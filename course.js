import { db } from './firebase.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get('id');

if (!courseId) window.location.href = 'feed.html';

try {
  const docRef = doc(db, 'courses', courseId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    window.location.href = 'feed.html';
  }

  const course = docSnap.data();

  // 4분할 썸네일
  const thumbnail = document.getElementById('detail-thumbnail');
  const photos = course.photos || [];
  for (let i = 0; i < 4; i++) {
    if (photos[i]) {
      thumbnail.innerHTML += `<img src="${photos[i]}" alt="코스 사진">`;
    } else {
      thumbnail.innerHTML += `<div class="empty-slot">📍</div>`;
    }
  }

  // 제목 + 날짜
  document.getElementById('detail-title').textContent = course.name;
  document.getElementById('detail-date').textContent = course.createdAt;

  // 장소 목록
  const placeList = document.getElementById('detail-places');
  course.places.forEach(function (place, index) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="place-number">${index + 1}</span>
      <span>${place.name}</span>
    `;
    placeList.appendChild(li);
  });

  // 좋아요 / 댓글 수
  document.getElementById('like-count').textContent = course.likes || 0;
  document.getElementById('comment-count').textContent = course.comments || 0;

  // 좋아요 버튼
  document.getElementById('like-btn').addEventListener('click', async function () {
    try {
      const newLikes = (course.likes || 0) + 1;
      await updateDoc(docRef, { likes: newLikes });
      document.getElementById('like-count').textContent = newLikes;
      course.likes = newLikes;
    } catch (error) {
      console.error('좋아요 오류:', error);
    }
  });

  // 삭제 버튼
  document.getElementById('delete-btn').addEventListener('click', async function () {
    if (!confirm('이 코스를 삭제할까요?')) return;

    try {
      await deleteDoc(docRef);
      window.location.href = 'feed.html';
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  });

  // 지도 + 동선
  kakao.maps.load(function () {
    const map = new kakao.maps.Map(document.getElementById('detail-map'), {
      center: new kakao.maps.LatLng(course.places[0].lat, course.places[0].lng),
      level: 5
    });

    const path = [];

    course.places.forEach(function (place) {
      const position = new kakao.maps.LatLng(place.lat, place.lng);

      new kakao.maps.Marker({ position: position, map: map });

      new kakao.maps.CustomOverlay({
        position: position,
        content: '<div class="label">' + place.name + '</div>',
        yAnchor: 2.5
      }).setMap(map);

      path.push(position);
    });

    new kakao.maps.Polyline({
      path: path,
      strokeWeight: 4,
      strokeColor: '#ff4e6a',
      strokeOpacity: 0.8,
      strokeStyle: 'solid'
    }).setMap(map);
  });

} catch (error) {
  console.error('코스 불러오기 오류:', error);
  alert('코스를 불러오지 못했습니다.');
  window.location.href = 'feed.html';
}