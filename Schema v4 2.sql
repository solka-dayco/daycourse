-- =====================================================
-- 데이코스 schema_v4_2.sql
-- 적용 순서: schema.sql → schema_v3_additions.sql → 이 파일
-- 멱등성 보장: 이미 실행해도 오류 없음
-- 갱신: 2026.03.26
-- =====================================================

-- ══════════════════════════════════════════════════════
-- SECTION 1. users 테이블 컬럼 정리
-- ══════════════════════════════════════════════════════

-- R4: user_xp 컬럼 추가 (기존 user_score와 별도 관리)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_xp integer NOT NULL DEFAULT 0;

-- is_plan / is_deleted 컬럼 (courses 테이블, v4에서 누락된 경우 대비)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_plan    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- users: bio (소개글) 컬럼 추가 (R5 프로필 개선)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio text;

-- users: profile_image_url 컬럼 추가 (R3 프로필 이미지)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_image_url text;

-- ══════════════════════════════════════════════════════
-- SECTION 2. 구 레벨 트리거 제거 (5단계 → 50단계 교체)
-- ══════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_user_score_update ON public.users;
DROP FUNCTION IF EXISTS public.update_user_level();

-- ══════════════════════════════════════════════════════
-- SECTION 3. R4 XP 시스템 (R4_xp_migration.sql 통합)
-- ══════════════════════════════════════════════════════

-- 레벨 계산 함수 (XP → 레벨, 1~50)
CREATE OR REPLACE FUNCTION public.calculate_level(xp integer)
RETURNS integer AS $$
DECLARE
  thresholds integer[] := ARRAY[
    0,1000,2000,3000,4000,5000,6250,7500,8750,10000,
    13500,17000,20500,24000,27500,31250,35000,38750,42500,46250,
    51250,56250,61250,66250,71250,77500,83750,90000,96250,102500,
    113000,123500,134000,144500,155000,167000,179000,191000,203000,215000,
    239000,263000,287000,311000,335000,361000,387000,413000,439000,465000,
    999999999
  ];
  i integer;
BEGIN
  FOR i IN 1..50 LOOP
    IF xp < thresholds[i + 1] THEN RETURN i; END IF;
  END LOOP;
  RETURN 50;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- XP 부여 RPC (레벨 자동 동기화 포함)
CREATE OR REPLACE FUNCTION public.add_user_xp(p_user_id uuid, p_delta integer)
RETURNS void AS $$
DECLARE
  new_xp   integer;
  new_level integer;
BEGIN
  UPDATE public.users
  SET user_xp = GREATEST(0, user_xp + p_delta)
  WHERE id = p_user_id
  RETURNING user_xp INTO new_xp;

  new_level := public.calculate_level(new_xp);

  UPDATE public.users SET level = new_level WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 일일 cap XP 부여 (북마크·공유 등 소극적 활동)
CREATE OR REPLACE FUNCTION public.add_user_xp_capped(
  p_user_id  uuid,
  p_delta    integer,
  p_action   text,
  p_daily_cap integer
)
RETURNS void AS $$
DECLARE
  today_count integer;
BEGIN
  SELECT COUNT(*) INTO today_count
  FROM public.event_logs
  WHERE user_id   = p_user_id
    AND event_name = p_action
    AND created_at >= CURRENT_DATE;

  IF today_count < p_daily_cap THEN
    PERFORM public.add_user_xp(p_user_id, p_delta);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 user_score 기반 add_user_score는 하위 호환용으로 유지
-- (course.js의 일부 경로에서 아직 참조할 수 있으므로)
CREATE OR REPLACE FUNCTION public.add_user_score(p_user_id uuid, p_delta integer)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.users
  SET user_score = GREATEST(user_score + p_delta, 0)
  WHERE id = p_user_id;
$$;

-- ══════════════════════════════════════════════════════
-- SECTION 4. follows 테이블 (R5 팔로우)
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows(following_id);

-- RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'follows_select_all'
  ) THEN
    CREATE POLICY "follows_select_all"   ON public.follows FOR SELECT USING (true);
    CREATE POLICY "follows_insert_own"   ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
    CREATE POLICY "follows_delete_own"   ON public.follows FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════
-- SECTION 5. notifications: mention 타입 지원
-- ══════════════════════════════════════════════════════

-- upsert_notification의 type CHECK 제약이 있으면 comment_mention 추가 필요
-- notifications 테이블에 type 컬럼 CHECK 없으므로 별도 작업 불필요
-- (upsert_notification RPC가 'comment_mention' 타입을 그대로 insert함)

-- ══════════════════════════════════════════════════════
-- SECTION 6. 팔로우 통계 RPC
-- ══════════════════════════════════════════════════════

-- 팔로워/팔로잉 수 조회
DROP FUNCTION IF EXISTS public.get_follow_stats(uuid);
CREATE OR REPLACE FUNCTION public.get_follow_stats(p_user_id uuid)
RETURNS TABLE (follower_count bigint, following_count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    (SELECT COUNT(*) FROM public.follows WHERE following_id = p_user_id) AS follower_count,
    (SELECT COUNT(*) FROM public.follows WHERE follower_id  = p_user_id) AS following_count;
$$;

-- ══════════════════════════════════════════════════════
-- SECTION 7. @mention 자동완성 RPC
-- ══════════════════════════════════════════════════════

-- 닉네임 검색: 팔로우 유저 우선, 부분 일치 포함
DROP FUNCTION IF EXISTS public.search_users_for_mention(uuid, text, integer);
CREATE OR REPLACE FUNCTION public.search_users_for_mention(
  p_actor_id uuid,
  p_keyword  text,
  p_limit    integer DEFAULT 5
)
RETURNS TABLE (user_id uuid, nickname text, is_following boolean)
LANGUAGE sql SECURITY DEFINER AS $$
  (
    -- 팔로우 유저 우선
    SELECT u.id, u.nickname, true AS is_following
    FROM public.users u
    JOIN public.follows f ON f.following_id = u.id AND f.follower_id = p_actor_id
    WHERE lower(u.nickname) LIKE '%' || lower(p_keyword) || '%'
    LIMIT p_limit
  )
  UNION
  (
    -- 나머지 유저
    SELECT u.id, u.nickname, false AS is_following
    FROM public.users u
    WHERE lower(u.nickname) LIKE '%' || lower(p_keyword) || '%'
      AND u.id <> p_actor_id
      AND NOT EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = p_actor_id AND f.following_id = u.id
      )
    LIMIT p_limit
  )
  LIMIT p_limit;
$$;

-- ══════════════════════════════════════════════════════
-- SECTION 8. get_user_stats 팔로우 수 포함으로 재정의
-- ══════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_user_stats(uuid);
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS TABLE (
  course_count     bigint,
  total_likes      bigint,
  total_references bigint,
  follower_count   bigint,
  following_count  bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COUNT(*)                           AS course_count,
    COALESCE(SUM(like_count), 0)       AS total_likes,
    COALESCE(SUM(reference_count), 0)  AS total_references,
    (SELECT COUNT(*) FROM public.follows WHERE following_id = p_user_id) AS follower_count,
    (SELECT COUNT(*) FROM public.follows WHERE follower_id  = p_user_id) AS following_count
  FROM public.courses
  WHERE author_id = p_user_id
    AND is_deleted = false
    AND is_plan    = false;
$$;

-- ══════════════════════════════════════════════════════
-- SECTION 9. 완료 안내
-- ══════════════════════════════════════════════════════
-- 적용 후 확인 쿼리:
-- SELECT id, nickname, user_xp, level, bio, profile_image_url FROM public.users LIMIT 5;
-- SELECT * FROM public.follows LIMIT 5;