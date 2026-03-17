// bookmarks.js — 북마크 페이지 (v3)
import { getCurrentUser, fetchBookmarkedCourses, toggleBookmark, isCourseLiked, toggleCourseLike, logEvent } from './db.js';
import { initSidebar } from './sidebar.js';
import { initIcons, initSidebarIcons } from './icons.js';

initSidebar();
initIcons();
initSidebarIcons();
logEvent('page_view', 'page', null, { page: 'bookmarks' });

const PAGE_SIZE = 20;
let page = 0, loading = false, allLoaded = false;
let currentUser = null;

const grid   = document.getElementById('bookmarkGrid');
const spinner = document.getElementById('spinner');
const empty  = document.getElementById('bookmarkEmpty');

(async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) { location.href = 'login.html'; return; }

  await loadBookmarks();
  setupInfiniteScroll();
})();

async function loadBookmarks() {
  if (loading || allLoaded) return;
  loading = true;
  if (page === 0) spinner.style.display = '';

  try {
    const courses = await fetchBookmarkedCourses(currentUser.id, { page, pageSize: PAGE_SIZE });

    spinner.style.display = 'none';

    if (courses.length === 0 && page === 0) {
      empty.style.display = '';
      return;
    }

    const frag = document.createDocumentFragment();
    for (const course of courses) {
      frag.appendChild(buildCard(course));
    }
    grid.appendChild(frag);

    if (courses.length < PAGE_SIZE) allLoaded = true;
    else page++;
  } catch (e) {
    console.error(e);
    spinner.style.display = 'none';
  } finally {
    loading = false;
  }
}

function buildCard(course) {
  const places = (course.course_places || []).sort((a, b) => a.order_index - b.order_index);
  const thumb  = course.thumbnail_url || places.find(p => p.photo_url)?.photo_url || '';
  const path   = places.map(p => p.name).join(' → ');
  const time   = formatMinutes(course.total_time);

  const card = document.createElement('div');
  card.className = 'feed-card';
  card.innerHTML = `
    <div class="feed-thumb">
      ${thumb
        ? `<img src="${escHtml(thumb)}" alt="${escHtml(course.name)}" loading="lazy"/>`
        : `<div class="feed-thumb-placeholder">🗺️</div>`
      }
      ${course.region_main
        ? `<span class="feed-region-badge">${escHtml(course.region_main)}${course.region_sub ? ' · ' + course.region_sub : ''}</span>`
        : ''
      }
    </div>
    <div class="feed-body">
      <div class="feed-course-name">${escHtml(course.name)}</div>
      <div class="feed-places-path">${escHtml(path)}</div>
      <div class="feed-meta">
        <span class="feed-author"
          style="cursor:pointer"
          data-user-id="${escHtml(course.author_id)}"
        >${escHtml(course.author_nickname)}</span>
        <div class="feed-actions">
          ${time ? `<span class="feed-time-badge">⏱ ${time}</span>` : ''}
          <button class="feed-like-btn" data-id="${course.id}" aria-label="좋아요">
            <span class="heart">♥</span>
            <span class="like-count">${course.like_count || 0}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // 카드 클릭
  card.addEventListener('click', e => {
    if (e.target.closest('.feed-like-btn') || e.target.closest('.feed-author')) return;
    location.href = `course.html?id=${course.id}`;
  });

  // 작성자 클릭
  card.querySelector('.feed-author')?.addEventListener('click', e => {
    e.stopPropagation();
    const uid = e.currentTarget.dataset.userId;
    if (uid) location.href = `user.html?id=${uid}`;
  });

  // 좋아요
  const likeBtn = card.querySelector('.feed-like-btn');
  // 초기 좋아요 상태 비동기 세팅
  (async () => {
    const liked = await isCourseLiked(course.id, currentUser.id);
    if (liked) likeBtn.classList.add('liked');
  })();

  likeBtn.addEventListener('click', async e => {
    e.stopPropagation();
    const nowLiked = likeBtn.classList.contains('liked');
    const countEl  = likeBtn.querySelector('.like-count');
    likeBtn.classList.toggle('liked', !nowLiked);
    countEl.textContent = parseInt(countEl.textContent) + (!nowLiked ? 1 : -1);
    try {
      await toggleCourseLike(course.id, currentUser.id);
    } catch {
      likeBtn.classList.toggle('liked', nowLiked);
      countEl.textContent = parseInt(countEl.textContent) + (nowLiked ? 1 : -1);
    }
  });

  return card;
}

function setupInfiniteScroll() {
  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadBookmarks();
  }, { rootMargin: '200px' });
  io.observe(document.getElementById('sentinel'));
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
