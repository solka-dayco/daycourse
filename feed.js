import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const feedList = document.getElementById('feed-list');
feedList.innerHTML = '<p style="color:#aaa; font-size:14px;">불러오는 중...</p>';

try {
  const snapshot = await getDocs(collection(db, 'courses'));

  if (snapshot.empty) {
    feedList.innerHTML = `
      <div class="empty-feed">
        <p>아직 저장된 코스가 없습니다 😊</p>
        <a href="index.html">+ 첫 코스 만들기</a>
      </div>
    `;
  } else {
    feedList.innerHTML = '';

    const courses = [];
    snapshot.forEach(function (docSnap) {
      courses.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 최신순 정렬
    courses.reverse();

    courses.forEach(function (course) {
      const card = document.createElement('div');
      card.className = 'feed-card';

      const photos = course.photos || [];
      let thumbnailHTML = '';
      for (let i = 0; i < 4; i++) {
        if (photos[i]) {
          thumbnailHTML += `<img src="${photos[i]}" alt="코스 사진">`;
        } else {
          thumbnailHTML += `<div class="empty-slot">📍</div>`;
        }
      }

      const placeSummary = course.places.map(p => p.name).join(' → ');

      card.innerHTML = `
        <div class="card-thumbnail">${thumbnailHTML}</div>
        <div class="card-info">
          <div class="card-title">${course.name}</div>
          <div class="card-places">${placeSummary}</div>
          <div class="card-actions">
            <button>❤️ <span>${course.likes || 0}</span></button>
            <button>💬 <span>${course.comments || 0}</span></button>
            <button>📤</button>
          </div>
        </div>
      `;

      card.addEventListener('click', function () {
        window.location.href = 'course.html?id=' + course.id;
      });

      feedList.appendChild(card);
    });
  }
} catch (error) {
  console.error('피드 불러오기 오류:', error);
  feedList.innerHTML = '<p style="color:#aaa; font-size:14px;">불러오기 실패. 새로고침 해주세요.</p>';
}