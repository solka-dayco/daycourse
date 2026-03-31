# 데이코스 (DayCourse) 개발 플랜 v4.3

> 기능 기획, 구현 현황, DB 설계, 작업 이력을 관리합니다.  
> **최종 갱신: 2026.03.27 (v4.2 — R1~R5 + 버그픽스 완료)**

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
| v4.1 | 2026.03.23 | URL 구조 정리, 드래프트 안정화, OG 미리보기 |
| **v4.2** | 2026.03.27 | 코스 제작 UX 개선, 코스 계획 기능, 이미지 처리 개선, 레벨/XP 시스템, 커뮤니티 기능 |
| v4.31 | 2026.03.27 | 팔로잉 피드 탭 분리 |
| **v4.32** | 2026.03.30 | 로그인 보안 강화 — XSS 방어, config.js 분리, event_logs RLS, Storage 업로드 제한, 비밀번호 정책 |
| **v4.33** | 2026.03.30 | 버그픽스 및 UX 개선 — 한줄평 줄바꿈, 로컬 서버, 마커 모바일 지원, 사진 시스템 개편, 되돌리기 기능 |


---

## 2. 구현 현황 (v4.2 기준)

> ℹ️ v4.0 이전 내용(퍼널 로그, 임시저장, SEO, 어드민 등)은 안정화 완료로 상세 기술 생략. 기능 목록만 유지.

### 2.1 기반 기능 ✅ (v4.0 완료, 안정)

<!-- 다음 세션에서 참조 불필요 — 모두 완료된 안정 기능 -->

- 퍼널 로그 전면 보강 (main.js · course.js · create.js 전체 이벤트)
- 임시저장(드래프트) v5 — `DraftManager` 클래스, 모드별 키 분리, 바텀시트 복구 UI
- 코스 사진 필수 검증, 썸네일 독립 업로드, 첫 장소 사진 fallback
- SEO 최적화 — OG/Twitter 카드, sitemap.xml, robots.txt, Google Search Console
- 도메인 전환 — `daycourse.kr` GitHub Pages CNAME
- 어드민 패널 — Dashboard(Chart.js), Reports, Courses, Comments, Users, Logs 6탭
- URL 구조 정리 — `.html` 제거, 301 리다이렉트, `vercel.json`
- OG 미리보기 — `api/og.js` Vercel Edge Function

### 2.2 인증 시스템 ✅ (v3 완료, 안정)

<!-- 다음 세션에서 참조 불필요 -->

- 자체 회원가입/로그인/로그아웃, 가상 이메일(`username@daycourse.com`)
- 프로필 설정 (`nickname.html`), 아이디·비밀번호 찾기 (`find.html`)
- 카카오 로그인 코드 구현 완료 (현재 주석 처리 — 비즈 앱 전환 후 활성화)
- 비로그인 피드·상세 열람 가능

### 2.3 피드 시스템 ✅ (v3~v4.2 완료, 안정)

<!-- 다음 세션에서 참조 불필요 -->

- 2열/3열/4열 그리드, 무한 스크롤, Pull to Refresh
- 검색 자동완성, 필터(지역·소요시간), 정렬(최신/인기/참조/짧은/긴/가까운순)
- 거리순 정렬: GPS 위치 획득 → Haversine → 첫 번째 장소 기준 클라이언트 정렬

### 2.4 코스 만들기 ✅ (v4.2 개선 완료)

- 장소 검색(카카오맵), 드래그 순서 변경(SortableJS), 최소 2·최대 10개
- **[v4.2]** 체류/이동시간 선택 → 필수에서 선택으로 변경, 세부사항 토글 분리
- **[v4.2]** 총 소요시간: 세부사항 닫힘=직접 입력, 열림=자동 계산
- **[v4.2]** 시간 입력: input 클릭→드럼롤 피커, 아이콘 클릭→칩 모달
- **[v4.2]** 코스 계획(plan) 모드 분기 — 썸네일 숨김, 지도 확장, 저장→plan-detail 이동
- **[v4.2]** 장소 검색 시 지하철역(`SW8`) 상단 노출

### 2.5 코스 상세 ✅ (v4.2 개선 완료)

- 캐러셀, 전체화면 뷰어, 타임라인, 동선 지도
- **[v4.2]** 타임라인: 이동거리 세로선 아래 배치, 화살표 제거, 한줄평 줄노트 구분선
- **[v4.2]** "참조" → "계획 담기" 텍스트 변경
- 액션 바(좋아요·댓글·공유), 신고, 댓글/답글, 참조된 코스 섹션

### 2.6 이미지 처리 ✅ (v4.2 전면 개선)

- **letterbox 크롭**: `Math.max`(fill) → `Math.min` 방식으로 변경. 비율 불일치 시 여백 검정(`#000`) 처리
- **원본 이미지 보존**: `_originalBase64` 필드로 크롭 전 원본 저장. 재편집 시 원본 기준 진입
- **사진 재편집**: `reopenCrop(dataUrl, existingBlurRegions)` — 썸네일/장소 사진 클릭 시 크롭 화면 재진입
- **사진 변경**: 크롭 모달 내 '사진 변경' 버튼 → file input 트리거 → 기존 블러 영역 초기화
- **얼굴 블러**: 드래그로 타원형 영역 지정, 핸들로 크기·위치 조절, 삭제/복사 아이콘, Stack Blur(Box Blur 2패스, 강도 8)
- **resolve 반환 통일**: `cropAndCompress` / `reopenCrop` 모두 `{ blob, blurRegions, changedOriginal }` 객체 반환
- **변경 파일**: `photo.js` (전면 재작성 v7), `create.js` (reopenCrop import, blobToDataUrl, 원본 보존 로직)

**place 데이터 구조**
```js
{
  _photoBlob,        // 현재 세션 메모리 Blob
  _photoPreview,     // ObjectURL (세션 내 미리보기)
  _photoBase64,      // 크롭+블러 결과 base64 (드래프트 저장용)
  _originalBase64,   // 크롭 전 원본 base64 (재편집 진입용)
  _blurRegions,      // 블러 영역 상대좌표 배열
  photo_url,         // Supabase Storage URL (저장 완료 후)
}
```

**블러 영역 데이터 구조**
```js
{
  cx_r,  // 이미지 너비 대비 중심 x 비율
  cy_r,  // 이미지 높이 대비 중심 y 비율
  rx_r,  // 이미지 너비 대비 반경 x 비율
  ry_r,  // 이미지 높이 대비 반경 y 비율
}
```

### 2.7 코스 계획 기능 ✅ (v4.2 신규)

- **DB**: `courses.is_plan` 컬럼, RLS 수정. `fetchPlanCourses` / `createPlanCourse` / `publishPlanCourse` / `deletePlanCourse` 추가. 피드/유저코스 쿼리에 `is_plan=false` 필터
- **`plan.html/js/css`**: 목록 형식, 연필/X 아이콘, 날짜 표시, 최신순
- **`plan-detail.html/js/css`**: 본인만 열람, 타임라인(사진 없음), 지도, 수정하기 + 게시하러가기
- **`sidebar.js`**: 코스 계획 메뉴 추가 (북마크 아래)
- **`profile.html/js`**: 코스 계획 탭 추가
- **`vercel.json`**: `/plan`, `/plan-detail` 라우팅 추가

### 2.8 레벨 및 경험치 시스템 ✅ (v4.2 전면 도입)

**레벨 구조**: LV1~LV50, 칭호: Walker(1~10) / Runner(11~20) / Rider(21~30) / Traveler(31~40) / Driver(41~49) / Cruiser(50)

**경험치 획득**

| 행동 | XP |
|------|----|
| 코스 업로드 | +750 |
| 코스 인용 | +1,000 |
| 댓글/답글 작성 | +50 |
| 좋아요 받음 | +5 / 취소 -5 |
| 북마크 받음 | +1 (일일 최대 20) |
| 코스 삭제 | -750 |

**레벨 구간 누적 XP**

| 구간 | 필요 누적 XP |
|------|-------------|
| LV1 → LV10 | 10,000 |
| LV10 → LV20 | 36,250 |
| LV20 → LV30 | 56,250 |
| LV30 → LV40 | 112,500 |
| LV40 → LV50 | 250,000 |
| 총합 (LV50) | 465,000 |

**레벨업 정책**: XP는 DB 누적값 저장. 레벨 갱신은 XP 변동 후 30초 딜레이 적용(pg_cron). 코스 삭제 시 레벨 하락 가능.

**DB**: `users.user_xp`(누적 XP), `users.level`(30초 갱신). Functions: `calculate_level`, `add_user_xp`, `add_user_xp_capped`. `users.user_score` 제거, `update_user_level` 트리거 제거.

**UI**: 프로필 — 레벨명 + XP 바 + 현재 XP / 다음 레벨 필요 XP. 유저 페이지 — 레벨명 표시.

### 2.9 커뮤니티 기능 ✅ (v4.2 신규)

**DB/RPC**
- `follows` 테이블 (follower_id, following_id, 복합 PK, self-follow 방지 CHECK)
- `follows` RLS (SELECT 전체공개, INSERT/DELETE 본인만)
- `get_user_stats` RPC 재정의 — follower_count, following_count 포함
- `get_followers` / `get_followings` / `search_users_for_mention` RPC 추가
- `users.bio`, `users.profile_image_url` 컬럼 추가

**db.js 추가 함수**: `followUser`, `unfollowUser`, `isFollowing`, `fetchFollowStats`, `fetchFollowers`, `fetchFollowings`, `searchUsersForMention`, `updateUserProfile`, `uploadProfileImage`, `fetchUserById`(bio·profile_image_url 포함), `fetchUserStats`(follower/following 기본값 포함)

**@mention 자동완성** (`course.js`): `createMentionDropdown` — 댓글/답글 공용. @ 입력 시 드롭다운(팔로우 유저 우선). 키보드(ArrowUp/Down/Enter) + 마우스 탐색.

**profile.html/css/js**
- 2단 레이아웃 (좌: 아바타+레벨+XP바, 우: 닉네임+소개글+통계)
- 프로필 편집 바텀시트: 닉네임·소개글(80자 카운터)·사진 변경(드래그/줌 슬라이더)·사진 삭제
- 팔로워/팔로잉 수 + 클릭 시 사이드 패널 (우측 슬라이드인)
- 프로필 사진 업로드 후 헤더/사이드바 아이콘 즉시 갱신
- 기본 프로필 이미지: `/image/profile_icon.png` 통일

**user.html/css/js**
- 2단 레이아웃 (좌: 아바타+레벨, 우: 닉네임+소개글+통계+팔로우버튼)
- 팔로우/언팔로우 버튼 (고정 크기, 팔로잉 상태 토글)
- 소개글 줄바꿈 반영 (pre-wrap), 헤더 타이틀 '데이코스' 고정

**sidebar.js**: 헤더 우측 프로필 아이콘 동적 주입, 미읽음 알림 red dot, 프로필 아이콘 드롭다운(알림/프로필), `unread_notification_count` 실제 연결

**notifications.js**: follow 알림 타입 렌더링 추가

---
### 2.10 팔로잉 피드 ✅ (v4.31 신규)

- **피드 탭**: `전체` / `팔로잉` 탭 분리 (비로그인 시 탭 숨김)
- **팔로잉 탭 정책**: 팔로잉한 유저 코스 최신순 우선 노출 → 소진 후 전체 최신순 (팔로잉 유저 제외) 이어서 노출
- **db.js**: `fetchFollowingCourses(followingIds, { page, pageSize })` 함수 추가
- **main.js**: `state`에 `tab`, `followingIds`, `followingDone`, `followingPage`, `followingTotal` 추가. 초기화 시 `fetchFollowings`로 팔로잉 ID 목록 로드 (`f.user_id` 기준)
- **index.html**: `<!-- 피드 탭 -->` 블록 추가 (`feedTabs`, `feed-tab`)
- **main.css**: `.feed-tabs`, `.feed-tab`, `.feed-tab.active` 스타일 추가

### 2.11 보안 강화 ✅ (v4.32 신규)

- **XSS 방어**: `utils.js`에 `sanitize()` 함수 추가. `innerHTML` 전수 점검 → `textContent` 교체 또는 sanitize 적용. 점검 대상: main.js, course.js, create.js, user.js, profile.js, sidebar.js, notifications.js. @mention 드롭다운(`createMentionDropdown`) 최우선 적용.
- **config.js 분리**: `.gitignore`에 `config.js` 추가. `config.example.js` 생성(빈 값). Vercel 환경변수로 이전. Supabase anon key Rotation.
- **event_logs RLS 제한**: `rate_limit_event_logs` 정책 추가 — 동일 `anonymous_id` 기준 1분 100건 초과 시 INSERT 차단. `logEvent()`에 try-catch 확인.
- **Storage 업로드 제한**: `course-photos` 버킷 정책 추가 — 5MB 이하, `image/jpeg` · `image/webp` · `image/png`만 허용. `photo.js` 클라이언트 이중 검증 추가.
- **비밀번호 정책 강화**: Supabase Authentication 최소 8자 설정. `login.js` 회원가입 폼 + `profile.js` 비밀번호 변경 폼에 `validatePassword()` 클라이언트 검증 추가(8자 이상, 영문+숫자 필수). 기존 계정 소급 미적용.

**변경 파일**: `utils.js`(신규), `login.js`, `profile.js`, `photo.js`, `config.js`, `.gitignore`, `config.example.js` + Supabase SQL/Storage 정책

### 2.12 버그픽스 및 UX 개선 ✅ (v4.33 신규)

**코스 상세 (`course.js`)**
- 한줄평 줄바꿈 `<hr class="tl-comment-rule"/>` → `<br/>` 교체 (불필요한 구분선 제거)

**로컬 개발 환경**
- `server.py` 추가 — `.html` 없는 URL 처리, 자동 브라우저 실행(`webbrowser.open`)

**지도 마커 (`map.js`)**
- '코스에 추가' 버튼 모바일 터치 지원 — `touchstart` 플래그 세팅, `touchend` 핸들러 추가
- 마커 `tap` 이벤트 추가 (모바일 툴팁 토글)
- 검색 결과 마커 생성 시 `road_address_name`, `address_name`, `place_url`, `phone`, `category_name`, `x`, `y` 전달

**코스 만들기 (`create.js`, `create.css`)**
- 지도 클릭 시 한줄평 포커스 해제 (`document.activeElement?.blur()`)
- 사진 시스템 개편 — 기존 사진 클릭 시 `confirm` 안내 후 새 사진 교체 방식으로 변경 (`reopenCrop` 제거)
- `confirm` 중복 발화 버그 수정 — `wrap._confirming` 플래그로 slot click 핸들러 중복 차단
- `has-photo` CSS 클래스 추가 — 사진 있을 때 `input[type="file"]` `pointer-events: none` 적용
- 썸네일도 동일하게 `confirm` + `_confirming` 플래그 적용

**사진 편집 (`photo.js`)**
- 되돌리기 버튼(`cropUndoBtn`) 추가 — 최대 20단계 히스토리 스택
- `saveHistory()` 적용 위치: 드래그 시작(`onDown`), 휠줌, 핀치줌 시작, 블러 타원 이동(`ellEl mousedown/touchstart`), 핸들 조절(`c mousedown/touchstart`), 타원 삭제(`delG click`)
- 핀치줌 히스토리 중복 저장 수정 — `touchmove` 진입 시 1회만 저장
- 모바일 블러 타원 이동 — `ellEl`에 `touchmove`/`touchend` 직접 추가
- 모바일 블러 핸들 조절 — `c`에 `touchmove`/`touchend` 직접 추가
- 모바일 삭제 아이콘 — `delG`에 `touchend` 추가, `ellipseDrag`/`handleDrag` null 초기화
- 모바일 복사 아이콘 — `copyG`에 `touchend` 추가
- 사진 변경 시 `cropHistory = []` 초기화 (이전 사진 상태 불일치 방지)

**변경 파일**: `course.js`, `create.js`, `create.css`, `map.js`, `photo.js`, `server.py`(신규)

---

### 3.1 역할 (Role)

| 역할 | 설명 |
|------|------|
| guest (비로그인) | 피드·상세 열람, 검색·필터 가능. 글쓰기·상호작용 불가 |
| user (일반) | 코스 CRUD, 좋아요, 북마크, 댓글, 참조, 신고. 본인 데이터만 수정·삭제 |
| admin | 모든 코스·댓글 삭제, 유저 role 변경, 신고 처리. 어드민 패널 접근 |

### 3.2 Supabase 주의사항
- 무료 플랜: DB 500MB, Storage 1GB, **1주일 미활동 시 자동 중지**
- 이메일 인증 OFF — 가상 이메일 `username@daycourse.com` 사용
- `SUPABASE_SERVICE_KEY` (service_role)는 절대 클라이언트에 노출 금지

---

## 4. DB 스키마 상세

### 4.1 users 테이블

```sql
users
├── id                        uuid, PK (Supabase Auth 연동)
├── username                  text       -- 아이디
├── nickname                  text       -- 닉네임
├── gender                    text       -- 'male'|'female'|'other' (선택)
├── birth_year                integer
├── age                       integer    -- birth_year 기반 자동 계산
├── region                    text       -- 거주 지역
├── user_xp                   integer    -- 누적 경험치 (default 0) [v4.2]
├── level                     integer    -- 현재 레벨 (pg_cron 30초 갱신) [v4.2]
├── bio                       text       -- 소개글 [v4.2]
├── profile_image_url         text       -- 프로필 이미지 URL [v4.2]
├── unread_notification_count integer    -- 미읽음 알림 수
├── role                      text       -- 'user'|'admin'
└── created_at                timestamptz
```

> ⚠️ `user_score` 컬럼 제거됨 (v4.2). `user_xp`로 대체.

### 4.2 courses 테이블

```sql
courses
├── id                  uuid, PK
├── name                text
├── description         text
├── region_main         text
├── region_sub          text
├── total_time          integer    -- 총 소요시간(분)
├── like_count          integer
├── comment_count       integer
├── reference_count     integer
├── thumbnail_url       text
├── author_id           uuid       -- FK → users.id
├── author_nickname     text
├── parent_course_id    uuid
├── original_course_id  uuid
├── is_plan             boolean    -- true: 계획 코스, false: 경험 코스 [v4.2]
├── is_deleted          boolean
└── created_at          timestamptz
```

### 4.3 course_places 테이블

```sql
course_places
├── id          uuid, PK
├── course_id   uuid, FK → courses.id
├── order_index integer
├── name        text
├── address     text
├── lat         numeric
├── lng         numeric
├── category    text
├── phone       text
├── place_url   text
├── comment     text       -- 한줄평 (선택)
├── stay_time   integer    -- 선택 [v4.2]
├── travel_time integer    -- 선택 [v4.2]
└── photo_url   text
```

### 4.4 follows 테이블 (v4.2 신규)

```sql
follows
├── follower_id   uuid, FK → users.id
├── following_id  uuid, FK → users.id
├── created_at    timestamptz
├── PRIMARY KEY (follower_id, following_id)
└── CHECK (follower_id <> following_id)  -- self-follow 방지
```

### 4.5 RPC 함수 목록

<!-- 다음 세션 참조 필요 — 최신 상태 -->

| 함수 | 설명 |
|------|------|
| `search_courses(...)` | 키워드 + 지역 + 시간 + 정렬 복합 검색 |
| `autocomplete_search(p_keyword, p_limit)` | 코스명·장소명 자동완성 |
| `get_user_stats(p_user_id)` | 유저 통계 (코스수, 좋아요, 참조, **follower/following** 포함) [v4.2] |
| `get_referenced_courses(p_course_id)` | 특정 코스를 참조한 코스 목록 |
| `get_liked_courses(p_user_id, ...)` | 좋아요한 코스 목록 |
| `get_bookmarked_courses(p_user_id, ...)` | 북마크한 코스 목록 |
| `get_followers(p_user_id)` | 팔로워 목록 [v4.2] |
| `get_followings(p_user_id)` | 팔로잉 목록 [v4.2] |
| `search_users_for_mention(p_keyword, p_current_user_id)` | @mention 유저 검색 [v4.2] |
| `add_user_xp(p_user_id, p_delta)` | XP 증감 [v4.2] |
| `add_user_xp_capped(p_user_id, p_delta, p_daily_max)` | 일일 한도 적용 XP 증감 [v4.2] |
| `calculate_level(p_xp)` | XP → 레벨 계산 [v4.2] |
| `upsert_notification(...)` | 알림 생성·집계 |
| `mark_notifications_read(p_user_id)` | 알림 일괄 읽음 처리 |
| `increment/decrement_like_count` | 좋아요 캐시 갱신 |
| `increment/decrement_comment_count` | 댓글 캐시 갱신 |
| `increment/decrement_reference_count` | 참조 캐시 갱신 |

---

## 5. 파일 간 의존 관계

```
db.js ← supabase.js, config.js
       ↑ 모든 페이지 JS에서 import

sidebar.js ← supabase.js
           ↑ 모든 페이지 JS에서 initSidebar() 호출

photo.js ← (cropAndCompress, reopenCrop export) [v4.2 전면 재작성]
          ↑ create.js, profile.js

map.js ← (kakao SDK 전역)
        ↑ create.js, course.js, plan-detail.js

main.js        ← db.js, sidebar.js, icons.js, supabase.js
course.js      ← db.js, sidebar.js, icons.js, supabase.js, map.js
create.js      ← db.js, sidebar.js, icons.js, map.js, photo.js
user.js        ← db.js, sidebar.js, icons.js
profile.js     ← db.js, sidebar.js, icons.js, photo.js
plan.js        ← db.js, sidebar.js, icons.js           [v4.2 신규]
plan-detail.js ← db.js, sidebar.js, icons.js, map.js  [v4.2 신규]
bookmarks.js   ← db.js, sidebar.js, icons.js
notifications.js ← db.js, sidebar.js, icons.js

admin/admin.js + 서브 모듈 ← supabase.js
```

---

## 6. 향후 작업 기획

- [ ] **카카오 로그인 활성화** — 코드 준비 완료, 비즈 앱 전환 필요
- [ ] **피드 BFCache 스크롤 위치 복원**

### Post-MVP (보류)

- 피드 팔로잉 기반 필터 — 일부 구현
- 공개/비공개 코스 설정
- 개인화 추천 알고리즘
- 해시태그 기능

---

## 7. 운영

- [ ] **카운터 캐시 정합성 정기 점검** (배포 후 월 1회 권장)
```sql
  SELECT c.id, c.name, c.like_count AS cached, count(cl.user_id) AS actual
  FROM public.courses c
  LEFT JOIN public.course_likes cl ON cl.course_id = c.id
  GROUP BY c.id, c.name, c.like_count
  HAVING c.like_count <> count(cl.user_id);
```

## 8. 작업 이력

| 날짜 | 버전 | 작업 내용 |
|------|------|-----------|
| ~ 2026.03.09 | v1 | Firebase + 카카오맵 초기 구현 |
| 2026.03.14~15 | v2 | Supabase 전환 전체 코드 재작성 |
| 2026.03.15~17 | v3 | 유저 페이지, 북마크, 알림, 어드민, 참조, 점수 시스템 |
| 2026.03.17~21 | v4 | 퍼널 로그 보강, 임시저장 v4, SEO, 도메인 전환 |
| 2026.03.23 | v4.1 | URL 구조 정리, DraftManager, OG Edge Function, RLS 점검 |
| 2026.03.27 | v4.2 | **R1** 코스 제작 UX 개선 (시간 선택·토글·피커). **R2** 코스 계획 기능 (is_plan, plan/plan-detail 페이지, 사이드바 메뉴). **R3** 이미지 처리 개선 (letterbox, 블러, 원본 보존, 사진 재편집, photo.js v7 전면 재작성). **R4** 레벨/XP 시스템 전면 도입 (LV1~50, 칭호, pg_cron, profile/user UI). **R5** 커뮤니티 기능 (follows 테이블, 팔로우/언팔로우, @mention 자동완성, 프로필 편집 바텀시트, 알림 red dot). 피드 거리순 정렬, 지하철역 검색 상단 노출 버그픽스 |
| 2026.03.27 | v4.31 | 팔로잉 피드 탭 — 전체/팔로잉 탭 분리, 팔로잉 코스 우선 노출 후 전체 최신순 혼합, fetchFollowingCourses 추가 |
| 2026.03.30 | v4.32 | 보안 강화 — XSS 방어(sanitize 함수), config.js 분리(.gitignore+Vercel 환경변수), event_logs RLS rate limit, Storage 업로드 제한(5MB+MIME), 비밀번호 정책 강화(8자+영문+숫자) |
| 2026.03.30 | v4.33 | 버그픽스 및 UX 개선 — 코스 상세 한줄평 줄바꿈 `<br/>` 처리, 로컬 개발 서버(`server.py`) 추가, 마커 '코스에 추가' 모바일 터치 지원, 지도 클릭 시 한줄평 포커스 해제, 사진 시스템 개편(사진 편집→교체 방식, confirm 중복 버그 수정, `has-photo` 클래스), photo.js 되돌리기 기능 추가(드래그/줌/블러 조작 히스토리), 모바일 블러 타원 이동·삭제·복사 touchmove/touchend 추가, 사진 변경 시 cropHistory 초기화 |
| 2026.03.31 | v4.34 | 사진 도용 대응 — 우클릭/드래그 방지, 워터마크 오버레이(코스 작성자 닉네임+데이코스). 이동수단 태그 — `course_places.transport` 컬럼 추가, create 세부사항 모드 아이콘 선택 UI(도보/대중교통/자차), course 타임라인 아이콘 표시, 임시저장/수정/복사 모드 유지. 캐러셀 한줄평 `white-space: pre-wrap` 적용. 구글 색인 생성 요청(9건 수동 제출) |