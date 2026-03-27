# 데이코스 (DayCourse) — 설정 & 배포 가이드 v4.1

> **배포 도메인**: https://daycourse.kr (GitHub Pages)  
> **저장소**: https://github.com/solka-dayco/daycourse  
> **최종 갱신**: 2026.03.23 (v4.1 — 1단계 리팩토링 완료)

---

## 1. 빠른 시작 체크리스트

### 1-1. Supabase 프로젝트 생성

1. https://supabase.com → New project 생성
2. **SQL Editor**에서 아래 순서대로 실행:
   ```
   1) schema.sql            ← 기본 테이블 + RLS + 기본 RPC
   2) schema_v3_additions.sql  ← v3/v4 신규 테이블·컬럼·RPC 추가 (멱등성 보장)
   ```
3. **Storage** → New bucket: `course-photos` (Public ON)
4. (선택) **Authentication** → Providers → Kakao 활성화
   - Kakao 개발자 콘솔에서 REST API 키 입력
   - Redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`

### 1-2. config.js 수정

```js
// config.js
export const SUPABASE_URL      = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';   // Project Settings > API
export const KAKAO_APP_KEY     = 'YOUR_KAKAO_APP_KEY';
export const STORAGE_BUCKET    = 'course-photos';
```

### 1-3. 카카오 개발자 콘솔 설정

- 플랫폼 → Web → 사이트 도메인 추가:
  - `http://localhost:8080`
  - `https://daycourse.kr`
- 카카오 로그인 → Redirect URI:
  - `https://<supabase-project>.supabase.co/auth/v1/callback`

### 1-4. 로컬 실행

```bash
python -m http.server 8080
# 브라우저: http://localhost:8080
```

> ⚠️ Supabase 무료 플랜은 **1주일 미활동 시 자동 중지**됩니다. 서비스 유지 시 주기적 접근 필요.

---

## 2. 파일 구조

```
daycourse/
│
├── index.html              # → main.html 리다이렉트 (SEO 메타 태그 삽입)
├── main.html               # 피드 (비로그인 열람 가능)
├── main.css / main.js      # 피드 스타일/로직 (v4 — 퍼널 로그 보강)
│
├── course.html             # 코스 상세 (OG/Twitter 카드 메타 태그 포함)
├── course.css / course.js  # 코스 상세 스타일/로직 (v4 — 퍼널 로그 강화)
│
├── create.html             # 코스 만들기 (로그인 필요)
├── create.css / create.js  # 코스 생성·수정·참조 (드래프트 v4, 썸네일 자동 대체)
│
├── login.html / login.js   # 로그인 + 회원가입 (탭 전환)
├── signup.html             # → login.html#signup 리다이렉트
├── nickname.html / nickname.js  # 프로필 설정 (가입 직후)
├── find.html / find.js     # 아이디·비밀번호 찾기
├── auth.css                # 인증 페이지 공통 스타일
│
├── user.html / user.js     # 공개 유저 페이지 (코스·참조 탭, 통계)
├── profile.html / profile.js    # 마이페이지 (내 정보·좋아요·북마크·내 코스 탭)
├── bookmarks.html / bookmarks.js # 북마크 목록 (무한 스크롤)
├── notifications.html / notifications.js # 알림 목록 (무한 스크롤)
│
├── privacy.html            # 개인정보처리방침
│
├── style.css               # 공통 스타일
├── main.css                # 피드 전용 스타일
├── user.css                # 유저/프로필 페이지 공통 스타일
├── profile.css             # 마이페이지 스타일
├── notifications.css       # 알림 페이지 스타일
│
├── sidebar.js              # 공통 사이드바 (로그인 상태 감지, 알림 뱃지)
├── icons.js                # SVG 아이콘 초기화 (initIcons / initSidebarIcons)
├── map.js                  # 카카오맵 유틸 (searchMarkers / courseMarkers 분리)
├── photo.js                # 4:5 크롭 / WebP 압축 (cropAndCompress)
├── app.js                  # 비로그인 체크 진입점
│
├── db.js                   # 모든 DB/Storage 접근 추상화 (v6, Supabase)
├── supabase.js             # Supabase 클라이언트 초기화
├── config.js               # 환경 변수 (URL, KEY, BUCKET)
│
├── schema.sql              # 기본 DB 스키마 + RLS + RPC
├── schema_v3_additions.sql # v3/v4 추가 스키마 (멱등성 보장)
├── migrate.js              # Firestore → Supabase 마이그레이션 (Node.js)
│
├── sitemap.xml             # 검색엔진 사이트맵
├── robots.txt              # 검색엔진 크롤링 정책
├── CNAME                   # GitHub Pages 커스텀 도메인 (daycourse.kr)
│
├── api/                    # Vercel Edge Functions
│   └── og.js               # OG 미리보기 (크롤러용 동적 메타 태그)
│
└── admin/                  # 어드민 패널 (관리자 전용)
    ├── admin.html          # 어드민 SPA (사이드바 탭 전환)
    ├── admin.css           # 어드민 전용 스타일
    ├── admin.js            # 어드민 진입점 + 인증 체크
    ├── dashboard.js        # DAU/MAU, 이벤트 집계, Chart.js 차트
    ├── reports.js          # 신고 목록 + 처리 (pending/resolved)
    ├── courses.js          # 코스 목록 + 삭제
    ├── comments.js         # 댓글 목록 + 삭제
    ├── users.js            # 유저 목록 + 권한 변경
    └── logs.js             # event_logs 조회 + 키워드 검색
```

---

## 3. v4 변경 사항 (현재 코드 기준)

### 3-1. v4 신규 / 변경 기능

| 구분 | 내용 |
|------|------|
| **퍼널 로그 전면 보강** | main.js·course.js 전체 사용자 행동 이벤트 세분화 (아래 이벤트 목록 참고) |
| **임시저장(드래프트) v4** | `DRAFT_VERSION = 4`, new/edit/copy 모드별 별도 키 관리. 최신 드래프트 자동 연결 |
| **코스 사진 필수 검증** | 장소 추가 시 사진 없으면 경고, 썸네일 미입력 시 첫 번째 장소 사진 자동 복사 |
| **썸네일 독립 업로드** | `courses.thumbnail_url` 컬럼에 코스 대표 이미지 별도 저장. 수정 모드에서 빈칸 유지 |
| **SEO 최적화** | course.html OG/Twitter 카드 메타 태그. 피드에 SEO용 코스 링크 블록(`seoCourseLinks`) 삽입. sitemap.xml + robots.txt |
| **어드민 패널** | `admin/` 디렉토리. Dashboard(Chart.js DAU/MAU), Reports, Courses, Comments, Users, Logs 6개 탭 |
| **무한 스크롤** | 피드(IntersectionObserver), 북마크, 알림, 유저·프로필 탭 전체 적용 |
| **Pull to Refresh** | 피드 최상단에서 아래로 64px 이상 드래그 시 자동 새로고침 |
| **자동완성 검색** | 2글자 이상, 320ms 딜레이. 코스명·장소명 구분 타입 표시. 키보드 화살표 탐색 |
| **도메인 전환** | GitHub Pages → `daycourse.kr` (CNAME 적용) |
| **유저 점수 시스템** | 코스 작성(+10), 댓글 작성(+2), 좋아요 받음(+1/-1), 참조 받음(+5). `add_user_score` RPC |
| **알림 시스템** | `notifications` 테이블. 좋아요/참조 aggregation upsert. 읽음 처리 RPC |
| **신고 시스템** | `reports` 테이블. course/comment 신고 중복 방지. 어드민에서 처리 |
| **공유 OG 카드** | 카카오톡 공유 시 코스 제목이 카드에 표시되도록 수정 |

### 3-2. v3에서 인계된 기능 (구현 완료)

| 기능 | 설명 |
|------|------|
| **Supabase 전환** | Firebase → Supabase (PostgreSQL + Storage + Auth) |
| **북마크** | `bookmarks` 테이블, 좋아요와 분리된 독립 기능 |
| **알림 인프라** | `notifications` 테이블 + `upsert_notification` RPC |
| **user.html** | Instagram 스타일 공개 유저 페이지 (코스·참조 탭, 통계) |
| **profile.html** | 마이페이지 (내 정보·좋아요·북마크·내 코스 탭 통합) |
| **참조 코스 목록** | 상세 페이지 하단 "이 코스를 참조한 코스" 섹션 (최대 6개) |
| **댓글 정렬** | 최신순·인기순·좋아요순 |
| **score 정렬** | `like_count × 2 + comment_count × 3 + reference_count × 4` |

---

## 3-2. v4.1 변경 사항 (2026.03.23)

### R1 — URL 구조 정리 ✅

| 항목 | 내용 |
|------|------|
| `vercel.json` 신규 생성 | rewrites (`.html` 없는 URL 서빙) + redirects (구 `.html` URL → 새 URL 301) + 보안 헤더 |
| `index.html` 교체 | 피드 콘텐츠 직접 담당. 기존 meta refresh 리다이렉트 제거 |
| `main.html` 삭제 | `index.html`로 통합 |
| 전체 내부 링크 치환 | 모든 HTML·JS 파일의 `.html` 경로 → `/path` 형태로 일괄 변환 |
| `sitemap.xml` 업데이트 | 새 URL 구조 반영, Google Search Console 재제출 완료 (4페이지 발견) |

**URL 변환표**

| 변경 전 | 변경 후 |
|---------|---------|
| `/main.html` | `/` |
| `/course.html?id=...` | `/course?id=...` |
| `/create.html` | `/create` |
| `/login.html` | `/login` |
| (그 외 동일 패턴) | |

### R2 — 드래프트 로직 안정화 ✅

| 항목 | 내용 |
|------|------|
| `DraftManager` 클래스 도입 | 자동저장·수동저장·복구·삭제 단일 진입점으로 통합 |
| 드래프트 버전 v5 | 구버전(v4) 드래프트 자동 무효화 |
| 바텀시트 복구 UI | 브라우저 `confirm()` → 자체 바텀시트 2단계 UI로 교체 |
| 스냅샷 기반 dirty 판별 | 초기 로드 상태 스냅샷 저장 → 실제 변경 시에만 드래프트 저장 |
| `beforeunload` 즉시 저장 | debounce pending 무관하게 이탈 직전 동기 저장 |
| 수정 모드 썸네일 복원 | edit 모드 진입 시 기존 썸네일 정상 표시 |

### R3 — OG 미리보기 ✅

| 항목 | 내용 |
|------|------|
| `api/og.js` 신규 생성 | Vercel Edge Function |
| 크롤러 판별 | `Mozilla/5.0` 시작 여부 기반 — 일반 브라우저(Chrome·Safari·인앱) 전부 통과, 그 외 크롤러 처리. `kakaotalk-scrap` 명시 예외 |
| Supabase REST API 조회 | `courses` + `course_places` 테이블 (anon key, RLS 공개) |
| thumbnail fallback | `thumbnail_url` 없으면 첫 번째 장소 `photo_url` 사용 |
| 일반 유저 처리 | `course.html` 인라인 반환 (fetch 루프 방지) |
| 캐시 설정 | `s-maxage=3600, stale-while-revalidate=86400` |
| Vercel 환경변수 | `SUPABASE_URL`, `SUPABASE_ANON_KEY` 프로젝트 등록 완료 |
| 검증 | 카카오톡 공유 디버거에서 썸네일·제목·소개글 정상 표시 확인 ✅ |

---

## 4. DB 스키마 요약

### 4-1. 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 (id, username, nickname, gender, birth_year, age, region, user_score, level, unread_notification_count, role) |
| `courses` | 코스 (name, description, region_main, region_sub, total_time, like_count, comment_count, reference_count, thumbnail_url, author_id, author_nickname, parent_course_id, original_course_id, is_deleted) |
| `course_places` | 코스 내 장소 (order_index, name, address, lat, lng, category, phone, place_url, comment, stay_time, travel_time, photo_url) |
| `course_likes` | 코스 좋아요 (unique: course_id + user_id) |
| `bookmarks` | 북마크 (unique: user_id + course_id) |
| `comments` | 댓글 |
| `comment_likes` | 댓글 좋아요 |
| `replies` | 답글 (1단계, comment_id 참조) |
| `reply_likes` | 답글 좋아요 |
| `notifications` | 알림 (aggregation 포함, is_read, agg_count) |
| `reports` | 신고 (target_type: course/comment, status: pending/resolved) |
| `event_logs` | 행동 로그 (user_id nullable, anonymous_id, session_id, event_name, target_type, target_id, event_page jsonb) |

### 4-2. 주요 RPC 함수

| 함수 | 설명 |
|------|------|
| `search_courses(...)` | 키워드 + 지역 + 시간 + 정렬 복합 검색 (score 포함) |
| `autocomplete_search(p_keyword, p_limit)` | 코스명·장소명 자동완성 |
| `get_user_stats(p_user_id)` | 유저 통계 (코스 수, 받은 좋아요, 참조 수) |
| `get_referenced_courses(p_course_id)` | 특정 코스를 참조한 코스 목록 (최대 6개) |
| `get_liked_courses(p_user_id, ...)` | 좋아요한 코스 목록 (페이지네이션) |
| `get_bookmarked_courses(p_user_id, ...)` | 북마크한 코스 목록 (페이지네이션) |
| `increment/decrement_like_count(course_id)` | 좋아요 카운터 캐시 갱신 |
| `increment/decrement_comment_count(p_course_id)` | 댓글 카운터 캐시 갱신 |
| `increment/decrement_reference_count(course_id)` | 참조 카운터 캐시 갱신 |
| `add_user_score(p_user_id, p_delta)` | 유저 점수 증감 (최소 0) |
| `upsert_notification(...)` | 알림 생성·집계 (course_like·course_reference는 aggregation) |
| `mark_notifications_read(p_user_id)` | 알림 일괄 읽음 처리 |
| `update_user_level()` | 점수 변경 시 레벨 자동 계산 트리거 함수 |
| `sync_age_from_birth_year()` | birth_year 저장 시 age 자동 동기화 트리거 함수 |
| `refresh_user_ages()` | age 일괄 갱신 (pg_cron 연동용) |

### 4-3. RLS 정책

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `courses` | 누구나 | user | 작성자 + admin | 작성자 + admin |
| `course_places` | 누구나 | 코스 작성자 본인 | 코스 작성자 본인 | 코스 작성자 본인 |
| `course_likes` | 누구나 | user (본인) | ❌ | user (본인) |
| `bookmarks` | 본인 | user (본인) | ❌ | user (본인) |
| `comments` | 누구나 | user | admin | 작성자 + admin |
| `comment_likes` | 누구나 | user (본인) | ❌ | user (본인) |
| `replies` | 누구나 | user | admin | 작성자 + admin |
| `reply_likes` | 누구나 | user (본인) | ❌ | user (본인) |
| `notifications` | 본인 | (RPC) | 본인 | ❌ |
| `reports` | admin | user (본인, `reporter_user_id = auth.uid()`) | admin | admin |
| `event_logs` | admin | 누구나 | ❌ | admin |
| `users` | 누구나 (username/nickname 공개) | Supabase Auth | 본인 + admin | ❌ |

> **2026.03.23 RLS 수정 이력**
>
> | 테이블 | 문제 | 조치 |
> |--------|------|------|
> | `course_places` | `allow insert course_places` 정책 (WITH CHECK=true) 중복 — 작성자 검증 무력화 | 삭제 |
> | `event_logs` | `allow insert for all`, `allow insert for authenticated` 중복 정책 2개 | 삭제 |
> | `reports` | INSERT WITH CHECK가 `auth.uid() IS NOT NULL` — reporter_user_id 위조 가능 | `auth.uid() = reporter_user_id` 로 교체 |

---

## 5. 행동 로그 이벤트 목록

`logEvent(eventName, targetType, targetId, metadata)` 로 기록.

### 피드 (main.js)

| 이벤트명 | 발생 시점 |
|----------|-----------|
| `page_view` | 피드 진입 |
| `page_restore` | BFCache로 피드 복원 |
| `search` | 검색 실행 |
| `search_clear` | 검색어 삭제 |
| `autocomplete_select` | 자동완성 항목 선택 |
| `filter_change` | 지역·시간 필터 변경 |
| `sort_change` | 정렬 변경 |
| `filter_reset` | 필터 초기화 |
| `feed_refresh` | Pull to Refresh |
| `course_view` | 카드 클릭 → 상세 이동 |
| `author_click` | 작성자 닉네임 클릭 |
| `comment_cta_click` | 댓글 버튼 클릭 |
| `like_click` / `like_cancel` | 좋아요 토글 |
| `login_required_click` | 비로그인 좋아요 시도 |

### 코스 상세 (course.js)

| 이벤트명 | 발생 시점 |
|----------|-----------|
| `course_view` | 상세 페이지 진입 |
| `author_click` | 작성자 닉네임 클릭 |
| `original_course_click` | 원본 코스 링크 클릭 |
| `course_edit_click` | 수정 버튼 클릭 |
| `course_delete_confirm` | 코스 삭제 확인 |
| `course_reference` | 참조 버튼 클릭 |
| `report_open` / `report_submit` | 신고 바텀시트 열기 / 제출 |
| `like_click` / `like_cancel` | 좋아요 토글 |
| `bookmark_add` / `bookmark_remove` | 북마크 토글 |
| `carousel_open` | 캐러셀 전체화면 뷰어 열기 |
| `carousel_nav` | 캐러셀 좌우 이동 |
| `carousel_swipe` | 캐러셀 스와이프 |
| `timeline_photo_jump` | 타임라인 썸네일 클릭 → 캐러셀 이동 |
| `viewer_nav` | 전체화면 뷰어 좌우 이동 |
| `place_link_click` | 장소명 카카오맵 링크 클릭 |
| `map_my_location` | 지도 내 위치 버튼 클릭 |
| `referenced_course_click` | 참조된 코스 카드 클릭 |
| `comment_sort_change` | 댓글 정렬 변경 |
| `comment_create` | 댓글 등록 |
| `comment_delete` | 댓글 삭제 |
| `comment_like` | 댓글 좋아요 |
| `reply_input_open` | 답글 입력창 열기 |
| `reply_create` | 답글 등록 |
| `reply_delete` | 답글 삭제 |
| `reply_like` | 답글 좋아요 |
| `share_click` | 공유 바텀시트 열기 |
| `share_copy_link` | 링크 복사 |
| `share_kakao` | 카카오톡 공유 |
| `comment_cta_click` | 댓글 수 버튼 클릭 |
| `login_required_click` | 비로그인 시 인증 필요 동작 시도 |

### 코스 만들기 (create.js)

| 이벤트명 | 발생 시점 |
|----------|-----------|
| `course_create_start` | 코스 만들기 페이지 진입 |
| `place_add` | 장소 추가 |
| `course_create_complete` | 신규 코스 저장 완료 |
| `course_edit` | 수정 모드 저장 완료 |
| `course_reference` | 참조 모드 저장 완료 |

---

## 6. 개발 워크플로우

```
1. config.js 수정 → 로컬 서버 실행 (python -m http.server 8080)
2. 기능 개발 + 테스트
3. git add → git commit (feat:/fix:/refactor: 컨벤션)
4. git push → GitHub Pages 자동 배포 (1~2분)
   → https://daycourse.kr 반영
```

---

## 7. 개발 컨벤션

- DB 접근 로직은 `db.js`로 완전 분리 — DB 전환 시 이 파일만 수정
- 카카오맵 SDK: `autoload=false` 방식 사용 (defer 제거)
- 검색 마커(`searchMarkers`)와 코스 마커(`courseMarkers`) 배열 분리 관리
- 모든 좋아요 버튼: `♥` 텍스트, liked 시 진한 회색(`#333`), 배경 변화 없음
- 수정 시 `찾을 코드` / `교체할 코드` 형식으로 안내 (토큰 절약)
- 커밋 이름: 실무 컨벤션 (`feat:`, `fix:`, `refactor:` 등)
- 카카오 로그인: 코드 구현 완료, 현재 주석 처리 (비즈 앱 전환 후 활성화)

---

## 8. 향후 작업 (미완료)

### 기능
- [ ] 카카오 로그인 활성화 (코드 준비 완료, 비즈 앱 전환 필요)
- [ ] 레벨 시스템 UI 노출 (현재 `display:none` 처리)
- [ ] 알림 뱃지 실시간 갱신 (현재 `unread_notification_count` 하드코딩 0)
- [ ] 코스 상세 OG 이미지 동적 생성 (현재 정적)
- [ ] 피드 캐싱 + 스크롤 위치 복원

### 운영
- [ ] Supabase 1주일 미활동 자동 중지 대응 (cron ping)
- [ ] pg_cron 활성화 후 `refresh-user-ages` 스케줄 등록
- [ ] Google Search Console sitemap 제출 확인

### DB 유지보수
- [x] RLS 정책 전체 점검 완료 (2026.03.23)
- [x] `like_count` 캐시 불일치 1건 수동 수정 — `행궁동 산책 데이트` (cached=2 → actual=1)
- [ ] 카운터 캐시 정합성 정기 점검 (배포 후 월 1회 권장)
  ```sql
  -- like_count 불일치 확인
  SELECT c.id, c.name, c.like_count AS cached, count(cl.user_id) AS actual
  FROM public.courses c
  LEFT JOIN public.course_likes cl ON cl.course_id = c.id
  GROUP BY c.id, c.name, c.like_count
  HAVING c.like_count <> count(cl.user_id);
  ```

### Post-MVP
- [ ] 공개/비공개 코스 설정
- [ ] 팔로우 / 채팅 / 협업
- [ ] 개인화 추천 알고리즘
- [ ] A/B 테스트 프레임워크

## v4.2 업데이트 계획 사항 (Chat GPT에서 작성한 계획, Claude에 맞춰서 재작성 및 재구성 필요)

### 코스 제작 방식 개선

코스 제작 시 이동시간과 체류시간 입력을 필수에서 제외하고, 총 소요시간 중심으로 입력 구조를 단순화했습니다.
필요한 경우에만 세부 시간을 입력할 수 있도록 선택 기능을 제공합니다.

---

### 코스 계획 기능 추가

실제 방문 전에도 코스를 미리 제작할 수 있도록 “코스 계획” 기능을 추가했습니다.
계획 코스는 비공개로 관리되며, 이후 실제 경험 후 수정하여 업로드할 수 있습니다.

---

### 프로필 기능 강화

프로필 이미지 설정 기능이 추가되었으며, 소개글과 닉네임을 직접 수정할 수 있습니다.
레벨, 칭호, 경험치 진행 상태가 프로필에 함께 표시됩니다.

---

### 레벨 시스템 도입

활동 기반 경험치 시스템을 도입하여 레벨이 상승하는 구조를 추가했습니다.
코스 업로드, 인용, 댓글, 좋아요 등의 활동을 통해 경험치를 획득할 수 있습니다.

---

### 커뮤니티 기능 확장

댓글에서 @태그를 통해 다른 유저를 호출할 수 있으며, 태그된 유저의 프로필로 이동할 수 있습니다.
유저 간 팔로우 기능도 추가되었습니다.

---

### 알림 기능 개선

@태그 등 상호작용 발생 시 알림이 생성되며, 마이페이지에서 확인할 수 있습니다.
읽지 않은 알림은 프로필 아이콘에 표시됩니다.

---

### 이미지 보호 기능

이미지 저장을 일부 제한하고, 화면에 워터마크를 적용하여 출처를 확인할 수 있도록 개선했습니다.
