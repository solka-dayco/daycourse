<DB 스키마 & 쿼리 규칙>

<적용 시점>
DB 컬럼 추가/수정, RPC 함수 작성, SQL 쿼리 작성, RLS 정책 수정 시 반드시 참고.

<규칙>
- 컬럼 추가 시 항상 IF NOT EXISTS 사용
- RPC 함수는 SECURITY DEFINER + CREATE OR REPLACE 사용
- 카운터 캐시(like_count 등)는 직접 UPDATE 금지 → RPC 함수 경유
- service_role 키는 클라이언트에 절대 노출 금지
- Supabase 무료 플랜: DB 500MB, Storage 1GB, 1주일 미활동 시 자동 중지

---

## 테이블 목록

### users
```
id uuid PK | username text | nickname text | gender text
birth_year int | age int | region text | user_xp int (default 0)
level int | bio text | profile_image_url text
unread_notification_count int | role text ('user'|'admin') | created_at timestamptz
```

### courses
```
id uuid PK | name text | description text | region_main text | region_sub text
total_time int(분) | like_count int | comment_count int | reference_count int | view_count int
thumbnail_url text | author_id uuid FK→users | author_nickname text
parent_course_id uuid | original_course_id uuid
is_plan boolean | is_deleted boolean | created_at timestamptz
```

### course_places
```
id uuid PK | course_id uuid FK→courses | order_index int
name text | address text | lat numeric | lng numeric
category text | phone text | place_url text | comment text
stay_time int(선택) | travel_time int(선택) | transport text(선택) | photo_url text
```

### follows
```
follower_id uuid FK→users | following_id uuid FK→users
created_at timestamptz | PK(follower_id, following_id) | CHECK(follower≠following)
```

### 기타 테이블
- `course_likes` — course_id + user_id (unique)
- `bookmarks` — user_id + course_id (unique)
- `comments` / `comment_likes`
- `replies` / `reply_likes`
- `notifications` — aggregation, is_read, agg_count
- `reports` — target_type(course/comment), status(pending/resolved)
- `event_logs` — user_id(nullable), anonymous_id, session_id, event_name, metadata(jsonb), referrer, current_url, utm_source, utm_medium, utm_campaign

---

## RPC 함수 목록

| 함수 | 설명 |
|------|------|
| `search_courses(...)` | 키워드+지역+시간+정렬 복합 검색 |
| `autocomplete_search(p_keyword, p_limit)` | 자동완성 |
| `get_user_stats(p_user_id)` | 유저 통계 (follower/following 포함) |
| `get_followers(p_user_id)` | 팔로워 목록 |
| `get_followings(p_user_id)` | 팔로잉 목록 |
| `search_users_for_mention(p_keyword, p_current_user_id)` | @mention 검색 |
| `get_referenced_courses(p_course_id)` | 참조한 코스 목록 |
| `get_liked_courses / get_bookmarked_courses` | 좋아요·북마크 코스 |
| `add_user_xp(p_user_id, p_delta)` | XP 증감 |
| `add_user_xp_capped(p_user_id, p_delta, p_daily_max)` | 일일 한도 XP |
| `calculate_level(p_xp)` | XP → 레벨 |
| `increment_view_count(p_course_id)` | 조회수 증가 |
| `increment/decrement_like_count` | 좋아요 캐시 |
| `increment/decrement_comment_count` | 댓글 캐시 |
| `increment/decrement_reference_count` | 참조 캐시 |
| `upsert_notification(...)` | 알림 생성·집계 |
| `mark_notifications_read(p_user_id)` | 알림 일괄 읽음 |

---

## RLS 정책 요약

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| courses | 누구나 | user | 작성자+admin | 작성자+admin |
| course_places | 누구나 | 코스 작성자 | 코스 작성자 | 코스 작성자 |
| follows | 누구나 | 본인 | ❌ | 본인 |
| course_likes | 누구나 | user(본인) | ❌ | user(본인) |
| bookmarks | 본인 | user(본인) | ❌ | user(본인) |
| comments/replies | 누구나 | user | admin | 작성자+admin |
| event_logs | admin | 누구나(1분 100건 rate limit) | ❌ | admin |
| users | 누구나(공개필드) | Supabase Auth | 본인+admin | ❌ |

---

## 카운터 캐시 정합성 점검 쿼리 (월 1회)
```sql
SELECT c.id, c.name, c.like_count AS cached, count(cl.user_id) AS actual
FROM public.courses c
LEFT JOIN public.course_likes cl ON cl.course_id = c.id
GROUP BY c.id, c.name, c.like_count
HAVING c.like_count <> count(cl.user_id);
```
