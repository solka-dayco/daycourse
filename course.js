// course.js — 코스 상세 페이지
import {
  fetchCourseById, getCurrentUser, isCourseLiked, toggleCourseLike,
  fetchComments, addComment, deleteComment, toggleCommentLike,
  addReply, deleteReply, toggleReplyLike,
  onCourseDeleted, logEvent
} from './db.js';
import { initSidebar } from './sidebar.js';
import { getDistance, formatDistance, initMyLocation } from './map.js';

initSidebar();
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

const courseId = new URLSearchParams(location.search).get('id');
if (!courseId) location.href = 'main.html';

let currentUser  = null;
let courseData   = null;
let photosForViewer = []; // { url, name, comment }
let carouselIdx  = 0;
let viewerIdx    = 0;
let isSubmitting = false;

// ── 유틸 ─────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function relativeTime(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return '방금 전';
  if (diff < 3600)  return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  if (diff < 86400*30) return `${Math.floor(diff/86400)}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR');
}
function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min/60), m = min%60;
  return m ? `${h ? h+'시간 ' : ''}${m}분` : `${h}시간`;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── 초기화 ───────────────────────────────────────────
(async () => {
  currentUser = await getCurrentUser();
  logEvent('course_view', 'course', courseId);

  try {
    courseData = await fetchCourseById(courseId);
  } catch(e) {
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('courseContent').innerHTML =
      '<div style="text-align:center;padding:60px;color:#aaa">코스를 찾을 수 없습니다.</div>';
    document.getElementById('courseContent').style.display = '';
    return;
  }

  document.getElementById('spinner').style.display = 'none';
  document.getElementById('courseContent').style.display = '';

  const places = (courseData.course_places || []).sort((a,b) => a.order_index - b.order_index);

  renderCarousel(places);
  await renderHeader(courseData, places);
  renderTimeline(places);
  renderMap(places);
  await renderComments();
  setupShare();

  // 동선 지도 내 위치 버튼
  document.getElementById('detailMyLocationBtn')?.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const latlng = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      detailMapInstance.setCenter(latlng);
    }, () => {
      alert('위치 권한이 필요합니다.');
    });
  });

  // 댓글 섹션 앵커 처리
  if (location.hash === '#commentSection') {
    setTimeout(() => {
      document.getElementById('commentSection')?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }
})();

// ── 캐러셀 ───────────────────────────────────────────
function renderCarousel(places) {
  photosForViewer = places.filter(p => p.photo_url).map(p => ({
    url:     p.photo_url,
    name:    p.name,
    comment: p.comment || '',
  }));

  const track   = document.getElementById('carouselTrack');
  const dots    = document.getElementById('carouselDots');
  const counter = document.getElementById('carouselCounter');
  const carousel = document.getElementById('carousel');

  if (!photosForViewer.length) {
    // 사진 없을 때 배경 플레이스홀더
    carousel.innerHTML = `
      <div class="carousel-placeholder">
        <span>🗺️</span>
        <span>등록된 사진이 없습니다</span>
      </div>
    `;
    return;
  }

  track.innerHTML = photosForViewer.map((p, i) => `
    <div class="carousel-slide" data-index="${i}">
      <img src="${p.url}" alt="${escHtml(p.name)}" loading="lazy"/>
      <div class="carousel-overlay">
        <div class="carousel-place-name">${escHtml(p.name)}</div>
        ${p.comment ? `<div class="carousel-place-comment">"${escHtml(p.comment)}"</div>` : ''}
      </div>
    </div>
  `).join('');

  dots.innerHTML = photosForViewer.map((_, i) =>
    `<div class="carousel-dot${i === 0 ? ' active' : ''}"></div>`
  ).join('');

  updateCarouselCounter();

  // 슬라이드 클릭 → 뷰어
  track.querySelectorAll('.carousel-slide').forEach(slide => {
    slide.addEventListener('click', () => openViewer(parseInt(slide.dataset.index)));
  });

  // 버튼 네비
  document.getElementById('carouselPrev').addEventListener('click', () => moveCarousel(-1));
  document.getElementById('carouselNext').addEventListener('click', () => moveCarousel(1));

  // 스와이프
  let touchStartX = 0;
  carousel.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) moveCarousel(dx < 0 ? 1 : -1);
  });

  if (photosForViewer.length <= 1) {
    document.getElementById('carouselPrev').style.display = 'none';
    document.getElementById('carouselNext').style.display = 'none';
    dots.style.display = 'none';
    counter.style.display = 'none';
  }
}

function moveCarousel(dir) {
  const total = photosForViewer.length;
  carouselIdx = (carouselIdx + dir + total) % total;
  document.getElementById('carouselTrack').style.transform = `translateX(-${carouselIdx * 100}%)`;
  document.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === carouselIdx));
  updateCarouselCounter();
  logEvent('carousel_swipe', 'course', courseId, { index: carouselIdx });
}

function updateCarouselCounter() {
  document.getElementById('carouselCounter').textContent =
    `${carouselIdx + 1} / ${photosForViewer.length}`;
}

// ── 뷰어 ─────────────────────────────────────────────
function openViewer(idx) {
  viewerIdx = idx;
  document.getElementById('photoViewer').style.display = 'flex';
  updateViewer();
}

function updateViewer() {
  const p = photosForViewer[viewerIdx];
  document.getElementById('viewerImg').src = p.url;
  document.getElementById('viewerCounter').textContent = `${viewerIdx + 1} / ${photosForViewer.length}`;

  // 옵션 8: 뷰어 하단 캡션 (장소명 + 한줄평)
  const captionEl = document.getElementById('viewerCaption');
  if (captionEl) {
    captionEl.innerHTML = `
      <div class="viewer-caption-name">${escHtml(p.name)}</div>
      ${p.comment ? `<div class="viewer-caption-comment">"${escHtml(p.comment)}"</div>` : ''}
    `;
  }

  const dots = document.getElementById('viewerDots');
  dots.innerHTML = photosForViewer.map((_, i) =>
    `<div class="photo-viewer-dot${i === viewerIdx ? ' active' : ''}"></div>`
  ).join('');
}

document.getElementById('viewerClose').addEventListener('click', () => {
  document.getElementById('photoViewer').style.display = 'none';
});
document.getElementById('viewerPrev').addEventListener('click', () => {
  viewerIdx = (viewerIdx - 1 + photosForViewer.length) % photosForViewer.length;
  updateViewer();
});
document.getElementById('viewerNext').addEventListener('click', () => {
  viewerIdx = (viewerIdx + 1) % photosForViewer.length;
  updateViewer();
});

// 뷰어 스와이프
const viewer = document.getElementById('photoViewer');
let vTouchX = 0;
viewer.addEventListener('touchstart', e => { vTouchX = e.touches[0].clientX; }, { passive: true });
viewer.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - vTouchX;
  if (Math.abs(dx) > 40) {
    viewerIdx = (viewerIdx + (dx < 0 ? 1 : -1) + photosForViewer.length) % photosForViewer.length;
    updateViewer();
  }
});

// ── 코스 헤더 ─────────────────────────────────────────
async function renderHeader(course, places) {
  // 지역
  const regionEl = document.getElementById('courseRegion');
  if (course.region_main) {
    regionEl.textContent = course.region_main + (course.region_sub ? ' · ' + course.region_sub : '');
  } else {
    regionEl.style.display = 'none';
  }

  // 소요시간
  document.getElementById('courseTime').textContent =
    course.total_time ? `⏱ ${formatMinutes(course.total_time)}` : '';

  document.getElementById('courseName').textContent = course.name || '';

  const descEl = document.getElementById('courseDesc');
  if (course.description) {
    descEl.textContent = course.description;
  } else {
    descEl.style.display = 'none';
  }

  // 참조 표시
  const refEl = document.getElementById('courseRef');
  if (course.parent_course_id) {
    refEl.innerHTML = `참조: ${escHtml(course.parent_author_nickname || '')}의 "${escHtml(course.parent_course_name || '')}"`;
    refEl.style.display = '';
  }

  document.getElementById('courseAuthor').textContent = course.author_nickname || '';
  document.getElementById('courseDate').textContent = course.created_at
    ? new Date(course.created_at).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })
    : '';

  // ── 좋아요 ────────────────────────────────────────
  let liked = false;
  if (currentUser) liked = await isCourseLiked(courseId, currentUser.id);
  const likeBtn = document.getElementById('likeBtn');
  updateLikeBtn(liked, course.like_count || 0);

  likeBtn.addEventListener('click', async () => {
    if (!currentUser) { location.href = 'login.html'; return; }
    const nowLiked = likeBtn.classList.contains('liked');
    const prevCount = parseInt(likeBtn.querySelector('#likeCount')?.textContent || '0');
    updateLikeBtn(!nowLiked, prevCount + (!nowLiked ? 1 : -1));
    try {
      await toggleCourseLike(courseId, currentUser.id);
      logEvent('course_like', 'course', courseId);
    } catch {
      updateLikeBtn(nowLiked, prevCount);
    }
  });

  // ── 댓글 수 점프 버튼 ──────────────────────────────
  document.getElementById('commentJumpBtn')?.addEventListener('click', () => {
    document.getElementById('commentSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  // ── 참조 버튼 ─────────────────────────────────────
  const refCount = document.getElementById('refCount');
  if (refCount) refCount.textContent = course.reference_count > 0 ? course.reference_count : '';

  document.getElementById('copyBtn').addEventListener('click', () => {
    if (!currentUser) { location.href = 'login.html'; return; }
    const q = new URLSearchParams({
      mode: 'copy', id: courseId,
      pnick: course.author_nickname || '',
      pname: course.name || '',
      onick: course.original_author_nickname || course.author_nickname || '',
      oname: course.original_course_name || course.name || '',
    });
    logEvent('course_reference', 'course', courseId);
    location.href = `create.html?${q}`;
  });

  // ── 공유 버튼 (액션바) ────────────────────────────
  document.getElementById('shareActionBtn')?.addEventListener('click', () => {
    document.getElementById('shareOverlay').classList.add('show');
    document.getElementById('shareSheet').classList.add('show');
    logEvent('share_click', 'course', courseId);
  });

  // ── 수정/삭제 (본인) ──────────────────────────────
  if (currentUser && currentUser.id === course.author_id) {
    document.getElementById('ownerActions').style.display = '';
    document.getElementById('editBtn').addEventListener('click', () => {
      location.href = `create.html?mode=edit&id=${courseId}`;
    });
    document.getElementById('deleteBtn').addEventListener('click', async () => {
      if (!confirm('코스를 삭제하시겠습니까?')) return;
      try {
        await onCourseDeleted(courseId, course.parent_course_id || null);
        location.href = 'main.html';
      } catch {
        showToast('삭제 중 오류가 발생했습니다');
      }
    });
  }
}

function updateLikeBtn(liked, count) {
  const btn = document.getElementById('likeBtn');
  btn.innerHTML = `<span class="heart-icon">♥</span> <span id="likeCount">${count}</span>`;
  btn.classList.toggle('liked', liked);
}

// ── 타임라인 ─────────────────────────────────────────
function renderTimeline(places) {
  const container = document.getElementById('timeline');
  const summary   = document.getElementById('timelineSummary');
  container.innerHTML = '';

  places.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'tl-item';

    const distText = i > 0
      ? formatDistance(getDistance(places[i-1].lat, places[i-1].lng, p.lat, p.lng))
      : '';

    item.innerHTML = `
      ${i < places.length - 1 ? '<div class="tl-line"></div>' : ''}
      <div class="tl-left">
        <div class="tl-num">${i + 1}</div>
      </div>
      <div class="tl-right">
        <div class="tl-place-row">
          <div class="tl-place-info">
            <div class="tl-name">${escHtml(p.name)}</div>
            <div class="tl-sub">
              ${p.category ? '🏷 ' + escHtml(p.category) : ''}
              ${p.address  ? ' 📍 ' + escHtml(p.address)  : ''}
            </div>
            ${p.comment ? `<div class="tl-comment">"${escHtml(p.comment)}"</div>` : ''}
            ${p.stay_time ? `<div class="tl-stay">🕐 ${formatMinutes(p.stay_time)}</div>` : ''}
          </div>
          ${p.photo_url
            ? `<div class="tl-photo" data-viewer-idx="${photosForViewer.findIndex(v => v.url === p.photo_url)}">
                 <img src="${p.photo_url}" alt="${escHtml(p.name)}" loading="lazy"/>
               </div>`
            : `<div class="tl-photo-empty"></div>`
          }
        </div>
      </div>
    `;
    container.appendChild(item);

    // 이동 행
    if (i < places.length - 1) {
      const travel = document.createElement('div');
      travel.className = 'tl-travel';
      const nextDist   = formatDistance(getDistance(p.lat, p.lng, places[i+1].lat, places[i+1].lng));
      const travelText = places[i+1].travel_time ? `이동 ${formatMinutes(places[i+1].travel_time)}` : '';
      travel.textContent = [nextDist, travelText].filter(Boolean).join(' · ');
      container.appendChild(travel);
    }
  });

  // 타임라인 사진 클릭 → 뷰어
  container.querySelectorAll('.tl-photo[data-viewer-idx]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.viewerIdx);
      if (idx >= 0) {
        openViewer(idx);
        carouselIdx = idx;
        const track = document.getElementById('carouselTrack');
        if (track) track.style.transform = `translateX(-${carouselIdx * 100}%)`;
        document.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === carouselIdx));
        updateCarouselCounter();
        document.getElementById('carousel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 요약
  summary.innerHTML = `
    <span>📍 총 ${places.length}곳</span>
    ${courseData.total_time ? `<span>⏱ 약 <strong>${formatMinutes(courseData.total_time)}</strong></span>` : ''}
  `;
}

// ── 동선 지도 ─────────────────────────────────────────
let detailMapInstance = null;

function renderMap(places) {
  if (!places.length) return;
  kakao.maps.load(() => {
    const center = new kakao.maps.LatLng(places[0].lat, places[0].lng);
    const map = new kakao.maps.Map(document.getElementById('detailMap'), { center, level: 5 });
    detailMapInstance = map;

    const path = places.map(p => new kakao.maps.LatLng(p.lat, p.lng));
    new kakao.maps.Polyline({
      map, path,
      strokeWeight: 3,
      strokeColor: '#ff4e6a',
      strokeOpacity: 0.85,
      strokeStyle: 'solid',
    });

    places.forEach((p, i) => {
      new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(p.lat, p.lng),
        content: `<div style="
          width:24px; height:24px; border-radius:50%;
          background:#ff4e6a; color:white;
          font-size:11px; font-weight:700;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 2px 6px rgba(0,0,0,0.25);
          border:2px solid white;
        ">${i + 1}</div>`,
        xAnchor: 0.5,
        yAnchor: 0.5,
      });
    });

    const bounds = new kakao.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    map.setBounds(bounds, 30);
  });
}

// ── 댓글 ─────────────────────────────────────────────
async function renderComments() {
  const comments = await fetchComments(courseId);
  const list     = document.getElementById('commentList');
  const total    = document.getElementById('commentTotal');
  const badge    = document.getElementById('commentCountBadge');

  const totalCount = comments.reduce((s, c) => s + 1 + (c.replies?.length || 0), 0);
  total.textContent = `${totalCount}`;
  if (badge) badge.textContent = totalCount;

  list.innerHTML = '';
  comments.forEach(c => list.appendChild(buildCommentEl(c)));

  // 댓글 입력
  const input  = document.getElementById('commentInput');
  const submit = document.getElementById('commentSubmitBtn');

  // 이벤트 중복 방지
  const newSubmit = submit.cloneNode(true);
  submit.parentNode.replaceChild(newSubmit, submit);
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  async function submitComment() {
    if (isSubmitting) return;
    if (!currentUser) { location.href = 'login.html'; return; }
    const content = newInput.value.trim();
    if (!content) return;
    isSubmitting = true;
    newSubmit.disabled = true;
    try {
      await addComment({ courseId, authorId: currentUser.id, nickname: currentUser.nickname, content });
      newInput.value = '';
      await renderComments();
      logEvent('comment_create', 'course', courseId);
    } catch { showToast('댓글 등록 실패'); }
    finally { isSubmitting = false; newSubmit.disabled = false; }
  }

  newSubmit.addEventListener('click', submitComment);
  newInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitComment(); });
}

function buildCommentEl(c) {
  const wrap = document.createElement('div');
  wrap.className = 'comment-item';

  const myLiked   = currentUser ? (c.comment_likes || []).some(l => l.user_id === currentUser.id) : false;
  const likeCount = (c.comment_likes || []).length;

  wrap.innerHTML = `
    <div class="comment-header">
      <span class="comment-nick">${escHtml(c.nickname)}</span>
      <span class="comment-time">${relativeTime(c.created_at)}</span>
    </div>
    <div class="comment-body">${escHtml(c.content)}</div>
    <div class="comment-foot">
      <button class="comment-like-btn ${myLiked ? 'liked' : ''}">
        <span class="heart">♥</span> <span class="clc">${likeCount}</span>
      </button>
      <button class="comment-reply-toggle">답글 ${c.replies?.length ? c.replies.length : ''}</button>
      ${currentUser && currentUser.id === c.author_id
        ? `<button class="comment-delete-btn">삭제</button>` : ''}
    </div>
    <div class="reply-area" id="reply-area-${c.id}"></div>
  `;

  // 답글 렌더
  const replyArea = wrap.querySelector(`#reply-area-${c.id}`);
  renderReplies(replyArea, c);

  // 댓글 좋아요
  wrap.querySelector('.comment-like-btn').addEventListener('click', async () => {
    if (!currentUser) { location.href = 'login.html'; return; }
    const btn = wrap.querySelector('.comment-like-btn');
    const nowLiked = btn.classList.contains('liked');
    btn.classList.toggle('liked', !nowLiked);
    btn.querySelector('.clc').textContent = parseInt(btn.querySelector('.clc').textContent) + (!nowLiked ? 1 : -1);
    await toggleCommentLike(c.id, currentUser.id);
  });

  // 답글 토글
  wrap.querySelector('.comment-reply-toggle').addEventListener('click', () => {
    const inputWrap = replyArea.querySelector('.reply-input-wrap');
    if (inputWrap) { inputWrap.remove(); return; }
    if (!currentUser) { location.href = 'login.html'; return; }
    const div = document.createElement('div');
    div.className = 'reply-input-wrap';
    div.innerHTML = `
      <input type="text" class="reply-input" placeholder="답글 입력…" maxlength="200"/>
      <button class="reply-submit-btn">등록</button>
    `;
    replyArea.appendChild(div);
    div.querySelector('.reply-submit-btn').addEventListener('click', async () => {
      const content = div.querySelector('.reply-input').value.trim();
      if (!content) return;
      await addReply({ commentId: c.id, authorId: currentUser.id, nickname: currentUser.nickname, content });
      await renderComments();
    });
    div.querySelector('.reply-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') div.querySelector('.reply-submit-btn').click();
    });
    div.querySelector('.reply-input').focus();
  });

  // 댓글 삭제
  wrap.querySelector('.comment-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    await deleteComment(c.id);
    await renderComments();
  });

  return wrap;
}

function renderReplies(area, comment) {
  const replies = comment.replies || [];
  replies.forEach(r => {
    const replyLikes = r.reply_likes || [];
    const myLiked = currentUser ? replyLikes.some(l => l.user_id === currentUser.id) : false;

    const el = document.createElement('div');
    el.className = 'reply-item';
    el.innerHTML = `
      <div class="reply-header">
        <span class="reply-nick">${escHtml(r.nickname)}</span>
        <span class="reply-time">${relativeTime(r.created_at)}</span>
      </div>
      <div class="reply-body">${escHtml(r.content)}</div>
      <div class="reply-foot">
        <button class="reply-like-btn ${myLiked ? 'liked' : ''}">
          <span class="heart">♥</span> <span class="rlc">${replyLikes.length}</span>
        </button>
        ${currentUser && currentUser.id === r.author_id
          ? `<button class="reply-delete-btn">삭제</button>` : ''}
      </div>
    `;

    el.querySelector('.reply-like-btn').addEventListener('click', async () => {
      if (!currentUser) { location.href = 'login.html'; return; }
      const btn = el.querySelector('.reply-like-btn');
      const nowLiked = btn.classList.contains('liked');
      btn.classList.toggle('liked', !nowLiked);
      btn.querySelector('.rlc').textContent = parseInt(btn.querySelector('.rlc').textContent) + (!nowLiked ? 1 : -1);
      await toggleReplyLike(r.id, currentUser.id);
    });

    el.querySelector('.reply-delete-btn')?.addEventListener('click', async () => {
      if (!confirm('답글을 삭제하시겠습니까?')) return;
      await deleteReply(r.id);
      await renderComments();
    });

    area.appendChild(el);
  });
}

// ── 공유 ─────────────────────────────────────────────
function setupShare() {
  const overlay = document.getElementById('shareOverlay');
  const sheet   = document.getElementById('shareSheet');

  overlay.addEventListener('click', closeShare);

  // 링크 복사
  document.getElementById('copyLinkBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast('링크가 복사되었습니다');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = location.href;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('링크가 복사되었습니다');
    }
    closeShare();
  });

  // 카카오톡 공유
  document.getElementById('kakaoShareBtn').addEventListener('click', () => {
    if (!window.Kakao) { showToast('카카오 SDK 로드 중입니다'); return; }
    if (!Kakao.isInitialized()) Kakao.init('725e3b5f43c47c651837511245861cc8');
    const thumbPlace = (courseData.course_places || []).find(p => p.photo_url);
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: courseData.name || '데이코스',
        description: courseData.description || `${courseData.author_nickname}의 데이트 코스`,
        imageUrl: thumbPlace?.photo_url || '',
        link: { mobileWebUrl: location.href, webUrl: location.href },
      },
      buttons: [{ title: '코스 보기', link: { mobileWebUrl: location.href, webUrl: location.href } }],
    });
    closeShare();
  });

  function closeShare() {
    overlay.classList.remove('show');
    sheet.classList.remove('show');
  }
}