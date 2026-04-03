# 데이코스 (DayCourse) — 설정 & 배포 가이드 v4.35

> **배포 도메인**: https://daycourse.kr (Vercel)
> **저장소**: https://github.com/solka-dayco/daycourse
> **최종 갱신**: 2026.04.03 (v4.35 — 지도 검색 개선, 임시저장 로직 개편)

---

## 1. 빠른 시작 체크리스트

### 1-1. Supabase 프로젝트 생성

1. https://supabase.com → New project 생성
2. **SQL Editor**에서 아래 순서대로 실행:
```
   1) schema.sql               ← 기본 테이블 + RLS + 기본 RPC
   2) schema_v3_additions.sql  ← v3/v4 신규 테이블·컬럼·RPC (멱등성 보장)
   3) schema_R5.sql            ← v4.2 follows, bio, profile_image_url, XP/레벨 RPC [v4.2]
   4) schema_R6_security.sql   ← v4.32 event_logs rate limit RLS, Storage 정책 [v4.32]
   5) ALTER TABLE public.course_places ADD COLUMN IF NOT EXISTS transport text;  ← [v4.34]
```
3. **Storage** → New bucket: `course-photos` (Public ON)
4. **Storage** → Policies → `course-photos` 버킷에 업로드 제한 정책 추가 [v4.32]
5. **Authentication** → Password Settings → 최소 8자 설정 [v4.32]
6. (선택) **Authentication** → Providers → Kakao 활성화

### 1-2. config.js 수정

> ⚠️ `config.js`는 `.gitignore`에 포함됨. 저장소에 커밋하지 말 것. [v4.32]
> `config.example.js`를 복사해 `config.js`로 생성 후 값 입력.
```js
export const SUPABASE_URL      = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
export const KAKAO_APP_KEY     = 'YOUR_KAKAO_APP_KEY';
export const STORAGE_BUCKET    = 'course-photos';
```

Vercel 배포 시 환경변수로 주입 (Vercel Dashboard → Settings → Environment Variables).

### 1-3. 로컬 실행
```bash
python server.py
# 브라우저 자동 실행: http://localhost:8080
```

> `server.py`는 `.html` 없는 URL을 자동 처리해 배포 환경과 동일하게 로컬 테스트 가능.
> ⚠️ Supabase 무료 플랜은 **1주일 미활동 시 자동 중지**됩니다.

---

## 2. 파일 구조
```
daycourse/
│
├── index.html              # 피드 (비로그인 열람 가능)
├── style.css               # 공통 스타일
│
├── course.html / .css / .js    # 코스 상세 [v4.34: 워터마크, 이동수단 아이콘]
├── create.html / .css / .js    # 코스 만들기 (plan 모드 분기 포함) [v4.34: 이동수단 태그] [v4.35: 지도 검색 개선, 임시저장 개편]
├── plan.html / .css / .js      # 코스 계획 목록 [v4.2 신규]
├── plan-detail.html / .css / .js # 코스 계획 상세 [v4.2 신규]
│
├── login.html / .js            # 로그인 + 회원가입 [v4.32: 비밀번호 정책 검증 추가]
├── signup.html                 # → /login#signup 리다이렉트
├── nickname.html / .js         # 프로필 설정 (가입 직후)
├── find.html / .js             # 아이디·비밀번호 찾기
├── auth.css                    # 인증 페이지 공통 스타일
│
├── user.html / .css / .js      # 공개 유저 페이지 [v4.2: 팔로우, 소개글, 레벨]
├── profile.html / .css / .js   # 마이페이지 [v4.2: XP바, 프로필 편집 바텀시트, 계획 탭] [v4.32: 비밀번호 정책 검증 추가]
├── bookmarks.html / .js        # 북마크 목록
├── notifications.html / .js    # 알림 목록 [v4.2: follow 알림 타입 추가]
│
├── privacy.html                # 개인정보처리방침
│
├── utils.js        # 공통 유틸 [v4.32 신규: sanitize() XSS 방어]
├── sidebar.js      # 공통 사이드바 [v4.2: 프로필 아이콘 동적 주입, red dot, 드롭다운]
├── icons.js        # SVG 아이콘 초기화 [v4.34: walk/bus/car 아이콘 추가]
├── map.js          # 카카오맵 유틸 [v4.33: 마커 모바일 터치 지원] [v4.35: searchAddress 추가]
├── photo.js        # 크롭/블러/WebP [v4.2: 전면 재작성 v7] [v4.32: 업로드 전 크기·MIME 검증] [v4.33: 되돌리기, 모바일 블러 개선]
├── app.js          # 비로그인 체크 진입점
│
├── server.py       # 로컬 개발 서버 [v4.33 신규: .html 없는 URL 처리, 자동 브라우저 실행]
│
├── db.js           # DB/Storage 추상화 [v4.2: XP, 팔로우, 계획 코스 함수 추가]
├── supabase.js     # Supabase 클라이언트
├── config.js       # 환경 변수 [v4.32: .gitignore 추가, Vercel 환경변수로 이전]
├── config.example.js  # 환경 변수 템플릿 [v4.32 신규]
│
├── schema.sql
├── schema_v3_additions.sql
├── schema_R5.sql               # [v4.2 신규] follows, bio, profile_image_url, XP RPC
├── schema_R6_security.sql      # [v4.32 신규] event_logs rate limit RLS, Storage 정책
│
├── .gitignore                  # [v4.32: config.js 추가]
├── sitemap.xml / robots.txt / CNAME
├── vercel.json     # [v4.2: /plan, /plan-detail 라우팅 추가]
│
├── api/
│   ├── og.js       # OG 미리보기 Edge Function
│   └── sitemap.js  # 동적 sitemap Edge Function
│
└── admin/          # 어드민 패널 (admin.html + 서브 모듈)
```

---

## 3. 버전별 변경 사항 요약

### v4.1 (2026.03.23) — 리팩토링

| 항목 | 내용 |
|------|------|
| URL 구조 | `.html` 제거, 301 리다이렉트, `vercel.json` 신규 |
| 드래프트 | `DraftManager` 클래스, 바텀시트 복구 UI, 스냅샷 dirty 판별 |
| OG 미리보기 | `api/og.js` Vercel Edge Function, 카카오톡 공유 썸네일 정상 표시 |
| RLS 점검 | 중복 정책 3건 제거, `reports` INSERT 강화 |

### v4.2 (2026.03.27) — 기능 확장

| 항목 | 내용 |
|------|------|
| **코스 제작 UX** | 체류/이동시간 선택으로 전환, 세부사항 토글, 드럼롤 피커, 칩 모달 |
| **코스 계획** | `is_plan` 컬럼, plan/plan-detail 페이지 신규, 사이드바 메뉴, "계획 담기" |
| **이미지 처리** | letterbox 크롭, 블러 기능(타원형 드래그+Stack Blur), 사진 재편집, 원본 보존 |
| **레벨/XP** | LV1~50, 칭호 6단계, `user_xp` 컬럼, pg_cron 30초 갱신, XP 바 UI |
| **커뮤니티** | `follows` 테이블, 팔로우/언팔로우, @mention 자동완성, 프로필 편집 바텀시트, 알림 red dot |
| **버그픽스** | 피드 거리순 정렬(GPS+Haversine), 지하철역 검색 상단 노출 |

### v4.31 (2026.03.27) — 팔로잉 피드

| 항목 | 내용 |
|------|------|
| **피드 탭** | 전체 / 팔로잉 탭 분리, 비로그인 시 탭 숨김 |
| **팔로잉 탭 정책** | 팔로잉 코스 최신순 우선 → 소진 후 전체 최신순 혼합 노출 |
| **신규 함수** | `fetchFollowingCourses` (db.js) |
| **변경 파일** | index.html, main.css, main.js, db.js |

### v4.32 (2026.03.30) — 보안 강화

| 항목 | 내용 |
|------|------|
| **XSS 방어** | `utils.js` `sanitize()` 함수 추가. `innerHTML` 전수 점검 → `textContent` / sanitize 적용. `createMentionDropdown` 최우선 적용 |
| **config.js 분리** | `.gitignore` 추가, `config.example.js` 생성, Vercel 환경변수로 이전, anon key Rotation |
| **event_logs RLS** | `rate_limit_event_logs` 정책 — `anonymous_id` 기준 1분 100건 초과 시 INSERT 차단 |
| **Storage 업로드 제한** | `course-photos` 버킷 — 5MB 이하, `image/jpeg` · `image/webp` · `image/png`만 허용. `photo.js` 클라이언트 이중 검증 |
| **비밀번호 정책** | Supabase 최소 8자 설정. `login.js` · `profile.js`에 `validatePassword()` 추가 (8자 이상, 영문+숫자 필수). 기존 계정 소급 미적용 |
| **변경 파일** | `utils.js`(신규), `login.js`, `profile.js`, `photo.js`, `config.js`, `.gitignore`, `config.example.js`, `schema_R6_security.sql`(신규) |

### v4.33 (2026.03.30) — 버그픽스 및 UX 개선

| 항목 | 내용 |
|------|------|
| **한줄평 줄바꿈** | `course.js` 타임라인 한줄평 `<hr>` → `<br/>` 교체 |
| **로컬 개발 서버** | `server.py` 추가 — `.html` 없는 URL 처리, 자동 브라우저 실행 |
| **마커 모바일 지원** | `map.js` '코스에 추가' `touchstart`/`touchend` 추가, `tap` 이벤트 추가 |
| **지도 포커스 해제** | 지도 클릭 시 한줄평 입력 포커스 자동 해제 |
| **사진 시스템 개편** | 사진 편집 → 새 사진 교체 방식으로 변경. `confirm` 중복 버그 수정. `has-photo` CSS 클래스 추가 |
| **되돌리기 기능** | `photo.js` 최대 20단계 히스토리. 드래그/줌/블러 조작 모두 적용 |
| **모바일 블러 개선** | 타원 이동·핸들 조절·삭제·복사에 `touchmove`/`touchend` 직접 추가 |
| **사진 변경 히스토리 초기화** | 사진 변경 시 `cropHistory = []` 초기화 |
| **변경 파일** | `course.js`, `create.js`, `create.css`, `map.js`, `photo.js`, `server.py`(신규) |

### v4.34 (2026.03.31) — 사진 도용 대응 및 이동수단 태그

| 항목 | 내용 |
|------|------|
| **사진 도용 대응** | 캐러셀·뷰어 이미지 우클릭/드래그 방지. 워터마크 오버레이 — 중앙 `@코스작성자닉네임`, 우측 하단 `데이코스` (낮은 opacity, CSS 방식) |
| **이동수단 태그** | `course_places.transport` 컬럼 추가. create 세부사항 모드에서 도보/대중교통/자차 아이콘 버튼 선택 UI. course 타임라인 이동시간 옆 아이콘 표시. 임시저장/수정/복사 모드 transport 필드 유지 |
| **캐러셀 한줄평** | `white-space: pre-wrap` 적용으로 띄어쓰기 반영 |
| **구글 색인** | 동적 sitemap 정상 동작 확인. 코스 9건 수동 색인 생성 요청 완료 |
| **변경 파일** | `course.js`, `course.css`, `course.html`, `create.js`, `create.css`, `icons.js` |

### v4.35 (2026.04.03) — 지도 검색 개선 및 임시저장 로직 개편

| 항목 | 내용 |
|------|------|
| **키워드 정렬** | 정확일치→시작일치→포함→지하철역 우선. 동일 score 내 거리 보조 정렬 |
| **주소 검색** | 키워드 입력 시 Geocoder 병렬 실행. [주소] 항목 클릭 → 위치 마커 + 직접 입력 폼 |
| **지도 이동** | 엔터/검색버튼 시에만 첫 번째 결과로 지도 이동 |
| **모바일 버그픽스** | 장소 추가 후 직접입력칸 미노출 수정 (`ul.style.display` 복구) |
| **DraftManager 키 고정** | `dc_draft_create` (신규/edit/copy 통합) / `dc_draft_plan` (plan 전용) 2개로 고정 |
| **리다이렉트 제거** | `restoreLatest` URL 파라미터, `redirectedToLatestDraft` 플래그, `loadLatest()` 메서드 제거 |
| **초기화 단순화** | 진입 → `load()` → 바로 복구. 리다이렉트 없음 |
| **삭제 범위 수정** | `clearAll()` → `clear()` 교체 — 현재 모드 키만 삭제, 타 모드 드래프트 보존 |
| **변경 파일** | `create.js`, `map.js` |

---

### 4-1. 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | id, username, nickname, gender, birth_year, age, region, **user_xp**, level, **bio**, **profile_image_url**, unread_notification_count, role |
| `courses` | name, description, region_main, region_sub, total_time, like_count, comment_count, reference_count, thumbnail_url, author_id, author_nickname, parent_course_id, original_course_id, **is_plan**, is_deleted |
| `course_places` | order_index, name, address, lat, lng, category, phone, place_url, comment, stay_time(선택), travel_time(선택), **transport**(선택) [v4.34], photo_url |
| `follows` | follower_id, following_id, created_at (복합PK, self-follow CHECK) **[v4.2]** |
| `course_likes` | unique: course_id + user_id |
| `bookmarks` | unique: user_id + course_id |
| `comments` / `comment_likes` | 댓글 + 좋아요 |
| `replies` / `reply_likes` | 답글 + 좋아요 |
| `notifications` | 알림 (aggregation, is_read, agg_count) |
| `reports` | 신고 (target_type: course/comment, status: pending/resolved) |
| `event_logs` | 행동 로그 (user_id nullable, anonymous_id, session_id, event_name, jsonb) [v4.32: rate limit RLS 추가] |

### 4-2. 주요 RPC 함수

| 함수 | 설명 |
|------|------|
| `search_courses(...)` | 키워드 + 지역 + 시간 + 정렬 복합 검색 |
| `autocomplete_search(p_keyword, p_limit)` | 자동완성 |
| `get_user_stats(p_user_id)` | 유저 통계 (follower_count, following_count 포함) |
| `get_followers(p_user_id)` | 팔로워 목록 |
| `get_followings(p_user_id)` | 팔로잉 목록 |
| `search_users_for_mention(p_keyword, p_current_user_id)` | @mention 검색 |
| `get_referenced_courses(p_course_id)` | 참조한 코스 목록 |
| `get_liked_courses` / `get_bookmarked_courses` | 좋아요·북마크 코스 |
| `add_user_xp(p_user_id, p_delta)` | XP 증감 |
| `add_user_xp_capped(...)` | 일일 한도 XP |
| `calculate_level(p_xp)` | XP → 레벨 |
| `upsert_notification(...)` | 알림 생성·집계 |
| `mark_notifications_read(p_user_id)` | 알림 일괄 읽음 |
| `increment/decrement_like_count` | 좋아요 캐시 |
| `increment/decrement_comment_count` | 댓글 캐시 |
| `increment/decrement_reference_count` | 참조 캐시 |

### 4-3. RLS 정책

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `courses` | 누구나 | user | 작성자+admin | 작성자+admin |
| `course_places` | 누구나 | 코스 작성자 | 코스 작성자 | 코스 작성자 |
| `follows` | 누구나 | 본인 | ❌ | 본인 |
| `course_likes` | 누구나 | user(본인) | ❌ | user(본인) |
| `bookmarks` | 본인 | user(본인) | ❌ | user(본인) |
| `comments` / `replies` | 누구나 | user | admin | 작성자+admin |
| `notifications` | 본인 | (RPC) | 본인 | ❌ |
| `reports` | admin | user(본인) | admin | admin |
| `event_logs` | admin | 누구나 (1분 100건 rate limit) **[v4.32]** | ❌ | admin |
| `users` | 누구나(공개 필드) | Supabase Auth | 본인+admin | ❌ |

---

## 5. 행동 로그 이벤트 목록

<!-- 다음 세션 참조 필요 — 피드/상세/create 이벤트 모두 포함 -->

`logEvent(eventName, targetType, targetId, metadata)` 로 기록.

**피드 (main.js)**: `page_view`, `page_restore`, `search`, `search_clear`, `autocomplete_select`, `filter_change`, `sort_change`, `filter_reset`, `feed_refresh`, `course_view`, `author_click`, `comment_cta_click`, `like_click`, `like_cancel`, `login_required_click`

**코스 상세 (course.js)**: `course_view`, `author_click`, `original_course_click`, `course_edit_click`, `course_delete_confirm`, `course_reference`, `report_open`, `report_submit`, `like_click`, `like_cancel`, `bookmark_add`, `bookmark_remove`, `carousel_open`, `carousel_nav`, `carousel_swipe`, `timeline_photo_jump`, `viewer_nav`, `place_link_click`, `map_my_location`, `referenced_course_click`, `comment_sort_change`, `comment_create`, `comment_delete`, `comment_like`, `reply_input_open`, `reply_create`, `reply_delete`, `reply_like`, `share_click`, `share_copy_link`, `share_kakao`, `comment_cta_click`, `login_required_click`

**코스 만들기 (create.js)**: `course_create_start`, `place_add`, `course_create_complete`, `course_edit`, `course_reference`

---

## 6. 개발 워크플로우
```
1. config.js 수정 → python server.py
2. 기능 개발 + 테스트
3. git add → git commit (feat:/fix:/refactor:/security:)
4. git push → Vercel 자동 배포 → https://daycourse.kr
```

---

## 7. 개발 컨벤션

- DB 접근 로직은 `db.js`로 완전 분리
- 공통 유틸(`sanitize` 등)은 `utils.js`로 분리 [v4.32]
- 카카오맵 SDK: `autoload=false` 방식
- 검색 마커(`searchMarkers`)와 코스 마커(`courseMarkers`) 배열 분리
- 모든 좋아요 버튼: `♥` 텍스트, liked 시 `#333`
- 커밋 이름: `feat:`, `fix:`, `refactor:`, `security:` 컨벤션
- 카카오 로그인: 구현 완료, 현재 주석 처리 (비즈 앱 전환 후 활성화)
- `innerHTML` 사용 시 반드시 `sanitize()` 적용 [v4.32]
- 아이콘: Lucide 아이콘 라이브러리 사용 (`icons.js` ICONS 객체)

---

## 8. 미완료 / 향후 작업

### 기능
- [ ] **카카오 로그인 활성화** (비즈 앱 전환 필요)
- [ ] **피드 BFCache 스크롤 위치 복원**

### 운영
- [ ] Supabase 1주일 미활동 자동 중지 대응 (cron ping)
- [ ] 카운터 캐시 정합성 월 1회 점검
```sql
  SELECT c.id, c.name, c.like_count AS cached, count(cl.user_id) AS actual
  FROM public.courses c
  LEFT JOIN public.course_likes cl ON cl.course_id = c.id
  GROUP BY c.id, c.name, c.like_count
  HAVING c.like_count <> count(cl.user_id);
```

### 보안 (보류 — 시점이 정해진 것)
- [ ] **비밀번호 변경 권장 안내 배너** — 수개월 후, 기존 계정 대상
- [ ] 유료 전환 시 — 이메일 인증 강제, 2FA, 세션 관리 강화, PG사 연동, 개인정보처리방침 재작성, 어드민 2FA 강제, Audit Log 확장

### Post-MVP
- [ ] 공개/비공개 코스 설정
- [ ] 개인화 추천 알고리즘
- [ ] 해시태그 기능