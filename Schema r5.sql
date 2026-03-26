-- =====================================================
-- 데이코스 schema_R5.sql — R5 커뮤니티 기능
-- 적용 조건: schema_v3_additions.sql + R4_xp_migration.sql 적용 완료 후 실행
-- 멱등성 보장
-- 갱신: 2026.03.26
-- =====================================================

-- ── 1. users 컬럼 추가 ───────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio               text,
  ADD COLUMN IF NOT EXISTS profile_image_url text;

-- ── 2. follows 테이블 ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'follows_select_all'
  ) THEN
    CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);
    CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
    CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END $$;

-- ── 3. get_user_stats 재정의 (팔로워/팔로잉 추가) ───
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
    COUNT(*)                          AS course_count,
    COALESCE(SUM(like_count), 0)      AS total_likes,
    COALESCE(SUM(reference_count), 0) AS total_references,
    (SELECT COUNT(*) FROM public.follows WHERE following_id = p_user_id) AS follower_count,
    (SELECT COUNT(*) FROM public.follows WHERE follower_id  = p_user_id) AS following_count
  FROM public.courses
  WHERE author_id  = p_user_id
    AND is_deleted = false
    AND is_plan    = false;
$$;

-- ── 4. @mention 자동완성 RPC ─────────────────────────
DROP FUNCTION IF EXISTS public.search_users_for_mention(uuid, text, integer);
CREATE OR REPLACE FUNCTION public.search_users_for_mention(
  p_actor_id uuid,
  p_keyword  text,
  p_limit    integer DEFAULT 5
)
RETURNS TABLE (user_id uuid, nickname text, is_following boolean)
LANGUAGE sql SECURITY DEFINER AS $$
  (
    SELECT u.id, u.nickname, true AS is_following
    FROM public.users u
    JOIN public.follows f ON f.following_id = u.id AND f.follower_id = p_actor_id
    WHERE lower(u.nickname) LIKE '%' || lower(p_keyword) || '%'
    LIMIT p_limit
  )
  UNION
  (
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