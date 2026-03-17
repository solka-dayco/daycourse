// user.js — 유저 페이지 (v3)
import { fetchUserById, fetchUserStats, fetchCoursesByUser, logEvent, getCurrentUser } from './db.js';
import { initSidebar } from './sidebar.js';
import { initIcons, initSidebarIcons } from './icons.js';

initSidebar();
initIcons();
initSidebarIcons();

const params = new URLSearchParams(location.search);
const userId = params.get('id');

const spinner    = document.getElementById('spinner');
const userContent = document.getElementById('userContent');
const userError  = document.getElementById('userError');

const LEVEL_NAMES = ['탐험가', '코스 메이커', '로컬 가이드', '트렌드 세터', '마스터 플래너'];

const PAGE_SIZE = 20;
let courseState = { page: 0, loading: false, allLoaded: false };
let refState    = { page: 0, loading: false, allLoaded: false };
let activeTab   = 'courses';
let userId_ = null;

(async () => {
  if (!userId) { showError(); return; }
  userId_ = userId;

  try {
    const [user, stats] = await Promise.all([
      fetchUserById(userId),
      fetchUserStats(userId),
    ]);

    if (!user) { showError(); return; }

    document.title = `${user.nickname} — 데이코스`;
    document.getElementById('headerTitle').textContent = user.nickname;
    document.getElementById('userAvatar').textContent = user.nickname[0]?.toUpperCase() ?? '?';
    document.getElementById('userNickname').textContent = user.nickname;

    // const levelIdx = Math.min((user.level || 1) - 1, LEVEL_NAMES.length - 1);
    // document.getElementById('userLevel').textContent = `Lv${user.level || 1} ${LEVEL_NAMES[levelIdx]}`;
    document.getElementById('userLevel').style.display = 'none';

    document.getElementById('statCourses').textContent = stats.course_count;
    document.getElementById('statLikes').textContent   = stats.total_likes;
    document.getElementById('statRefs').textContent    = stats.total_references;

    spinner.style.display = 'none';
    userContent.style.display = '';

    logEvent('page_view', 'user', userId, { page: 'user_profile' });

    // 첫 탭 로드
    loadCourses();
    setupInfiniteScroll();
    setupTabs();

  } catch (e) {
    console.error(e);
    showError();
  }
})();

function showError() {
  spinner.style.display = 'none';
  userError.style.display = '';
}

// ── 탭 ────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      switchTab(activeTab);
    });
  });
}

function switchTab(tab) {
  const courseGrid = document.getElementById('userCourseGrid');
  const refGrid    = document.getElementById('userRefGrid');
  const courseEmpty = document.getElementById('courseEmpty');
  const refEmpty   = document.getElementById('refEmpty');

  if (tab === 'courses') {
    courseGrid.style.display = '';
    courseEmpty.style.display = courseGrid.children.length === 0 && courseState.allLoaded ? '' : 'none';
    refGrid.style.display = 'none';
    refEmpty.style.display = 'none';
    if (courseGrid.children.length === 0) loadCourses();
  } else {
    courseGrid.style.display = 'none';
    courseEmpty.style.display = 'none';
    refGrid.style.display = '';
    refEmpty.style.display = refGrid.children.length === 0 && refState.allLoaded ? '' : 'none';
    if (refGrid.children.length === 0) loadRefs();
  }
}

// ── 코스 로드 ──────────────────────────────────────────────
async function loadCourses() {
  if (courseState.loading || courseState.allLoaded) return;
  courseState.loading = true;
  const sp = document.getElementById('courseSpinner');
  sp.style.display = '';

  try {
    const { courses } = await fetchCoursesByUser(userId_, {
      page: courseState.page,
      pageSize: PAGE_SIZE,
      onlyReferenced: false,
    });

    const grid = document.getElementById('userCourseGrid');
    const frag = document.createDocumentFragment();
    courses.forEach(c => frag.appendChild(buildCard(c)));
    grid.appendChild(frag);

    if (courses.length < PAGE_SIZE) {
      courseState.allLoaded = true;
      if (grid.children.length === 0) {
        document.getElementById('courseEmpty').style.display = '';
      }
    } else {
      courseState.page++;
    }
  } catch (e) { console.error(e); }
  finally {
    sp.style.display = 'none';
    courseState.loading = false;
  }
}

async function loadRefs() {
  if (refState.loading || refState.allLoaded) return;
  refState.loading = true;
  const sp = document.getElementById('refSpinner');
  sp.style.display = '';

  try {
    const { courses } = await fetchCoursesByUser(userId_, {
      page: refState.page,
      pageSize: PAGE_SIZE,
      onlyReferenced: true,
    });

    const grid = document.getElementById('userRefGrid');
    const frag = document.createDocumentFragment();
    courses.forEach(c => frag.appendChild(buildCard(c)));
    grid.appendChild(frag);

    if (courses.length < PAGE_SIZE) {
      refState.allLoaded = true;
      if (grid.children.length === 0) {
        document.getElementById('refEmpty').style.display = '';
      }
    } else {
      refState.page++;
    }
  } catch (e) { console.error(e); }
  finally {
    sp.style.display = 'none';
    refState.loading = false;
  }
}

// ── 카드 빌드 ─────────────────────────────────────────────
function buildCard(course) {
  const places = (course.course_places || []).sort((a, b) => a.order_index - b.order_index);
  const thumb = course.thumbnail_url || places.find(p => p.photo_url)?.photo_url || '';
  const pathText = places.map(p => p.name).join(' → ');
  const timeText = formatMinutes(course.total_time);

  const card = document.createElement('div');
  card.className = 'feed-card';
  card.innerHTML = `
    <div class="feed-thumb">
      ${thumb
        ? `<img src="${escHtml(thumb)}" alt="${escHtml(course.name)}" loading="lazy"/>`
        : `<div class="feed-thumb-placeholder">🗺️</div>`
      }
      ${course.region_main
        ? `<span class="feed-region-badge">${escHtml(course.region_main)}</span>`
        : ''
      }
    </div>
    <div class="feed-body">
      <div class="feed-course-name">${escHtml(course.name)}</div>
      <div class="feed-places-path">${escHtml(pathText)}</div>
      <div class="feed-meta">
        <span class="feed-author">${escHtml(course.author_nickname)}</span>
        <div class="feed-actions">
          ${timeText ? `<span class="feed-time-badge">⏱ ${timeText}</span>` : ''}
          <span class="feed-like-btn">
            <span class="heart">♥</span>
            <span>${course.like_count || 0}</span>
          </span>
          <span class="feed-comment-btn">
            💬 <span>${course.comment_count || 0}</span>
          </span>
        </div>
      </div>
    </div>
  `;
  card.addEventListener('click', () => { location.href = `course.html?id=${course.id}`; });
  return card;
}

// ── 무한 스크롤 ───────────────────────────────────────────
function setupInfiniteScroll() {
  const io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    if (activeTab === 'courses') loadCourses();
    else loadRefs();
  }, { rootMargin: '200px' });

  // 두 센티넬 모두 관찰 (탭에 따라 로드 분기)
  io.observe(document.getElementById('courseSentinel'));
  io.observe(document.getElementById('refSentinel'));
}

// ── 유틸 ─────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h ? h+'시간 ' : ''}${m}분` : `${h}시간`;
}