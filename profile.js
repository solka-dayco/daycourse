// profile.js — 마이페이지 (내 정보 + 활동 탭 통합)
import {
  getCurrentUser, fetchUserStats,
  fetchLikedCourses, fetchBookmarkedCourses, fetchCoursesByUser,
  fetchPlanCourses,
  logEvent,
  updateUserProfile, uploadProfileImage,
} from './db.js';
import { initSidebar } from './sidebar.js';
import { initIcons, initSidebarIcons } from './icons.js';

initSidebar();
initIcons();
initSidebarIcons();
logEvent('page_view', 'page', null, { page: 'profile' });

const PAGE_SIZE = 18;
let myUserId = null;
let activeTab = 'myCourse';

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

const sectionState = {
  liked:    { page: 0, loading: false, allLoaded: false, loaded: false },
  bookmark: { page: 0, loading: false, allLoaded: false, loaded: false },
  myCourse: { page: 0, loading: false, allLoaded: false, loaded: false },
  plan:     { page: 0, loading: false, allLoaded: false, loaded: false },
};

(async () => {
  const user = await getCurrentUser();
  if (!user) { location.href = '/login'; return; }
  myUserId = user.id;

  // 통계 (실패해도 계속 진행)
  let stats = { course_count: 0, total_likes: 0, total_references: 0 };
  try { stats = await fetchUserStats(user.id); } catch (_) {}

  // 내 정보 렌더
  document.getElementById('profileAvatar').textContent   = user.nickname?.[0]?.toUpperCase() ?? '?';
  document.getElementById('profileNickname').textContent = user.nickname;
  const xp  = user.user_xp || 0;
  const lv  = user.level || calcLevel(xp);
  const title = getLevelTitle(lv);
  const curFloor = LEVEL_THRESHOLDS[lv - 1];
  const nextFloor = LEVEL_THRESHOLDS[lv];
  const pct = nextFloor === 999999999 ? 100
    : Math.round((xp - curFloor) / (nextFloor - curFloor) * 100);

  document.getElementById('profileLevel').textContent = `Lv${lv} ${title}`;
  document.getElementById('profileLevel').style.display = '';
  document.getElementById('profileXpWrap').style.display = '';
  document.getElementById('profileXpFill').style.width = `${pct}%`;

  /* 필요경험치 차감 방식 : 밑에 2줄 대신에 주석 코드로 교체
  const xpInLevel = xp - curFloor;
  const xpNeeded = nextFloor - curFloor;
  document.getElementById('profileXpLabel').textContent =
    lv === 50 ? `MAX` : `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`; 
  */
  document.getElementById('profileXpLabel').textContent =
    lv === 50 ? `${xp.toLocaleString()} XP` : `${xp.toLocaleString()} / ${nextFloor.toLocaleString()} XP`;


  document.getElementById('statCourses').textContent     = stats.course_count ?? 0;
  document.getElementById('statFollowers').textContent   = stats.follower_count ?? 0;
  document.getElementById('statFollowing').textContent   = stats.following_count ?? 0;
  document.getElementById('viewPublicPage').href         = `/user?id=${user.id}`;

  // 소개글
  const bioEl = document.getElementById('profileBio');
  bioEl.textContent = user.bio || '소개글을 입력해주세요';
  bioEl.addEventListener('click', () => {
    const cur = user.bio || '';
    const input = prompt('소개글 수정 (최대 80자)', cur);
    if (input === null) return;
    const trimmed = input.trim().slice(0, 80);
    updateUserProfile(user.id, { bio: trimmed }).then(() => {
      user.bio = trimmed;
      bioEl.textContent = trimmed || '소개글을 입력해주세요';
    }).catch(() => showToast('저장 실패'));
  });

  // 닉네임 수정
  const nicknameEl    = document.getElementById('profileNickname');
  const nicknameInput = document.getElementById('nicknameInput');
  const nicknameEditBtn = document.getElementById('nicknameEditBtn');

  nicknameEditBtn.addEventListener('click', () => {
    nicknameEl.style.display    = 'none';
    nicknameEditBtn.style.display = 'none';
    nicknameInput.value         = user.nickname;
    nicknameInput.style.display = '';
    nicknameInput.focus();
  });

  async function saveNickname() {
    const val = nicknameInput.value.trim();
    if (!val || val === user.nickname) {
      nicknameInput.style.display   = 'none';
      nicknameEl.style.display      = '';
      nicknameEditBtn.style.display = '';
      return;
    }
    try {
      await updateUserProfile(user.id, { nickname: val });
      user.nickname = val;
      nicknameEl.textContent        = val;
    } catch (_) { showToast('저장 실패'); }
    nicknameInput.style.display   = 'none';
    nicknameEl.style.display      = '';
    nicknameEditBtn.style.display = '';
  }

  nicknameInput.addEventListener('blur', saveNickname);
  nicknameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nicknameInput.blur(); });

  // 프로필 이미지 업로드
  const avatarEl    = document.getElementById('profileAvatar');
  const imageInput  = document.getElementById('profileImageInput');

  if (user.profile_image_url) {
    avatarEl.innerHTML = `<img src="${e(user.profile_image_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  }

  avatarEl.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', async () => {
    const file = imageInput.files[0];
    if (!file) return;
    try {
      const blob = await centerCropToBlob(file);
      const url  = await uploadProfileImage(blob, user.id);
      await updateUserProfile(user.id, { profile_image_url: url });
      avatarEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    } catch (_) { showToast('이미지 업로드 실패'); }
  });

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
  ['liked', 'bookmark', 'myCourse', 'plan'].forEach(key => {
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

  const spId  = `${key}Spinner`;
  const empId = `${key}Empty`;

  document.getElementById(spId).style.display = '';

  try {
    let courses = [];
    if (key === 'liked') {
      courses = await fetchLikedCourses(myUserId, { page: st.page, pageSize: PAGE_SIZE });
    } else if (key === 'bookmark') {
      courses = await fetchBookmarkedCourses(myUserId, { page: st.page, pageSize: PAGE_SIZE });
    } else if (key === 'plan') {
      const res = await fetchPlanCourses(myUserId, { page: st.page, pageSize: PAGE_SIZE });
      courses = res.courses;
    } else {
      const res = await fetchCoursesByUser(myUserId, { page: st.page, pageSize: PAGE_SIZE });
      courses = res.courses;
    }

    const gridId = key === 'plan' ? 'planListProfile' : `${key}Grid`;
    const grid = document.getElementById(gridId);
    if (courses.length === 0 && st.page === 0) {
      document.getElementById(empId).style.display = '';
    } else {
      const frag = document.createDocumentFragment();
      courses.forEach(c => frag.appendChild(
        key === 'plan' ? buildPlanItem(c) : buildCard(c)
      ));
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
  card.addEventListener('click', () => { location.href = `/course?id=${course.id}`; });
  return card;
}

// ── 계획 코스 리스트 아이템 ───────────────────────────────
function buildPlanItem(course) {
  const region = [course.region_main, course.region_sub].filter(Boolean).join(' · ');
  const time   = course.total_time
    ? (() => { const h = Math.floor(course.total_time/60); const m = course.total_time%60; return m ? `${h?`${h}시간 `:''}${m}분` : `${h}시간`; })()
    : '';

  const li = document.createElement('li');
  li.className = 'plan-list-item';
  li.innerHTML = `
    <div class="plan-item-title">${e(course.name || '(이름 없음)')}</div>
    ${course.description ? `<div class="plan-item-desc">${e(course.description)}</div>` : ''}
    <div class="plan-item-meta">
      ${region ? `<span>${e(region)}</span>` : ''}
      ${region && time ? `<span class="plan-item-meta-dot">·</span>` : ''}
      ${time ? `<span>예상 ${time}</span>` : ''}
    </div>
  `;
  li.addEventListener('click', () => { location.href = `/create?mode=edit&id=${course.id}`; });
  return li;
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

  ['liked', 'bookmark', 'myCourse', 'plan'].forEach(key => {
    const el = document.getElementById(`${key}Sentinel`);
    el.dataset.key = key;
    io.observe(el);
  });
}
// 정사각형 중앙 크롭 → WebP blob
async function centerCropToBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const sx = (img.width  - size) / 2;
      const sy = (img.height - size) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 300;
      canvas.getContext('2d').drawImage(img, sx, sy, size, size, 0, 0, 300, 300);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob fail')), 'image/webp', 0.85);
    };
    img.onerror = reject;
    img.src = url;
  });
}
function e(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}