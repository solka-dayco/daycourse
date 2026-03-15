# Supabase 설정 가이드

> https://supabase.com 접속 후 진행

---

## 1. 프로젝트 생성

- [ ] New project 클릭
- [ ] 이름: `daycourse`
- [ ] 리전: **Northeast Asia (Seoul)** 선택
- [ ] DB 비밀번호 저장해두기
- [ ] 생성 완료까지 1~2분 대기

---

## 2. API 키 복사 → config.js에 붙여넣기

> Settings → API

- [ ] **Project URL** 복사 → `config.js`의 `SUPABASE_URL`
- [ ] **anon public** 키 복사 → `config.js`의 `SUPABASE_ANON_KEY`

```js
// config.js
export const SUPABASE_URL = 'https://여기에붙여넣기.supabase.co';
export const SUPABASE_ANON_KEY = '여기에붙여넣기';
```

---

## 3. SQL Editor — schema.sql 실행

> SQL Editor → New query → schema.sql 전체 붙여넣기 → Run

실행하면 아래가 자동으로 모두 생성됩니다:

| 생성 항목 | 내용 |
|-----------|------|
| 테이블 | users, courses, course_places, course_likes, comments, comment_likes, replies, reply_likes, event_logs |
| 인덱스 | created_at, like_count, region, course_id 등 |
| RLS 정책 | 전 테이블 행 단위 보안 |
| RPC 함수 | increment/decrement like_count, reference_count, search_courses |
| Auth trigger | 신규 가입 시 users 테이블 자동 생성 |
| Storage 버킷 | course-photos (Public) |
| Storage 정책 | 공개 읽기, 로그인 사용자만 업로드/삭제 |

⚠️ 실행 후 하단에 **"Success. No rows returned"** 뜨면 정상

---

## 4. Storage 버킷 확인

> Storage 메뉴 클릭

- [ ] `course-photos` 버킷이 생성되어 있는지 확인
- [ ] 없으면 **New bucket** → 이름: `course-photos` → **Public** ON → Save

---

## 5. Authentication — 카카오 로그인 설정

> Authentication → Providers → Kakao

- [ ] **Enable Sign in with Kakao** 토글 ON
- [ ] **REST API Key** 입력
  - 카카오 개발자 콘솔 → 내 애플리케이션 → 앱 키 → REST API 키
- [ ] **Client Secret** 입력
  - 카카오 개발자 콘솔 → 보안 → Client Secret 코드
  - ※ 보안 메뉴에서 활성화 상태여야 함
- [ ] **Callback URL (읽기 전용)** 값 복사해두기
  - `https://<프로젝트ID>.supabase.co/auth/v1/callback`
  - → 카카오 개발자 콘솔 Redirect URI에 이 값 등록해야 함
- [ ] Save 클릭

---

## 6. Authentication — URL 설정

> Authentication → URL Configuration

- [ ] **Site URL** 입력
  ```
  https://solka-dayco.github.io/daycourse
  ```
- [ ] **Redirect URLs** 추가 (Add URL 클릭해서 하나씩)
  ```
  http://localhost:8080/main.html
  https://solka-dayco.github.io/daycourse/main.html
  ```
- [ ] Save 클릭

---

## 7. (선택) 마이그레이션 후 데이터 확인

> migrate.js 실행 후 진행

- [ ] **Table Editor → users** — 기존 사용자 데이터 확인
- [ ] **Table Editor → courses** — 기존 코스 데이터 확인
- [ ] **Storage → course-photos** — 기존 사진 업로드 확인

---

## ✅ 완료 기준

아래 항목이 모두 보이면 설정 완료:

| 확인 위치 | 확인 내용 |
|-----------|-----------|
| Table Editor | 테이블 9개 존재 |
| Storage | course-photos 버킷 존재 (Public) |
| Authentication → Providers | Kakao **Enabled** 상태 |
| Authentication → URL Configuration | Site URL, Redirect URLs 등록 |
| SQL Editor 실행 결과 | 에러 없음 |
