// course.js — 코스 상세 페이지 (v4 — 퍼널 로그 강화 + 안정화)
import {
  getCurrentUser,
  fetchCourseById,
  isCourseLiked,
  toggleCourseLike,
  isBookmarked,
  toggleBookmark,
  fetchComments,
  addComment,
  deleteComment,
  toggleCommentLike,
  addReply,
  deleteReply,
  toggleReplyLike,
  fetchReferencedCourses,
  onCourseDeleted,
  logEvent,
  submitReport,
  searchUsersForMention,
} from './db.js';
import { initSidebar } from './sidebar.js';
import { initIcons, initSidebarIcons, ICONS } from './icons.js';
import { supabase } from './supabase.js';

// ── 안전한 DOM 헬퍼 ──────────────────────────────────────
function $id(id) {
  return document.getElementById(id);
}
function setText(id, val) {
  const el = $id(id);
  if (el) el.textContent = val;
}
function setHtml(id, val) {
  const el = $id(id);
  if (el) el.innerHTML = val;
}
function show(id) {
  const el = $id(id);
  if (el) el.style.display = '';
}
function hide(id) {
  const el = $id(id);
  if (el) el.style.display = 'none';
}
function on(id, ev, fn) {
  const el = $id(id);
  if (el) el.addEventListener(ev, fn);
}

initSidebar();
initSidebarIcons();

// ── 파라미터 ──────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const courseId = params.get('id');

if (!courseId) {
  location.href = '/';
}

// ── 상태 ─────────────────────────────────────────────────
let course = null;
let currentUser = null;
let commentSort = 'latest';

// ── 워터마크 헬퍼 ─────────────────────────────────────────
function wmHtml() {
  const label = course?.author_nickname ? `@${course.author_nickname}` : '데이코스';
  return `<div class="wm-wrap"><div class="wm-center">${escHtml(label)}</div><div class="wm-corner">데이코스</div></div>`;
}

// ── 요소 참조 ─────────────────────────────────────────────
const spinner = $id('spinner');
const courseContent = $id('courseContent');
const likeBtn = $id('likeBtn');
const bookmarkBtn = $id('bookmarkBtn');
const commentInput = $id('commentInput');
const commentSubmitBtn = $id('commentSubmitBtn');

// ── 초기화 ───────────────────────────────────────────────
(async () => {
  try {
    [course, currentUser] = await Promise.all([
      fetchCourseById(courseId),
      getCurrentUser(),
    ]);

    if (!course) {
      spinner.style.display = 'none';
      showToast('코스를 찾을 수 없습니다');
      setTimeout(() => {
        location.href = '/';
      }, 1500);
      return;
    }

    logEvent('course_view', 'course', courseId, {
      page: 'course',
      author_id: course.author_id || null,
      region_main: course.region_main || '',
      region_sub: course.region_sub || '',
      has_thumbnail: !!course.thumbnail_url,
      place_count: Array.isArray(course.course_places) ? course.course_places.length : 0,
    });

    renderCourseHeader();
    renderCarousel();
    renderTimeline();
    renderReferencedCourses();
    await renderLikeBookmark();
    initCommentSortChips();
    await renderComments();

    spinner.style.display = 'none';
    courseContent.style.display = '';

    initIcons();
    renderMap();

    if (location.hash === '#commentSection') {
      setTimeout(() => {
        $id('commentSection')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  } catch (err) {
    console.error('course init error:', err);
    spinner.style.display = 'none';
    showToast('코스 정보를 불러오지 못했습니다');
  }
})();

// ── 코스 헤더 렌더 ────────────────────────────────────────
function renderCourseHeader() {
  updateSeoTags();

  if (course.region_main) {
    setText(
      'courseRegion',
      course.region_main + (course.region_sub ? ` · ${course.region_sub}` : '')
    );
  }

  setText('courseTime', formatMinutes(course.total_time) || '');
  setText('courseName', course.name);
  setText('courseDesc', course.description || '');
  setText('courseDate', relativeTime(course.created_at));

  // 작성자 → 유저 페이지
  const authorEl = $id('courseAuthor');
  if (authorEl) {
    authorEl.textContent = course.author_nickname;
    authorEl.addEventListener('click', () => {
      logEvent('author_click', 'user', course.author_id, {
        page: 'course',
        course_id: courseId,
      });
      location.href = `/user?id=${course.author_id}`;
    });
  }

  // 참조 출처
  if (course.original_course_id) {
    const refEl = $id('courseRef');
    if (refEl) {
      refEl.style.display = '';
      refEl.innerHTML =
        `이 코스는 <a href="/course?id=${escHtml(course.original_course_id)}">${escHtml(course.original_course_name || '원본 코스')}</a>를 참고하여 만들어졌습니다`;

      refEl.querySelector('a')?.addEventListener('click', () => {
        logEvent('original_course_click', 'course', course.original_course_id, {
          page: 'course',
          course_id: courseId,
        });
      });
    }
  }

  setText('refCount', course.reference_count ?? 0);
  setText('commentCountBadge', course.comment_count || 0);

  const ownerActions = $id('ownerActions');
  const reportBtn = $id('reportBtn');
  const editBtn = $id('editBtn');
  const deleteBtnEl = $id('deleteBtn');

  if (currentUser && currentUser.id === course.author_id) {
    if (ownerActions) ownerActions.style.display = '';
    if (reportBtn) reportBtn.style.display = 'none';

    editBtn?.addEventListener('click', () => {
      logEvent('course_edit_click', 'course', courseId, {
        page: 'course',
      });
      location.href = `/create?mode=edit&id=${courseId}`;
    });

    deleteBtnEl?.addEventListener('click', () => {
      $id('deleteModal')?.classList.add('show');
    });
  } else if (currentUser) {
    if (reportBtn) {
      reportBtn.style.display = '';
      reportBtn.addEventListener('click', () => {
        logEvent('report_open', 'course', courseId, {
          page: 'course',
        });
        openReportSheet();
      });
    }
  }

  // 삭제 모달
  $id('deleteCancel')?.addEventListener('click', () => {
    $id('deleteModal')?.classList.remove('show');
  });

  $id('deleteConfirm')?.addEventListener('click', async () => {
    $id('deleteModal')?.classList.remove('show');

    try {
      logEvent('course_delete_confirm', 'course', courseId, {
        page: 'course',
      });
      await onCourseDeleted(courseId, course.parent_course_id);
      location.href = '/';
    } catch (e) {
      showToast('삭제 실패: ' + e.message);
    }
  });

  // 참조 버튼
  on('copyBtn', 'click', () => {
    if (!currentUser) {
      logEvent('login_required_click', 'course', courseId, {
        page: 'course',
        action: 'reference',
      });
      location.href = '/login';
      return;
    }

    logEvent('course_reference', 'course', courseId, {
      page: 'course',
    });

    location.href = `/create?mode=copy&id=${courseId}`;
  });

  // 공유 버튼
  on('shareActionBtn', 'click', openShareSheet);

  // 댓글 점프
  on('commentJumpBtn', 'click', () => {
    logEvent('comment_cta_click', 'course', courseId, {
      page: 'course',
    });
    $id('commentSection')?.scrollIntoView({ behavior: 'smooth' });
  });
}

// ── 좋아요 / 북마크 ───────────────────────────────────────
async function renderLikeBookmark() {
  if (!likeBtn || !bookmarkBtn) return;

  likeBtn.innerHTML = `♥ <span id="likeCount">${course.like_count || 0}</span>`;

  if (currentUser) {
    const [liked, marked] = await Promise.all([
      isCourseLiked(courseId, currentUser.id),
      isBookmarked(courseId, currentUser.id),
    ]);

    if (liked) likeBtn.classList.add('liked');
    if (marked) bookmarkBtn.classList.add('bookmarked');
  }

  likeBtn.addEventListener('click', async () => {
    if (!currentUser) {
      logEvent('login_required_click', 'course', courseId, {
        page: 'course',
        action: 'like',
      });
      location.href = '/login';
      return;
    }

    const nowLiked = likeBtn.classList.contains('liked');
    const countEl = likeBtn.querySelector('#likeCount');

    likeBtn.classList.toggle('liked', !nowLiked);
    countEl.textContent = parseInt(countEl.textContent, 10) + (!nowLiked ? 1 : -1);

    try {
      const liked = await toggleCourseLike(courseId, currentUser.id);
      logEvent(liked ? 'like_click' : 'like_cancel', 'course', courseId, {
        page: 'course',
      });
    } catch {
      likeBtn.classList.toggle('liked', nowLiked);
      countEl.textContent = parseInt(countEl.textContent, 10) + (nowLiked ? 1 : -1);
    }
  });

  bookmarkBtn.addEventListener('click', async () => {
    if (!currentUser) {
      logEvent('login_required_click', 'course', courseId, {
        page: 'course',
        action: 'bookmark',
      });
      location.href = '/login';
      return;
    }

    const nowMarked = bookmarkBtn.classList.contains('bookmarked');
    bookmarkBtn.classList.toggle('bookmarked', !nowMarked);

    try {
      const marked = await toggleBookmark(courseId, currentUser.id);
      showToast(marked ? '북마크에 추가했습니다' : '북마크를 해제했습니다');
      logEvent(marked ? 'bookmark_add' : 'bookmark_remove', 'course', courseId, {
        page: 'course',
      });
    } catch {
      bookmarkBtn.classList.toggle('bookmarked', nowMarked);
    }
  });
}

// ── 캐러셀 ────────────────────────────────────────────────
function renderCarousel() {
  const places = course.course_places || [];
  const photoPlaces = places.filter(p => p.photo_url);
  const thumbnail = course.thumbnail_url || null;
  const track = $id('carouselTrack');
  const counter = $id('carouselCounter');

  const slides = [];
  if (thumbnail) {
    slides.push({
      type: 'thumbnail',
      photo_url: thumbnail,
      name: course.name,
      comment: '',
    });
  }
  photoPlaces.forEach(p => slides.push({ type: 'place', ...p }));

  if (slides.length === 0) {
    track.innerHTML = `
      <div class="carousel-slide" style="min-width:100%;display:flex;align-items:center;justify-content:center;">
        <div class="carousel-placeholder"><span>🗺️</span><span>사진 없음</span></div>
      </div>`;
    counter.style.display = 'none';
    hide('carouselPrev');
    hide('carouselNext');
    return;
  }

  track.innerHTML = slides.map((p, i) => `
    <div class="carousel-slide" data-idx="${i}">
      <img src="${escHtml(p.photo_url)}" alt="${escHtml(p.name)}" loading="${i === 0 ? 'eager' : 'lazy'}"/>
      ${wmHtml()}
      <div class="carousel-overlay">
        ${p.type === 'thumbnail' ? '' : (() => {
          const addrParts = (p.address || '').trim().split(' ');
          const loc = addrParts.length >= 2 ? escHtml(addrParts.slice(0, 2).join(' ')) : '';
          return loc
            ? `<span class="carousel-place-name-main">${escHtml(p.name)}<span class="carousel-place-name-sub"> ${loc}</span></span>`
            : `<span class="carousel-place-name-main">${escHtml(p.name)}</span>`;
        })()}
        ${p.type !== 'thumbnail' && p.comment ? `<div class="carousel-place-comment">${escHtml(p.comment)}</div>` : ''}
      </div>
    </div>
  `).join('');

  const viewerPhotos = slides;
  track.querySelectorAll('.carousel-slide').forEach((slide, i) => {
    slide.addEventListener('click', () => {
      logEvent('carousel_open', 'course', courseId, {
        page: 'course',
        index: i,
      });
      openViewer(i, viewerPhotos);
    });
  });

  let curIdx = 0;
  const total = slides.length;

  function updateCounter() {
    counter.textContent = `${curIdx + 1}/${total}`;
  }
  updateCounter();

  function goTo(idx) {
    curIdx = Math.max(0, Math.min(idx, total - 1));
    track.style.transform = `translateX(-${curIdx * 100}%)`;
    updateCounter();
  }

  on('carouselPrev', 'click', () => {
    goTo(curIdx - 1);
    logEvent('carousel_nav', 'course', courseId, {
      page: 'course',
      direction: 'prev',
      index: curIdx,
    });
  });

  on('carouselNext', 'click', () => {
    goTo(curIdx + 1);
    logEvent('carousel_nav', 'course', courseId, {
      page: 'course',
      direction: 'next',
      index: curIdx,
    });
  });

  let touchStartX = 0;
  const carousel = $id('carousel');

  carousel.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  carousel.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      goTo(curIdx + (dx < 0 ? 1 : -1));
      logEvent('carousel_swipe', 'course', courseId, {
        page: 'course',
        direction: dx < 0 ? 'next' : 'prev',
        index: curIdx,
      });
    }
  }, { passive: true });

  window.jumpCarousel = (placeName) => {
    const idx = slides.findIndex(p => p.type !== 'thumbnail' && p.name === placeName);
    if (idx >= 0) {
      goTo(idx);
      logEvent('timeline_photo_jump', 'course', courseId, {
        page: 'course',
        place_name: placeName,
        index: idx,
      });
      document.querySelector('.carousel-wrap')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 이미지 저장 방지
  track.querySelectorAll('img').forEach(img => {
    img.addEventListener('contextmenu', e => e.preventDefault());
    img.addEventListener('dragstart', e => e.preventDefault());
  });
}

// ── 전체화면 뷰어 ─────────────────────────────────────────
let viewerPhotos = [];
let viewerCurrent = 0;

function openViewer(idx, photos) {
  viewerPhotos = photos;
  viewerCurrent = idx;
  renderViewer();
  const wmEl = $id('viewerWatermark');
  if (wmEl) wmEl.innerHTML = wmHtml();
  show('photoViewer');
  document.body.style.overflow = 'hidden';
}

function renderViewer() {
  const p = viewerPhotos[viewerCurrent];
  if ($id('viewerImg')) $id('viewerImg').src = p.photo_url;
  setText('viewerCounter', `${viewerCurrent + 1} / ${viewerPhotos.length}`);
  setHtml(
    'viewerCaption',
    `<div class="viewer-caption-name">${escHtml(p.name)}</div>${p.comment ? `<div class="viewer-caption-comment">${escHtml(p.comment)}</div>` : ''}`
  );
}

on('viewerClose', 'click', () => {
  hide('photoViewer');
  document.body.style.overflow = '';
});

// 뷰어 이미지 저장 방지
const viewerImg = $id('viewerImg');
if (viewerImg) {
  viewerImg.addEventListener('contextmenu', e => e.preventDefault());
  viewerImg.addEventListener('dragstart', e => e.preventDefault());
}

on('viewerPrev', 'click', () => {
  if (viewerCurrent > 0) {
    viewerCurrent--;
    renderViewer();
    logEvent('viewer_nav', 'course', courseId, {
      page: 'course',
      direction: 'prev',
      index: viewerCurrent,
    });
  }
});

on('viewerNext', 'click', () => {
  if (viewerCurrent < viewerPhotos.length - 1) {
    viewerCurrent++;
    renderViewer();
    logEvent('viewer_nav', 'course', courseId, {
      page: 'course',
      direction: 'next',
      index: viewerCurrent,
    });
  }
});

on('photoViewer', 'click', e => {
  if (e.target === $id('photoViewer')) {
    hide('photoViewer');
    document.body.style.overflow = '';
  }
});

// ── 타임라인 ─────────────────────────────────────────────
function renderTimeline() {
  const places = course.course_places || [];
  const container = $id('timeline');
  container.innerHTML = '';

  places.forEach((p, i) => {
    if (i > 0) {
      const travelEl = document.createElement('div');
      travelEl.className = 'tl-travel';
      const dist = haversineDist(places[i - 1], p);
      travelEl.innerHTML = `
        <div class="tl-travel-line-area">
          <span class="tl-travel-dist">${formatDist(dist)}</span>
        </div>
        ${p.travel_time ? `<span class="tl-travel-time">이동 ${formatMinutes(p.travel_time)}</span>` : ''}
        ${p.transport === 'walk' ? `<span class="tl-transport-icon">${ICONS.walk(13)}</span>` : p.transport === 'transit' ? `<span class="tl-transport-icon">${ICONS.bus(13)}</span>` : p.transport === 'car' ? `<span class="tl-transport-icon">${ICONS.car(13)}</span>` : ''}
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
            ${p.place_url
              ? `<a class="tl-name tl-name-link" href="${escHtml(p.place_url)}" target="_blank" rel="noopener">${escHtml(p.name)}</a>`
              : `<div class="tl-name">${escHtml(p.name)}</div>`}
            <div class="tl-sub">${escHtml(p.category || '')}${p.address ? ` · ${escHtml(p.address)}` : ''}</div>
            ${p.stay_time ? `<div class="tl-duration">${formatMinutes(p.stay_time)}</div>` : ''}
          </div>
          ${p.photo_url
            ? `<div class="tl-photo" data-name="${escHtml(p.name)}">
                 <img src="${escHtml(p.photo_url)}" alt="${escHtml(p.name)}" loading="lazy"/>
               </div>`
            : `<div class="tl-photo-empty"></div>`
          }
        </div>
        ${p.comment ? `<div class="tl-comment">${escHtml(p.comment).replace(/\n/g, '<br/>')}</div>` : ''}
      </div>
    `;

    const thumb = item.querySelector('.tl-photo');
    if (thumb) {
      thumb.addEventListener('click', () => {
        window.jumpCarousel?.(thumb.dataset.name);
      });
    }

    item.querySelector('.tl-name-link')?.addEventListener('click', () => {
      logEvent('place_link_click', 'place', p.id || null, {
        page: 'course',
        place_name: p.name || '',
        course_id: courseId,
      });
    });

    container.appendChild(item);
  });

  setHtml(
    'timelineSummary',
    `
      <span>총 <strong>${places.length}개</strong> 장소</span>
      ${course.total_time ? `<span>총 소요 <strong>${formatMinutes(course.total_time)}</strong></span>` : ''}
    `
  );
}

// ── 지도 ─────────────────────────────────────────────────
function renderMap() {
  kakao.maps.load(() => {
    const places = course.course_places || [];
    if (!places.length) return;

    const validPlaces = places.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');
    if (!validPlaces.length) return;

    const container = $id('detailMap');
    const first = validPlaces[0];

    const map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(first.lat, first.lng),
      level: 5,
    });

    const bounds = new kakao.maps.LatLngBounds();
    const path = [];

    validPlaces.forEach((p, i) => {
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

      new kakao.maps.CustomOverlay({
        position: pos,
        content: el,
        map,
      });
    });

    new kakao.maps.Polyline({
      path,
      strokeWeight: 3,
      strokeColor: '#e8648a',
      strokeOpacity: 0.7,
      strokeStyle: 'solid',
      map,
    });

    if (validPlaces.length > 1) map.setBounds(bounds);

    kakao.maps.event.addListener(map, 'idle', () => {});
    setTimeout(() => map.relayout(), 100);

    on('detailMyLocationBtn', 'click', () => {
      navigator.geolocation?.getCurrentPosition(pos => {
        const latlng = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        map.setCenter(latlng);
        logEvent('map_my_location', 'course', courseId, {
          page: 'course',
        });
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

    const section = $id('referencedSection');
    const grid = $id('referencedGrid');
    section.style.display = '';

    refs.forEach(c => {
      const places = (c.course_places || []).sort((a, b) => a.order_index - b.order_index);
      const thumb = c.thumbnail_url || places.find(p => p.photo_url)?.photo_url || '';

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
            <span class="feed-like-btn"><span class="heart">♥</span>${c.like_count || 0}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        logEvent('referenced_course_click', 'course', c.id, {
          page: 'course',
          source_course_id: courseId,
        });
        location.href = `/course?id=${c.id}`;
      });

      grid.appendChild(card);
    });
  } catch (e) {
    console.error('참조 코스 로드 실패:', e);
  }
}

// ── 댓글 ─────────────────────────────────────────────────
function initCommentSortChips() {
  document.querySelectorAll('.comment-sort-chips .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.comment-sort-chips .chip')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');
      commentSort = btn.dataset.sort;

      logEvent('comment_sort_change', 'course', courseId, {
        page: 'course',
        sort: commentSort,
      });

      renderComments();
    });
  });
}

async function renderComments() {
  const list = $id('commentList');
  list.innerHTML = '<div class="spinner-wrap" style="padding:20px"><div class="spinner"></div></div>';

  document.querySelectorAll('.comment-sort-chips .chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === commentSort);
  });

  try {
    const comments = await fetchComments(courseId, commentSort);
    list.innerHTML = '';

    const total = comments.reduce((s, c) => s + 1 + (c.replies?.length || 0), 0);
    setText('commentTotal', total > 0 ? `${total}개` : '');
    setText('commentCountBadge', course.comment_count || 0);

    const ccLabel2 = document.querySelector('.comment-count-label');
    if (ccLabel2) ccLabel2.textContent = course.comment_count || 0;

    comments.forEach(c => list.appendChild(buildCommentEl(c)));
  } catch (e) {
    console.error(e);
    list.innerHTML = '';
  }

  setupCommentInput();
}

function buildCommentEl(c) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.dataset.id = c.id;

  if (c.is_deleted) {
    item.innerHTML = `<div class="comment-body" style="color:#bbb;font-style:italic">삭제된 댓글입니다.</div>`;
    return item;
  }

  const likeCount = (c.comment_likes || []).length;
  const isLiked = currentUser ? (c.comment_likes || []).some(l => l.user_id === currentUser.id) : false;
  const isOwn = currentUser && currentUser.id === c.author_id;

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

  item.querySelector('.comment-like-btn')?.addEventListener('click', async btn => {
    if (!currentUser) {
      logEvent('login_required_click', 'comment', c.id, {
        page: 'course',
        action: 'comment_like',
      });
      location.href = '/login';
      return;
    }

    const el = btn.currentTarget;
    const nowLiked = el.classList.contains('liked');
    const countEl = el.querySelector('.comment-like-count');

    el.classList.toggle('liked', !nowLiked);
    countEl.textContent = parseInt(countEl.textContent, 10) + (!nowLiked ? 1 : -1);

    try {
      await toggleCommentLike(c.id, currentUser.id);
      logEvent('comment_like', 'comment', c.id, {
        page: 'course',
      });
    } catch {
      el.classList.toggle('liked', nowLiked);
      countEl.textContent = parseInt(countEl.textContent, 10) + (nowLiked ? 1 : -1);
    }
  });

  item.querySelector('.comment-reply-toggle')?.addEventListener('click', () => {
    const wrap = $id(`replyInputWrap-${c.id}`);
    const isHidden = wrap.style.display === 'none';
    wrap.style.display = isHidden ? '' : 'none';

    if (isHidden) {
      wrap.querySelector('.reply-input')?.focus();
      logEvent('reply_input_open', 'comment', c.id, {
        page: 'course',
      });
    }
  });

  const replySubmit = item.querySelector('.reply-submit-btn');
  const replyInput = item.querySelector('.reply-input');

  replySubmit?.addEventListener('click', async () => {
    if (!currentUser) {
      logEvent('login_required_click', 'comment', c.id, {
        page: 'course',
        action: 'reply',
      });
      location.href = '/login';
      return;
    }

    const content = replyInput.value.trim();
    if (!content) return;

    replySubmit.disabled = true;

    try {
      const reply = await addReply({
        commentId: c.id,
        authorId: currentUser.id,
        nickname: currentUser.nickname,
        content,
      });

      const area = $id(`replyArea-${c.id}`);
      area.insertAdjacentHTML('beforeend', buildReplyHtml(reply));
      replyInput.value = '';
      $id(`replyInputWrap-${c.id}`).style.display = 'none';
      bindReplyEvents(area.lastElementChild);

      logEvent('reply_create', 'comment', c.id, {
        page: 'course',
        length: content.length,
      });
    } catch (e) {
      showToast('답글 등록 실패');
    } finally {
      replySubmit.disabled = false;
    }
  });

  const replyMentionBox = createMentionDropdown(replyInput);

  replyInput?.addEventListener('keydown', e => {
    if (replyMentionBox.isOpen() && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      e.preventDefault();
      replyMentionBox.handleKey(e.key);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      replySubmit.click();
    }
  });

  item.querySelector('.comment-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('댓글을 삭제하시겠어요?')) return;

    try {
      await deleteComment(c.id, courseId);
      item.remove();
      logEvent('comment_delete', 'comment', c.id, {
        page: 'course',
      });
    } catch (e) {
      showToast('삭제 실패');
    }
  });

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
// ── @mention 자동완성 ─────────────────────────────────────
function createMentionDropdown(inputEl) {
  let dropdown = null;
  let items = [];
  let selectedIdx = -1;
  let mentionStart = -1;
  let debounceTimer = null;

  function open(list) {
    close();
    if (!list.length) return;
    items = list;
    selectedIdx = -1;

    dropdown = document.createElement('ul');
    dropdown.className = 'mention-dropdown';
    list.forEach((u, i) => {
      const li = document.createElement('li');
      li.className = 'mention-item';
      li.textContent = u.nickname;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        select(i);
      });
      dropdown.appendChild(li);
    });

    inputEl.parentElement.style.position = 'relative';
    inputEl.parentElement.appendChild(dropdown);
  }

  function close() {
    dropdown?.remove();
    dropdown = null;
    items = [];
    selectedIdx = -1;
  }

  function highlight(idx) {
    dropdown?.querySelectorAll('.mention-item').forEach((el, i) => {
      el.classList.toggle('mention-item-active', i === idx);
    });
  }

  function select(idx) {
    if (!items[idx]) return;
    const val = inputEl.value;
    console.log('select called | mentionStart:', mentionStart, '| val:', val, '| cursor:', inputEl.selectionStart);
    // mentionStart(@위치)부터 @ 이후 키워드 끝까지 잘라냄
    const atEnd = val.indexOf(' ', mentionStart) === -1 ? val.length : val.indexOf(' ', mentionStart);
    const before = val.slice(0, mentionStart);
    const after  = val.slice(atEnd);
    inputEl.value = `${before}@${items[idx].nickname}${after}`;
    const newCursor = before.length + 1 + items[idx].nickname.length + 1;
    inputEl.setSelectionRange(newCursor, newCursor);
    close();
    mentionStart = -1;
    inputEl.focus();
  }

  inputEl.addEventListener('input', () => {
    const val = inputEl.value;
    const cursor = inputEl.selectionStart;
    const atIdx = val.lastIndexOf('@', cursor);

    if (atIdx === -1 || (atIdx > 0 && !/\s/.test(val[atIdx - 1]))) {
      close();
      return;
    }

    const keyword = val.slice(atIdx + 1, cursor);
    if (/\s/.test(keyword)) { close(); return; }

    mentionStart = atIdx;
    console.log('mentionStart:', mentionStart, '| char:', val[mentionStart], '| val:', val);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (!currentUser) return;
      const results = await searchUsersForMention(currentUser.id, keyword);
      open(results);
    }, 200);
  });

  document.addEventListener('click', e => {
    if (!dropdown?.contains(e.target) && e.target !== inputEl) close();
  });

  return {
    isOpen: () => !!dropdown,
    handleKey(key) {
      if (!dropdown) return;
      if (key === 'ArrowDown') {
        selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
        highlight(selectedIdx);
      } else if (key === 'ArrowUp') {
        selectedIdx = Math.max(selectedIdx - 1, 0);
        highlight(selectedIdx);
      } else if (key === 'Enter') {
        if (selectedIdx >= 0) select(selectedIdx);
        else close();
      }
    },
  };
}
function bindReplyEvents(el) {
  const rId = el.dataset.id;
  const cId = el.dataset.commentId;

  el.querySelector('.reply-like-btn')?.addEventListener('click', async btn => {
    if (!currentUser) {
      logEvent('login_required_click', 'reply', rId, {
        page: 'course',
        action: 'reply_like',
      });
      location.href = '/login';
      return;
    }

    const b = btn.currentTarget;
    const nowLiked = b.classList.contains('liked');
    const countEl = b.querySelector('.reply-like-count');

    b.classList.toggle('liked', !nowLiked);
    countEl.textContent = parseInt(countEl.textContent, 10) + (!nowLiked ? 1 : -1);

    try {
      await toggleReplyLike(rId, currentUser.id);
      logEvent('reply_like', 'reply', rId, {
        page: 'course',
      });
    } catch {
      b.classList.toggle('liked', nowLiked);
      countEl.textContent = parseInt(countEl.textContent, 10) + (nowLiked ? 1 : -1);
    }
  });

  el.querySelector('.reply-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('답글을 삭제하시겠어요?')) return;

    try {
      await deleteReply(rId, cId);
      el.remove();
      logEvent('reply_delete', 'reply', rId, {
        page: 'course',
      });
    } catch {
      showToast('삭제 실패');
    }
  });
}

let commentInputBound = false;
function setupCommentInput() {
  if (!commentInput || !commentSubmitBtn) return;

  if (!currentUser) {
    commentInput.placeholder = '로그인 후 댓글을 작성할 수 있습니다';
    commentInput.disabled = true;
    commentSubmitBtn.disabled = true;
    return;
  }

  if (commentInputBound) return;
  commentInputBound = true;

  const mentionBox = createMentionDropdown(commentInput);

  commentSubmitBtn.addEventListener('click', submitComment);
  commentInput.addEventListener('keydown', e => {
    if (mentionBox.isOpen() && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      e.preventDefault();
      mentionBox.handleKey(e.key);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComment();
    }
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

    const list = $id('commentList');
    list.prepend(buildCommentEl(comment));

    const badge = $id('commentCountBadge');
    const ccLabel3 = document.querySelector('.comment-count-label');
    badge.textContent = parseInt(badge.textContent || '0', 10) + 1;
    if (ccLabel3) ccLabel3.textContent = badge.textContent;

    logEvent('comment_create', 'course', courseId, {
      page: 'course',
      length: content.length,
    });

    // @멘션 알림
    const mentionedNicknames = [...new Set((content.match(/@([^\s@]+)/g) || []).map(m => m.slice(1)))];
    for (const nick of mentionedNicknames) {
      try {
        const { data: mentionedUser } = await supabase.from('users').select('id').eq('nickname', nick).single();
        if (mentionedUser && mentionedUser.id !== currentUser.id) {
          await supabase.rpc('upsert_notification', {
            p_actor_user_id:  currentUser.id,
            p_actor_nickname: currentUser.nickname,
            p_target_user_id: mentionedUser.id,
            p_type:           'comment_mention',
            p_course_id:      courseId,
            p_course_name:    course.name,
          });
        }
      } catch (_) {}
    }
  } catch (e) {
    showToast('댓글 등록 실패');
  } finally {
    commentSubmitBtn.disabled = false;
  }
}

// ── 공유 ─────────────────────────────────────────────────
function openShareSheet() {
  $id('shareOverlay')?.classList.add('show');
  $id('shareSheet')?.classList.add('open');

  logEvent('share_click', 'course', courseId, {
    page: 'course',
  });
}

function closeShareSheet() {
  $id('shareOverlay')?.classList.remove('show');
  $id('shareSheet')?.classList.remove('open');
}

on('shareOverlay', 'click', closeShareSheet);

on('copyLinkBtn', 'click', () => {
  navigator.clipboard.writeText(location.href)
    .then(() => {
      showToast('링크가 복사되었습니다');
      logEvent('share_copy_link', 'course', courseId, {
        page: 'course',
      });
    })
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
        link: {
          mobileWebUrl: location.href,
          webUrl: location.href,
        },
      },
    });

    logEvent('share_kakao', 'course', courseId, {
      page: 'course',
    });
  } else {
    showToast('카카오 SDK 미초기화');
  }

  closeShareSheet();
});

function upsertMeta(selector, attrName, attrValue, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(selector, rel, href) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function buildSeoDescription(course) {
  const placeCount = Array.isArray(course.course_places) ? course.course_places.length : 0;
  const region = [course.region_main, course.region_sub].filter(Boolean).join(' ');
  const timeText = formatMinutes(course.total_time);
  const base = course.description?.trim();

  if (base) {
    return base.slice(0, 140);
  }

  return [
    course.name,
    region ? `${region} 코스` : '',
    placeCount ? `${placeCount}개 장소` : '',
    timeText ? `총 ${timeText}` : '',
    '데이코스에서 확인해보세요.'
  ].filter(Boolean).join(' · ').slice(0, 155);
}

//코스 제목 노출
function updateSeoTags() {
  const canonicalUrl = `${location.origin}/course?id=${encodeURIComponent(courseId)}`;
  const title = `${course.name} | 데이코스`;
  const description = buildSeoDescription(course);
  const image =
    course.thumbnail_url ||
    (course.course_places || []).find(p => p.photo_url)?.photo_url ||
    '';
    if (image) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
    }

  document.title = title;

  upsertMeta('meta[name="description"]', 'name', 'description', description);
  upsertMeta('meta[name="robots"]', 'name', 'robots', 'index,follow');

  upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  if (image) {
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
  }

  upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  if (image) {
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
  }

  upsertLink('link[rel="canonical"]', 'canonical', canonicalUrl);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": course.name,
    "headline": course.name,
    "description": description,
    "url": canonicalUrl,
    "inLanguage": "ko",
    "isPartOf": {
      "@type": "WebSite",
      "name": "데이코스",
      "url": "https://daycourse.kr/"
    },
    "author": course.author_nickname ? {
      "@type": "Person",
      "name": course.author_nickname
    } : undefined,
    "image": image ? [image] : undefined
  };

  let script = document.getElementById('courseJsonLd');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'courseJsonLd';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonLd);
}

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

    if (!currentUser) {
      logEvent('login_required_click', 'course', courseId, {
        page: 'course',
        action: 'report',
      });
      location.href = '/login';
      return;
    }

    try {
      await submitReport({
        reporterUserId: currentUser.id,
        targetType: 'course',
        targetId: courseId,
        reason,
      });

      showToast('신고가 접수되었습니다');

      logEvent('report_submit', 'course', courseId, {
        page: 'course',
        reason,
      });
    } catch (e) {
      showToast('신고 실패: ' + e.message);
    }
  });
});

// ── ESC 키 전역 처리 ─────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;

  if ($id('photoViewer')?.style.display !== 'none') {
    hide('photoViewer');
    document.body.style.overflow = '';
    return;
  }

  if ($id('shareSheet')?.classList.contains('open')) {
    closeShareSheet();
    return;
  }

  if ($id('reportSheet')?.classList.contains('open')) {
    closeReportSheet();
    return;
  }

  if ($id('deleteModal')?.classList.contains('show')) {
    $id('deleteModal')?.classList.remove('show');
  }
});

// ── 유틸 ─────────────────────────────────────────────────
function haversineDist(a, b) {
  const R = 6371000; // 반환값: 미터 단위
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) *
    Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDist(meters) {
  if (meters == null || !Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h ? h + '시간 ' : ''}${m}분` : `${h}시간`;
}

function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  if (d < 7) return `${d}일 전`;

  return new Date(isoStr).toLocaleDateString('ko-KR');
}

let toastTimer;
function showToast(msg) {
  const el = $id('toast');
  if (!el) return;

  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}