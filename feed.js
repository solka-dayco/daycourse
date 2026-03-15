import { db } from './firebase.js';
import { collection, getDocs, doc as firestoreDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── 피드 불러오기 ─────────────────────────────────
const feedList = document.getElementById('feed-list');
feedList.innerHTML = '<p style="color:#aaa; font-size:14px;">불러오는 중...</p>';

try {
  const snapshot = await getDocs(collection(db, 'courses'));

  if (snapshot.empty) {
    feedList.innerHTML = '';
  } else {
    feedList.innerHTML = '';

    const courses = [];
    snapshot.forEach(function (docSnap) {
      courses.push({ id: docSnap.id, ...docSnap.data() });
    });

    courses.reverse();

    courses.forEach(async function (course) {
      const card = document.createElement('div');
      card.className = 'feed-card';

      // 댓글 + 답글 수 조회
      let commentTotal = 0;
      try {
        const commentSnap = await getDocs(collection(db, 'courses', course.id, 'comments'));
        commentSnap.forEach(function (cDoc) {
          commentTotal++;
          const replies = cDoc.data().replies || [];
          commentTotal += replies.length;
        });
      } catch (e) { }
      course.commentCount = commentTotal;

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
      let likes = course.likes || 0;

      card.innerHTML = `
        <div class="card-thumbnail">${thumbnailHTML}</div>
        <div class="card-info">
          <div class="card-title">${course.name}</div>
          <div class="card-places">${placeSummary}</div>
          <div class="card-meta">✍️ ${course.authorNickname || '익명'}</div>
          <div class="card-actions">
            <button class="like-btn" data-id="${course.id}"><span>${likes}</span></button>
            <button class="comment-btn" data-id="${course.id}">💬 <span>${course.commentCount}</span></button>
            <button class="share-btn" data-id="${course.id}">📤</button>
          </div>
        </div>
      `;

      // 카드 클릭 시 상세 페이지 이동 (버튼 클릭 제외)
      card.addEventListener('click', function (e) {
        if (e.target.closest('.card-actions')) return;
        window.location.href = 'course.html?id=' + course.id;
      });

      // 좋아요 버튼 (토글)
      const likeBtn = card.querySelector('.like-btn');
      const likedKey = 'liked_' + course.id;

      if (localStorage.getItem(likedKey)) {
        likeBtn.style.color = '#ff4e6a';
      }

      likeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!localStorage.getItem('userId')) {
          alert('로그인이 필요합니다.');
          window.location.href = 'login.html';
          return;
        }
        const isLiked = localStorage.getItem(likedKey);

        if (isLiked) {
          likes = Math.max(likes - 1, 0);
          this.querySelector('span').textContent = likes;
          this.style.color = '';
          localStorage.removeItem(likedKey);
          updateDoc(firestoreDoc(db, 'courses', course.id), { likes: likes });
        } else {
          likes++;
          this.querySelector('span').textContent = likes;
          this.style.color = '#ff4e6a';
          localStorage.setItem(likedKey, 'true');
          updateDoc(firestoreDoc(db, 'courses', course.id), { likes: likes });
        }
      });

      // 댓글 버튼 → 상세 페이지 댓글 섹션으로 이동
      card.querySelector('.comment-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        window.location.href = 'course.html?id=' + course.id + '#comments';
      });

      feedList.appendChild(card);
    });
  }
} catch (error) {
  console.error('피드 불러오기 오류:', error);
  feedList.innerHTML = '<p style="color:#aaa; font-size:14px;">불러오기 실패. 새로고침 해주세요.</p>';
}