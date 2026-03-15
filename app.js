// app.js — 진입점: 비로그인 시 로그인 페이지로 리다이렉트
import { getSession } from './db.js';

<<<<<<< HEAD
(async () => {
  const session = await getSession();
  if (!session) {
    location.replace('login.html');
  }
})();
=======
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
>>>>>>> d3dafc5f7ca6945a22744ee97e673c4bede88adb
