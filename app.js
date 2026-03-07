// ── app.js ───────────────────────────────────────
// 담당: 진입점, 비로그인 체크, 각 모듈 초기화 호출

import { initMap } from './map.js';
import { initCourse } from './course.js';
import { initPhoto } from './photo.js';

// ── 비로그인 체크 ────────────────────────────────
if (!localStorage.getItem('userId')) {
  alert('로그인이 필요합니다.');
  window.location.href = 'login.html';
}

// ── 카카오맵 로드 후 전체 초기화 ─────────────────
kakao.maps.load(function () {
  initMap();     // 지도, 장소 검색, 내 위치
  initCourse();  // 코스 목록, 저장, 불러오기
  initPhoto();   // 사진 업로드, 크롭, 뷰어
});
