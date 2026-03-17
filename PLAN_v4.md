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
