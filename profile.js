// profile.js — 마이페이지 (내 정보 + 활동 탭 통합)
import {
  getCurrentUser, fetchUserStats,
  fetchLikedCourses, fetchBookmarkedCourses, fetchCoursesByUser,
  logEvent,
} from './db.js';
import { initSidebar } from './sidebar.js';

initSidebar();
logEvent('page_view', 'page', null, { page: 'profile' });

const PAGE_SIZE = 18;
let myUserId = null;
let activeTab = 'myCourse';

const LEVEL_NAMES = ['탐험가', '코스 메이커', '로컬 가이드', '트렌드 세터', '마스터 플래너'];

const sectionState = {
  liked:    { page: 0, loading: false, allLoaded: false, loaded: false },
  bookmark: { page: 0, loading: false, allLoaded: false, loaded: false },
  myCourse: { page: 0, loading: false, allLoaded: false, loaded: false },
};

(async () => {
  const user = await getCurrentUser();
  if (!user) { location.href = 'login.html'; return; }
  myUserId = user.id;

  // 통계 (실패해도 계속 진행)
  let stats = { course_count: 0, total_likes: 0, total_references: 0 };
  try { stats = await fetchUserStats(user.id); } catch (_) {}

  // 내 정보 렌더
  document.getElementById('profileAvatar').textContent   = user.nickname?.[0]?.toUpperCase() ?? '?';
  document.getElementById('profileNickname').textContent = user.nickname;
  const lvIdx = Math.min((user.level || 1) - 1, LEVEL_NAMES.length - 1);
  document.getElementById('profileLevel').textContent    = `Lv${user.level || 1} ${LEVEL_NAMES[lvIdx]}`;
  document.getElementById('statCourses').textContent     = stats.course_count ?? 0;
  document.getElementById('statLikes').textContent       = stats.total_likes ?? 0;
  document.getElementById('statRefs').textContent        = stats.total_references ?? 0;
  document.getElementById('viewPublicPage').href         = `user.html?id=${user.id}`;

  document.getElementById('spinner').style.display = 'none';
  document.getElementById('profileContent').style.display = '';

  // 탭 이벤트
  document.querySelectorAll('.activity-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.activity-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      switchTab(tab.dataset.tab);
    });
  });

  // 첫 탭 로드 — profileContent 표시 후 실행
  await loadSection('myCourse');
  setupInfiniteScroll();
})();

// ── 탭 전환 ───────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  ['liked', 'bookmark', 'myCourse'].forEach(key => {
    document.getElementById(`panel-${key}`).style.display = key === tab ? '' : 'none';
  });
  if (!sectionState[tab].loaded) loadSection(tab);
}

// ── 섹션 로더 ─────────────────────────────────────────────
async function loadSection(key) {
  const st = sectionState[key];
  if (st.loading || st.allLoaded) return;
  st.loading = true;
  st.loaded  = true;

  const spId   = `${key}Spinner`;
  const gridId = `${key}Grid`;
  const empId  = `${key}Empty`;

  document.getElementById(spId).style.display = '';

  try {
    let courses = [];
    if (key === 'liked') {
      courses = await fetchLikedCourses(myUserId, { page: st.page, pageSize: PAGE_SIZE });
    } else if (key === 'bookmark') {
      courses = await fetchBookmarkedCourses(myUserId, { page: st.page, pageSize: PAGE_SIZE });
    } else {
      const res = await fetchCoursesByUser(myUserId, { page: st.page, pageSize: PAGE_SIZE });
      courses = res.courses;
    }

    const grid = document.getElementById(gridId);
    if (courses.length === 0 && st.page === 0) {
      document.getElementById(empId).style.display = '';
    } else {
      const frag = document.createDocumentFragment();
      courses.forEach(c => frag.appendChild(buildCard(c)));
      grid.appendChild(frag);
    }

    if (courses.length < PAGE_SIZE) st.allLoaded = true;
    else st.page++;
  } catch (e) {
    console.error(`[profile] ${key} 오류:`, e);
  } finally {
    document.getElementById(spId).style.display = 'none';
    st.loading = false;
  }
}

// ── 카드 빌드 ─────────────────────────────────────────────
function buildCard(course) {
  const places = (course.course_places || []).sort((a, b) => a.order_index - b.order_index);
  const thumb  = course.thumbnail_url || places.find(p => p.photo_url)?.photo_url || '';
  const card   = document.createElement('div');
  card.className = 'feed-card';
  card.innerHTML = `
    <div class="feed-thumb">
      ${thumb
        ? `<img src="${e(thumb)}" alt="${e(course.name)}" loading="lazy"/>`
        : `<div class="feed-thumb-placeholder">🗺️</div>`
      }
      ${course.region_main ? `<span class="feed-region-badge">${e(course.region_main)}</span>` : ''}
    </div>
    <div class="feed-body">
      <div class="feed-course-name">${e(course.name)}</div>
      <div class="feed-meta">
        <span class="feed-author">${e(course.author_nickname)}</span>
        <span class="feed-like-btn"><span class="heart">♥</span> ${course.like_count || 0}</span>
      </div>
    </div>
  `;
  card.addEventListener('click', () => { location.href = `course.html?id=${course.id}`; });
  return card;
}

// ── 무한 스크롤 ───────────────────────────────────────────
function setupInfiniteScroll() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const key = entry.target.dataset.key;
      if (key === activeTab) loadSection(key);
    });
  }, { rootMargin: '200px' });

  ['liked', 'bookmark', 'myCourse'].forEach(key => {
    const el = document.getElementById(`${key}Sentinel`);
    el.dataset.key = key;
    io.observe(el);
  });
}

function e(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}