// ── app.js ───────────────────────────────────────
// 담당: 진입점, 비로그인 체크, 각 모듈 초기화 호출

import { initMap } from './map.js';
import { initCourse } from './create.js';
import { initPhoto } from './photo.js';

if (!localStorage.getItem('userId')) {
  alert('로그인이 필요합니다.');
  window.location.href = 'login.html';
}

kakao.maps.load(function () {
  initMap();
  initCourse();
  initPhoto();
});