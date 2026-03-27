// user.js — 유저 페이지 (v3)
import { fetchUserById, fetchUserStats, fetchCoursesByUser, logEvent, getCurrentUser, isFollowing, followUser, unfollowUser } from './db.js';
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

const LEVEL_THRESHOLDS = [0,1000,2000,3000,4000,5000,6250,7500,8750,10000,
  13500,17000,20500,24000,27500,31250,35000,38750,42500,46250,
  51250,56250,61250,66250,71250,77500,83750,90000,96250,102500,
  113000,123500,134000,144500,155000,167000,179000,191000,203000,215000,
  239000,263000,287000,311000,335000,361000,387000,413000,439000,465000,
  999999999];
const LEVEL_TITLES = ['Walker', 'Runner', 'Rider', 'Traveler', 'Driver', 'Cruiser'];

function getLevelTitle(lv) {
  if (lv === 50) return 'Cruiser';
  return LEVEL_TITLES[Math.floor((lv - 1) / 10)];
}

function calcLevel(xp) {
  for (let i = 0; i < 50; i++) {
    if (xp < LEVEL_THRESHOLDS[i + 1]) return i + 1;
  }
  return 50;
}

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

    const avatarEl = document.getElementById('userAvatar');
    avatarEl.innerHTML = `<img src="${escHtml(user.profile_image_url || '/image/profile_icon.png')}" alt="${escHtml(user.nickname)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;

    document.getElementById('userNickname').textContent = user.nickname;
    document.getElementById('userBio').innerHTML = escHtml(user.bio || '').replace(/\n/g, '<br/>');

    const lv = user.level || calcLevel(user.user_xp || 0);
    document.getElementById('userLevel').textContent = `Lv${lv} ${getLevelTitle(lv)}`;
    document.getElementById('userLevel').style.display = '';

    document.getElementById('statCourses').textContent   = stats.course_count   ?? 0;
    document.getElementById('statFollowers').textContent = stats.follower_count  ?? 0;
    document.getElementById('statFollowing').textContent = stats.following_count ?? 0;

    // 팔로우 버튼
    const me = await getCurrentUser();
    if (me && me.id !== userId) {
      const followBtn = document.getElementById('followBtn');
      let following = await isFollowing(me.id, userId);

      function renderFollowBtn() {
        followBtn.textContent = following ? '팔로잉' : '팔로우';
        followBtn.className   = following ? 'follow-btn follow-btn-active' : 'follow-btn';
        followBtn.style.display = '';
      }
      renderFollowBtn();

      followBtn.addEventListener('click', async () => {
        followBtn.disabled = true;
        try {
          if (following) { await unfollowUser(me.id, userId); following = false; }
          else           { await followUser(me.id, userId);   following = true;  }
          renderFollowBtn();
        } catch (_) {}
        followBtn.disabled = false;
      });
    }

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
  card.addEventListener('click', () => { location.href = `/course?id=${course.id}`; });
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