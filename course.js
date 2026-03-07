// ── course.js ────────────────────────────────────
// 담당: 코스 상세 페이지 (썸네일, 장소목록, 지도, 좋아요, 댓글, 삭제)

import { db } from './firebase.js';
import {
  doc, getDoc, deleteDoc,
  collection, addDoc, getDocs, query, orderBy, deleteDoc as deleteComment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get('id');

let viewerPhotos = [];
let viewerIndex = 0;

if (!courseId) {
  alert('잘못된 접근입니다.');
  window.location.href = 'feed.html';
}

kakao.maps.load(function () {
  loadCourse();
});

// ── 코스 불러오기 ────────────────────────────────
function loadCourse() {
  getDoc(doc(db, 'courses', courseId)).then(function (docSnap) {
    if (!docSnap.exists()) {
      alert('존재하지 않는 코스입니다.');
      window.location.href = 'feed.html';
      return;
    }

    const course = docSnap.data();

    // 제목, 날짜, 작성자
    document.getElementById('detail-title').textContent = course.name;
    document.getElementById('detail-date').textContent = course.createdAt;
    document.getElementById('detail-author').textContent = '작성자: ' + (course.authorNickname || '익명');

    // 썸네일
    renderThumbnail(course.photos);

    // 장소 목록
    renderPlaces(course.places);

    // 지도
    renderMap(course.places);

    // 좋아요
    renderLikes(course.likes);

    // 삭제 버튼 권한
    const userId = localStorage.getItem('userId');
    const deleteBtn = document.getElementById('delete-btn');
    if (userId && userId === course.authorId) {
      deleteBtn.style.display = 'block';
    } else {
      deleteBtn.style.display = 'none';
    }

    deleteBtn.addEventListener('click', function () {
      if (!confirm('이 게시글을 삭제할까요?')) return;
      deleteDoc(doc(db, 'courses', courseId)).then(function () {
        alert('삭제됐습니다.');
        window.location.href = 'feed.html';
      });
    });

    // 댓글 수
    loadComments();

  }).catch(function (error) {
    console.error('불러오기 오류:', error);
  });
}

// ── 썸네일 ───────────────────────────────────────
function renderThumbnail(photos) {
  const container = document.getElementById('detail-thumbnail');
  container.innerHTML = '';
  if (!photos) return;

  const validPhotos = photos.filter(function (p) { return p; });

  validPhotos.forEach(function (src, i) {
    const div = document.createElement('div');
    div.className = 'thumbnail-cell';
    div.style.backgroundImage = 'url(' + src + ')';
    div.addEventListener('click', function () {
      openViewer(validPhotos, i);
    });
    container.appendChild(div);
  });
}

// ── 장소 목록 ────────────────────────────────────
function renderPlaces(places) {
  const ul = document.getElementById('detail-places');
  ul.innerHTML = '';
  if (!places) return;

  places.forEach(function (place, index) {
    const li = document.createElement('li');
    li.textContent = (index + 1) + '. ' + place.name;
    ul.appendChild(li);
  });
}

// ── 지도 ─────────────────────────────────────────
function renderMap(places) {
  if (!places || places.length === 0) return;

  const container = document.getElementById('detail-map');
  const center = new kakao.maps.LatLng(places[0].lat, places[0].lng);
  const map = new kakao.maps.Map(container, { center: center, level: 5 });

  const linePath = [];

  places.forEach(function (place, index) {
    const pos = new kakao.maps.LatLng(place.lat, place.lng);
    linePath.push(pos);

    const marker = new kakao.maps.Marker({ position: pos, map: map });

    const infowindow = new kakao.maps.InfoWindow({
      content: '<div style="padding:4px 8px;font-size:13px;">' + (index + 1) + '. ' + place.name + '</div>'
    });
    infowindow.open(map, marker);
  });

  new kakao.maps.Polyline({
    map: map,
    path: linePath,
    strokeWeight: 3,
    strokeColor: '#ff4e6a',
    strokeOpacity: 0.8,
    strokeStyle: 'solid'
  });
}

// ── 좋아요 ───────────────────────────────────────
function renderLikes(count) {
  document.getElementById('like-count').textContent = count || 0;

  const likeBtn = document.getElementById('like-btn');
  const likedKey = 'liked_' + courseId;
  const isLiked = localStorage.getItem(likedKey);
  if (isLiked) likeBtn.classList.add('liked');

  likeBtn.addEventListener('click', function () {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('로그인이 필요합니다.');
      window.location.href = 'login.html';
      return;
    }

    if (localStorage.getItem(likedKey)) return;

    const newCount = (parseInt(document.getElementById('like-count').textContent) || 0) + 1;
    document.getElementById('like-count').textContent = newCount;
    likeBtn.classList.add('liked');
    localStorage.setItem(likedKey, '1');

    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(function (m) {
      m.updateDoc(doc(db, 'courses', courseId), { likes: newCount });
    });
  });
}

// ── 댓글 ─────────────────────────────────────────
function loadComments() {
  const q = query(collection(db, 'courses', courseId, 'comments'), orderBy('createdAt', 'asc'));
  getDocs(q).then(function (snapshot) {
    document.getElementById('comment-count').textContent = snapshot.size;
    renderComments(snapshot);
  });

  document.getElementById('comment-submit').addEventListener('click', function () {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('로그인이 필요합니다.');
      window.location.href = 'login.html';
      return;
    }

    const content = document.getElementById('comment-content').value.trim();
    if (!content) return;

    const comment = {
      nickname: localStorage.getItem('nickname') || '익명',
      content: content,
      authorId: userId,
      createdAt: new Date()
    };

    addDoc(collection(db, 'courses', courseId, 'comments'), comment).then(function () {
      document.getElementById('comment-content').value = '';
      loadComments();
    });
  });
}

function renderComments(snapshot) {
  const ul = document.getElementById('comment-list');
  ul.innerHTML = '';
  const userId = localStorage.getItem('userId');

  snapshot.forEach(function (docSnap) {
    const c = docSnap.data();
    const li = document.createElement('li');
    li.className = 'comment-item';
    li.innerHTML = `
      <span class="comment-nickname">${c.nickname}</span>
      <span class="comment-content">${c.content}</span>
      ${userId === c.authorId ? '<button class="comment-delete-btn" data-id="' + docSnap.id + '">삭제</button>' : ''}
    `;
    ul.appendChild(li);
  });

  document.querySelectorAll('.comment-delete-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteComment(doc(db, 'courses', courseId, 'comments', this.dataset.id)).then(function () {
        loadComments();
      });
    });
  });
}

// ── 공유 ─────────────────────────────────────────
document.getElementById('share-btn').addEventListener('click', function () {
  document.getElementById('share-modal').classList.remove('hidden');
});

document.getElementById('share-close').addEventListener('click', function () {
  document.getElementById('share-modal').classList.add('hidden');
});

document.getElementById('share-copy-btn').addEventListener('click', function () {
  navigator.clipboard.writeText(window.location.href).then(function () {
    document.getElementById('share-modal').classList.add('hidden');
    const toast = document.getElementById('toast');
    toast.classList.remove('hidden');
    setTimeout(function () { toast.classList.add('hidden'); }, 2000);
  });
});

document.getElementById('comment-scroll-btn').addEventListener('click', function () {
  document.getElementById('comments').scrollIntoView({ behavior: 'smooth' });
});

// ── 사진 뷰어 ────────────────────────────────────
function openViewer(photos, startIndex) {
  viewerPhotos = photos.filter(function (p) { return p; });
  if (viewerPhotos.length === 0) return;
  viewerIndex = startIndex;
  updateViewer();
  document.getElementById('photo-viewer').classList.remove('hidden');
}

function updateViewer() {
  document.getElementById('viewer-img').src = viewerPhotos[viewerIndex];
  const dots = document.getElementById('viewer-dots');
  dots.innerHTML = '';
  viewerPhotos.forEach(function (_, i) {
    const dot = document.createElement('div');
    dot.className = 'viewer-dot' + (i === viewerIndex ? ' active' : '');
    dots.appendChild(dot);
  });
}

document.getElementById('viewer-close').addEventListener('click', function () {
  document.getElementById('photo-viewer').classList.add('hidden');
});

document.getElementById('viewer-prev').addEventListener('click', function () {
  viewerIndex = (viewerIndex - 1 + viewerPhotos.length) % viewerPhotos.length;
  updateViewer();
});

document.getElementById('viewer-next').addEventListener('click', function () {
  viewerIndex = (viewerIndex + 1) % viewerPhotos.length;
  updateViewer();
});