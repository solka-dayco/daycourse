# 데이코스 v4.2 구현 현황

> 최종 갱신: 2026.03.27

---

## R1. 코스 제작 UX 개선 ✅

- 체류/이동시간 필수 → 선택, 세부사항 토글로 분리
- 총 소요시간: 세부사항 닫힘 = 직접 입력, 열림 = 자동 계산
- 시간 입력: input 클릭 → 드럼롤 피커, 아이콘 클릭 → 칩 모달
- `course.js` 타임라인: 이동거리 세로선 아래 배치, 화살표 제거, 한줄평 줄노트 구분선

---

## R2. 코스 계획 기능 ✅

- DB: `courses.is_plan` 컬럼 추가, RLS 수정
- `db.js`: `fetchPlanCourses`, `createPlanCourse`, `publishPlanCourse`, `deletePlanCourse` 추가, 피드/유저코스 쿼리에 `is_plan=false` 필터
- `sidebar.js`: 코스 계획 메뉴 추가 (북마크 아래)
- `create.html/js/css`: plan 모드 분기 (썸네일 숨김, 지도 확장, 메모 안내문구, 저장 → plan-detail 이동, 게시하기 버튼 분리)
- `plan.html/js/css`: 리스트 형식, 연필/X 아이콘, 날짜 표시, 최신순
- `plan-detail.html/js/css`: 본인만 열람, 타임라인(사진 없음), 지도, 수정하기 + 게시하러가기
- `profile.html/js`: 코스 계획 탭 추가
- `vercel.json`: `/plan`, `/plan-detail` 라우팅 추가
- `course.html`: "참조" → "계획 담기" 텍스트 변경

---

## R3. 이미지 처리 개선 ✅

### 1. 코스 이미지 비율 불일치 시 여백 검정 처리
- 크롭 초기 배치를 `Math.max`(fill) → `Math.min`(letterbox) 방식으로 변경
- 이미지 전체가 뷰포트 안에 들어오도록 축소 후 빈 여백을 검정(`#000`)으로 채움
- `renderCrop` 함수에서 canvas 배경 검정 초기화 후 이미지 교차 영역만 렌더링

### 2. 사진 재편집 (크롭 화면 재진입)
- `photo.js`에 `reopenCrop(dataUrl, existingBlurRegions)` export 추가
- 이미 사진이 있는 상태에서 썸네일/장소 사진 클릭 시 크롭 화면으로 재진입
- `create.js`에 `blobToDataUrl(blob)` 헬퍼 추가
- 드래프트 복원 후에도 `_photoPreview`(base64) 기준으로 재진입 가능

### 3. 사진 변경
- 크롭 모달 내 '사진 변경' 버튼 추가
- 클릭 시 file input 트리거 → 새 이미지로 교체
- 사진 변경 시 기존 블러 영역 초기화
- 변경된 원본을 `_changedOriginal`로 저장 → `create.js`에서 `_originalBase64` 갱신에 활용

### 4. 원본 이미지 보존
- `_originalBase64` 필드로 크롭 전 원본 이미지 보존
- 재편집 시 크롭된 결과물이 아닌 원본 기준으로 크롭 화면 열림
- `_buildPayload` / `normalizePlace`에 `_originalBase64`, `_photoBase64`, `_blurRegions` 포함
- 드래프트 복원 시에도 원본 및 블러 영역 유지

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

### 5. 얼굴 블러 기능
- 크롭 모달 내 '블러' 버튼으로 블러 모드 진입
- 블러 모드에서 드래그로 타원형 영역 지정 (여러 개 가능)
- 타원 선택 시 4꼭짓점 핸들 표시 → 드래그로 크기 조절 및 위치 이동
- 선택된 타원 상단에 삭제(🗑) / 복사(⧉) 아이콘 표시
- '적용' 클릭 시 블러 모드 → 이동 모드 전환
- '완료' 클릭 시 canvas에서 실제 블러 처리 후 WebP Blob 생성
- Stack Blur (Box Blur 2패스) 알고리즘, 강도 고정값 8

**블러 영역 데이터 구조**
```js
{
  cx_r,  // 이미지 너비 대비 중심 x 비율
  cy_r,  // 이미지 높이 대비 중심 y 비율
  rx_r,  // 이미지 너비 대비 반경 x 비율
  ry_r,  // 이미지 높이 대비 반경 y 비율
}
```

### 6. resolve 반환 형식 변경
- `cropAndCompress` / `reopenCrop` 모두 단순 Blob 대신 객체 반환으로 통일

```js
{
  blob,             // WebP Blob
  blurRegions,      // 블러 영역 배열 (상대좌표)
  changedOriginal,  // 사진 변경 시 새 원본 base64 (없으면 null)
}
```

**변경 파일**

| 파일 | 변경 내용 |
|------|-----------|
| `photo.js` | 전면 재작성 (v7). letterbox 크롭, 블러 기능, 사진 변경, 객체 반환 |
| `create.js` | `reopenCrop` import, `blobToDataUrl` 추가, 썸네일/장소 사진 재편집 핸들러, 원본 보존 로직, 드래프트 직렬화 확장 |

---

## R4. 레벨 및 경험치 시스템 ✅

### 레벨 구조
- LV1 ~ LV50
- 칭호: Walker(1~10) / Runner(11~20) / Rider(21~30) / Traveler(31~40) / Driver(41~49) / Cruiser(50)

### 경험치 획득

| 행동 | XP |
|------|----|
| 코스 업로드 | +750 |
| 코스 인용 | +1,000 |
| 댓글/답글 작성 | +50 |
| 좋아요 받음 | +5 |
| 좋아요 취소됨 | -5 |
| 북마크 받음 | +1 (일일 최대 20) |
| 코스 삭제 | -750 |

### 레벨 구간 누적 XP

| 구간 | 필요 누적 XP |
|------|-------------|
| LV1 → LV10 | 10,000 |
| LV10 → LV20 | 36,250 |
| LV20 → LV30 | 56,250 |
| LV30 → LV40 | 112,500 |
| LV40 → LV50 | 250,000 |
| 총합 (LV50) | 465,000 |

### 레벨업 정책
- XP는 DB에 누적값으로 저장
- 레벨 갱신은 XP 변동 후 30초 딜레이 적용 (pg_cron)
- 코스 삭제 시 XP 차감 후 레벨 하락 가능

### UI
- 프로필 페이지: 레벨명 + XP 바 + 현재 XP / 다음 레벨 필요 XP 표시
- 유저 페이지: 레벨명 표시

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `db.js` | `add_user_xp` 전환, 북마크 XP cap, 코스 삭제 차감 |
| `profile.js` | 레벨/XP 렌더링 |
| `profile.html` | XP 바 마크업 |
| `style.css` | XP 바 CSS |
| `user.js` | 레벨 표시 활성화 |

### DB

- `users.user_xp`: 누적 XP
- `users.level`: 현재 레벨 (pg_cron 30초 갱신)
- Functions: `calculate_level`, `add_user_xp`, `add_user_xp_capped`
- `users.user_score` 제거, `update_user_level` 트리거 제거

---

## R5. 커뮤니티 기능 ✅

### R5.1 DB 스키마 (schema_R5.sql)
- [x] `follows` 테이블 추가 (follower_id, following_id, PK 복합키, self-follow 방지 CHECK)
- [x] `follows` RLS 정책 (SELECT 전체공개, INSERT/DELETE 본인만)
- [x] `get_user_stats` RPC 재정의 — follower_count, following_count 포함
- [x] `get_followers` RPC 추가
- [x] `get_followings` RPC 추가
- [x] `search_users_for_mention` RPC 추가 (팔로우 유저 우선, 부분 일치)
- [x] `users.bio` 컬럼 추가
- [x] `users.profile_image_url` 컬럼 추가
- [x] follow 알림용 `upsert_notification` 기존 RPC 활용 (타입: `follow`)

### R5.2 db.js
- [x] `followUser` — 팔로우 + 알림 생성
- [x] `unfollowUser`
- [x] `isFollowing`
- [x] `fetchFollowStats`
- [x] `fetchFollowers`
- [x] `fetchFollowings`
- [x] `searchUsersForMention`
- [x] `updateUserProfile` (nickname, bio, profile_image_url)
- [x] `uploadProfileImage` (Supabase Storage, WebP, cache bust)
- [x] `fetchUserById` — bio, profile_image_url 포함으로 확장
- [x] `fetchUserStats` — follower_count, following_count 기본값 포함

### R5.3 @mention 자동완성 (course.js)
- [x] `createMentionDropdown` 함수 — 댓글/답글 입력창 공용
- [x] @ 입력 시 자동완성 드롭다운 표시 (팔로우 유저 우선)
- [x] 키보드 탐색 (ArrowUp/Down/Enter)
- [x] 마우스 클릭 선택
- [x] 닉네임 자동 삽입 후 커서 위치 처리

### R5.4 profile.html / profile.css / profile.js
- [x] 2단 레이아웃 (좌: 아바타+레벨+XP바, 우: 닉네임+소개글+통계)
- [x] 프로필 편집 바텀시트 (헤더 아래 전체 채움)
  - [x] 닉네임 수정
  - [x] 소개글 수정 (80자 카운터, 줄바꿈 반영)
  - [x] 프로필 사진 변경 (인터랙티브 크롭 — 드래그/줌 슬라이더)
  - [x] 프로필 사진 삭제 (휴지통 아이콘)
- [x] 팔로워/팔로잉 수 표시 (클릭 시 사이드 패널)
- [x] 팔로워/팔로잉 사이드 패널 (우측 슬라이드인)
- [x] 공개 프로필 버튼
- [x] 프로필 사진 업로드 후 헤더/사이드바 아이콘 즉시 갱신
- [x] 기본 프로필 이미지 `/image/profile_icon.png` 통일

### R5.5 user.html / user.css / user.js
- [x] 2단 레이아웃 (좌: 아바타+레벨, 우: 닉네임+소개글+통계+팔로우버튼)
- [x] 팔로우/언팔로우 버튼 (고정 크기, 팔로잉 상태 토글)
- [x] 팔로워/팔로잉 수 표시
- [x] 소개글 줄바꿈 반영 (pre-wrap)
- [x] 프로필 이미지 표시 (없을 시 기본 이미지)
- [x] 헤더 타이틀 '데이코스' 고정

### R5.6 sidebar.js
- [x] 헤더 우측 프로필 아이콘 동적 주입 (모든 페이지 공통)
- [x] 프로필 이미지 있을 시 사진, 없을 시 기본 이미지
- [x] 미읽음 알림 red dot 표시 (헤더 + 사이드바)
- [x] 프로필 아이콘 클릭 시 드롭다운 (알림 / 프로필 이동)
- [x] 사이드바 아바타에도 프로필 이미지 반영
- [x] `unread_notification_count` 실제 연결

### R5.7 notifications.js
- [x] follow 알림 타입 렌더링 추가 ("OOO님이 회원님을 팔로우했습니다")

### 미완료 / 보류
- [ ] @mention 알림 생성 (comment_mention 타입 — addComment/addReply에 멘션 파싱 후 알림 발송)
- [ ] 팔로워/팔로잉 목록에서 언팔로우 버튼
- [ ] 피드 팔로잉 기반 필터 (Post-MVP)

---

## 기타 버그픽스 (2026.03.27)

### 피드 거리순 정렬 추가
- `index.html`: 정렬 칩에 "가까운순" (`data-sort="nearby"`) 추가
- `main.js`: 거리순 선택 시 `navigator.geolocation`으로 GPS 위치 요청, 위치 획득 실패 시 토스트 알림 후 정렬 취소
- `main.js`: `state`에 `userLat`, `userLng` 추가, 한 번 획득한 위치는 세션 중 재사용
- `main.js`: `loadFeed` 내부에서 `nearby` 정렬 시 Haversine 거리 기준으로 코스 첫 번째 장소 좌표를 이용해 클라이언트 측 정렬
- `main.js`: `haversine(lat1, lng1, lat2, lng2)` 유틸 함수 추가
- `db.js`: `fetchCourses` select에 `lat, lng` 필드 추가 (키워드 없는 쿼리, RPC 이후 places 재조회 두 곳 모두)

### 장소 검색 지하철역 상단 노출
- `create.js`: `doSearch()` 내 `searchPlaces()` 결과에서 `category_group_code === 'SW8'`인 지하철역 항목을 배열 앞으로 재정렬 후 `showKeywordResults()` 전달
