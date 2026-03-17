# 데이코스 (DayCourse) 개발 플랜

> 이 문서는 자주 업데이트됩니다. 기능 기획, 분석 리포트, 작업 이력을 관리합니다.
> **v2 구현은 Supabase(PostgreSQL) 전환을 전제로 합니다.**
> **최종 갱신: 2026.03.15**

### 프로젝트 핵심 구조
```
Place → Course → Share
(장소 검색/추가) → (코스 구성/저장) → (피드 공유/탐색)
```

### 프로젝트 목표
1. **MVP 배포** — 코스 기반 장소 공유 웹서비스
2. **데이터 수집** — 사용자 행동 로그 기반 퍼널/리텐션/행동 분석
3. **서비스 개선** — A/B 테스트 기반 UX 개선 사이클
4. **포트폴리오** — 위 과정 전체를 데이터 분석 포트폴리오로 제작

---

## 1. v2 전제 조건: Supabase 전환 ✅ 완료

### 1.1 전환 이유
- Firestore는 키워드 부분 일치 검색, 복합 필터링 불가 → 피드 검색 엔진 구현 불가능
- base64 사진을 문서에 직접 저장하는 구조 → 1MB 문서 제한으로 확장성 한계
- Supabase는 무료 플랜에 Storage 1GB 포함 → 사진을 URL로 저장 가능
- SQL 기반으로 검색/필터/정렬 자유자재
- 인증 기본 제공 (카카오 로그인 지원)

### 1.2 전환 범위
- [x] Firebase Firestore → Supabase PostgreSQL
- [x] base64 사진 → Supabase Storage (URL 저장)
- [x] 자체 SHA-256 인증 → Supabase Auth (이메일/비밀번호)
- [x] 모든 데이터 접근 로직을 db.js로 분리하여 구현
- [x] 카카오 로그인 — 코드 구현 완료, 현재 주석 처리 (추후 활성화)

### 1.3 주의사항
- Supabase 무료 플랜: DB 500MB, Storage 1GB, **1주일 미활동 시 자동 중지**
- 기존 Firestore 데이터 마이그레이션 필요 (migrate.js 스크립트 구현 완료)
- 이메일 인증 OFF 상태 (가상 이메일 `username@daycourse.com` 사용)

---

## 2. v2 기능 구현 현황

### 2.1 인증 시스템 ✅ 완료
- [x] 자체 회원가입 (아이디/비밀번호)
- [x] 회원가입 후 프로필 설정 페이지 (nickname.html) 자동 이동
- [x] 프로필 입력: 닉네임, 성별, 출생연도, 거주 지역
- [x] 개인정보 수집 동의 체크박스 + 개인정보처리방침 페이지 (privacy.html)
- [x] 로그인 / 로그아웃
- [x] 아이디·비밀번호 찾기 (find.html)
- [x] 비로그인 사용자 피드/상세 열람 가능, 글쓰기/좋아요/댓글만 로그인 필요
- [x] 카카오 로그인 — 코드 구현 완료, 현재 주석 처리
  <!-- 추후 활성화 시: db.js signInWithKakao 주석 해제, login.html 카카오 버튼 주석 해제 -->

### 2.2 사진 시스템 ✅ 완료
- [x] 장소 1개당 사진 1장 연동 (선택)
- [x] 4:5 세로형 크롭 팝업 (드래그/핀치줌/휠줌, 3x3 가이드)
- [x] WebP 압축 (OUTPUT_WIDTH=800, 품질 0.82, ~80KB)
- [x] Supabase Storage 업로드, URL만 DB 저장
- [x] 피드 대표 이미지: 사진 있는 첫 번째 장소 photo_url 사용

### 2.3 캐러셀 (상세 페이지 상단) ✅ 완료
- [x] 흰 배경 래퍼 안에 배치, 코스 목록과 동일 너비 (max-width: 640px)
- [x] 좌우 스와이프 (터치/마우스), 스냅 한 장씩
- [x] 사진 없는 장소 제외, 네이비 그라데이션 플레이스홀더
- [x] 하단 검정 그라데이션 + 장소명(20px) + 한줄평(14px) 오버레이
- [x] 우측 상단 1/N 카운터
- [x] 사진 탭 → 전체화면 뷰어 (장소명 + 한줄평 캡션 표시)
- [x] 타임라인 사진 탭 → 캐러셀 해당 슬라이드로 이동

### 2.4 코스 만들기 ✅ 완료
- [x] 장소 검색 (카카오맵 keywordSearch) — 입력 시 자동검색 (0.4초 딜레이)
- [x] 검색 결과에 주소 표시
- [x] 현재 위치 기반 검색 정렬 (myLat/myLng 저장 후 location 옵션)
- [x] 지도 클릭 → 반경 30m 카테고리 검색
- [x] 내 위치 버튼 — 지도 내부 우측 하단 고정
- [x] 장소 추가 시 category/address/phone/place_url 자동 저장
- [x] 코스 목록 드래그 순서 변경 (SortableJS) — 첫 번째 이동 시간 자동 초기화
- [x] 장소별 사진 슬롯 (우측, 52px) — 크롭 팝업 연동
- [x] 장소별 한줄평 입력 (선택)
- [x] 체류 시간 선택 (필수, 모달 — 10가지)
- [x] 이동 시간 선택 (필수, 두 번째 장소부터, 모달 — 10가지)
- [x] 총 소요시간 자동 계산
- [x] 지역 태그 선택 (필수) — 전국 행정구역 기준 대분류 17개 + 세부
- [x] 코스 소개글 입력 (선택)
- [x] 저장 버튼 코스 목록 상단에 배치
- [x] 저장 후 상세 페이지 자동 이동
- [x] 수정 모드 (`?mode=edit&id=...`)
- [x] 참조 모드 (`?mode=copy&id=...`) — 장소/시간만 복사

### 2.5 상세 페이지 타임라인 ✅ 완료
- [x] 넘버링 원형 + 세로줄 연결
- [x] 장소명, 카테고리, 주소, 한줄평, 체류시간 표시
- [x] 우측 사진 썸네일 (58px) — 탭 시 뷰어 + 캐러셀 이동
- [x] 장소 간 Haversine 직선거리 + 이동 시간 표시
- [x] 총 장소 수 + 총 소요시간 요약

### 2.6 동선 지도 ✅ 완료
- [x] 카카오맵 + 넘버링 커스텀 오버레이 + Polyline
- [x] 내 위치 버튼 — 지도 내부 우측 하단 고정

### 2.7 코스 수정 / 참조 기능 ✅ 완료
- [x] 수정 모드 — 모든 데이터 로드, 저장 시 UPDATE
- [x] 참조 모드 — 장소/시간 복사, 소개글/한줄평/사진 미복사
- [x] 참조 체인 — original_course_id + parent_course_id 저장
- [x] 참조 표시 UI — 제목 아래 작은 회색 텍스트
- [x] parent reference_count +1/-1 처리
- [ ] 원본 게시글에 참조 카운터 표시 ("이 코스가 N번 참조되었습니다")

### 2.8 좋아요 시스템 ✅ 완료
- [x] course_likes 테이블 — unique 제약, race condition 없음
- [x] comment_likes, reply_likes 테이블 동일 패턴
- [x] 모든 좋아요 UI 통일 — ♥ 텍스트, 누르면 진한 회색(#333), 배경 변화 없음
- [x] 비로그인 → 로그인 페이지 유도

### 2.9 액션 바 (상세 페이지) ✅ 완료
- [x] 좋아요 · 댓글 수 · 참조(+참조 수) · 공유 순서로 하나의 컨테이너
- [x] 댓글 수 버튼 — 클릭 시 댓글 섹션으로 스크롤
- [x] 참조 수 표기 (reference_count)
- [x] 공유 바텀시트 (링크 복사 / 카카오톡 공유)
- [x] 헤더 공유 버튼 제거

### 2.10 댓글 시스템 ✅ 완료
- [x] 댓글 등록/삭제, 중복 등록 방지
- [x] 답글 등록/삭제
- [x] 댓글/답글 좋아요 (userId 배열 기반, 계정당 1회)
- [x] 상대 시간 표시 (방금 전 / N분 전 / N시간 전 / N일 전)

### 2.11 피드 ✅ 완료
- [x] 2열 카드 그리드 (모바일), 3열(640px+), 4열(960px+)
- [x] 대표 이미지 (4:5), 지역 배지, 코스명, 장소 경로, 소개글 한 줄
- [x] 좋아요 수 + 댓글 수 (답글 포함) 표시
- [x] 작성자 / 소요시간 배지
- [x] 카드 하단 작성자·좋아요·댓글 항상 같은 높이 정렬 (margin-top: auto)
- [x] 피드 검색 — 코스명/소개글/장소명/주소/한줄평 ILIKE (PostgreSQL RPC)
- [x] 필터 — 지역(대분류+세부), 소요시간 범위
- [x] 정렬 — 최신순/인기순/참조순/짧은순/긴순
- [x] 키워드 + 필터 + 정렬 조합 가능
- [x] 더 보기 (페이지네이션)

### 2.12 행동 로그 ✅ 완료
- [x] event_logs 테이블 (user_id nullable, metadata jsonb)
- [x] 구현된 이벤트: page_view, course_view, course_like, course_create_start, place_add, course_create_complete, carousel_swipe, share_click, comment_create, course_reference
- [ ] 미구현: search_query, course_create_abandon

### 2.13 향후 미구현 항목
- [ ] 카카오 로그인 활성화 (코드 준비 완료, 비즈 앱 전환 필요)
- [ ] 원본 게시글 참조 카운터 표시
- [ ] 장소 정보 팝업 (타임라인/지도 마커 클릭)
- [ ] 피드 카테고리 필터 (맛집/카페/액티비티)
- [ ] 프로필 페이지 (내 코스, 좋아요한 코스)
- [ ] 무한 스크롤
- [ ] SEO / Open Graph 메타 태그
- [ ] 어드민 페이지
- [ ] 행동 로그: search_query, course_create_abandon

---

## 3. 보안 정책 ✅ 구현 완료

### 3.1 역할 (Role)

| 역할 | 설명 |
|------|------|
| guest (비로그인) | 피드/상세 열람, 검색/필터 가능. 글쓰기/상호작용 불가 |
| user (일반 사용자) | 코스 CRUD, 좋아요, 댓글, 참조. 본인 데이터만 수정/삭제 |
| admin (관리자) | 모든 코스/댓글 삭제. MVP에서는 Supabase 대시보드로 대체 |

### 3.2 Supabase RLS 정책 ✅ schema.sql에 구현 완료

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| courses | 누구나 | user | 작성자 본인 | 작성자 본인 + admin |
| course_places | 누구나 | user | 작성자 본인 | 작성자 본인 |
| course_likes | 누구나 | user (본인만) | ❌ | user (본인만) |
| comments | 누구나 | user | ❌ | 작성자 본인 + admin |
| comment_likes | 누구나 | user (본인만) | ❌ | user (본인만) |
| replies | 누구나 | user | ❌ | 작성자 본인 + admin |
| reply_likes | 누구나 | user (본인만) | ❌ | user (본인만) |
| event_logs | ❌ | 누구나 | ❌ | admin |
| users | 공개 (username/nickname) | Supabase Auth | 본인만 | admin |

---

## 4. DB 설계 ✅ 구현 완료

### 4.1 users 테이블 (v2 추가 컬럼)
```sql
users
├── id (uuid, PK, Supabase Auth 연동)
├── username        -- 아이디
├── nickname        -- 닉네임 (nickname.html에서 입력)
├── gender          -- 'male' | 'female' | 'other' (선택)
├── birth_year      -- 출생연도 (선택, 데이터 분석용)
├── region          -- 거주 지역 (선택, 데이터 분석용)
├── role            -- 'user' | 'admin'
├── created_at
```

### 4.2 전체 테이블 구조
```sql
courses / course_places / course_likes
comments / comment_likes
replies / reply_likes
event_logs
```
→ 상세 스키마: `schema.sql` 참고

---

## 5. 파일 구조

```
daycourse/
├── index.html          # → main.html 리다이렉트
├── main.html / main.css / main.js       # 피드
├── login.html / login.js                # 로그인 + 회원가입
├── nickname.html / nickname.js          # 프로필 설정 (가입 직후)
├── find.html / find.js                  # 아이디·비밀번호 찾기
├── signup.html                          # → login.html#signup 리다이렉트
├── privacy.html                         # 개인정보처리방침
├── auth.css                             # 인증 페이지 공통 스타일
├── create.html / create.css / create.js # 코스 만들기
├── course.html / course.css / course.js # 코스 상세
├── style.css                            # 공통 스타일
├── sidebar.js                           # 공통 사이드바
├── map.js                               # 카카오맵 유틸 (searchMarkers/courseMarkers 분리)
├── photo.js                             # 4:5 크롭/WebP 압축
├── app.js                               # 비로그인 체크
├── db.js                                # DB 접근 추상화 (Supabase)
├── supabase.js                          # Supabase 클라이언트
├── config.js                            # 환경 설정
├── schema.sql                           # DB 스키마 + RLS + RPC
└── migrate.js                           # Firestore → Supabase 마이그레이션
```

---

## 6. 개발 컨벤션

- 수정 시 `찾을 코드` / `교체할 코드` 형식으로 안내
- 간단한 수정은 전체 코드 제공하지 않음 (토큰 절약)
- 커밋 이름은 실무 컨벤션 (`feat:`, `fix:`, `refactor:` 등)
- DB 접근 로직은 db.js로 분리 — DB 전환 시 이 파일만 수정
- 모든 좋아요 버튼: ♥ 텍스트, liked 시 진한 회색(#333), 배경 변화 없음
- 카카오맵 SDK: `autoload=false` 방식 사용 (defer 제거)
- 검색 마커(searchMarkers)와 코스 마커(courseMarkers) 배열 분리 관리

---

## 7. 작업 이력

| 날짜 | 작업 내용 |
|------|----------|
| ~ 2026.03.09 | v1 초기 구현 (Firebase, 카카오맵, 피드, 상세, 인증) |
| 2026.03.09 | 헤더/사이드바 통일, 인증 UI 개선, 댓글 시스템 개선 |
| 2026.03.14 | v2 전체 코드 구현 (Supabase 전환) |
| 2026.03.15 | 로그인 디버깅 (이메일 rate limit, 도메인 변경) |
| 2026.03.15 | 프로필 설정 페이지 추가 (닉네임/성별/나이/지역/동의) |
| 2026.03.15 | 카카오맵 마커 분리 (searchMarkers/courseMarkers) |
| 2026.03.15 | 캐러셀 UI 개선 (배경, 오버레이 텍스트 확대, 흰 배경 래퍼) |
| 2026.03.15 | 액션 바 통일 (좋아요·댓글·참조·공유) |
| 2026.03.15 | 좋아요 ♥ 텍스트 통일, 진한 회색 처리 |
| 2026.03.15 | 피드 댓글 수 (답글 포함) 표시 |
| 2026.03.15 | 피드 카드 하단 정렬 고정 (margin-top: auto) |
| 2026.03.15 | 지도 내 위치 버튼 우측 하단 고정 (create/course) |
| 2026.03.15 | 지역 세부 목록 전국 행정구역 기준 재작성 |
| 2026.03.15 | 저장 버튼 코스 목록 상단으로 이동 |
| 2026.03.15 | 검색 자동완성 (0.4초 딜레이) |
| 2026.03.15 | 개인정보처리방침 페이지 추가 |

---

## 8. 서비스 페이지 구조

DayCourse 서비스는 **3개의 영역으로 구성된다.**

```text
Explore → Create → Personal
(탐색)     (제작)     (개인)
```

### 8.1 탐색 영역 (Public)
로그인 없이도 접근 가능한 페이지. 콘텐츠 발견과 공유 중심.

#### 메인 피드
```text
main.html
```
- 코스 피드 탐색
- 검색
- 필터
- 정렬

#### 코스 상세
```text
course.html?id=COURSE_ID
```
- 캐러셀
- 타임라인
- 동선 지도
- 좋아요
- 북마크
- 댓글
- 공유

#### 유저 페이지
```text
user.html?id=USER_ID
```
Instagram 스타일 프로필

상단
```text
닉네임

코스 12   좋아요 84   참조 6
```

탭
```text
[ 코스 ]  [ 참조 ]
```

콘텐츠
- 사용자가 만든 코스
- 참조한 코스

### 8.2 콘텐츠 제작 영역 (Auth Required)
코스를 생성하거나 수정하는 콘텐츠 편집 영역.

#### 코스 만들기
```text
create.html
```
- 장소 검색
- 지도 선택
- 사진 업로드
- 체류시간 설정
- 이동시간 설정
- 코스 저장

#### 코스 수정
```text
create.html?mode=edit&id=COURSE_ID
```

#### 코스 참조 생성
```text
create.html?mode=copy&id=COURSE_ID
```

### 8.3 사용자 개인 영역 (Auth Required)
사용자 개인 데이터 관리 및 활동 확인.

#### 내 정보
```text
profile.html
```
- 닉네임
- 내가 만든 코스 목록

#### 활동 내역
```text
activity.html
```
섹션
```text
좋아요한 게시물
북마크한 게시물
내가 만든 코스
공유한 코스
```

#### 북마크
```text
bookmarks.html
```
- 사용자가 저장한 코스 목록
- 피드 카드 UI 재사용

#### 알림
```text
notifications.html
```
- 내 코스에 대한 사용자 반응 표시

### 8.4 인증 영역
- `login.html`
- `signup.html`
- `nickname.html`
- `find.html`

### 8.5 정책 페이지
- `privacy.html`

### 8.6 전체 페이지 목록
정리하면 총 **13개 페이지**

```text
index.html
main.html
course.html
user.html

create.html

profile.html
activity.html
bookmarks.html
notifications.html

login.html
signup.html
nickname.html
find.html

privacy.html
```

### 8.7 네비게이션 구조
Header
```text
로고        +
```
- `+` → 코스 만들기

Sidebar
```text
닉네임

[ 내 정보 ] [ 활동 내역 ]

----------------

홈
북마크
알림
```

---

## 9. 서비스 데이터 흐름 (Data Flow)

DayCourse는 **UGC(User Generated Content) 기반 코스 공유 플랫폼**이다.
사용자는 코스를 탐색하고, 제작하고, 다른 사용자와 상호작용한다.

서비스 데이터 흐름은 다음과 같이 구성된다.

```text
탐색 → 상호작용 → 제작 → 공유 → 알림
```

### 9.1 코스 탐색
```text
User → main.html → courses 조회
```
조회 데이터
- 코스 제목
- 대표 이미지
- 작성자
- 좋아요 수
- 댓글 수

DB 흐름
```text
courses
users
course_likes
comments
```

### 9.2 코스 상세 조회
```text
main → course.html?id=COURSE_ID
```
조회 데이터
- 코스 정보
- 장소 목록
- 타임라인
- 지도 경로
- 댓글

DB 흐름
```text
courses
course_places
places
comments
course_likes
bookmarks
```

### 9.3 사용자 상호작용
- 좋아요 → `course_likes`
- 북마크 → `bookmarks`
- 댓글 → `comments`
- 모든 행동은 `event_logs`에도 기록

### 9.4 코스 제작
```text
user → create.html → 코스 생성
```
입력 데이터
- 코스 제목
- 장소 리스트
- 방문 순서
- 체류시간
- 이동시간
- 사진

저장 데이터
```text
courses
course_places
course_images
```

### 9.5 코스 참조 제작
```text
course → reference → create.html?mode=copy
```
데이터 구조
```text
parent_course_id
```

### 9.6 사용자 활동 기록
기록 대상
```text
course_create
course_like
course_bookmark
course_share
comment_create
course_reference
```
저장 테이블
```text
event_logs
```
활용
- 활동 내역 페이지
- 알림 시스템
- 데이터 분석

### 9.7 알림 생성
```text
userA → userB 코스 좋아요
```
데이터 흐름
```text
event_logs
actor_user_id
target_user_id
```
이 데이터는 `notifications.html`에서 표시된다.

### 9.8 사용자 활동 조회
```text
activity.html
```
조회 데이터
```text
event_logs
WHERE actor_user_id = user
```
표시 항목
- 좋아요
- 북마크
- 코스 생성
- 코스 공유

### 9.9 전체 데이터 흐름
```text
1 탐색
main → course

2 상호작용
like / bookmark / comment

3 제작
create

4 공유
share / reference

5 기록
event_logs

6 알림
notifications
```

### 9.10 데이터 중심 구조
핵심 엔티티
```text
User
Course
Place
Interaction
```
관계
```text
User → Course 생성
Course → Place 포함
User → Course 상호작용
User → User 알림 발생
```

---

## 10. 사용자 시스템 확장 (프로필 · 활동 · 북마크 · 알림)

### 10.1 북마크 기능
좋아요와 **별도 기능으로 분리**한다.

상세 페이지 액션바
```text
♥ 좋아요   🔖 북마크   댓글   참조   공유
```

#### bookmarks 테이블
```text
bookmarks
├── id
├── user_id
├── course_id
├── created_at
```
제약
```text
unique(user_id, course_id)
```

#### 북마크 페이지
```text
bookmarks.html
```
- 사용자가 저장한 코스 목록
- 피드 카드 UI 재사용

### 10.2 활동 내역 페이지
```text
activity.html
```

UI 구조
```text
좋아요한 게시물
----------------

북마크한 게시물
----------------

내가 만든 코스
----------------

공유한 코스
```

표시 예시
- **성수 감성 카페 코스**에 좋아요를 눌렀습니다 · 3분 전
- **홍대 디저트 투어 코스**를 북마크했습니다 · 10분 전
- **민수**님이 **성수 감성 카페 코스**를 만들었습니다 · 1시간 전
- **민수**님이 **강릉 여행 코스**를 공유했습니다 · 어제

UI 규칙
- **코스 제목 볼드**
- **닉네임 볼드**
- 코스 제목 클릭 → 코스 페이지
- 닉네임 클릭 → 유저 페이지

### 10.3 알림 시스템
내 코스에 대한 **다른 사용자 행동 표시**

예
- **지훈**님이 **성수 감성 카페 코스**에 좋아요를 눌렀습니다
- **유진**님이 **홍대 밤 산책 코스**에 댓글을 남겼습니다
- **수아**님이 **을지로 술집 투어** 코스를 참조했습니다

알림 페이지
```text
notifications.html
```

### 10.4 event_logs 확장
기존 행동 로그를 **활동 내역 + 알림 시스템에 재사용**

#### 테이블 구조
```text
event_logs
├── id
├── actor_user_id
├── target_user_id
├── event_type
├── course_id
├── metadata
├── is_read
├── created_at
```

#### 이벤트 종류
```text
course_create
course_like
course_bookmark
course_share
comment_create
reply_create
course_reference
```

활용 방식
- 활동 내역 → `actor_user_id`
- 알림 → `target_user_id`

### 10.5 유저 페이지 (Instagram 스타일)
```text
user.html?id=USER_ID
```

상단 프로필
```text
닉네임

코스 12   좋아요 84   참조 6
```

표시 항목
- 닉네임
- 작성 코스 수
- 받은 좋아요 총합
- 참조된 횟수

※ 개인정보(거주지역, 나이)는 **표시하지 않음**
→ 데이터 분석용으로만 사용

탭 구조
```text
[ 코스 ]  [ 참조 ]
```
- 코스: 사용자가 만든 코스
- 참조: 다른 코스를 참조해서 만든 코스

콘텐츠 UI
- 피드와 동일한 카드 그리드 사용
- 반응형 2/3/4열 구조 유지

유저 페이지 접근 경로
1. 활동 내역 닉네임 클릭
2. 코스 상세 작성자 클릭
3. 피드 카드 작성자 클릭

---

## 11. 피드 시스템 설계

### 11.1 피드 정렬 알고리즘
메인 피드는 **최신성 + 반응 점수 기반 정렬**을 사용한다.

점수 계산
```text
score =
(like_count × 2)
+ (comment_count × 3)
+ (reference_count × 4)
```

| 요소 | 의미 |
|---|---|
| 좋아요 | 가벼운 반응 |
| 댓글 | 참여 |
| 참조 | 실제 활용 |

참조는 플랫폼 핵심 행동이므로 **가장 높은 가중치**를 부여한다.

### 11.2 피드 카드 표시 요소
피드 카드에는 다음 정보만 표시한다.
```text
대표 이미지
코스 제목
작성자 닉네임
좋아요 수
댓글 수
```
참조 여부는 **피드에서 표시하지 않는다.**
참조 정보는 **코스 상세 페이지에서만 표시한다.**

### 11.3 무한 스크롤
메인 피드는 **Infinite Scroll 방식**으로 동작한다.

동작 흐름
```text
초기 로드 → 코스 20개 표시
스크롤 하단 도달 → 다음 20개 로드
```

데이터 요청 방식
```text
cursor 기반 pagination
```
예
```text
/api/courses?cursor=LAST_COURSE_ID
```

### 11.4 Pull to Refresh
피드 상단에서 추가 스크롤 시 **새 코스를 새로고침**한다.

동작
```text
피드 상단 도달
↓
추가 스크롤
↓
로딩 아이콘 표시
↓
피드 새로고침
```

로딩 UI 예
```text
⟳ 새 코스 불러오는 중
```

### 11.5 피드 캐싱
피드는 **클라이언트 캐싱**을 사용한다.

캐싱 대상
```text
로드된 코스 목록
cursor
스크롤 위치
```

저장 위치
```text
sessionStorage
```

뒤로가기 시
```text
main → course → 뒤로가기
```
다음 상태를 복원한다.
```text
코스 리스트
스크롤 위치
```

### 11.6 검색 자동완성 (Search Autocomplete)
검색창 입력 시 **자동완성 추천 결과를 표시한다.**

사용자가 검색어를 입력하면 관련된 코스 제목 또는 장소 이름을 **실시간으로 추천한다.**

자동완성 대상
```text
코스 제목
장소 이름
```

입력 트리거
```text
입력 2글자 이상
입력 후 약 0.3 ~ 0.4초 지연
```

추천 결과는 **최대 5개**까지 표시한다.

추천 항목 클릭 시
```text
해당 키워드로 검색 실행
```

검색 결과가 없으면
```text
검색 결과 없음
```
을 표시한다.

구현 방식
```text
ILIKE 또는 trigram index
```

---

## 12. 코스 참조 시스템

### 12.1 참조 방식
참조 시 **원본 코스를 전체 복사**한다.

복사 데이터
```text
title
description
places
route
tags
images
```

참조 코스 생성 시
```text
parent_course_id 저장
```

흐름
```text
참조하기 클릭
↓
create.html?mode=copy
↓
원본 데이터 자동 입력
↓
사용자 수정 후 게시
```

참조 체인은 **1단계만 허용**한다.
```text
A (원본)
 └ B (A 참조)
```

### 12.2 참조 표시
코스 상세페이지 상단
```text
이 코스는 "원본 코스"를 참고하여 만들어졌습니다
```
원본 코스는 **클릭 가능 링크**로 제공한다.

### 12.3 참조 코스 목록
코스 상세페이지 하단에 다음 섹션을 추가한다.
```text
이 코스를 참조한 코스
```

표시 방식
```text
피드 카드 형태
```

조회
```sql
SELECT *
FROM courses
WHERE parent_course_id = current_course_id
ORDER BY created_at DESC
LIMIT 6
```

---

## 13. 댓글 시스템

댓글 구조
```text
댓글
 └ 답글 (1단계)
```
답글에는 **추가 답글을 허용하지 않는다.**

### 13.1 댓글 정렬
사용자는 댓글을 다음 기준으로 정렬할 수 있다.
```text
최신순
인기순
좋아요순
```

UI 예
```text
댓글 24

[ 최신순 ] [ 인기순 ] [ 좋아요순 ]
```

- 최신순: `created_at DESC`
- 인기순: `(좋아요 × 2) + (답글 수 × 3)`
- 좋아요순: `like_count DESC`

기본값은 **최신순**

---

## 14. 알림 시스템

### 14.1 알림 방식
알림은 **조회형 알림 시스템**을 사용한다.
실시간 WebSocket 알림은 사용하지 않는다.

### 14.2 알림 발생 이벤트
다음 행동에서 알림이 생성된다.
```text
course_like
course_comment
comment_reply
course_reference
```

### 14.3 notifications 테이블
```text
notifications
id
actor_user_id
target_user_id
type
course_id
comment_id
count
is_read
created_at
```

### 14.4 알림 묶기 (Aggregation)
같은 종류의 알림은 **하나로 묶는다.**

예
```text
민수님 외 8명이 성수 카페 코스에 좋아요를 눌렀습니다
```

묶기 대상
```text
course_like
course_reference
```

묶지 않는 것
```text
comment_create
reply_create
```

### 14.5 읽지 않은 알림 수
`users` 테이블에 다음 컬럼을 추가한다.
```text
unread_notification_count
```

알림 생성 시
```text
notifications insert
users.unread_notification_count +1
```

알림 페이지 조회 시
```text
unread_notification_count 초기화
```

사이드바에서는 COUNT 쿼리 대신 `users.unread_notification_count` 값을 사용한다.

---

## 15. 피드 성능 최적화

피드 성능을 위해 **Counter Cache 구조**를 사용한다.

`courses` 테이블
```text
like_count
comment_count
reference_count
```

동작
- 좋아요 → `course_likes insert` 후 `courses.like_count +1`
- 댓글 → `comments insert` 후 `courses.comment_count +1`
- 참조 → 원본 `courses.reference_count +1`

피드 조회 시 **COUNT 쿼리를 사용하지 않는다.**

---

## 16. 사용자 레벨 시스템

사용자 활동 기반 **레벨 시스템**을 도입한다.

점수 기준
```text
코스 작성 +10
댓글 작성 +2
좋아요 받음 +1
코스 참조됨 +5
```

유저 점수
```text
user_score
```

레벨 예시
```text
Lv1 탐험가
Lv2 코스 메이커
Lv3 로컬 가이드
Lv4 트렌드 세터
Lv5 마스터 플래너
```

프로필 표시
```text
닉네임
Lv3 로컬 가이드
코스 12
총 참조 41
```

초기 MVP에서는 **레벨 표시만 적용**하고 배지 / 업적 시스템은 추후 확장한다.

---

## 17. 사진 정책 개편

초기 MVP에서는 사진을 두 종류로 분리한다.

### 17.1 코스 대표 썸네일
- 사용자가 직접 업로드하는 대표 이미지
- `courses.thumbnail_url`에 저장
- 피드, 유저 페이지, 북마크 등 카드형 UI에서 사용
- 4:5 비율 기준
- 비교적 낮은 용량과 빠른 로딩을 우선한다

### 17.2 장소 사진
- 장소별 사진은 기존처럼 장소당 1장 구조를 유지한다
- `course_places.photo_url`에 저장
- 코스 상세 페이지의 캐러셀, 전체화면 뷰어, 타임라인 썸네일에 사용한다
- 최대 10장 수준의 사진을 고려하여, 썸네일보다 높은 품질을 유지한다

### 17.3 표시 우선순위
- 피드 카드 대표 이미지는 `thumbnail_url`을 우선 사용한다
- 대표 썸네일이 없는 경우 첫 번째 장소 사진을 fallback으로 사용한다

### 17.4 운영 원칙
- 피드용 썸네일은 성능 우선
- 상세용 장소 사진은 체감 품질 우선

---

## 18. 코스 길이 정책

코스는 **최소 2개, 최대 10개 장소**로 제한한다.

원칙
```text
최소 2개 장소 필요
최대 10개 장소까지 추가 가능
```

이유
- 코스는 이동이 있어야 의미 있음
- 타임라인 / 지도 / 캐러셀 UI 안정성 유지
- 하루 코스 단위의 사용성 유지

시간 범위 제한은 두지 않는다.
총 소요시간은 장소별 체류시간과 이동시간을 바탕으로 자동 계산한다.

---

## 19. 콘텐츠 관리 정책 (MVP)

초기 MVP에서는 **복잡한 자동 탐지 알고리즘 없이**, 신고 기능과 수동 관리 중심으로 운영한다.

### 19.1 신고 대상
사용자는 다음 항목을 신고할 수 있다.
```text
코스
댓글
```

### 19.2 신고 기능
신고 시 다음 정보를 저장한다.
```text
report_id
reporter_user_id
target_type      // course | comment
target_id
reason
created_at
status           // pending | resolved
```

### 19.3 신고 사유
MVP에서는 고정된 신고 사유를 사용한다.
```text
스팸 / 광고
부적절한 내용
욕설 / 비방
기타
```

### 19.4 운영 방식
신고가 접수되면 **관리자가 수동으로 확인**한다.

처리 방식
```text
신고 접수
→ 관리자 확인
→ 숨김 또는 삭제
```

초기에는 별도의 복잡한 자동 제재 로직은 두지 않는다.

### 19.5 단순 제한 정책
MVP에서는 필요 시 다음 수준의 **단순 제한 정책**만 적용한다.
```text
짧은 시간 내 과도한 코스 생성
짧은 시간 내 반복 댓글 작성
신고 누적 다수 발생 항목
```
이 경우 **관리자 확인 대상**으로 우선 분류한다.

### 19.6 운영 원칙
초기 서비스는 **신고 기능 + 수동 확인**만으로 운영한다.
사용자 수와 신고량이 증가할 경우 이후 단계에서 자동 탐지 정책을 확장한다.

---

## 20. MVP 제외 기능 (Post-MVP)

초기 MVP에서는 다음 기능을 의도적으로 제외한다.

```text
코스 공개 / 비공개
팔로우 시스템
채팅 / 메시지
협업 코스 편집
북마크 폴더
개인화 추천
```

설명
- 코스 공개 / 비공개: 추후 권한 설계와 함께 별도 논의
- 팔로우 시스템: 코스 중심 플랫폼 구조 유지
- 채팅 / 메시지: 실시간 인프라 부담
- 협업 코스 편집: 권한 / 충돌 처리 복잡
- 북마크 폴더: 저장 기능 자체가 먼저
- 개인화 추천: 피드 정렬 / 검색 안정화 후 검토

---
