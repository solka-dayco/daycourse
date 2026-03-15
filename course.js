// course.js — 코스 상세 페이지 (v3)
import {
  getCurrentUser, fetchCourseById,
  isCourseLiked, toggleCourseLike,
  isBookmarked, toggleBookmark,
  fetchComments, addComment, deleteComment, toggleCommentLike,
  addReply, deleteReply, toggleReplyLike,
  fetchReferencedCourses,
  onCourseDeleted, logEvent, submitReport,
} from './db.js';
import { initSidebar } from './sidebar.js';
import { supabase } from './supabase.js';

// ── 안전한 DOM 헬퍼 ──────────────────────────────────────
// getElementById가 null을 반환해도 오류 없이 처리
function $id(id) {
  return document.getElementById(id);
}
function setText(id, val) {
  const el = $id(id); if (el) el.textContent = val;
}
function setHtml(id, val) {
  const el = $id(id); if (el) el.innerHTML = val;
}
function show(id) {
  const el = $id(id); if (el) el.style.display = '';
}
function hide(id) {
  const el = $id(id); if (el) el.style.display = 'none';
}
function on(id, ev, fn) {
  const el = $id(id); if (el) el.addEventListener(ev, fn);
}

initSidebar();

// ── 파라미터 ──────────────────────────────────────────────
const params   = new URLSearchParams(location.search);
const courseId = params.get('id');

if (!courseId) { location.href = 'main.html'; }

// ── 상태 ─────────────────────────────────────────────────
let course = null, currentUser = null;
let commentSort = 'latest';

// ── 요소 참조 ─────────────────────────────────────────────
const spinner      = document.getElementById('spinner');
const courseContent = document.getElementById('courseContent');
const likeBtn      = document.getElementById('likeBtn');
const bookmarkBtn  = document.getElementById('bookmarkBtn');
const commentInput = document.getElementById('commentInput');
const commentSubmitBtn = document.getElementById('commentSubmitBtn');

// ── 초기화 ───────────────────────────────────────────────
(async () => {
  [course, currentUser] = await Promise.all([
    fetchCourseById(courseId),
    getCurrentUser(),
  ]);

  if (!course) {
    spinner.style.display = 'none';
    showToast('코스를 찾을 수 없습니다');
    setTimeout(() => location.href = 'main.html', 1500);
    return;
  }

  logEvent('course_view', 'course', courseId);

  renderCourseHeader();
  renderCarousel();
  renderTimeline();
  renderReferencedCourses();
  await renderLikeBookmark();
  initCommentSortChips();
  await renderComments();

  spinner.style.display = 'none';
  courseContent.style.display = '';

  // 지도는 courseContent가 보인 후 초기화 — display:none 상태에서 초기화하면 크기 0으로 깨짐
  renderMap();

  // 앵커 처리 (댓글 섹션)
  if (location.hash === '#commentSection') {
    setTimeout(() => {
      document.getElementById('commentSection')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }
})();

// ── 코스 헤더 렌더 ────────────────────────────────────────
function renderCourseHeader() {
  document.title = `${course.name} — 데이코스`;

  if (course.region_main) {
    setText('courseRegion', course.region_main + (course.region_sub ? ` · ${course.region_sub}` : ''));
  }
  setText('courseTime', formatMinutes(course.total_time) ? `⏱ ${formatMinutes(course.total_time)}` : '');
  setText('courseName',  course.name);
  setText('courseDesc',  course.description || '');
  setText('courseDate',  relativeTime(course.created_at));

  // 작성자 → 유저 페이지
  const authorEl = $id('courseAuthor');
  if (authorEl) {
    authorEl.textContent = course.author_nickname;
    authorEl.addEventListener('click', () => { location.href = `user.html?id=${course.author_id}`; });
  }

  // 참조 출처
  if (course.original_course_id) {
    const refEl = $id('courseRef');
    if (refEl) {
      refEl.style.display = '';
      refEl.innerHTML = `이 코스는 <a href="course.html?id=${escHtml(course.original_course_id)}">${escHtml(course.original_course_name || '원본 코스')}</a>를 참고하여 만들어졌습니다`;
    }
  }

  // 참조 수
  setText('refCount', course.reference_count > 0 ? course.reference_count : '');

  // 댓글 수 뱃지
  setText('commentCountBadge', course.comment_count || 0);

  // 본인 코스 — 수정/삭제 / 타인 코스 — 신고 버튼
  const ownerActions = document.getElementById('ownerActions');
  const reportBtn    = document.getElementById('reportBtn');
  const editBtn      = document.getElementById('editBtn');
  const deleteBtn_el = document.getElementById('deleteBtn');

  if (currentUser && currentUser.id === course.author_id) {
    if (ownerActions) ownerActions.style.display = '';
    if (reportBtn)    reportBtn.style.display    = 'none';

    editBtn?.addEventListener('click', () => {
      location.href = `create.html?mode=edit&id=${courseId}`;
    });
    deleteBtn_el?.addEventListener('click', () => {
      document.getElementById('deleteModal')?.classList.add('show');
    });
  } else if (currentUser) {
    if (reportBtn) {
      reportBtn.style.display = '';
      reportBtn.addEventListener('click', openReportSheet);
    }
  }

  // 삭제 모달
  document.getElementById('deleteCancel')?.addEventListener('click', () => {
    document.getElementById('deleteModal')?.classList.remove('show');
  });
  document.getElementById('deleteConfirm')?.addEventListener('click', async () => {
    document.getElementById('deleteModal')?.classList.remove('show');
    try {
      await onCourseDeleted(courseId, course.parent_course_id);
      location.href = 'main.html';
    } catch (e) {
      showToast('삭제 실패: ' + e.message);
    }
  });

  // 참조 버튼
  on('copyBtn', 'click', () => {
    if (!currentUser) { location.href = 'login.html'; return; }
    location.href = `create.html?mode=copy&id=${courseId}`;
    logEvent('course_reference', 'course', courseId);
  });

  // 공유 버튼
  on('shareActionBtn', 'click', openShareSheet);

  // 댓글 점프
  on('commentJumpBtn', 'click', () => {
    document.getElementById('commentSection')?.scrollIntoView({ behavior: 'smooth' });
  });
}

// ── 좋아요 / 북마크 ───────────────────────────────────────
async function renderLikeBookmark() {
  likeBtn.innerHTML = `♥ <span id="likeCount">${course.like_count || 0}</span>`;

  if (currentUser) {
    const [liked, marked] = await Promise.all([
      isCourseLiked(courseId, currentUser.id),
      isBookmarked(courseId, currentUser.id),
    ]);
    if (liked)  likeBtn.classList.add('liked');
    if (marked) bookmarkBtn.classList.add('bookmarked');
  }

  likeBtn.addEventListener('click', async () => {
    if (!currentUser) { location.href = 'login.html'; return; }
    const nowLiked = likeBtn.classList.contains('liked');
    const countEl  = likeBtn.querySelector('#likeCount');
    likeBtn.classList.toggle('liked', !nowLiked);
    countEl.textContent = parseInt(countEl.textContent) + (!nowLiked ? 1 : -1);
    try {
      await toggleCourseLike(courseId, currentUser.id);
      logEvent('course_like', 'course', courseId);
    } catch {
      likeBtn.classList.toggle('liked', nowLiked);
      countEl.textContent = parseInt(countEl.textContent) + (nowLiked ? 1 : -1);
    }
  });

  bookmarkBtn.addEventListener('click', async () => {
    if (!currentUser) { location.href = 'login.html'; return; }
    const nowMarked = bookmarkBtn.classList.contains('bookmarked');
    bookmarkBtn.classList.toggle('bookmarked', !nowMarked);
    try {
      await toggleBookmark(courseId, currentUser.id);
      showToast(!nowMarked ? '북마크에 추가했습니다' : '북마크를 해제했습니다');
      logEvent('course_bookmark', 'course', courseId);
    } catch {
      bookmarkBtn.classList.toggle('bookmarked', nowMarked);
    }
  });
}

// ── 캐러셀 ────────────────────────────────────────────────
function renderCarousel() {
  const places = course.course_places || [];
  const photoPlaces = places.filter(p => p.photo_url);
  const track   = document.getElementById('carouselTrack');
  const counter = document.getElementById('carouselCounter');

  if (photoPlaces.length === 0) {
    track.innerHTML = `
      <div class="carousel-slide" style="min-width:100%;display:flex;align-items:center;justify-content:center;">
        <div class="carousel-placeholder"><span>🗺️</span><span>사진 없음</span></div>
      </div>`;
    counter.style.display = 'none';
    hide('carouselPrev');
    hide('carouselNext');
    return;
  }

  track.innerHTML = photoPlaces.map((p, i) => `
    <div class="carousel-slide" data-idx="${i}">
      <img src="${escHtml(p.photo_url)}" alt="${escHtml(p.name)}" loading="${i === 0 ? 'eager' : 'lazy'}"/>
      <div class="carousel-overlay">
        <div class="carousel-place-name">${escHtml(p.name)}</div>
        ${p.comment ? `<div class="carousel-place-comment">${escHtml(p.comment)}</div>` : ''}
      </div>
    </div>
  `).join('');

  // 전체화면 뷰어
  const viewerPhotos = photoPlaces;
  let viewerIdx = 0;
  track.querySelectorAll('.carousel-slide').forEach((slide, i) => {
    slide.addEventListener('click', () => openViewer(i, viewerPhotos));
  });

  // 네비게이션
  let curIdx = 0;
  const total = photoPlaces.length;

  function updateCounter() {
    counter.textContent = `${curIdx + 1}/${total}`;
  }
  updateCounter();

  function goTo(idx) {
    curIdx = Math.max(0, Math.min(idx, total - 1));
    track.style.transform = `translateX(-${curIdx * 100}%)`;
    updateCounter();
  }

  on('carouselPrev', 'click', () => goTo(curIdx - 1));
  on('carouselNext', 'click', () => goTo(curIdx + 1));

  // 스와이프
  let touchStartX = 0;
  const carousel = document.getElementById('carousel');
  carousel.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      goTo(curIdx + (dx < 0 ? 1 : -1));
      logEvent('carousel_swipe', 'course', courseId);
    }
  }, { passive: true });

  // 타임라인 썸네일 클릭 → 캐러셀 이동 연동 (전역 함수)
  window.jumpCarousel = (placeName) => {
    const idx = photoPlaces.findIndex(p => p.name === placeName);
    if (idx >= 0) {
      goTo(idx);
      document.querySelector('.carousel-wrap')?.scrollIntoView({ behavior: 'smooth' });
    }
  };
}

// ── 전체화면 뷰어 ─────────────────────────────────────────
let viewerPhotos = [], viewerCurrent = 0;

function openViewer(idx, photos) {
  viewerPhotos  = photos;
  viewerCurrent = idx;
  renderViewer();
  show('photoViewer');
  document.body.style.overflow = 'hidden';
}

function renderViewer() {
  const p = viewerPhotos[viewerCurrent];
  $id('viewerImg') && ($id('viewerImg').src = p.photo_url);
  setText('viewerCounter', `${viewerCurrent + 1} / ${viewerPhotos.length}`);
  setHtml('viewerCaption', `<div class="viewer-caption-name">${escHtml(p.name)}</div>${p.comment ? `<div class="viewer-caption-comment">${escHtml(p.comment)}</div>` : ''}`);
}

on('viewerClose', 'click', () => { hide('photoViewer'); document.body.style.overflow = ''; });
on('viewerPrev', 'click', () => {
  if (viewerCurrent > 0) { viewerCurrent--; renderViewer(); }
});
on('viewerNext', 'click', () => {
  if (viewerCurrent < viewerPhotos.length - 1) { viewerCurrent++; renderViewer(); }
});
// 뷰어 배경 클릭 닫기
on('photoViewer', 'click', e => {
  if (e.target === $id('photoViewer')) { hide('photoViewer'); document.body.style.overflow = ''; }
});

// ── 타임라인 ─────────────────────────────────────────────
function renderTimeline() {
  const places  = course.course_places || [];
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  places.forEach((p, i) => {
    // 이동 시간 (두 번째 장소부터)
    if (i > 0 && p.travel_time) {
      const travelEl = document.createElement('div');
      travelEl.className = 'tl-travel';
      const dist = i > 0 ? haversineDist(places[i-1], p) : null;
      travelEl.innerHTML = `
        <span>↓</span>
        <span>이동 ${formatMinutes(p.travel_time)}</span>
        ${dist !== null ? `<span>· ${dist} km</span>` : ''}
      `;
      container.appendChild(travelEl);
    }

    const item = document.createElement('div');
    item.className = 'tl-item';
    item.innerHTML = `
      <div class="tl-left">
        <div class="tl-line"></div>
        <div class="tl-num">${i + 1}</div>
      </div>
      <div class="tl-right">
        <div class="tl-place-row">
          <div class="tl-place-info">
            <div class="tl-name">${escHtml(p.name)}</div>
            <div class="tl-sub">${escHtml(p.category || '')}${p.address ? ` · ${escHtml(p.address)}` : ''}</div>
            ${p.comment ? `<div class="tl-comment">"${escHtml(p.comment)}"</div>` : ''}
            ${p.stay_time ? `<div class="tl-stay">체류 ${formatMinutes(p.stay_time)}</div>` : ''}
          </div>
          ${p.photo_url
            ? `<div class="tl-photo" data-name="${escHtml(p.name)}">
                 <img src="${escHtml(p.photo_url)}" alt="${escHtml(p.name)}" loading="lazy"/>
               </div>`
            : `<div class="tl-photo-empty"></div>`
          }
        </div>
      </div>
    `;

    // 사진 썸네일 클릭 → 캐러셀 이동
    const thumb = item.querySelector('.tl-photo');
    if (thumb) {
      thumb.addEventListener('click', () => {
        window.jumpCarousel?.(thumb.dataset.name);
      });
    }

    container.appendChild(item);
  });

  // 요약
  const totalStay = places.reduce((s, p) => s + (p.stay_time || 0), 0);
  const totalTravel = places.reduce((s, p) => s + (p.travel_time || 0), 0);
  setHtml('timelineSummary', `
    <span>총 <strong>${places.length}개</strong> 장소</span>
    <span>총 소요 <strong>${formatMinutes(course.total_time)}</strong></span>
    ${totalStay   ? `<span>체류 <strong>${formatMinutes(totalStay)}</strong></span>`   : ''}
    ${totalTravel ? `<span>이동 <strong>${formatMinutes(totalTravel)}</strong></span>` : ''}
  `);
}

// ── 지도 ─────────────────────────────────────────────────
function renderMap() {
  kakao.maps.load(() => {
    const places = course.course_places || [];
    if (!places.length) return;

    const container = document.getElementById('detailMap');
    const first = places[0];
    const map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(first.lat, first.lng),
      level: 5,
    });

    const bounds = new kakao.maps.LatLngBounds();
    const path   = [];

    places.forEach((p, i) => {
      const pos = new kakao.maps.LatLng(p.lat, p.lng);
      path.push(pos);
      bounds.extend(pos);

      const el = document.createElement('div');
      el.style.cssText = `
        width:24px;height:24px;border-radius:50%;
        background:#e8648a;color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;
        box-shadow:0 2px 6px rgba(0,0,0,.35);
      `;
      el.textContent = i + 1;
      new kakao.maps.CustomOverlay({ position: pos, content: el, map });
    });

    new kakao.maps.Polyline({
      path,
      strokeWeight: 3,
      strokeColor: '#e8648a',
      strokeOpacity: .7,
      strokeStyle: 'solid',
      map,
    });

    if (places.length > 1) map.setBounds(bounds);

    // 컨테이너 크기 재계산 (display:none 해제 직후 초기화 시 필요)
    kakao.maps.event.addListener(map, 'idle', () => {});
    setTimeout(() => map.relayout(), 100);

    // 내 위치 버튼
    on('detailMyLocationBtn', 'click', () => {
      navigator.geolocation?.getCurrentPosition(pos => {
        const latlng = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        map.setCenter(latlng);
      });
    });
  });
}

// ── 참조된 코스 섹션 ──────────────────────────────────────
async function renderReferencedCourses() {
  if (!course.reference_count || course.reference_count === 0) return;

  try {
    const refs = await fetchReferencedCourses(courseId);
    if (!refs.length) return;

    const section = document.getElementById('referencedSection');
    const grid    = document.getElementById('referencedGrid');
    section.style.display = '';

    refs.forEach(c => {
      const places = (c.course_places || []).sort((a, b) => a.order_index - b.order_index);
      const thumb  = c.thumbnail_url || places.find(p => p.photo_url)?.photo_url || '';

      const card = document.createElement('div');
      card.className = 'feed-card';
      card.innerHTML = `
        <div class="feed-thumb">
          ${thumb
            ? `<img src="${escHtml(thumb)}" alt="${escHtml(c.name)}" loading="lazy"/>`
            : `<div class="feed-thumb-placeholder" style="font-size:24px">🗺️</div>`
          }
        </div>
        <div class="feed-body">
          <div class="feed-course-name">${escHtml(c.name)}</div>
          <div class="feed-meta" style="justify-content:space-between">
            <span class="feed-author">${escHtml(c.author_nickname)}</span>
            <span class="feed-like-btn"><span class="heart">♥</span>${c.like_count||0}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => { location.href = `course.html?id=${c.id}`; });
      grid.appendChild(card);
    });
  } catch (e) { console.error('참조 코스 로드 실패:', e); }
}

// ── 댓글 ─────────────────────────────────────────────────
// 정렬 칩은 최초 1회만 바인딩
function initCommentSortChips() {
  document.querySelectorAll('.comment-sort-chips .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.comment-sort-chips .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      commentSort = btn.dataset.sort;
      renderComments();
    });
  });
}

async function renderComments() {
  const list = document.getElementById('commentList');
  list.innerHTML = '<div class="spinner-wrap" style="padding:20px"><div class="spinner"></div></div>';

  // 현재 활성 칩 표시 업데이트
  document.querySelectorAll('.comment-sort-chips .chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === commentSort);
  });

  try {
    const comments = await fetchComments(courseId, commentSort);
    list.innerHTML = '';

    // 총 댓글 수 (댓글 + 답글 합산)
    const total = comments.reduce((s, c) => s + 1 + (c.replies?.length || 0), 0);
    setText('commentTotal', total > 0 ? `${total}개` : '');
    setText('commentCountBadge', course.comment_count || 0);

    comments.forEach(c => list.appendChild(buildCommentEl(c)));
  } catch (e) { console.error(e); list.innerHTML = ''; }

  // 댓글 등록 (최초 1회만 - setupCommentInput 내부에서 중복 방지)
  setupCommentInput();
}

function buildCommentEl(c) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.dataset.id = c.id;

  const likeCount = (c.comment_likes || []).length;
  const isLiked   = currentUser ? (c.comment_likes || []).some(l => l.user_id === currentUser.id) : false;
  const isOwn     = currentUser && currentUser.id === c.author_id;

  item.innerHTML = `
    <div class="comment-item-header">
      <span class="comment-nick">${escHtml(c.nickname)}</span>
      <span class="comment-time">${relativeTime(c.created_at)}</span>
    </div>
    <div class="comment-body">${escHtml(c.content)}</div>
    <div class="comment-foot">
      <button class="comment-like-btn ${isLiked ? 'liked' : ''}" data-id="${c.id}">
        ♥ <span class="comment-like-count">${likeCount}</span>
      </button>
      <button class="comment-reply-toggle" data-id="${c.id}">답글</button>
      ${isOwn ? `<button class="comment-delete-btn" data-id="${c.id}">삭제</button>` : ''}
    </div>
    <div class="reply-area" id="replyArea-${c.id}">
      ${(c.replies || []).map(r => buildReplyHtml(r)).join('')}
    </div>
    <div class="reply-input-wrap" id="replyInputWrap-${c.id}" style="display:none">
      <input type="text" class="reply-input" placeholder="답글 입력…" maxlength="200" autocomplete="off"/>
      <button class="reply-submit-btn" data-comment-id="${c.id}">등록</button>
    </div>
  `;

  // 좋아요
  item.querySelector('.comment-like-btn').addEventListener('click', async btn => {
    if (!currentUser) { location.href = 'login.html'; return; }
    const el = btn.currentTarget;
    const nowLiked = el.classList.contains('liked');
    const countEl  = el.querySelector('.comment-like-count');
    el.classList.toggle('liked', !nowLiked);
    countEl.textContent = parseInt(countEl.textContent) + (!nowLiked ? 1 : -1);
    try { await toggleCommentLike(c.id, currentUser.id); }
    catch {
      el.classList.toggle('liked', nowLiked);
      countEl.textContent = parseInt(countEl.textContent) + (nowLiked ? 1 : -1);
    }
  });

  // 답글 토글
  item.querySelector('.comment-reply-toggle').addEventListener('click', () => {
    const wrap = document.getElementById(`replyInputWrap-${c.id}`);
    const isHidden = wrap.style.display === 'none';
    wrap.style.display = isHidden ? '' : 'none';
    if (isHidden) wrap.querySelector('.reply-input')?.focus();
  });

  // 답글 등록
  const replySubmit = item.querySelector('.reply-submit-btn');
  const replyInput  = item.querySelector('.reply-input');
  replySubmit.addEventListener('click', async () => {
    if (!currentUser) { location.href = 'login.html'; return; }
    const content = replyInput.value.trim();
    if (!content) return;
    replySubmit.disabled = true;
    try {
      const reply = await addReply({
        commentId: c.id,
        authorId:  currentUser.id,
        nickname:  currentUser.nickname,
        content,
      });
      const area = document.getElementById(`replyArea-${c.id}`);
      area.insertAdjacentHTML('beforeend', buildReplyHtml(reply));
      replyInput.value = '';
      document.getElementById(`replyInputWrap-${c.id}`).style.display = 'none';
      bindReplyEvents(area.lastElementChild);
    } catch (e) { showToast('답글 등록 실패'); }
    finally { replySubmit.disabled = false; }
  });
  replyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); replySubmit.click(); }
  });

  // 댓글 삭제
  item.querySelector('.comment-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('댓글을 삭제하시겠어요?')) return;
    try {
      await deleteComment(c.id, courseId);
      item.remove();
    } catch (e) { showToast('삭제 실패'); }
  });

  // 답글 이벤트 바인딩
  item.querySelectorAll('.reply-item').forEach(el => bindReplyEvents(el));

  return item;
}

function buildReplyHtml(r) {
  const isOwn = currentUser && currentUser.id === r.author_id;
  const rLiked = currentUser ? (r.reply_likes || []).some(l => l.user_id === currentUser.id) : false;
  const rLikeCount = (r.reply_likes || []).length;
  return `
    <div class="reply-item" data-id="${r.id}" data-comment-id="${r.comment_id}">
      <div class="reply-header">
        <span class="reply-nick">${escHtml(r.nickname)}</span>
        <span class="reply-time">${relativeTime(r.created_at)}</span>
      </div>
      <div class="reply-body">${escHtml(r.content)}</div>
      <div class="reply-foot">
        <button class="reply-like-btn ${rLiked ? 'liked' : ''}" data-id="${r.id}">
          ♥ <span class="reply-like-count">${rLikeCount}</span>
        </button>
        ${isOwn ? `<button class="reply-delete-btn" data-id="${r.id}" data-comment-id="${r.comment_id}">삭제</button>` : ''}
      </div>
    </div>
  `;
}

function bindReplyEvents(el) {
  const rId = el.dataset.id;
  const cId = el.dataset.commentId;

  el.querySelector('.reply-like-btn')?.addEventListener('click', async btn => {
    if (!currentUser) { location.href = 'login.html'; return; }
    const b = btn.currentTarget;
    const nowLiked = b.classList.contains('liked');
    const countEl  = b.querySelector('.reply-like-count');
    b.classList.toggle('liked', !nowLiked);
    countEl.textContent = parseInt(countEl.textContent) + (!nowLiked ? 1 : -1);
    try { await toggleReplyLike(rId, currentUser.id); }
    catch {
      b.classList.toggle('liked', nowLiked);
      countEl.textContent = parseInt(countEl.textContent) + (nowLiked ? 1 : -1);
    }
  });

  el.querySelector('.reply-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('답글을 삭제하시겠어요?')) return;
    try {
      await deleteReply(rId, cId);
      el.remove();
    } catch { showToast('삭제 실패'); }
  });
}

let commentInputBound = false;
function setupCommentInput() {
  if (!currentUser) {
    commentInput.placeholder = '로그인 후 댓글을 작성할 수 있습니다';
    commentInput.disabled    = true;
    commentSubmitBtn.disabled = true;
    return;
  }
  if (commentInputBound) return;   // 이미 바인딩됨 → skip
  commentInputBound = true;

  commentSubmitBtn.addEventListener('click', submitComment);
  commentInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
  });
}

async function submitComment() {
  const content = commentInput.value.trim();
  if (!content || !currentUser) return;
  commentSubmitBtn.disabled = true;
  try {
    const comment = await addComment({
      courseId,
      authorId: currentUser.id,
      nickname: currentUser.nickname,
      content,
    });
    commentInput.value = '';
    comment.comment_likes = [];
    comment.replies = [];
    const list = document.getElementById('commentList');
    list.prepend(buildCommentEl(comment));

    // 뱃지 카운트 즉시 반영
    const badge = document.getElementById('commentCountBadge');
    badge.textContent = parseInt(badge.textContent || '0') + 1;

    logEvent('comment_create', 'course', courseId);
  } catch (e) { showToast('댓글 등록 실패'); }
  finally { commentSubmitBtn.disabled = false; }
}

// ── 공유 ─────────────────────────────────────────────────
function openShareSheet() {
  $id('shareOverlay')?.classList.add('show');
  $id('shareSheet')?.classList.add('open');
  logEvent('share_click', 'course', courseId);
}
function closeShareSheet() {
  $id('shareOverlay')?.classList.remove('show');
  $id('shareSheet')?.classList.remove('open');
}

on('shareOverlay', 'click', closeShareSheet);

on('copyLinkBtn', 'click', () => {
  navigator.clipboard.writeText(location.href)
    .then(() => showToast('링크가 복사되었습니다'))
    .catch(() => showToast('복사 실패'));
  closeShareSheet();
});

on('kakaoShareBtn', 'click', () => {
  if (window.Kakao?.isInitialized()) {
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: course.name,
        description: course.description || '',
        imageUrl: course.thumbnail_url || '',
        link: { mobileWebUrl: location.href, webUrl: location.href },
      },
    });
  } else {
    showToast('카카오 SDK 미초기화');
  }
  closeShareSheet();
});

// ── 신고 바텀시트 ─────────────────────────────────────────
function openReportSheet() {
  $id('reportOverlay')?.classList.add('show');
  $id('reportSheet')?.classList.add('open');
}
function closeReportSheet() {
  $id('reportOverlay')?.classList.remove('show');
  $id('reportSheet')?.classList.remove('open');
}

on('reportOverlay', 'click', closeReportSheet);

document.querySelectorAll('#reportSheet .bottom-sheet-item').forEach(item => {
  item.addEventListener('click', async () => {
    const reason = item.dataset.reason;
    if (!reason) return;
    closeReportSheet();
    if (!currentUser) { location.href = 'login.html'; return; }
    try {
      await submitReport({
        reporterUserId: currentUser.id,
        targetType: 'course',
        targetId: courseId,
        reason,
      });
      showToast('신고가 접수되었습니다');
    } catch (e) {
      showToast('신고 실패: ' + e.message);
    }
  });
});

// ── ESC 키 전역 처리 ─────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;

  // 전체화면 뷰어
  if ($id('photoViewer')?.style.display !== 'none') {
    hide('photoViewer');
    document.body.style.overflow = '';
    return;
  }
  // 공유 시트
  if ($id('shareSheet')?.classList.contains('open')) {
    closeShareSheet();
    return;
  }
  // 신고 시트
  if ($id('reportSheet')?.classList.contains('open')) {
    closeReportSheet();
    return;
  }
  // 삭제 모달
  if ($id('deleteModal')?.classList.contains('show')) {
    $id('deleteModal')?.classList.remove('show');
    return;
  }
});

// ── 유틸 ─────────────────────────────────────────────────
function haversineDist(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 +
    Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))).toFixed(1);
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h ? h+'시간 ' : ''}${m}분` : `${h}시간`;
}

function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  if (d < 7)  return `${d}일 전`;
  return new Date(isoStr).toLocaleDateString('ko-KR');
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}