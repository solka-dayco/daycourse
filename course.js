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

function hideSpinner() {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.classList.add('hidden');
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
    hideSpinner();

  }).catch(function (error) {
    console.error('불러오기 오류:', error);
    hideSpinner();
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

    const content = document.createElement('div');
    content.style.cssText = 'width:28px;height:28px;background:#ff4e6a;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.25);';
    content.textContent = index + 1;

    new kakao.maps.CustomOverlay({
      position: pos,
      content: content,
      map: map,
      xAnchor: 0.5,
      yAnchor: 0.5
    });
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
let isSubmitting = false;

function loadComments() {
  const q = query(collection(db, 'courses', courseId, 'comments'), orderBy('createdAt', 'asc'));
  getDocs(q).then(function (snapshot) {
    document.getElementById('comment-count').textContent = countAllComments(snapshot);
    renderComments(snapshot);
  });
}

function countAllComments(snapshot) {
  let count = 0;
  snapshot.forEach(function (docSnap) {
    count++;
    const c = docSnap.data();
    if (c.replies) count += c.replies.length;
  });
  return count;
}

function submitComment() {
  if (isSubmitting) return;
  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('로그인이 필요합니다.');
    window.location.href = 'login.html';
    return;
  }

  const content = document.getElementById('comment-content').value.trim();
  if (!content) return;

  isSubmitting = true;
  const comment = {
    nickname: localStorage.getItem('nickname') || '익명',
    content: content,
    authorId: userId,
    createdAt: new Date(),
    commentLikes: [],
    replies: []
  };

  addDoc(collection(db, 'courses', courseId, 'comments'), comment).then(function () {
    document.getElementById('comment-content').value = '';
    isSubmitting = false;
    loadComments();
  }).catch(function () {
    isSubmitting = false;
  });
}

document.getElementById('comment-submit').addEventListener('click', submitComment);

function getTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const target = date.toDate ? date.toDate() : new Date(date);
  const diff = Math.floor((now - target) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return Math.floor(diff / 60) + '분 전';
  if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
  if (diff < 2592000) return Math.floor(diff / 86400) + '일 전';
  if (diff < 31536000) return Math.floor(diff / 2592000) + '개월 전';
  return Math.floor(diff / 31536000) + '년 전';
}

function renderComments(snapshot) {
  const ul = document.getElementById('comment-list');
  ul.innerHTML = '';
  const userId = localStorage.getItem('userId');

  snapshot.forEach(function (docSnap) {
    const c = docSnap.data();
    const commentId = docSnap.id;
    const likedUsers = c.commentLikes || [];
    const isLiked = userId && likedUsers.includes(userId);
    const likeCount = likedUsers.length;
    const replies = c.replies || [];

    const li = document.createElement('li');
    li.className = 'comment-item-wrap';

    let html =
      '<div class="comment-item">' +
        '<div class="comment-body">' +
          '<div class="comment-header">' +
            '<span class="comment-nickname">' + c.nickname + '</span>' +
            '<span class="comment-date">' + getTimeAgo(c.createdAt) + '</span>' +
          '</div>' +
          '<p class="comment-content">' + c.content + '</p>' +
          '<div class="comment-footer">' +
            (userId === c.authorId ? '<button class="comment-delete-btn" data-id="' + commentId + '">삭제</button>' : '') +
            '<button class="comment-reply-toggle" data-id="' + commentId + '">답글 달기</button>' +
          '</div>' +
          '<div class="reply-input-box hidden" id="reply-input-' + commentId + '">' +
            '<input type="text" class="reply-input" placeholder="답글을 입력하세요" maxlength="100">' +
            '<button class="reply-submit" data-id="' + commentId + '">등록</button>' +
          '</div>' +
        '</div>' +
        '<button class="comment-like-btn' + (isLiked ? ' liked' : '') + '" data-id="' + commentId + '">' +
          '<span class="comment-like-icon">♥</span>' +
          '<span class="comment-like-count">' + (likeCount > 0 ? likeCount : '') + '</span>' +
        '</button>' +
      '</div>';

    if (replies.length > 0) {
      html += '<ul class="reply-list">';
      replies.forEach(function (r, rIndex) {
        const rLikes = r.replyLikes || [];
        const rIsLiked = userId && rLikes.includes(userId);
        html +=
          '<li class="reply-item">' +
            '<div class="reply-body">' +
              '<div class="comment-header">' +
                '<span class="comment-nickname">' + r.nickname + '</span>' +
                '<span class="comment-date">' + getTimeAgo(r.createdAt) + '</span>' +
              '</div>' +
              '<p class="comment-content">' + r.content + '</p>' +
              '<div class="comment-footer">' +
                (userId === r.authorId ? '<button class="reply-delete-btn" data-comment-id="' + commentId + '" data-reply-index="' + rIndex + '">삭제</button>' : '') +
              '</div>' +
            '</div>' +
            '<button class="reply-like-btn' + (rIsLiked ? ' liked' : '') + '" data-comment-id="' + commentId + '" data-reply-index="' + rIndex + '">' +
              '<span class="comment-like-icon">♥</span>' +
              '<span class="comment-like-count">' + (rLikes.length > 0 ? rLikes.length : '') + '</span>' +
            '</button>' +
          '</li>';
      });
      html += '</ul>';
    }

    li.innerHTML = html;
    ul.appendChild(li);
  });

  // 댓글 삭제
  document.querySelectorAll('.comment-delete-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteComment(doc(db, 'courses', courseId, 'comments', this.dataset.id)).then(function () {
        loadComments();
      });
    });
  });

  // 댓글 좋아요
  document.querySelectorAll('.comment-like-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!userId) { alert('로그인이 필요합니다.'); window.location.href = 'login.html'; return; }
      const cid = this.dataset.id;
      const ref = doc(db, 'courses', courseId, 'comments', cid);
      getDoc(ref).then(function (snap) {
        if (!snap.exists()) return;
        let likes = snap.data().commentLikes || [];
        if (likes.includes(userId)) {
          likes = likes.filter(function (id) { return id !== userId; });
        } else {
          likes.push(userId);
        }
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(function (m) {
          m.updateDoc(ref, { commentLikes: likes }).then(function () { loadComments(); });
        });
      });
    });
  });

  // 답글 달기 토글
  document.querySelectorAll('.comment-reply-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!userId) { alert('로그인이 필요합니다.'); window.location.href = 'login.html'; return; }
      const box = document.getElementById('reply-input-' + this.dataset.id);
      box.classList.toggle('hidden');
      if (!box.classList.contains('hidden')) {
        box.querySelector('.reply-input').focus();
      }
    });
  });

  // 답글 등록
  document.querySelectorAll('.reply-submit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (isSubmitting) return;
      const cid = this.dataset.id;
      const input = document.getElementById('reply-input-' + cid).querySelector('.reply-input');
      const content = input.value.trim();
      if (!content) return;

      isSubmitting = true;
      const ref = doc(db, 'courses', courseId, 'comments', cid);
      getDoc(ref).then(function (snap) {
        if (!snap.exists()) { isSubmitting = false; return; }
        const replies = snap.data().replies || [];
        replies.push({
          nickname: localStorage.getItem('nickname') || '익명',
          content: content,
          authorId: userId,
          createdAt: new Date(),
          replyLikes: []
        });
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(function (m) {
          m.updateDoc(ref, { replies: replies }).then(function () {
            isSubmitting = false;
            loadComments();
          });
        });
      }).catch(function () { isSubmitting = false; });
    });
  });

  // 답글 삭제
  document.querySelectorAll('.reply-delete-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const cid = this.dataset.commentId;
      const rIndex = parseInt(this.dataset.replyIndex);
      const ref = doc(db, 'courses', courseId, 'comments', cid);
      getDoc(ref).then(function (snap) {
        if (!snap.exists()) return;
        const replies = snap.data().replies || [];
        replies.splice(rIndex, 1);
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(function (m) {
          m.updateDoc(ref, { replies: replies }).then(function () { loadComments(); });
        });
      });
    });
  });

  // 답글 좋아요
  document.querySelectorAll('.reply-like-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!userId) { alert('로그인이 필요합니다.'); window.location.href = 'login.html'; return; }
      const cid = this.dataset.commentId;
      const rIndex = parseInt(this.dataset.replyIndex);
      const ref = doc(db, 'courses', courseId, 'comments', cid);
      getDoc(ref).then(function (snap) {
        if (!snap.exists()) return;
        const replies = snap.data().replies || [];
        let rLikes = replies[rIndex].replyLikes || [];
        if (rLikes.includes(userId)) {
          rLikes = rLikes.filter(function (id) { return id !== userId; });
        } else {
          rLikes.push(userId);
        }
        replies[rIndex].replyLikes = rLikes;
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(function (m) {
          m.updateDoc(ref, { replies: replies }).then(function () { loadComments(); });
        });
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