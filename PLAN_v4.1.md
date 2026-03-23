# 데이코스 (DayCourse) 개발 플랜 v4

> 기능 기획, 구현 현황, DB 설계, 작업 이력을 관리합니다.  
> **최종 갱신: 2026.03.23 (v4.1 — 1단계 리팩토링 완료)**

### 프로젝트 핵심 구조
```
Place → Course → Share
(장소 검색/추가) → (코스 구성/저장) → (피드 공유/탐색)
```

### 프로젝트 목표
1. **MVP 배포** — 코스 기반 장소 공유 웹서비스 (`daycourse.kr`)
2. **데이터 수집** — 사용자 행동 로그 기반 퍼널/리텐션/행동 분석
3. **서비스 개선** — 행동 로그 분석 → UX 개선 사이클
4. **포트폴리오** — 위 과정 전체를 데이터 분석 포트폴리오로 제작

---

## 1. 버전 히스토리

| 버전 | 기간 | 핵심 변경 |
|------|------|-----------|
| v1 | ~ 2026.03.09 | Firebase + 카카오맵 기반 초기 구현 |
| v2 | 2026.03.14~15 | Supabase 전환 (PostgreSQL + Storage + Auth) |
| v3 | 2026.03.15~17 | 유저 페이지, 북마크, 알림, 어드민, 참조 목록, 점수 시스템 |
| v4 | 2026.03.17~21 | 퍼널 로그 전면 보강, 임시저장 v4, SEO, 도메인 전환, 사진 필수 검증 |
| **v4.1** | 2026.03.23 | 1단계 리팩토링 완료: URL 구조 정리, 드래프트 안정화, OG 미리보기 |

---

## 2. v4 구현 현황

### 2.1 퍼널 로그 전면 보강 ✅ 완료
- [x] main.js: `page_view`, `page_restore`, `search`, `search_clear`, `autocomplete_select`, `filter_change`, `sort_change`, `filter_reset`, `feed_refresh`, `course_view`, `author_click`, `comment_cta_click`, `like_click`, `like_cancel`, `login_required_click`
- [x] course.js: `course_view`, `author_click`, `original_course_click`, `course_edit_click`, `course_delete_confirm`, `course_reference`, `report_open`, `report_submit`, `like_click`, `like_cancel`, `bookmark_add`, `bookmark_remove`, `carousel_open`, `carousel_nav`, `carousel_swipe`, `timeline_photo_jump`, `viewer_nav`, `place_link_click`, `map_my_location`, `referenced_course_click`, `comment_sort_change`, `comment_create`, `comment_delete`, `comment_like`, `reply_input_open`, `reply_create`, `reply_delete`, `reply_like`, `share_click`, `share_copy_link`, `share_kakao`
- [x] create.js: `course_create_start`, `place_add`, `course_create_complete`, `course_edit`, `course_reference`
- [x] 비로그인 시도 이벤트: 좋아요/댓글/북마크/신고 등 모든 인증 필요 동작에 `login_required_click` 기록

### 2.2 임시저장 (드래프트) v4 ✅ 완료
- [x] `DRAFT_VERSION = 4` — 이전 버전 드래프트 자동 무효화
- [x] 모드별 별도 키: `dc_draft_new` / `dc_draft_edit_{id}` / `dc_draft_copy_{id}`
- [x] `+` 버튼 진입 시 최신 드래프트 자동 복구 제안
- [x] 임시저장 버튼 (`draftSaveBtn`) — 수동 저장 지원
- [x] 자동저장 트리거 — 입력·변경 감지 시 3초 딜레이 debounce
- [x] 저장 완료 시 `_isSaved = true` → 페이지 이탈 경고 비활성화

### 2.3 코스 사진 시스템 ✅ 완료
- [x] 장소 사진 필수 검증 — 저장 시 사진 없는 장소 확인 후 경고
- [x] 썸네일 독립 업로드 — `courses.thumbnail_url` 컬럼에 별도 저장
- [x] 썸네일 미입력 시 첫 번째 장소 사진 자동 복사 (fallback)
- [x] 수정 모드에서 기존 썸네일 URL 유지 (`thumbnailExistingUrl`)
- [x] 장소 사진 4:5 세로형 크롭 (드래그/핀치줌/휠줌, 3×3 가이드)
- [x] WebP 압축 (OUTPUT_WIDTH=800, 품질 0.82, ~80KB)
- [x] Supabase Storage 업로드, URL만 DB 저장

### 2.4 SEO 최적화 ✅ 완료
- [x] `course.html` — OG/Twitter 카드 메타 태그 + JSON-LD structured data
- [x] 공유 시 카카오톡 카드에 코스 제목 표시
- [x] 피드에 SEO용 숨김 링크 블록 (`seoCourseLinks`) 삽입
- [x] `sitemap.xml` 생성 및 Google Search Console 제출
- [x] `robots.txt` 추가
- [x] `index.html` SEO 메타 태그 삽입 (Google Search Console 인증 포함)

### 2.5 도메인 전환 ✅ 완료
- [x] GitHub Pages 커스텀 도메인 `daycourse.kr` 적용 (CNAME)
- [x] 홈 링크 전체 절대경로 통일

### 2.6 어드민 패널 ✅ 완료 (v4에서 안정화)
- [x] `admin/admin.html` — SPA 구조, 탭 전환
- [x] Dashboard: DAU/MAU 집계, 이벤트별 카운트, Chart.js 차트
- [x] Reports: 신고 목록 + pending/resolved 상태 처리
- [x] Courses: 전체 코스 목록 + 강제 삭제
- [x] Comments: 전체 댓글 목록 + 강제 삭제
- [x] Users: 전체 유저 목록 + 권한(role) 변경
- [x] Logs: `event_logs` 조회 + 키워드 검색 (50개 페이지네이션)

---

## 3. v3 구현 현황 (인계됨)

### 3.1 인증 시스템 ✅
- [x] 자체 회원가입 (아이디/비밀번호)
- [x] 가상 이메일 (`username@daycourse.com`) — 이메일 인증 OFF
- [x] 프로필 설정 페이지 (`nickname.html`) — 닉네임·성별·출생연도·거주지역·동의
- [x] `birth_year` 저장 시 `age` 자동 동기화 (트리거)
- [x] 로그인/로그아웃
- [x] 아이디·비밀번호 찾기 (`find.html`)
- [x] 비로그인 피드·상세 열람 가능
- [x] 카카오 로그인 코드 구현 완료 (현재 주석 처리)

### 3.2 피드 시스템 ✅
- [x] 2열 카드 그리드 (모바일), 3열(640px+), 4열(960px+)
- [x] 대표 이미지: `thumbnail_url` 우선 → fallback: 첫 번째 장소 `photo_url`
- [x] 지역 배지, 코스명, 장소 경로, 소개글, 좋아요 수, 댓글 수
- [x] 카드 하단 작성자·좋아요·댓글 항상 같은 높이 정렬 (`margin-top: auto`)
- [x] 검색 자동완성 (2글자 이상, 320ms 딜레이, 코스/장소 타입 표시)
- [x] 키보드 자동완성 탐색 (ArrowUp/Down/Enter/Escape)
- [x] 피드 검색 — 코스명/소개글/장소명/주소/한줄평 ILIKE (RPC)
- [x] 필터 — 지역(대분류+세부), 소요시간 범위
- [x] 정렬 — 최신순/인기순/참조순/짧은순/긴순 (score 기반: `like×2 + comment×3 + reference×4`)
- [x] 무한 스크롤 (IntersectionObserver, PAGE_SIZE=20)
- [x] Pull to Refresh (64px threshold)

### 3.3 코스 만들기 ✅
- [x] 장소 검색 (카카오맵 keywordSearch, 0.4초 딜레이)
- [x] 검색 결과에 주소 표시
- [x] 현재 위치 기반 검색 정렬 (`myLat/myLng`)
- [x] 지도 클릭 → 반경 30m 카테고리 검색
- [x] 직접 입력 UI (주소 없는 장소)
- [x] 코스 목록 드래그 순서 변경 (SortableJS)
- [x] 장소 추가 제한: 최소 2개, 최대 10개
- [x] 체류 시간 선택 (필수, 모달 — 10가지)
- [x] 이동 시간 선택 (두 번째 장소부터 필수, 모달 — 10가지)
- [x] 총 소요시간 자동 계산
- [x] 지역 태그 (전국 행정구역 기준 대분류 17개 + 세부)
- [x] 코스 소개글 (선택, 글자수 카운터)
- [x] 저장 버튼 코스 목록 상단 배치
- [x] 저장 후 상세 페이지 자동 이동
- [x] 수정 모드 (`?mode=edit&id=...`)
- [x] 참조 모드 (`?mode=copy&id=...`) — 장소/시간만 복사, 소개글/한줄평/사진 미복사

### 3.4 코스 상세 ✅
- [x] 캐러셀 — 사진 있는 장소만, 스와이프, 하단 장소명 오버레이, 1/N 카운터
- [x] 사진 탭 → 전체화면 뷰어, 타임라인 썸네일 → 캐러셀 해당 슬라이드 이동
- [x] 타임라인 — 넘버링 원형·세로줄, 장소명·카테고리·주소·한줄평·체류시간·거리·썸네일
- [x] Haversine 직선거리 계산
- [x] 동선 지도 (카카오맵 + 넘버링 오버레이 + Polyline)
- [x] 액션 바 — 좋아요·댓글 수·참조·공유
- [x] 공유 바텀시트 (링크 복사·카카오톡 공유)
- [x] 신고 바텀시트 (course/comment, 중복 방지)
- [x] 참조된 코스 섹션 — 하단에 최대 6개 카드
- [x] 댓글 정렬 — 최신순·인기순·좋아요순

### 3.5 유저·프로필 시스템 ✅
- [x] `user.html` — 공개 유저 페이지 (닉네임·통계·코스·참조 탭)
- [x] `profile.html` — 마이페이지 (내 정보·좋아요·북마크·내 코스 탭 통합)
- [x] `bookmarks.html` — 북마크 목록 (무한 스크롤)
- [x] `notifications.html` — 알림 목록 (진입 시 일괄 읽음 처리, 무한 스크롤)
- [x] 레벨 시스템 계산 로직 완료 (UI는 현재 `display:none`)

### 3.6 알림 시스템 ✅
- [x] `notifications` 테이블 + RLS
- [x] `upsert_notification` RPC — `course_like`·`course_reference`는 aggregation
- [x] 알림 타입: `course_like`, `course_comment`, `comment_reply`, `course_reference`
- [x] `mark_notifications_read` RPC — 일괄 읽음 처리 + `unread_notification_count` 초기화
- [ ] 사이드바 알림 뱃지 실시간 갱신 (현재 하드코딩 0)

### 3.7 유저 점수 시스템 ✅
- [x] `add_user_score` RPC (최소 0 보장)
- [x] 코스 작성: +10, 댓글 작성: +2, 좋아요 받음: +1/-1, 참조 받음: +5
- [x] `update_user_level` 트리거 — 점수 구간별 레벨 자동 계산
  - Lv1: 0~9 / Lv2: 10~39 / Lv3: 40~99 / Lv4: 100~199 / Lv5: 200+
- [x] 레벨명: 탐험가·코스 메이커·로컬 가이드·트렌드 세터·마스터 플래너
- [ ] 레벨 UI 노출 (현재 `display:none` 처리)

### 3.8 신고 시스템 ✅
- [x] `reports` 테이블 + RLS
- [x] course/comment 신고 중복 방지
- [x] 어드민 패널 Reports 탭에서 처리

### 3.9 행동 로그 ✅ (v2 기반, v4에서 전면 보강)
- [x] `event_logs` 테이블 (user_id nullable, anonymous_id, session_id, event_page jsonb)
- [x] `dc_session_id` — sessionStorage 기반 세션 ID
- [x] `dc_anonymous_id` — localStorage 기반 익명 ID
- [x] `crypto.randomUUID()` + fallback 구현

---

## 4. 보안 정책

### 4.1 역할 (Role)

| 역할 | 설명 |
|------|------|
| guest (비로그인) | 피드·상세 열람, 검색·필터 가능. 글쓰기·상호작용 불가 |
| user (일반) | 코스 CRUD, 좋아요, 북마크, 댓글, 참조, 신고. 본인 데이터만 수정·삭제 |
| admin | 모든 코스·댓글 삭제, 유저 role 변경, 신고 처리. 어드민 패널 접근 |

### 4.2 Supabase 주의사항
- 무료 플랜: DB 500MB, Storage 1GB, **1주일 미활동 시 자동 중지**
- 이메일 인증 OFF — 가상 이메일 `username@daycourse.com` 사용
- `SUPABASE_SERVICE_KEY` (service_role)는 절대 클라이언트에 노출 금지

---

## 5. DB 스키마 상세

### 5.1 users 테이블

```sql
users
├── id              uuid, PK (Supabase Auth 연동)
├── username        text       -- 아이디
├── nickname        text       -- 닉네임
├── gender          text       -- 'male'|'female'|'other' (선택)
├── birth_year      integer    -- 출생연도 (저장 시 age 자동 동기화)
├── age             integer    -- birth_year 기반 자동 계산
├── region          text       -- 거주 지역
├── user_score      integer    -- 활동 점수 (default 0)
├── level           integer    -- 레벨 (점수 기반 트리거 자동 계산)
├── unread_notification_count integer -- 미읽음 알림 수
├── role            text       -- 'user'|'admin'
└── created_at      timestamptz
```

### 5.2 courses 테이블

```sql
courses
├── id                  uuid, PK
├── name                text       -- 코스명
├── description         text       -- 소개글 (선택)
├── region_main         text       -- 대분류 지역
├── region_sub          text       -- 세부 지역
├── total_time          integer    -- 총 소요시간(분)
├── like_count          integer    -- 캐시 카운터
├── comment_count       integer    -- 캐시 카운터 (답글 포함)
├── reference_count     integer    -- 캐시 카운터
├── thumbnail_url       text       -- 코스 대표 이미지 URL
├── author_id           uuid       -- FK → users.id
├── author_nickname     text       -- 비정규화 (쿼리 성능)
├── parent_course_id    uuid       -- 직접 참조한 원본 ID
├── original_course_id  uuid       -- 참조 체인 최상위 원본 ID
├── is_deleted          boolean    -- soft delete
└── created_at          timestamptz
```

### 5.3 course_places 테이블

```sql
course_places
├── id          uuid, PK
├── course_id   uuid, FK → courses.id
├── order_index integer    -- 순서 (0-based)
├── name        text       -- 장소명
├── address     text
├── lat         numeric
├── lng         numeric
├── category    text       -- 카카오맵 카테고리
├── phone       text
├── place_url   text       -- 카카오맵 상세 URL
├── comment     text       -- 한줄평 (선택)
├── stay_time   integer    -- 체류 시간(분)
├── travel_time integer    -- 이동 시간(분, 두 번째~)
└── photo_url   text       -- Supabase Storage URL
```

---

## 6. 파일 간 의존 관계

```
db.js ← supabase.js, config.js
       ↑ 모든 페이지 JS에서 import

sidebar.js ← supabase.js
           ↑ 모든 페이지 JS에서 initSidebar() 호출

icons.js ← (독립)
          ↑ initIcons(), initSidebarIcons() — 모든 페이지

map.js ← (kakao SDK 전역)
        ↑ create.js, course.js

photo.js ← (cropAndCompress 단일 export)
          ↑ create.js

main.js   ← db.js, sidebar.js, icons.js, supabase.js
course.js ← db.js, sidebar.js, icons.js, supabase.js, map.js
create.js ← db.js, sidebar.js, icons.js, map.js, photo.js
user.js   ← db.js, sidebar.js, icons.js
profile.js← db.js, sidebar.js, icons.js
bookmarks.js ← db.js, sidebar.js, icons.js
notifications.js ← db.js, sidebar.js, icons.js

admin/admin.js  ← supabase.js
admin/dashboard.js, reports.js, courses.js,
comments.js, users.js, logs.js ← supabase.js
```

---

## 7. 향후 작업 기획

> 우선순위 순서대로 기술. 완료 시 ✅ 표시 후 섹션 8(작업 이력)에 날짜 기록.  
> **원칙: 1단계 리팩토링 완료 후 2단계 기능 개발 진행.**

---

## 1단계 — 리팩토링 ✅ 완료 (2026.03.23)

### R1. URL 구조 정리 + Vercel 설정 ✅

**목표**: 주소창에서 `.html` 제거, Google 색인 리다이렉션 오류 해결, 검색엔진 자연 노출 기반 마련.

**현황 및 문제**
- `index.html`이 `main.html`로 meta refresh + JS 리다이렉트 → 구글봇이 정식 URL 판단 불가 → Search Console 색인 오류
- 모든 페이지 URL에 `.html` 노출 (`/main.html`, `/course.html` 등) → 가독성 저하
- `main.html` 내부에 빈 앵커 태그 하드코딩 (`<a href="/course.html?id=..."></a>`) → 불필요한 잔재

**해결 방향**

```
현재                          변경 후
daycourse.kr/main.html   →   daycourse.kr/
daycourse.kr/course.html →   daycourse.kr/course
daycourse.kr/create.html →   daycourse.kr/create
daycourse.kr/login.html  →   daycourse.kr/login
(그 외 페이지 동일 패턴)
```

**구현 단계**

1. **`vercel.json` 신규 생성** — 핵심 파일
   - `rewrites`: 새 URL → 기존 `.html` 파일로 내부 서빙 (URL은 변경된 형태 유지)
   - `redirects`: 기존 `.html` URL → 새 URL 301 영구 리다이렉트 (구글 색인 이전)
   - `headers`: 보안 헤더 (`X-Frame-Options`, `X-Content-Type-Options` 등) 추가

   ```json
   {
     "rewrites": [
       { "source": "/",        "destination": "/index.html" },
       { "source": "/course",  "destination": "/course.html" },
       { "source": "/create",  "destination": "/create.html" },
       { "source": "/login",   "destination": "/login.html" }
     ],
     "redirects": [
       { "source": "/main.html",   "destination": "/",       "permanent": true },
       { "source": "/course.html", "destination": "/course", "permanent": true },
       { "source": "/create.html", "destination": "/create", "permanent": true },
       { "source": "/login.html",  "destination": "/login",  "permanent": true }
     ]
   }
   ```

2. **`index.html` 교체** — 리다이렉트 제거, 피드 콘텐츠 직접 담기
   - 현재 `main.html` 내용을 `index.html`로 이동
   - `main.html`은 삭제 (또는 `/` 리다이렉트만 남김)
   - `main.html` 내 하드코딩된 빈 앵커 태그 제거

3. **내부 링크 경로 일괄 수정** — 모든 HTML·JS 파일
   - `href="/main.html"` → `href="/"`
   - `href="course.html"` → `href="/course"`
   - `location.href = 'main.html'` → `location.href = '/'`
   - 수정 대상: `sidebar.js`, `course.js`, `create.js`, `login.js`, `nickname.js`, `profile.js`, `user.js`, `bookmarks.js`, `notifications.js`, `find.js`, 모든 `.html` 파일

4. **`sitemap.xml` 업데이트**
   - `.html` URL → 새 URL로 전체 교체
   - Google Search Console에 재제출

5. **`canonical` 태그 정리**
   - 각 HTML 파일의 `<link rel="canonical">` URL을 새 형태로 수정

**작업 파일**
- 신규: `vercel.json`
- 교체: `index.html` (main.html 내용 흡수)
- 삭제: `main.html`
- 수정: `sidebar.js`, `course.js`, `create.js`, `login.js`, `nickname.js`, `profile.js`, `user.js`, `bookmarks.js`, `notifications.js`, `find.js`, `sitemap.xml`, 모든 `.html` 내부 링크

---

### R2. 임시저장(드래프트) 로직 안정화 ✅

**목표**: 코스 신규 작성·수정·인용 중 어떤 이탈 패턴에도 임시저장 데이터가 꼬이지 않고, 복구 시 정확한 데이터를 불러온다. R1과 독립적이므로 병행 진행 가능.

**현황 및 문제**

1. **자동저장 타이머 레이스** — debounce 진행 중 저장 버튼을 누르면 완료 후에도 타이머가 발동해 `_isSaved` 플래그를 덮어씀
2. **수동·자동저장 경로 이중화** — 같은 키에 독립적으로 쓰기 때문에 타이밍에 따라 한쪽이 덮어씀
3. **비정상 이탈 시 불완전 저장** — `beforeunload` 발동 전 debounce가 pending이면 마지막 변경 누락
4. **복구 검증 분산** — `hasMeaningfulDraft()` / `isDraftCompatible()` 두 함수가 분리되어 엣지케이스 판단 불확실
5. **드래프트 키 결정 취약** — 페이지 로드 시 1회 결정 후 URL 변경 시 키와 모드가 어긋날 수 있음

**해결 방향: DraftManager 클래스 단일화**

```js
class DraftManager {
  constructor(mode, sourceId)   // 생성 시 키 확정 및 불변 유지
  save()                        // 즉시 저장 (동기, debounce 없음)
  scheduleSave(delayMs = 2000)  // debounce 자동저장 — 항상 기존 타이머 취소 후 재설정
  cancelScheduled()             // 저장 완료 시 pending 타이머 강제 취소
  load()                        // 로드 + version·mode·sourceId 한 번에 검증, 불일치 시 null
  clear()                       // 저장 완료 시 즉시 삭제
  hasContent()                  // 복구 제안 표시 여부 단일 판단
}
```

**핵심 변경 사항**

- 자동저장·수동저장 모두 `draftManager.save()` 단일 진입점으로 통일
- `beforeunload` 시 debounce 무시하고 `draftManager.save()` 즉시 호출 (localStorage 동기 API)
- 저장 완료 시 `draftManager.cancelScheduled()` + `draftManager.clear()` 순서 보장
- 복구 검증을 `load()` 내부로 캡슐화 — 외부에서 조건 분기 불필요

**작업 파일**
- 수정: `create.js` — DraftManager 클래스 도입, 기존 드래프트 변수·함수 전면 교체

---

### R3. OG 미리보기 — Vercel Edge Function ✅

**목표**: 코스 링크 공유 시 카카오톡·슬랙·트위터 등에서 썸네일·제목·소개글 미리보기 카드 표시. **R1 완료 후 진행** (URL 구조가 확정되어야 OG URL도 확정).

**현황 및 문제**
- `course.html` OG 태그가 정적 하드코딩 → 크롤러는 JS 실행 안 하므로 미리보기 불가
- 배포가 Vercel로 이전됐으므로 Vercel Edge Functions로 해결 (이전 계획인 Cloudflare Workers 폐기)

**해결 방향**

```
일반 유저 요청  →  Vercel  →  course.html 정적 파일 서빙
크롤러 요청     →  Vercel Edge Function (api/og.js)
                   └─ Supabase REST API로 코스 데이터 조회
                   └─ OG 태그 채운 HTML 응답
```

**구현 단계**

1. **`api/og.js` 신규 작성** (Vercel Edge Function)
   - `User-Agent`로 크롤러 판별 — `Mozilla/5.0`으로 시작하면 일반 브라우저로 통과, 그 외는 크롤러로 처리. 카카오 인앱 브라우저 오탐 방지. `kakaotalk-scrap`만 예외적으로 명시
   - URL에서 `id` 파라미터 추출
   - Supabase REST API 호출 (anon key, RLS SELECT 공개)
     ```
     GET /rest/v1/courses?id=eq.{id}&select=name,description,thumbnail_url
     GET /rest/v1/course_places?course_id=eq.{id}&select=photo_url&order=order_index.asc&limit=1
     ```
   - `thumbnail_url` 없으면 첫 번째 장소 `photo_url` fallback
   - OG 태그 완성된 HTML 반환

2. **OG 태그 템플릿**
   ```html
   <meta property="og:title"       content="{course.name}" />
   <meta property="og:description" content="{course.description}" />
   <meta property="og:image"       content="{thumbnail}" />
   <meta property="og:url"         content="https://daycourse.kr/course?id={id}" />
   <meta name="twitter:card"       content="summary_large_image" />
   ```

3. **`vercel.json`에 라우팅 추가** (R1 파일에 병합)
   ```json
   { "source": "/course", "destination": "/api/og" }
   ```
   → Edge Function 내부에서 크롤러/유저 분기 처리

4. **`course.html` OG 태그 정리**
   - 정적 플레이스홀더로 통일 (크롤러는 Edge Function이 처리하므로 유저용은 그대로 유지)

**작업 파일**
- 신규: `api/og.js`
- 수정: `vercel.json` (R1에서 생성한 파일에 라우팅 추가), `course.html` (OG 태그 정리)

---

## 2단계 — 기능 개발 (기획 진행 중)

> 1단계 리팩토링 완료 후 다음 세션에서 우선순위 확정 예정.

- [ ] 사이드바 알림 뱃지 실시간 갱신 (`user?.unread_notification_count` 연결)
- [ ] 레벨 UI 노출 (현재 `display:none`)
- [ ] 카카오 로그인 활성화 (비즈 앱 전환 필요)
- [ ] 피드 BFCache 스크롤 위치 복원
- [ ] 수정 모드 썸네일 표시 버그 수정 ✅ (v4.1에서 완료)

---

### 보류 (Post-MVP)

- 공개/비공개 코스 설정
- 팔로우 / 채팅 / 협업
- 개인화 추천 알고리즘
- pg_cron `refresh-user-ages` 스케줄 등록

---

## 8. 작업 이력

| 날짜 | 버전 | 작업 내용 |
|------|------|-----------|
| ~ 2026.03.09 | v1 | Firebase + 카카오맵 초기 구현. 피드·상세·인증 |
| 2026.03.07 | v1 | 헤더·사이드바 전 페이지 통일. 댓글 UI 개선 (답글·좋아요·상대시간) |
| 2026.03.08 | v1 | 마커 넘버링 커스텀 오버레이. Polyline 연결 개선 |
| 2026.03.14~15 | v2 | Supabase 전환 (PostgreSQL + Storage + Auth). 전체 코드 재작성 |
| 2026.03.15 | v2 | 로그인 디버깅. 프로필 설정 페이지. 카카오맵 마커 분리. 캐러셀 UI. 액션 바 통일. 좋아요 ♥ 텍스트 통일. 지역 목록 재작성 |
| 2026.03.15 | v3 | 유저 프로필 전면 추가: `user.html`, `profile.html`, `bookmarks.html`, `notifications.html`. 북마크·알림·참조 코스 목록·점수·레벨 |
| 2026.03.15~16 | v3 | 캐러셀 텍스트 수정. 모바일 최적화. 썸네일 추가. 참조·수정 데이터 로딩 오류 수정 |
| 2026.03.17 | v4 | **어드민 패널** 추가 (`admin/`). 아이콘 전면 SVG 교체 (`icons.js`). 레벨 시스템 UI 숨김 |
| 2026.03.17~19 | v4 | db.js 안정화 (session/anonymous_id 로깅). 지도 검색 알고리즘 버그 수정. 임시저장 기능 추가. UI 전반 세부 수정 |
| 2026.03.19 | v4 | 코스 사진 필수 입력 검증. 썸네일 fallback (첫 번째 장소 사진 자동 복사). 댓글 수 표시 오류 수정 (`comment_count` 누락). 색상 명암비 조정 |
| 2026.03.21 | v4 | 도메인 전환 (`daycourse.kr` CNAME). SEO 최적화 (메타 태그·sitemap·robots). Google Search Console 인증. SEO용 코스 링크 블록. 공유 카카오 카드 코스 제목 표시. 홈 링크 절대경로 통일 |
| 2026.03.23 | v4.1 | **R1** `vercel.json` 신규 생성. URL 구조 정리 (`.html` 제거, 301 리다이렉트). `index.html`이 피드 직접 담당. `main.html` 삭제. 전체 내부 링크 경로 일괄 치환. `sitemap.xml` 업데이트 및 Google Search Console 재제출 (4페이지 발견) |
| 2026.03.23 | v4.1 | **R2** `DraftManager` 클래스 도입으로 임시저장 로직 전면 재작성. 드래프트 복구 UI를 브라우저 `confirm()`에서 자체 바텀시트로 교체 (2단계 삭제 재확인 포함). 수정 모드 썸네일 미표시 버그 수정. 스냅샷 기반 dirty 판별로 불필요한 드래프트 저장 방지.
| 2026.03.23 | v4.1 | **R3** `api/og.js` Vercel Edge Function 신규 작성. 크롤러 요청 시 Supabase REST API로 코스 데이터 조회 후 OG 태그 채운 HTML 반환. 카카오톡 공유 미리보기 썸네일·제목·소개글 표시 확인. Vercel 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 등록 |
| 2026.03.23 | v4.1 | **RLS 점검** 중복 정책 3건 제거, `reports` INSERT 조건 강화. **DB 정합성** `like_count` 캐시 불일치 1건 수동 수정 |
| 2026.03.23 | v4.1 | **R3 버그수정** OG Edge Function 크롤러 판별 로직을 `Mozilla/5.0` 기반으로 전환. 카카오 인앱 브라우저 오탐 수정. CDN 캐시 혼용 방지 (`Cache-Control: no-store` 전체 적용) |