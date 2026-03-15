# 데이코스 (DayCourse) 개발 플랜

> 이 문서는 자주 업데이트됩니다. 기능 기획, 분석 리포트, 작업 이력을 관리합니다.
> **v2 구현은 Supabase(PostgreSQL) 전환을 전제로 합니다.**

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

## 1. v2 전제 조건: Supabase 전환

### 1.1 전환 이유
- Firestore는 키워드 부분 일치 검색, 복합 필터링 불가 → 피드 검색 엔진 구현 불가능
- base64 사진을 문서에 직접 저장하는 구조 → 1MB 문서 제한으로 확장성 한계
- Supabase는 무료 플랜에 Storage 1GB 포함 → 사진을 URL로 저장 가능
- SQL 기반으로 검색/필터/정렬 자유자재
- 인증 기본 제공 (카카오 로그인 지원)

### 1.2 전환 범위
- [x] Firebase Firestore → Supabase PostgreSQL
- [x] base64 사진 → Supabase Storage (URL 저장)
- [x] 자체 SHA-256 인증 → Supabase Auth
- [x] 모든 데이터 접근 로직을 db.js로 분리하여 구현

### 1.3 주의사항
- Supabase 무료 플랜: DB 500MB, Storage 1GB, 1주일 미활동 시 자동 중지
- 기존 Firestore 데이터 마이그레이션 필요 (migrate.js 스크립트 구현 완료)

---

## 2. v2 기능

### 2.1 사진 시스템 개편
- [x] **장소 1개당 사진 1장 연동** (선택, 비워둘 수 있음)
  - 기존 photos 배열 제거 → places 테이블의 각 장소에 photo_url 필드 (Storage URL 또는 null)
  - 최대 사진 수 = 장소 수 (별도 상한 없음)
  - 사진 없는 장소는 캐러셀에서 제외
- [x] 이미지 압축 후 Supabase Storage에 업로드, URL만 DB에 저장
- [x] 사진 비율 **4:5 세로형**으로 변경 (크롭 팝업 로직 수정 완료)
- [x] 피드 대표 이미지: 사진이 있는 첫 번째 장소의 photo_url 사용
- [x] 코스 만들기 타임라인: 우측에 작은 사진 슬롯 (+ 버튼 → 업로드 → 크롭/드래그/줌)
- [ ] **장기 과제:** 장소당 여러 장 확장 가능 (Storage 용량 여유 시)

### 2.2 캐러셀 (상세 페이지 상단)
- [x] 인스타그램 스타일 좌우 스와이프 (스냅, 한 장씩 걸림)
- [x] 사진이 있는 장소만 표시
- [x] 비율 4:5, 숫자 카운터 우측 상단 (1/N)
- [x] 하단 검정 그라데이션 + 해당 장소명 + 한줄평 오버레이
- [x] 사진 탭 시 기존 전체화면 뷰어 진입 (유지)
- [x] 타임라인 장소 사진 탭 → 캐러셀 해당 사진으로 스크롤 + 상단 이동
- [x] 모바일 최적화 (터치 스와이프 반응)

### 2.3 장소 데이터 확장 (코스 생성 시)
- [x] 장소 추가 시 상세 정보 자동 저장 (`category`, `address`, `phone`, `place_url`)
- [x] 장소별 한줄평 입력 (선택, 비워두면 안 보임)
- [x] 코스 전체 소개글 입력 (선택)
- [x] **지역 태그 선택 (필수)** — 대분류 + 세부 2단계
  - 대분류: 서울 / 경기 / 인천 / 부산 / 대구 / 대전 / 광주 / 제주 등
  - 세부: 서울 → 강남 / 홍대 / 이태원 / 성수 / 여의도 등
- [x] 저장 후 해당 코스 상세 페이지로 자동 이동
- [x] **체류 시간 입력 (필수)** — 선택 버튼 방식
  - 선택지: 30분 / 1시간 / 1시간 30분 / 2시간 / 2시간 30분 / 3시간 / 3시간 30분 / 4시간 / 4시간 30분 / 5시간 이상
  <!-- ⚠️ 설계 메모: 체류 시간은 현재 필수 입력. 선택 입력으로 전환 시 saveCourse()의 유효성 검사에서 stayTime 체크를 제거하고, renderPlaces()에서 null 처리 추가 필요 -->
- [x] **이동 시간 입력 (필수, 두 번째 장소부터)** — 선택 버튼 방식
  - 선택지: 5분 / 10분 / 15분 / 20분 / 30분 / 40분 / 50분 / 1시간 / 1시간 30분 / 2시간 이상
  <!-- ⚠️ 설계 메모: 이동 시간은 현재 필수 입력. 선택 입력으로 전환 시 saveCourse()의 유효성 검사에서 travelTime 체크를 제거하고, 타임라인 UI에서 null일 때 이동 시간 행을 숨기는 처리 필요 -->
- [x] **최종 예상 소요시간** = 체류 시간 합산 + 이동 시간 합산 → 상세 페이지 상단에 표시
  <!-- ⚠️ 설계 메모: 체류/이동 시간이 선택 입력으로 전환되면, 하나라도 미입력 시 총 소요시간을 "약 N시간+" 또는 비표시 처리 필요 -->

### 2.4 상세 페이지 타임라인 (트리플 스타일)
- [x] 좌측 넘버링(원형) + 세로줄 연결, 세로줄 우측에 거리 표시
  ```
  ●① ── 존앤진피자팜 행궁본점 — 🕐 1시간       [📷]
   │     📍 수원시 팔달구 | 🏷 음식점
   │     "피자가 정말 맛있어요!"
   │
   │     200m · 이동 10분
   │
  ●② ── 보드게임카페 홈즈앤루팡 — 🕐 2시간      [📷]
   │     📍 수원시 팔달구 | 🏷 카페
   │
   │     450m · 이동 40분
   │
  ●③ ── 운멜로 1호점 — 🕐 1시간                 [📷]
        📍 수원시 팔달구 | 🏷 카페

  📍 총 3곳 | ⏱ 약 4시간 50분
  ```
- [x] 우측에 작은 사진 썸네일 (세로 가운데 정렬, 58px)
- [x] 장소 간 거리 자동 계산 (Haversine 직선거리, map.js 함수 분리)
- [x] 마지막 장소 아래에는 세로줄 없음
- [x] 모바일 최적화: 넘버링 24px, 세로줄 2px, 텍스트 14/12/13px, 좌우 패딩 16px
- [ ] **장기 과제:** 카카오모빌리티 길찾기 API로 실제 도로 거리/시간 교체 가능
  ```javascript
  // 현재: Haversine 직선거리 (map.js getDistance)
  // 나중에 API 교체 시 이 함수만 변경
  // async function getDistance(lat1, lng1, lat2, lng2) { ... }
  ```

### 2.5 장소 정보 팝업
- [ ] 상세 페이지에서 장소 목록 클릭 시 정보 팝업 표시
- [ ] 지도 마커 클릭 시에도 동일한 팝업 표시
- [ ] 팝업 내용: 장소명, 카테고리, 주소, 전화, 작성자 한줄평
- [ ] 카카오맵 외부 링크 연동 방식 — 보류 (place_url 데이터는 저장해둠)

### 2.6 코스 수정 / 참조 기능
- [x] **수정 모드** (`?mode=edit&id=코스ID`)
  - 모든 데이터 그대로 불러옴 (사진 포함)
  - 저장 시 기존 레코드 UPDATE
- [x] **참조 모드** (`?mode=copy&id=코스ID`)
  - 복사됨: 장소 목록 (이름, 주소, 카테고리, 좌표, place_url), 체류/이동 시간
  - 복사 안 됨: 소개글, 한줄평, 사진
  - 저장 시 새 레코드 INSERT, 작성자는 현재 로그인 사용자
  - 원본 출처 자동 추가 + parent의 reference_count +1
- [x] **참조 체인 (B방식 — 직접 참조 추적)**
  - `original_course_id` (최초 원본) + `parent_course_id` (직접 참조한 글) 두 개 저장
  - parent 삭제 시 → original로 폴백 표시
  - 둘 다 삭제 시 → "삭제된 코스" 표시
  - 참조 코스 삭제 시 → parent의 reference_count -1 (레코드 존재 체크 후 실행, 없으면 무시)
  - original의 reference_count는 건드리지 않음 (직접 참조 parent만 카운트)
- [x] **참조 표시 UI** — 작고 은은하게 (12px, #bbb 연한 회색)
  - 제목 + 날짜 + 작성자 아래에: `참조: OOO의 "코스이름"`
- [ ] **원본 게시글에 참조 카운터 표시** — "이 코스가 N번 참조되었습니다"

### 2.7 좋아요 시스템 통일
- [x] **게시글 좋아요: course_likes 테이블로 관리**
  - (course_id, user_id) unique 제약 → 중복 불가, race condition 없음
  - 좋아요 수는 courses.like_count 캐시 컬럼 + RPC로 증감
  - 토글 방식 (INSERT / DELETE)
- [x] 댓글/답글 좋아요도 동일 패턴 (comment_likes, reply_likes 테이블)
- [x] 비로그인 사용자는 좋아요 불가 → 로그인 유도

### 2.8 피드 검색 엔진
- [x] **키워드 검색**
  - 매칭 대상: 코스 이름, 소개글, 장소 이름, 장소 주소, 장소 한줄평
  - PostgreSQL `ILIKE` (search_courses RPC 함수)
- [x] **필터**
  - 지역: 대분류 + 세부 2단계 태그
  - 소요시간: 범위 필터 (2시간 이하 / 3시간 이하 / 4시간 이하 / 5시간 이하)
  - 카테고리 필터: [ ] 미구현 (장소 카테고리 기반 — 향후 추가)
- [x] **정렬**
  - 최신순 (기본값)
  - 인기순 (좋아요 수)
  - 참조 많은 순 (reference_count)
  - 소요시간 짧은/긴 순
- [x] 키워드 + 필터 + 정렬 조합 가능

### 2.9 검색 고도화 (코스 만들기)
- [x] 검색 결과에 주소 표시 (같은 이름 장소 구분)
- [x] 현재 위치 기반 검색 정렬 (가까운 장소 우선) — myLat/myLng 저장 후 location 옵션 전달

### 2.10 피드 / 메인 페이지
- [x] **메인 페이지 = 피드 페이지** (main.html)
- [x] **비로그인 사용자도 피드 열람 가능** (글쓰기/좋아요/댓글만 로그인 필요)
- [x] 피드 카드에 코스 소개글 한 줄 표시 (클릭 유도)
- [ ] **향후 마케팅용 확장 예정:**
  - 인기 피드 섹션 (좋아요/참조 많은 코스)
  - 지역별 추천 코스
  - 에디터 추천 / 시즌별 큐레이션
  - 신규 사용자용 온보딩 (샘플 코스, 빈 피드 안내)

### 2.11 행동 로그 수집 (데이터 분석용)
- [x] event_logs 테이블에 사용자 행동 이벤트 기록
- [x] **event_logs 테이블 구조:**
  ```
  event_logs
  ├── id (uuid, PK)
  ├── user_id (nullable, 비로그인도 기록)
  ├── event_name          -- 이벤트 이름
  ├── target_type         -- 대상 종류 ('course', 'comment', 'page' 등)
  ├── target_id           -- 대상 ID (nullable)
  ├── metadata (jsonb)    -- 이벤트별 상세 데이터
  ├── created_at
  ```
- [x] **MVP 핵심 이벤트 구현 완료:**
  | event_name | target_type | 설명 |
  |------------|-------------|------|
  | page_view | page | 페이지 진입 (피드, 상세, 만들기) |
  | course_view | course | 코스 상세 조회 |
  | course_like | course | 코스 좋아요 |
  | course_create_start | course | 코스 만들기 진입 |
  | place_add | course | 장소 추가 |
  | course_create_complete | course | 코스 저장 완료 |
- [x] **확장 이벤트 구현 완료:**
  - carousel_swipe: 캐러셀 스와이프
  - share_click: 공유 버튼 클릭 (링크복사/카카오톡)
  - comment_create: 댓글 작성
  - course_reference: 코스 참조
- [ ] **확장 이벤트 미구현:**
  - search_query: 검색 키워드, 필터/정렬 사용 내역
  - course_create_abandon: 코스 만들기 이탈 시점
- [x] **분석 목적 설계 완료:**
  - 퍼널: page_view → course_view → course_create_start → place_add → course_create_complete 전환율
  - 리텐션: DAU/WAU/MAU, 재방문 주기
  - 인기 콘텐츠: course_view 대비 course_like 비율
  - 검색 패턴: 많이 검색되는 키워드, 필터 조합
  - A/B 테스트: metadata에 실험 그룹 태깅 가능

### 2.12 향후 확장 검토 (미확정)
- [ ] 프로필 페이지 (내가 쓴 코스, 좋아요한 코스)
- [ ] 태그/카테고리 시스템 고도화
- [ ] 무한 스크롤 (현재: 더 보기 버튼 구현)
- [ ] 좋아요 누른 사람 목록 보기
- [ ] SEO / Open Graph 메타 태그 (동적 공유 프리뷰)
- [ ] Supabase Auth로 소셜 로그인 (구글 추가)
- [ ] 어드민 페이지 (사용자 규모 커지면)
- [ ] A/B 테스트 프레임워크 (metadata에 실험 그룹 태깅)
- [ ] **원본 게시글에 참조 카운터 표시** — "이 코스가 N번 참조되었습니다"
- [ ] 장소 정보 팝업 (상세 페이지 타임라인/지도 마커 클릭)
- [ ] 피드 카테고리 필터 (맛집 위주 / 카페 위주 / 액티비티)
- [ ] 행동 로그: search_query, course_create_abandon 이벤트

### 2.13 진행 단계
- [x] UX 리스크 검토 완료
- [x] 이벤트 로그 설계 완료
- [x] UI 디자인 기획 완료 (캐러셀, 타임라인, 사진 시스템)
- [x] 보안 정책 설계 완료 (RLS, 역할)
- [x] Supabase 전환 결정
- [x] DB 스키마 전체 검토 완료 (최종 확정)
- [x] **v2 코드 구현 완료** (2026.03.14)
- [ ] 카카오 개발자 콘솔 — `localhost` 도메인 등록
- [ ] 카카오 개발자 콘솔 — 카카오 로그인 Redirect URI 등록
- [ ] Supabase 프로젝트 생성
- [ ] Supabase — 테이블 생성 SQL 실행 (`schema.sql`)
- [ ] Supabase — RLS 정책 적용 (`schema.sql` 포함)
- [ ] Supabase — Storage 버킷 생성 (`course-photos`, Public)
- [ ] Supabase — 카카오 OAuth 키 입력 (대시보드)
- [ ] `config.js` 실제 키 입력
- [ ] Firestore → Supabase 데이터 마이그레이션 (`migrate.js` 실행)
- [ ] 로컬 테스트 완료 후 GitHub Pages 배포

---

## 3. 보안 정책

### 3.1 역할 (Role)

| 역할 | 설명 |
|------|------|
| guest (비로그인) | 피드/상세 열람, 검색/필터 가능. 글쓰기/상호작용 불가 |
| user (일반 사용자) | 코스 CRUD, 좋아요, 댓글, 참조. 본인 데이터만 수정/삭제 |
| admin (관리자) | 모든 코스/댓글 삭제, 사용자 관리. MVP에서는 Supabase 대시보드로 대체 |

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

### 3.3 users 테이블 role 컬럼
- 기본값: `'user'`
- admin은 Supabase 대시보드에서 직접 설정
- 향후 어드민 페이지 구현 시 role 기반 접근 제어

---

## 4. Supabase DB 설계 (v2) ✅ 구현 완료

### 4.1 테이블 구조

```sql
-- 사용자
users
├── id (uuid, PK, Supabase Auth 연동)
├── username
├── nickname
├── role              -- 'user' | 'admin' (기본값: 'user')
├── created_at

-- 코스
courses
├── id (uuid, PK)
├── name
├── description          -- 코스 소개글
├── region_main          -- 지역 대분류 (서울, 경기 등)
├── region_sub           -- 지역 세부 (강남, 홍대 등)
├── total_time           -- 총 소요시간 (분)
├── like_count           -- 좋아요 캐시
├── reference_count      -- 참조 횟수
├── original_course_id
├── original_author_nickname
├── original_course_name
├── parent_course_id
├── parent_author_nickname
├── parent_course_name
├── author_id (FK → users)
├── author_nickname
├── created_at

-- 코스 장소
course_places
├── id (uuid, PK)
├── course_id (FK → courses)
├── order_index          -- 순서
├── name
├── lat, lng
├── category, address, phone, place_url
├── comment              -- 한줄평
├── photo_url            -- Storage URL
├── stay_time            -- 체류 시간 (분)
├── travel_time          -- 이동 시간 (분, 첫 번째는 null)

-- 좋아요
course_likes
├── course_id (FK → courses)
├── user_id (FK → users)
├── UNIQUE(course_id, user_id)

-- 댓글
comments
├── id (uuid, PK)
├── course_id (FK → courses)
├── author_id (FK → users)
├── nickname
├── content
├── created_at

-- 댓글 좋아요
comment_likes
├── comment_id (FK → comments)
├── user_id (FK → users)
├── UNIQUE(comment_id, user_id)

-- 답글
replies
├── id (uuid, PK)
├── comment_id (FK → comments)
├── author_id (FK → users)
├── nickname
├── content
├── created_at

-- 답글 좋아요
reply_likes
├── reply_id (FK → replies)
├── user_id (FK → users)
├── UNIQUE(reply_id, user_id)

-- 행동 로그
event_logs
├── id (uuid, PK)
├── user_id (nullable, 비로그인도 기록)
├── event_name           -- 'page_view', 'course_view', 'course_like' 등
├── target_type          -- 'course', 'comment', 'page' 등
├── target_id (nullable) -- 대상 ID
├── metadata (jsonb)     -- 이벤트별 상세 데이터 (검색어, 필터, A/B 그룹 등)
├── created_at
```

### 4.2 기존 Firestore 대비 개선점
- 좋아요: 별도 테이블 + unique 제약 → race condition 없음, 중복 불가
- 답글: 배열이 아닌 별도 테이블 → 동시 수정 충돌 없음
- 사진: Storage URL → 문서 크기 제한 해소
- 검색: SQL ILIKE (search_courses RPC) → 키워드 부분 일치 가능
- 필터/정렬: SQL WHERE + ORDER BY → 복합 조건 자유자재
- 행동 로그: jsonb 컬럼으로 유연한 이벤트 데이터 저장

---

## 5. 구현 전 분석 리포트

> 코딩 착수 전 반드시 확인해야 할 리스크와 설계 사항

### 5.1 Critical (사전 설계 필수)

**① Supabase Storage 용량 관리** ✅ 대응 완료
- 무료 1GB, 사진 압축 후 장당 약 70~100KB (WebP, 품질 0.82)
- 약 10,000~14,000장 저장 가능
- photo.js에서 OUTPUT_WIDTH=800, WebP 압축 구현

**② 기존 데이터 마이그레이션** ✅ migrate.js 구현 완료
- migrate.js — 사용자/코스/댓글 3단계 마이그레이션 스크립트
- base64 사진 → Storage 업로드 후 URL로 변환 포함

**③ 드래그 순서 변경 시 이동 시간 처리** ✅ 구현 완료
- 순서 변경 시 첫 번째 장소 travel_time 자동 null 처리

**④ 참조 코스 삭제 시 정합성** ✅ 구현 완료
- onCourseDeleted() — parent 존재 체크 후 reference_count -1
- DB RPC 함수(decrement_reference_count)로 처리

**⑤ 1주일 미활동 자동 중지**
- **대응:** 주기적으로 대시보드 접속하거나, cron job으로 핑 보내기 검토 (미구현)

### 5.2 Warning (인지 사항)

**⑥ Supabase 무료 DB 500MB**
- 텍스트 데이터만 DB에 저장하면 500MB로 수만 개 코스 가능

**⑦ 검색 시 GPS 좌표 저장** ✅ 해결 완료
- map.js에서 myLat/myLng 모듈 레벨 변수에 저장
- keywordSearch 시 location 옵션으로 전달

---

## 6. 로컬 개발 환경 설정

> **원칙: 로컬에서 테스트 완료 후 확실할 때만 push. 매번 push해서 확인하지 않는다.**

### 6.1 로컬 서버 실행
- VS Code Live Server 확장 또는 `python -m http.server 8080`
- `http://localhost:8080`에서 즉시 확인, 코드 저장 시 자동 새로고침

### 6.2 배포 전 체크리스트
- [ ] 카카오 개발자 콘솔 — `localhost` 도메인 등록
- [ ] 카카오 개발자 콘솔 — 카카오 로그인 Redirect URI 등록
- [x] ~~Firebase/Supabase 도메인 허용~~ — Supabase는 별도 도메인 제한 없음
- [x] ~~CORS 이슈~~ — Supabase 기본 CORS 허용, 카카오맵 도메인 등록으로 해결
- [x] 경로 참조 방식 — 모든 경로 상대 경로 사용 확인 완료
- [x] index.html 리다이렉트 — `main.html`로 변경 완료 (비로그인 피드 열람)
- [x] config.js 환경 변수 분리 — config.js로 분리 완료

### 6.3 개발 워크플로우
```
1. config.js에 Supabase URL/Key 입력
2. schema.sql Supabase SQL Editor에서 실행
3. 로컬 서버 실행 (localhost:8080)
4. 기능 테스트
5. git add → git commit (feat:/fix:/refactor: 컨벤션)
6. git push → GitHub Pages 자동 배포 (1~2분)
7. 실제 사이트에서 최종 확인
```

---

## 7. 작업 이력

| 날짜 | 작업 내용 | 커밋 |
|------|----------|------|
| ~ 이전 | 초기 기능 구현 (카카오맵, 사진, Firestore, 피드, 상세, 인증) | - |
| 2026.03.09 | 헤더 및 사이드바 전 페이지 통일 | `헤더 및 사이드바 전 페이지 통일` |
| 2026.03.09 | 인증 페이지 UI 개선 (카드형, 탭, 포커스 효과) | `인증 페이지 UI 개선 및 헤더 통일` |
| 2026.03.09 | 인증 페이지 사이드바 추가 | `인증 페이지 사이드바 추가 및 헤더 통일` |
| 2026.03.09 | 댓글 UI 개선 (상대시간, 좋아요, 답글, 중복등록 방지) | `feat: 댓글 UI 개선 - 답글/좋아요 기능 추가 및 피드 댓글 수 연동` |
| 2026.03.09 | 답글 UI 구조 수정, 로딩 스피너, 페이지 캐시 갱신 | `fix: 답글 UI 구조 수정, 로딩 스피너 추가, 페이지 캐시 갱신` |
| 2026.03.09 | 삭제 버튼 썸네일 하단 우측 이동 | `refactor: 삭제 버튼 썸네일 하단 우측 배치` |
| 2026.03.09 | 게시글 좋아요 토글(취소) 수정 | `fix: 삭제 버튼 위치/크기 조정, 게시글 좋아요 토글 수정` |
| 2026.03.09 | 코스 저장 오류 수정 (renderSavedList 제거) | - |
| 2026.03.09 | 상세페이지 썸네일 이미지 잘림 수정 | `fix: 상세페이지 썸네일 이미지 잘림 수정` |
| 2026.03.09 | 동선지도 텍스트 제거, 마커 넘버링 커스텀 오버레이 | `refactor: 동선지도 텍스트 제거, 마커 넘버링 커스텀 오버레이` |
| 2026.03.09 | 지도 마커 중심 정렬 (Polyline 연결 개선) | `fix: 지도 마커 중심 정렬 및 스타일 개선` |
| 2026.03.14 | **v2 전체 구현** — Supabase 전환, 신규 기능 전부 | `feat: v2 전체 구현 - Supabase 전환 및 신규 기능` |
