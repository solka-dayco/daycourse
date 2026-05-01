<데이터 분석 규칙>

<적용 시점>
퍼널 분석, 리텐션 분석, 행동 로그 조회, 이벤트 설계, 어드민 Logs 탭 작업 시 반드시 참고.

<분석 목표>
1. 퍼널 분석 — 피드 진입 → 코스 상세 → 좋아요/북마크/참조 → 코스 생성 전환율
2. 리텐션 분석 — 재방문율, 세션 간격, 이탈 시점 파악
3. 행동 로그 분석 — 클릭 패턴, 검색어, 필터 사용 현황 → UX 개선
4. 유입 경로 분석 — referrer, utm 파라미터 기반 채널별 효과 측정

---

## event_logs 테이블 구조

```
user_id        uuid (nullable, 비로그인 시 null)
anonymous_id   text (localStorage dc_anon_id, 기기 고유)
session_id     text (세션 단위 구분)
event_name     text
target_type    text ('course'|'user'|'comment' 등)
target_id      text
metadata       jsonb
referrer       text
current_url    text
utm_source     text
utm_medium     text
utm_campaign   text
created_at     timestamptz
```

### 수집 제외 조건
- `localStorage.dc_is_dev === 'true'` 인 기기는 로그 수집 안 함 (개발자 기기 제외)
- localhost 접속 데이터 삭제 쿼리: `DELETE FROM event_logs WHERE current_url LIKE '%localhost%'`

---

## 이벤트 목록

### 피드 (main.js)
`page_view`, `page_restore`, `search`, `search_clear`, `autocomplete_select`,
`filter_change`, `sort_change`, `filter_reset`, `feed_refresh`, `course_view`,
`author_click`, `comment_cta_click`, `like_click`, `like_cancel`, `login_required_click`

### 코스 상세 (course.js)
`course_view`, `author_click`, `original_course_click`, `course_edit_click`,
`course_delete_confirm`, `course_reference`, `report_open`, `report_submit`,
`like_click`, `like_cancel`, `bookmark_add`, `bookmark_remove`,
`carousel_open`, `carousel_nav`, `carousel_swipe`, `timeline_photo_jump`,
`viewer_nav`, `place_link_click`, `map_my_location`, `referenced_course_click`,
`comment_sort_change`, `comment_create`, `comment_delete`, `comment_like`,
`reply_input_open`, `reply_create`, `reply_delete`, `reply_like`,
`share_click`, `share_copy_link`, `share_kakao`, `comment_cta_click`, `login_required_click`

### 코스 만들기 (create.js)
`course_create_start`, `place_add`, `course_create_complete`, `course_edit`, `course_reference`

---

## 조회수(view_count) 집계 규칙
- 코스 상세 페이지 진입 후 **10초 체류** 시 카운트
- `localStorage dc_view_{courseId}` 기준 **7일 이내 재방문은 미카운트**
- event_logs 기반 view_count 재계산 쿼리:
```sql
UPDATE public.courses c
SET view_count = COALESCE(v.cnt, 0)
FROM (
  SELECT target_id AS course_id,
         COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) AS cnt
  FROM public.event_logs
  WHERE event_name = 'course_view'
    AND target_type = 'course'
    AND target_id IS NOT NULL
    AND (current_url NOT LIKE '%localhost%' OR current_url IS NULL)
  GROUP BY target_id
) v
WHERE c.id = v.course_id::uuid;
```

---

## 분석 시 주의사항
- `course_view` 이벤트는 페이지 진입 즉시 기록 → 실제 view_count(10초 체류)보다 수치가 높음
- anonymous_id 기준 중복 제거 권장 (user_id 없는 비로그인 포함)
- utm 파라미터는 v4.36부터 수집, 이전 데이터는 null
