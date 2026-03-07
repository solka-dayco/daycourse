import { db } from './firebase.js';
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

  // ── 4분할 썸네일 ─────────────────────────────────
  const thumbnail = document.getElementById('detail-thumbnail');
  const photos = course.photos || [];
  for (let i = 0; i < 4; i++) {
    if (photos[i]) {
      thumbnail.innerHTML += `<img src="${photos[i]}" alt="코스 사진">`;
    } else {
      thumbnail.innerHTML += `<div class="empty-slot">📍</div>`;
    }
  }

  // ── 제목 + 날짜 ──────────────────────────────────
  document.getElementById('detail-title').textContent = course.name;
  document.getElementById('detail-date').textContent = course.createdAt;

  // ── 장소 목록 ────────────────────────────────────
  const placeList = document.getElementById('detail-places');
  course.places.forEach(function (place, index) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="place-number">${index + 1}</span>
      <span>${place.name}</span>
    `;
    placeList.appendChild(li);
  });

  // ── 좋아요 / 댓글 수 ─────────────────────────────
  document.getElementById('like-count').textContent = course.likes || 0;
  document.getElementById('comment-count').textContent = course.comments || 0;

  // ── 좋아요 버튼 (토글) ───────────────────────────
  const likeBtn = document.getElementById('like-btn');
  const likedKey = 'liked_' + courseId;

  if (localStorage.getItem(likedKey)) {
    likeBtn.style.color = '#ff4e6a';
  }

  likeBtn.addEventListener('click', function () {
    const isLiked = localStorage.getItem(likedKey);

    if (isLiked) {
      const newLikes = Math.max((course.likes || 0) - 1, 0);
      updateDoc(docRef, { likes: newLikes }).then(function () {
        document.getElementById('like-count').textContent = newLikes;
        course.likes = newLikes;
        likeBtn.style.color = '';
        localStorage.removeItem(likedKey);
      }).catch(function (error) {
        console.error('좋아요 취소 오류:', error);
      });
    } else {
      const newLikes = (course.likes || 0) + 1;
      updateDoc(docRef, { likes: newLikes }).then(function () {
        document.getElementById('like-count').textContent = newLikes;
        course.likes = newLikes;
        likeBtn.style.color = '#ff4e6a';
        localStorage.setItem(likedKey, 'true');
      }).catch(function (error) {
        console.error('좋아요 오류:', error);
      });
    }
  });

  // ── 삭제 버튼 ────────────────────────────────────
  document.getElementById('delete-btn').addEventListener('click', function () {
    if (!confirm('이 코스를 삭제할까요?')) return;

    deleteDoc(docRef).then(function () {
      window.location.href = 'feed.html';
    }).catch(function (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    });
  });

  // ── 사진 뷰어 ────────────────────────────────────
  const viewerPhotos = (course.photos || []).filter(function (p) { return p; });
  let viewerIndex = 0;

  function updateViewer() {
    document.getElementById('viewer-img').src = viewerPhotos[viewerIndex];
    const dots = document.getElementById('viewer-dots');
    dots.innerHTML = '';
    viewerPhotos.forEach(function (_, i) {
      const dot = document.createElement('div');
      dot.className = 'viewer-dot' + (i === viewerIndex ? ' active' : '');
      dots.appendChild(dot);
    });
    document.getElementById('viewer-prev').style.display = viewerPhotos.length > 1 ? 'block' : 'none';
    document.getElementById('viewer-next').style.display = viewerPhotos.length > 1 ? 'block' : 'none';
  }

  document.getElementById('detail-thumbnail').addEventListener('click', function (e) {
    if (viewerPhotos.length === 0) return;

    const imgs = document.querySelectorAll('#detail-thumbnail img');
    let clickedIndex = 0;
    imgs.forEach(function (img, i) {
      if (img === e.target) clickedIndex = i;
    });

    viewerIndex = Math.min(clickedIndex, viewerPhotos.length - 1);
    updateViewer();
    document.getElementById('photo-viewer').classList.remove('hidden');
  });

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

  document.getElementById('photo-viewer').addEventListener('click', function (e) {
    if (e.target === this) {
      this.classList.add('hidden');
    }
  });

  // ── 댓글 기능 ────────────────────────────────────
  function loadComments() {
    const commentList = document.getElementById('comment-list');
    commentList.innerHTML = '<li style="color:#aaa; font-size:13px;">불러오는 중...</li>';

    const commentsRef = collection(db, 'courses', courseId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    getDocs(q).then(function (snapshot) {
      commentList.innerHTML = '';

      if (snapshot.empty) {
        commentList.innerHTML = '<li style="color:#aaa; font-size:13px;">첫 댓글을 남겨보세요!</li>';
        return;
      }

      snapshot.forEach(function (docSnap) {
        const comment = docSnap.data();
        const id = docSnap.id;
        const myNickname = localStorage.getItem('nickname') || '';

        const li = document.createElement('li');
        li.innerHTML = `
          <div class="comment-header">
            <span class="comment-nickname">${comment.nickname}</span>
            <span>
              <span class="comment-date">${comment.createdAt}</span>
              ${comment.nickname === myNickname ? `<button class="comment-delete" data-id="${id}">삭제</button>` : ''}
            </span>
          </div>
          <div class="comment-content">${comment.content}</div>
        `;
        commentList.appendChild(li);
      });

      document.querySelectorAll('.comment-delete').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('댓글을 삭제할까요?')) return;
          const commentId = this.dataset.id;
          deleteDoc(doc(db, 'courses', courseId, 'comments', commentId)).then(function () {
            loadComments();
            updateCommentCount(-1);
          });
        });
      });

    }).catch(function (error) {
      console.error('댓글 불러오기 오류:', error);
    });
  }

  function updateCommentCount(delta) {
    const newCount = (course.comments || 0) + delta;
    course.comments = newCount;
    document.getElementById('comment-count').textContent = newCount;
    updateDoc(docRef, { comments: newCount });
  }

  document.getElementById('comment-submit').addEventListener('click', function () {
    const nickname = document.getElementById('comment-nickname').value.trim();
    const content = document.getElementById('comment-content').value.trim();

    if (!nickname) {
      alert('닉네임을 입력해주세요.');
      return;
    }
    if (!content) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    localStorage.setItem('nickname', nickname);

    const commentsRef = collection(db, 'courses', courseId, 'comments');
    addDoc(commentsRef, {
      nickname: nickname,
      content: content,
      createdAt: new Date().toLocaleDateString('ko-KR') + ' ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }).then(function () {
      document.getElementById('comment-content').value = '';
      loadComments();
      updateCommentCount(1);
    }).catch(function (error) {
      console.error('댓글 등록 오류:', error);
    });
  });

  const savedNickname = localStorage.getItem('nickname');
  if (savedNickname) {
    document.getElementById('comment-nickname').value = savedNickname;
  }

  document.getElementById('comment-scroll-btn').addEventListener('click', function () {
    document.getElementById('comments').scrollIntoView({ behavior: 'smooth' });
  });

  loadComments();

  // ── 지도 + 동선 ──────────────────────────────────
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