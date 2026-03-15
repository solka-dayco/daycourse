# 데이코스 v2 — 설정 & 배포 가이드

## 1. 빠른 시작 체크리스트

### 1-1. Supabase 프로젝트 생성
1. https://supabase.com → New project 생성
2. **SQL Editor**에서 `schema.sql` 전체 실행
3. **Storage** → New bucket: `course-photos` (Public ON)
4. **Authentication** → Providers → Kakao 활성화
   - Kakao 개발자 콘솔에서 REST API 키 입력
   - Redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`

### 1-2. config.js 수정
```js
// config.js
export const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';   // Project Settings > API
export const KAKAO_APP_KEY = '725e3b5f43c47c651837511245861cc8';
export const STORAGE_BUCKET = 'course-photos';
```

### 1-3. 카카오 개발자 콘솔
- 플랫폼 → Web → 사이트 도메인 추가:
  - `http://localhost:8080`
  - `https://solka-dayco.github.io`
- 카카오 로그인 → Redirect URI:
  - `https://<supabase-project>.supabase.co/auth/v1/callback`

### 1-4. 로컬 실행
```bash
python -m http.server 8080
# 브라우저: http://localhost:8080
```

---

## 2. 파일 구조

```
daycourse/
├── index.html          # → main.html 리다이렉트
├── main.html           # 피드 (비로그인 열람 가능)
├── main.css / main.js
├── login.html          # 로그인 + 회원가입 (탭 전환)
├── login.js
├── signup.html         # → login.html#signup 리다이렉트
├── find.html / find.js # 아이디·비밀번호 찾기
├── auth.css
├── create.html         # 코스 만들기 (로그인 필요)
├── create.css / create.js
├── course.html         # 코스 상세
├── course.css / course.js
├── style.css           # 공통 스타일
├── sidebar.js          # 공통 사이드바
├── map.js              # 카카오맵 유틸
├── photo.js            # 사진 크롭/압축 (4:5 WebP)
├── app.js              # 비로그인 체크 진입점
├── db.js               # 모든 DB 접근 (Supabase abstraction)
├── supabase.js         # Supabase 클라이언트
├── config.js           # 환경 설정
├── schema.sql          # DB 스키마 + RLS + RPC
└── migrate.js          # Firestore → Supabase 마이그레이션 (Node.js)
```

---

## 3. v2 신규 기능

| 기능 | 설명 |
|------|------|
| **Supabase 전환** | Firebase → Supabase (PostgreSQL + Storage + Auth) |
| **카카오 OAuth** | Supabase Auth 카카오 로그인 |
| **사진 시스템** | 장소 1개당 사진 1장, 4:5 세로형 크롭, WebP 압축 (~80KB), Storage URL |
| **캐러셀** | 사진 있는 장소만 표시, 스와이프, 하단 장소명 오버레이, 1/N 카운터 |
| **타임라인** | 트리플 스타일 — 넘버링 + 체류/이동 시간 + 한줄평 + 거리 + 썸네일 |
| **코스 소개글** | 코스 전체 소개글 입력 (선택) |
| **장소 한줄평** | 장소별 한줄평 입력 (선택) |
| **체류 시간** | 장소별 필수 선택 (10가지) |
| **이동 시간** | 두 번째 장소부터 필수 선택 (10가지) |
| **총 소요시간** | 자동 계산, 피드 카드·상세 페이지 표시 |
| **지역 태그** | 대분류 + 세부 2단계, 필수 선택 |
| **피드 검색** | 코스명/소개글/장소명/주소/한줄평 ILIKE (RPC) |
| **피드 필터** | 지역 + 소요시간 + 정렬(최신/인기/참조/시간) |
| **참조 기능** | 코스 참조 (장소 복사), 원본 출처 표시, reference_count |
| **수정 모드** | `?mode=edit&id=...` — 기존 코스 전체 수정 |
| **참조 모드** | `?mode=copy&id=...` — 장소/시간만 복사, 새 코스로 저장 |
| **좋아요 통일** | course_likes 테이블 — race condition 없음, 비로그인 차단 |
| **행동 로그** | event_logs 테이블 — page_view, course_view, course_like, place_add 등 |
| **비로그인 피드** | 피드·상세 열람 가능, 글쓰기·좋아요·댓글만 로그인 필요 |

---

## 4. Firestore → Supabase 마이그레이션

```bash
npm install firebase-admin @supabase/supabase-js node-fetch

SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=your_service_role_key \
FIREBASE_CREDENTIAL=./serviceAccountKey.json \
node migrate.js
```

⚠️ `SUPABASE_SERVICE_KEY`는 service_role 키 (RLS 우회). 절대 클라이언트에 노출 금지.

---

## 5. 개발 워크플로우

```
1. config.js 수정 → 로컬 서버 실행 (localhost:8080)
2. 기능 개발 + 테스트
3. git add → git commit (feat:/fix:/refactor: 컨벤션)
4. git push → GitHub Pages 자동 배포 (1~2분)
```

---

## 6. 향후 작업 (미완료)

- [ ] Supabase Auth 이메일 인증 플로우 개선
- [ ] 무한 스크롤 (현재: 더 보기 버튼)
- [ ] 프로필 페이지 (내 코스, 좋아요한 코스)
- [ ] SEO / Open Graph 메타 태그
- [ ] 어드민 페이지
- [ ] A/B 테스트 프레임워크
- [ ] Supabase 1주일 미활동 자동 중지 대응 (cron ping)


---

## 7. v3 기획 반영 사항

### 7-1. 네비게이션 구조 변경
- **Header 우측 상단**: `+` 버튼으로 언제든 새 코스 생성 (`create.html`)
- **Sidebar**
  - 닉네임 표시
  - 상단 버튼: `내 정보`, `활동 내역`
  - 하단 메뉴: `홈`, `북마크`, `알림`
- 기존 사이드바의 **코스 만들기 메뉴 제거**

### 7-2. 페이지 구조 재정리
#### Public
- `main.html` — 메인 피드
- `course.html` — 코스 상세
- `user.html` — 공개 유저 페이지

#### Auth Required
- `create.html` — 코스 생성 / 수정 / 참조 생성
- `profile.html` — 내 정보
- `activity.html` — 활동 내역
- `bookmarks.html` — 북마크
- `notifications.html` — 알림

### 7-3. 피드 시스템
- **정렬 알고리즘**
  - `score = like_count × 2 + comment_count × 3 + reference_count × 4`
- **Infinite Scroll**
- **Pull to Refresh**
  - 피드 최상단에서 한 번 더 스크롤 시 로딩 후 새로고침
- **피드 캐싱 + 스크롤 위치 복원**
  - 캐싱 대상: 코스 목록, cursor, scroll position
- **검색 자동완성**
  - 코스 제목 / 장소 이름
  - 2글자 이상, 약 0.3~0.4초 딜레이

### 7-4. 참조 시스템 확장
- 참조 시 **원본 코스 전체 복사**
- `parent_course_id` 저장
- **참조 체인 1단계만 허용**
- 상세페이지 하단에
  - `이 코스를 참조한 코스` 섹션 추가
  - 카드 UI로 최대 6개 표시

### 7-5. 사용자 영역
#### user.html
- Instagram 스타일 공개 유저 페이지
- 상단: 닉네임 / 코스 수 / 받은 좋아요 수 / 참조 수
- 탭: `코스`, `참조`
- 카드 그리드 UI 재사용

#### activity.html
섹션 구분선 기반
- 좋아요한 게시물
- 북마크한 게시물
- 내가 만든 코스
- 공유한 코스

#### bookmarks.html
- 좋아요와 분리된 **독립 북마크 기능**
- `bookmarks` 테이블 사용

#### notifications.html
- 조회형 알림 시스템
- 실시간 WebSocket 미사용
- `unread_notification_count` 기반 unread 개수 표시
- 좋아요/참조 알림은 aggregation 가능

### 7-6. 댓글 시스템
- 댓글 + 답글(1단계만 허용)
- 댓글 정렬
  - 최신순
  - 인기순
  - 좋아요순

### 7-7. 사진 정책 개편
#### 코스 대표 썸네일
- 사용자가 직접 업로드
- `courses.thumbnail_url` 저장
- 피드 / 유저 페이지 / 북마크 카드에서 사용
- **상대적으로 낮은 용량 / 빠른 로딩 우선**

#### 장소 사진
- 장소당 1장 유지
- 상세 캐러셀 / 전체화면 / 타임라인 썸네일에 사용
- **최대 10장 수준의 고품질 사진을 고려**
- 피드 썸네일보다 높은 품질 유지

#### fallback 규칙
- `thumbnail_url`이 없으면 첫 번째 장소 사진 사용

### 7-8. 성능 최적화
- `courses` 테이블에 counter cache 유지
  - `like_count`
  - `comment_count`
  - `reference_count`
- 알림 unread count를 `users.unread_notification_count`로 관리
- 알림은 필요한 경우 aggregation 처리

### 7-9. 운영 정책 (MVP)
- 신고 대상: 코스 / 댓글
- 신고는 `report` 테이블에 저장
- 초기에는 **수동 검토 중심 운영**
- 복잡한 자동 탐지 알고리즘은 MVP 범위에서 제외

### 7-10. 제약 및 원칙
- 코스 길이 제한: **최소 2개, 최대 10개 장소**
- 코스 시간 범위 제한은 두지 않음
- 공개/비공개 설정은 **Post-MVP 논의 항목**으로 보류
- 북마크 폴더 / 팔로우 / 채팅 / 협업 / 개인화 추천은 **MVP 제외**

---

## 8. 향후 작업 (Post-MVP 포함)

- [ ] 프로필 / 활동 내역 / 북마크 / 알림 페이지 실제 구현
- [ ] user.html 공개 유저 페이지 구현
- [ ] 코스 대표 썸네일 업로드 기능 추가
- [ ] 피드 무한 스크롤 + Pull to Refresh 적용
- [ ] 피드 캐싱 / 스크롤 위치 복원 적용
- [ ] 참조 코스 목록 섹션 추가
- [ ] notifications / reports 스키마 반영
- [ ] 레벨 시스템 계산 로직 반영
- [ ] 공개/비공개 코스 정책 논의
- [ ] SEO / Open Graph 메타 태그
- [ ] 어드민 페이지
- [ ] Supabase 1주일 미활동 자동 중지 대응 (cron ping)
