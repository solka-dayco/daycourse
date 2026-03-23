-- ============================================================
-- 데이코스 db.js 기반 Supabase SQL 테스트 쿼리
-- Supabase 대시보드 > SQL Editor 에서 실행
-- 각 블록을 독립적으로 실행하세요 (블록 사이 -- ─── 구분선 기준)
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 0. 사전 확인: 테이블 존재 여부 및 컬럼 목록 전체 조회
-- ════════════════════════════════════════════════════════════

-- db.js가 접근하는 테이블 전체 목록 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'courses', 'course_places',
    'course_likes', 'bookmarks',
    'comments', 'comment_likes',
    'replies', 'reply_likes',
    'notifications', 'reports', 'event_logs'
  )
ORDER BY table_name;

-- ─────────────────────────────────────────────────────────────
-- users 컬럼 확인
-- getCurrentUser(), fetchUserById(), upsertUserProfile() 에서 사용
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- courses 컬럼 확인
-- fetchCourses(), fetchCourseById(), createCourse(), updateCourse() 에서 사용
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'courses'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- course_places 컬럼 확인
-- fetchCourseById(), createCourse(), updateCourse() 에서 사용
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'course_places'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- event_logs 컬럼 확인
-- logEvent() 에서 삽입: user_id, anonymous_id, event_name,
--   target_type, target_id, session_id, event_page(jsonb)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'event_logs'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- notifications 컬럼 확인
-- fetchNotifications(), upsert_notification RPC 에서 사용
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- reports 컬럼 확인
-- submitReport() 에서 삽입: reporter_user_id, target_type, target_id, reason
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reports'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- db.js가 호출하는 RPC 함수 전체 존재 여부 확인
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_user_stats',
    'search_courses',
    'autocomplete_search',
    'get_referenced_courses',
    'get_liked_courses',
    'get_bookmarked_courses',
    'increment_like_count',
    'decrement_like_count',
    'increment_comment_count',
    'decrement_comment_count',
    'increment_reference_count',
    'decrement_reference_count',
    'add_user_score',
    'upsert_notification',
    'mark_notifications_read'
  )
ORDER BY routine_name;


-- ════════════════════════════════════════════════════════════
-- 1. users 테이블 테스트
-- ════════════════════════════════════════════════════════════

-- [1-1] getCurrentUser() — users 테이블 전체 컬럼 select
--       실제로는 auth.uid() 기준이지만, 아무 행이나 꺼내서 컬럼 구조 확인
SELECT *
FROM public.users
LIMIT 1;

-- [1-2] fetchUserById() — user.html에서 공개 정보만 select
--       컬럼이 실제로 존재하는지 확인
SELECT id, nickname, user_score, level, created_at
FROM public.users
LIMIT 3;

-- [1-3] upsertUserProfile() — upsert에 사용되는 컬럼 직접 확인
--       gender CHECK 제약 확인 (male/female/other 이외 값 삽입 시 오류 여부)
SELECT id, username, nickname, gender, birth_year, region
FROM public.users
LIMIT 3;

-- [1-4] get_user_stats RPC — fetchUserStats() 에서 호출
--       실제 유저 ID가 없으면 임의 UUID로 테스트 (결과 0이면 정상)
SELECT * FROM public.get_user_stats('00000000-0000-0000-0000-000000000000');


-- ════════════════════════════════════════════════════════════
-- 2. courses 테이블 테스트
-- ════════════════════════════════════════════════════════════

-- [2-1] fetchCourses() 기본 — keyword 없을 때 실행되는 쿼리
--       is_deleted 컬럼 존재 + 정렬 확인
SELECT
  id, name, description, region_main, region_sub, total_time,
  like_count, comment_count, reference_count, thumbnail_url,
  author_id, author_nickname, created_at
FROM public.courses
WHERE is_deleted IS NOT TRUE
ORDER BY created_at DESC
LIMIT 20;

-- [2-2] fetchCourses() 인기순 정렬
SELECT id, name, like_count, comment_count, created_at
FROM public.courses
WHERE is_deleted IS NOT TRUE
ORDER BY like_count DESC, created_at DESC
LIMIT 10;

-- [2-3] fetchCourses() 참조순 정렬
SELECT id, name, reference_count, created_at
FROM public.courses
WHERE is_deleted IS NOT TRUE
ORDER BY reference_count DESC, created_at DESC
LIMIT 10;

-- [2-4] fetchCourses() 지역 필터 + 소요시간 필터
SELECT id, name, region_main, region_sub, total_time
FROM public.courses
WHERE is_deleted IS NOT TRUE
  AND region_main = '서울'
  AND total_time <= 180
ORDER BY created_at DESC
LIMIT 10;

-- [2-5] fetchCourseById() — course_places JOIN 포함
SELECT
  c.*,
  cp.id AS place_id,
  cp.order_index,
  cp.name AS place_name,
  cp.address,
  cp.lat, cp.lng,
  cp.category,
  cp.phone,
  cp.place_url,
  cp.comment,
  cp.stay_time,
  cp.travel_time,
  cp.photo_url
FROM public.courses c
LEFT JOIN public.course_places cp ON cp.course_id = c.id
WHERE is_deleted IS NOT TRUE
ORDER BY c.created_at DESC, cp.order_index ASC
LIMIT 30;

-- [2-6] fetchCoursesByUser() — onlyReferenced=false
--       parent_course_id 컬럼 존재 확인
SELECT
  id, name, region_main, region_sub, total_time,
  like_count, reference_count, thumbnail_url,
  author_id, author_nickname, created_at,
  parent_course_id
FROM public.courses
WHERE is_deleted = false
ORDER BY created_at DESC
LIMIT 10;

-- [2-7] fetchCoursesByUser() — onlyReferenced=true
--       parent_course_id IS NOT NULL 필터
SELECT id, name, parent_course_id
FROM public.courses
WHERE is_deleted = false
  AND parent_course_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;


-- ════════════════════════════════════════════════════════════
-- 3. search_courses RPC 테스트
-- fetchCourses() — keyword 있을 때 호출
-- ════════════════════════════════════════════════════════════

-- [3-1] 빈 키워드로 호출 (전체 조회와 동일하게 동작해야 함)
SELECT * FROM public.search_courses(
  p_keyword     := '',
  p_region_main := '',
  p_region_sub  := '',
  p_max_time    := 0,
  p_sort        := 'latest',
  p_offset      := 0,
  p_limit       := 5
);

-- [3-2] 키워드 검색 — 코스명/소개글/장소명/주소/한줄평 ILIKE 동작 확인
SELECT * FROM public.search_courses(
  p_keyword     := '서울',
  p_region_main := '',
  p_region_sub  := '',
  p_max_time    := 0,
  p_sort        := 'popular',
  p_offset      := 0,
  p_limit       := 5
);

-- [3-3] 반환 컬럼 확인 — total_count 포함 여부
--       id, name, description, region_main, region_sub, total_time,
--       like_count, comment_count, reference_count,
--       author_id, author_nickname, created_at,
--       thumbnail_url, total_count
SELECT * FROM public.search_courses(
  p_keyword     := '카페',
  p_region_main := '',
  p_region_sub  := '',
  p_max_time    := 0,
  p_sort        := 'latest',
  p_offset      := 0,
  p_limit       := 3
);

-- [3-4] 지역 + 소요시간 필터 조합
SELECT * FROM public.search_courses(
  p_keyword     := '',
  p_region_main := '서울',
  p_region_sub  := '강남',
  p_max_time    := 240,
  p_sort        := 'latest',
  p_offset      := 0,
  p_limit       := 5
);

-- [3-5] score 정렬 (popular) — like×2 + comment×3 + reference×4
SELECT * FROM public.search_courses(
  p_keyword     := '',
  p_region_main := '',
  p_region_sub  := '',
  p_max_time    := 0,
  p_sort        := 'popular',
  p_offset      := 0,
  p_limit       := 5
);


-- ════════════════════════════════════════════════════════════
-- 4. autocomplete_search RPC 테스트
-- autocompleteSearch() 에서 호출
-- ════════════════════════════════════════════════════════════

-- [4-1] 기본 동작 확인 — label, type 컬럼 반환 여부 확인
SELECT * FROM public.autocomplete_search(
  p_keyword := '서울',
  p_limit   := 5
);

-- [4-2] 장소명 매칭 확인
SELECT * FROM public.autocomplete_search(
  p_keyword := '카페',
  p_limit   := 5
);


-- ════════════════════════════════════════════════════════════
-- 5. 좋아요 관련 테이블 테스트
-- isCourseLiked(), toggleCourseLike()
-- ════════════════════════════════════════════════════════════

-- [5-1] course_likes 구조 확인
SELECT course_id, user_id
FROM public.course_likes
LIMIT 5;

-- [5-2] increment_like_count RPC — like_count +1
--       (실제 존재하는 course_id 필요, 없으면 영향 행 0으로 무해)
SELECT public.increment_like_count('00000000-0000-0000-0000-000000000000');

-- [5-3] decrement_like_count RPC — like_count -1 (최소 0 보장 여부 확인)
SELECT public.decrement_like_count('00000000-0000-0000-0000-000000000000');

-- [5-4] like_count 카운터 캐시 vs 실제 course_likes 수 일치 검사
--       불일치가 있으면 카운터 캐시 오염 의심
SELECT
  c.id,
  c.name,
  c.like_count AS cached_count,
  COUNT(cl.course_id) AS actual_count,
  c.like_count - COUNT(cl.course_id) AS diff
FROM public.courses c
LEFT JOIN public.course_likes cl ON cl.course_id = c.id
WHERE c.is_deleted IS NOT TRUE
GROUP BY c.id, c.name, c.like_count
HAVING c.like_count != COUNT(cl.course_id)
ORDER BY diff DESC
LIMIT 20;


-- ════════════════════════════════════════════════════════════
-- 6. 북마크 테이블 테스트
-- isBookmarked(), toggleBookmark(), fetchBookmarkedCourses()
-- ════════════════════════════════════════════════════════════

-- [6-1] bookmarks 구조 확인 — id, user_id, course_id, created_at
SELECT *
FROM public.bookmarks
LIMIT 5;

-- [6-2] get_bookmarked_courses RPC
SELECT * FROM public.get_bookmarked_courses(
  p_user_id := '00000000-0000-0000-0000-000000000000',
  p_limit   := 20,
  p_offset  := 0
);

-- [6-3] get_liked_courses RPC
SELECT * FROM public.get_liked_courses(
  p_user_id := '00000000-0000-0000-0000-000000000000',
  p_limit   := 20,
  p_offset  := 0
);


-- ════════════════════════════════════════════════════════════
-- 7. 댓글·답글 테이블 테스트
-- fetchComments(), addComment(), deleteComment(),
-- toggleCommentLike(), addReply(), deleteReply(), toggleReplyLike()
-- ════════════════════════════════════════════════════════════

-- [7-1] comments 구조 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'comments'
ORDER BY ordinal_position;

-- [7-2] fetchComments() 실제 join 구조 재현
--       comments + comment_likes(user_id) + replies + reply_likes(user_id)
SELECT
  c.id,
  c.course_id,
  c.author_id,
  c.nickname,
  c.content,
  c.created_at,
  COUNT(DISTINCT cl.user_id)  AS like_count,
  COUNT(DISTINCT r.id)        AS reply_count
FROM public.comments c
LEFT JOIN public.comment_likes cl ON cl.comment_id = c.id
LEFT JOIN public.replies r        ON r.comment_id = c.id
GROUP BY c.id, c.course_id, c.author_id, c.nickname, c.content, c.created_at
ORDER BY c.created_at DESC
LIMIT 10;

-- [7-3] replies 구조 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'replies'
ORDER BY ordinal_position;

-- [7-4] comment_count 카운터 캐시 vs 실제 댓글+답글 수 일치 검사
SELECT
  c.id,
  c.name,
  c.comment_count AS cached_count,
  (
    SELECT COUNT(*) FROM public.comments cm WHERE cm.course_id = c.id
  ) + (
    SELECT COUNT(*) FROM public.replies r
    JOIN public.comments cm2 ON cm2.id = r.comment_id
    WHERE cm2.course_id = c.id
  ) AS actual_count
FROM public.courses c
WHERE c.is_deleted IS NOT TRUE
ORDER BY c.created_at DESC
LIMIT 20;

-- [7-5] increment_comment_count / decrement_comment_count RPC 확인
SELECT public.increment_comment_count('00000000-0000-0000-0000-000000000000');
SELECT public.decrement_comment_count('00000000-0000-0000-0000-000000000000');


-- ════════════════════════════════════════════════════════════
-- 8. 알림 테이블 테스트
-- fetchNotifications(), markNotificationsRead(), upsert_notification RPC
-- ════════════════════════════════════════════════════════════

-- [8-1] notifications 전체 조회 (최신 10개)
SELECT
  id, actor_user_id, actor_nickname, target_user_id,
  type, course_id, course_name, comment_id,
  agg_count, is_read, created_at, updated_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;

-- [8-2] upsert_notification RPC — 존재하지 않는 UUID로 테스트
--       p_actor_user_id = p_target_user_id 이면 삽입 안 됨 (자기 자신 알림 차단)
SELECT public.upsert_notification(
  p_actor_user_id  := '00000000-0000-0000-0000-000000000001',
  p_actor_nickname := 'tester',
  p_target_user_id := '00000000-0000-0000-0000-000000000002',
  p_type           := 'course_like',
  p_course_id      := NULL,
  p_course_name    := 'test course',
  p_comment_id     := NULL
);

-- [8-3] mark_notifications_read RPC
SELECT public.mark_notifications_read('00000000-0000-0000-0000-000000000000');

-- [8-4] aggregation 동작 확인
--       동일 type+course_id+is_read=false 알림이 agg_count 증가하는지 확인
SELECT id, type, course_id, agg_count, is_read, updated_at
FROM public.notifications
WHERE target_user_id != actor_user_id
ORDER BY updated_at DESC
LIMIT 10;


-- ════════════════════════════════════════════════════════════
-- 9. 유저 점수 / 레벨 시스템 테스트
-- add_user_score RPC, update_user_level 트리거
-- ════════════════════════════════════════════════════════════

-- [9-1] add_user_score RPC 존재 확인 (존재하지 않는 UUID → 영향 행 0)
SELECT public.add_user_score(
  p_user_id := '00000000-0000-0000-0000-000000000000',
  p_delta   := 10
);

-- [9-2] user_score 최소값 0 보장 확인
--       음수 delta 적용 시 score가 0 미만으로 내려가지 않아야 함
SELECT public.add_user_score(
  p_user_id := '00000000-0000-0000-0000-000000000000',
  p_delta   := -9999
);

-- [9-3] 레벨 트리거 동작 확인
--       score 변경 후 level이 자동으로 바뀌는지 검증
--       (실제 유저 ID가 있을 때 동작, 없으면 조회만 가능)
SELECT id, nickname, user_score, level
FROM public.users
ORDER BY user_score DESC
LIMIT 10;

-- [9-4] 레벨 구간 정합성 검사
--       score 구간과 level 값이 트리거 정의와 일치하는지 확인
SELECT
  id, nickname, user_score, level,
  CASE
    WHEN user_score >= 200 THEN 5
    WHEN user_score >= 100 THEN 4
    WHEN user_score >= 40  THEN 3
    WHEN user_score >= 10  THEN 2
    ELSE 1
  END AS expected_level,
  level = CASE
    WHEN user_score >= 200 THEN 5
    WHEN user_score >= 100 THEN 4
    WHEN user_score >= 40  THEN 3
    WHEN user_score >= 10  THEN 2
    ELSE 1
  END AS is_correct
FROM public.users
WHERE level != CASE
  WHEN user_score >= 200 THEN 5
  WHEN user_score >= 100 THEN 4
  WHEN user_score >= 40  THEN 3
  WHEN user_score >= 10  THEN 2
  ELSE 1
END;
-- 결과가 0행이면 모든 유저의 레벨이 정확함


-- ════════════════════════════════════════════════════════════
-- 10. 참조 코스 시스템 테스트
-- createReferenceCourse(), onCourseDeleted(),
-- get_referenced_courses RPC
-- increment/decrement_reference_count RPC
-- ════════════════════════════════════════════════════════════

-- [10-1] get_referenced_courses RPC
SELECT * FROM public.get_referenced_courses(
  p_course_id := '00000000-0000-0000-0000-000000000000'
);

-- [10-2] increment_reference_count RPC
SELECT public.increment_reference_count('00000000-0000-0000-0000-000000000000');

-- [10-3] decrement_reference_count RPC
SELECT public.decrement_reference_count('00000000-0000-0000-0000-000000000000');

-- [10-4] reference_count 카운터 캐시 vs 실제 참조 수 일치 검사
SELECT
  c.id,
  c.name,
  c.reference_count AS cached_count,
  COUNT(ref.id)     AS actual_count,
  c.reference_count - COUNT(ref.id) AS diff
FROM public.courses c
LEFT JOIN public.courses ref ON ref.parent_course_id = c.id
  AND ref.is_deleted = false
WHERE c.is_deleted IS NOT TRUE
GROUP BY c.id, c.name, c.reference_count
HAVING c.reference_count != COUNT(ref.id)
ORDER BY ABS(c.reference_count - COUNT(ref.id)) DESC
LIMIT 20;
-- 결과가 0행이면 모든 카운터 캐시가 정확함


-- ════════════════════════════════════════════════════════════
-- 11. 신고 테이블 테스트
-- submitReport()
-- ════════════════════════════════════════════════════════════

-- [11-1] reports 구조 및 데이터 확인
SELECT
  id, reporter_user_id, target_type, target_id, reason, status, created_at
FROM public.reports
ORDER BY created_at DESC
LIMIT 10;

-- [11-2] target_type CHECK 제약 확인
--        'course' / 'comment' 만 허용되는지 확인
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name LIKE '%reports%';

-- [11-3] 중복 신고 방지 로직 재현
--        submitReport()에서 먼저 existing 조회 후 insert
SELECT id
FROM public.reports
WHERE reporter_user_id = '00000000-0000-0000-0000-000000000000'
  AND target_type      = 'course'
  AND target_id        = '00000000-0000-0000-0000-000000000000'
LIMIT 1;


-- ════════════════════════════════════════════════════════════
-- 12. 행동 로그 테이블 테스트
-- logEvent()
-- ════════════════════════════════════════════════════════════

-- [12-1] event_logs 최신 10행 확인
SELECT
  id, user_id, anonymous_id, event_name,
  target_type, target_id, session_id,
  event_page, created_at
FROM public.event_logs
ORDER BY created_at DESC
LIMIT 10;

-- [12-2] logEvent() 삽입 컬럼 구조 테스트
--        NULL user_id (비로그인) 허용 여부 확인
INSERT INTO public.event_logs (
  user_id, anonymous_id, event_name,
  target_type, target_id, session_id, event_page
) VALUES (
  NULL,
  'test-anon-id',
  'page_view',
  'page',
  NULL,
  'test-session-id',
  '{"page": "feed"}'::jsonb
);

-- 삽입 확인
SELECT * FROM public.event_logs
WHERE anonymous_id = 'test-anon-id'
ORDER BY created_at DESC
LIMIT 1;

-- 테스트 데이터 정리
DELETE FROM public.event_logs WHERE anonymous_id = 'test-anon-id';

-- [12-3] event_page jsonb 필드 쿼리 확인
--        metadata가 정상적으로 jsonb로 저장되었는지 확인
SELECT
  event_name,
  event_page->>'page' AS page,
  event_page->>'keyword' AS keyword,
  created_at
FROM public.event_logs
WHERE event_page ? 'page'
ORDER BY created_at DESC
LIMIT 10;

-- [12-4] 이벤트별 집계 (어드민 Dashboard에서 사용)
SELECT
  event_name,
  COUNT(*) AS cnt,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT anonymous_id) AS unique_anon,
  COUNT(DISTINCT session_id) AS sessions
FROM public.event_logs
GROUP BY event_name
ORDER BY cnt DESC;

-- [12-5] DAU 계산 (오늘)
SELECT
  COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) AS dau
FROM public.event_logs
WHERE created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day';

-- [12-6] 퍼널 분석: course_create_start → place_add → course_create_complete
SELECT
  event_name,
  COUNT(DISTINCT session_id) AS sessions
FROM public.event_logs
WHERE event_name IN (
  'course_create_start',
  'place_add',
  'course_create_complete'
)
GROUP BY event_name
ORDER BY sessions DESC;


-- ════════════════════════════════════════════════════════════
-- 13. RLS 정책 확인
-- ════════════════════════════════════════════════════════════

-- db.js가 접근하는 테이블 전체 RLS 정책 목록
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'courses', 'course_places',
    'course_likes', 'bookmarks',
    'comments', 'comment_likes',
    'replies', 'reply_likes',
    'notifications', 'reports', 'event_logs'
  )
ORDER BY tablename, cmd;

-- event_logs INSERT: 비로그인(누구나) 허용 여부 확인
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'event_logs' AND cmd = 'INSERT';

-- bookmarks SELECT: 본인만 조회 가능한지 확인
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'bookmarks';


-- ════════════════════════════════════════════════════════════
-- 14. 인덱스 존재 확인
-- ════════════════════════════════════════════════════════════

SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'courses', 'course_places', 'course_likes',
    'bookmarks', 'notifications', 'event_logs', 'reports'
  )
ORDER BY tablename, indexname;


-- ════════════════════════════════════════════════════════════
-- 15. 카운터 캐시 전체 재동기화 (불일치 발견 시 실행)
-- ════════════════════════════════════════════════════════════

-- ⚠️ 주의: 아래 쿼리는 실제 데이터를 UPDATE합니다.
--    카운터 불일치 확인(섹션 5-4, 7-4, 10-4) 후에만 실행하세요.

-- like_count 재동기화
/*
UPDATE public.courses c
SET like_count = (
  SELECT COUNT(*) FROM public.course_likes cl WHERE cl.course_id = c.id
)
WHERE is_deleted IS NOT TRUE;
*/

-- comment_count 재동기화 (댓글 + 답글 합산)
/*
UPDATE public.courses c
SET comment_count = (
  SELECT COUNT(*) FROM public.comments cm WHERE cm.course_id = c.id
) + (
  SELECT COUNT(*) FROM public.replies r
  JOIN public.comments cm2 ON cm2.id = r.comment_id
  WHERE cm2.course_id = c.id
)
WHERE is_deleted IS NOT TRUE;
*/

-- reference_count 재동기화
/*
UPDATE public.courses c
SET reference_count = (
  SELECT COUNT(*) FROM public.courses ref
  WHERE ref.parent_course_id = c.id AND ref.is_deleted = false
)
WHERE is_deleted IS NOT TRUE;
*/
