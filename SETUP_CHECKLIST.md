# 데이코스 v2 — 수동 작업 체크리스트

> 코드 외에 직접 콘솔/대시보드에서 해야 하는 작업 목록입니다.
> 순서대로 진행하세요.

---

## 1단계. 카카오 개발자 콘솔
> https://developers.kakao.com → 내 애플리케이션 → 데이코스 앱

- [ ] **플랫폼 → Web → 사이트 도메인 추가**
  - `http://localhost:8080`
  - `https://solka-dayco.github.io`

- [ ] **카카오 로그인 → 활성화 ON**

- [ ] **카카오 로그인 → Redirect URI 추가**
  - `https://<supabase-project-id>.supabase.co/auth/v1/callback`
  - ※ Supabase 프로젝트 생성 후 ID 확인 가능

- [ ] **카카오 로그인 → 동의항목 설정**
  - 닉네임 — 필수 동의
  - 프로필 사진 — 선택 동의 (선택)

---

## 2단계. Supabase 프로젝트 생성
> https://supabase.com → New project

- [ ] **프로젝트 생성**
  - 이름: `daycourse`
  - 리전: `Northeast Asia (Seoul)` 권장
  - 비밀번호 안전하게 저장

- [ ] **Project Settings → API에서 값 복사**
  - `Project URL` → `config.js`의 `SUPABASE_URL`에 붙여넣기
  - `anon public` 키 → `config.js`의 `SUPABASE_ANON_KEY`에 붙여넣기

---

## 3단계. Supabase SQL Editor
> Supabase 대시보드 → SQL Editor → New query

- [ ] **`schema.sql` 전체 내용 붙여넣기 후 실행 (Run)**
  - 테이블 10개 생성
  - RLS 정책 적용
  - RPC 함수 6개 생성 (like/reference count 증감, search_courses 등)
  - Storage 버킷 정책 적용
  - Auth trigger (신규 가입 시 users 테이블 자동 생성) 등록

---

## 4단계. Supabase Storage
> Supabase 대시보드 → Storage

- [ ] **`course-photos` 버킷 생성**
  - Name: `course-photos`
  - Public bucket: **ON** (공개 URL 사용)
  - ※ schema.sql 실행 시 자동 생성될 수 있음 — 없으면 수동 생성

---

## 5단계. Supabase Authentication
> Supabase 대시보드 → Authentication → Providers

- [ ] **Kakao 활성화**
  - `REST API 키` 입력 (카카오 개발자 콘솔 → 앱 키)
  - `Client Secret` 입력 (카카오 개발자 콘솔 → 보안 → Client Secret)
  - Redirect URL 확인 (`https://<id>.supabase.co/auth/v1/callback`)

- [ ] **Authentication → URL Configuration**
  - Site URL: `https://solka-dayco.github.io/daycourse`
  - Redirect URLs 추가:
    - `http://localhost:8080/main.html`
    - `https://solka-dayco.github.io/daycourse/main.html`

---

## 6단계. config.js 수정
> 로컬 에디터에서 직접 수정

- [ ] **`config.js` 열어서 아래 값 교체**
  ```js
  export const SUPABASE_URL = 'https://여기에-프로젝트-URL';
  export const SUPABASE_ANON_KEY = '여기에-anon-키';
  export const KAKAO_APP_KEY = '725e3b5f43c47c651837511245861cc8'; // 기존 그대로
  export const STORAGE_BUCKET = 'course-photos'; // 기존 그대로
  ```

---

## 7단계. Firestore 데이터 마이그레이션
> 기존 v1 데이터가 있을 경우에만 진행

- [ ] **Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성**
  - `serviceAccountKey.json` 로컬에 저장

- [ ] **Supabase 대시보드 → Project Settings → API → `service_role` 키 복사**
  - ⚠️ service_role 키는 RLS 우회 가능 — 절대 코드에 커밋 금지

- [ ] **마이그레이션 스크립트 실행**
  ```bash
  npm install firebase-admin @supabase/supabase-js node-fetch

  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_KEY=여기에-service_role-키 \
  FIREBASE_CREDENTIAL=./serviceAccountKey.json \
  node migrate.js
  ```

- [ ] **마이그레이션 결과 확인**
  - Supabase 대시보드 → Table Editor → users, courses, course_places, comments 데이터 확인
  - Storage → course-photos → 사진 업로드 확인

---

## 8단계. 로컬 테스트

- [ ] 로컬 서버 실행
  ```bash
  python -m http.server 8080
  ```
- [ ] `http://localhost:8080` 접속
- [ ] 카카오 로그인 동작 확인
- [ ] 코스 만들기 → 저장 → 상세 페이지 이동 확인
- [ ] 사진 업로드 → Storage URL 정상 저장 확인
- [ ] 피드 검색/필터 동작 확인

---

## 9단계. GitHub Pages 배포

- [ ] **`git add . && git commit -m "feat: v2 전체 구현 - Supabase 전환"` 후 push**
- [ ] **GitHub → 리포지토리 → Settings → Pages → Source: Deploy from branch (main)** 확인
- [ ] 배포 완료 후 `https://solka-dayco.github.io/daycourse` 접속 최종 확인

---

## ⚠️ 주의사항

| 항목 | 내용 |
|------|------|
| `config.js` 커밋 | anon 키는 커밋해도 되지만, **service_role 키는 절대 커밋 금지** |
| Supabase 무료 플랜 | **1주일 미활동 시 자동 중지** → 주기적으로 대시보드 접속 |
| 카카오 Client Secret | 카카오 개발자 콘솔 → 보안 메뉴에서 활성화 후 복사 |
| migrate.js | 한 번만 실행할 것 — 중복 실행 시 데이터 중복 가능성 |
