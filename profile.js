// profile.js — 마이페이지 v4.2 (R5)
import {
  getCurrentUser, fetchUserStats,
  fetchLikedCourses, fetchBookmarkedCourses, fetchCoursesByUser,
  fetchPlanCourses, logEvent,
  updateUserProfile, uploadProfileImage,
  fetchFollowers, fetchFollowings,
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
const LEVEL_TITLES = ['Walker','Runner','Rider','Traveler','Driver','Cruiser'];

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

// ── 메인 진입 ─────────────────────────────────────────────
(async () => {
  const user = await getCurrentUser();
  if (!user) { location.href = '/login'; return; }
  myUserId = user.id;

  let stats = { course_count: 0, total_likes: 0, total_references: 0, follower_count: 0, following_count: 0 };
  try { stats = await fetchUserStats(user.id); } catch (_) {}

  renderProfile(user, stats);
  setupEditSheet(user);
  setupFollowPanel(user.id);
  setupTabs();

  document.getElementById('spinner').style.display = 'none';
  document.getElementById('profileContent').style.display = '';

  await loadSection('myCourse');
  setupInfiniteScroll();
})();

// ── 프로필 렌더 ───────────────────────────────────────────
function renderProfile(user, stats) {
  const xp    = user.user_xp || 0;
  const lv    = user.level   || calcLevel(xp);
  const title = getLevelTitle(lv);
  const curFloor  = LEVEL_THRESHOLDS[lv - 1];
  const nextFloor = LEVEL_THRESHOLDS[lv];
  const pct = nextFloor === 999999999 ? 100
    : Math.round((xp - curFloor) / (nextFloor - curFloor) * 100);

  // 아바타
  const avatarEl = document.getElementById('profileAvatar');
  avatarEl.innerHTML = `<img src="${e(user.profile_image_url || '/image/profile_icon.png')}" alt="프로필"/>`;

  document.getElementById('profileNickname').textContent = user.nickname;
  document.getElementById('profileLevel').textContent    = `Lv${lv} ${title}`;
  document.getElementById('profileLevel').style.display  = '';

  const xpWrap = document.getElementById('profileXpWrap');
  xpWrap.style.display = '';
  document.getElementById('profileXpFill').style.width   = `${pct}%`;
  document.getElementById('profileXpLabel').textContent  =
    lv === 50 ? `${xp.toLocaleString()} XP` : `${xp.toLocaleString()} / ${nextFloor.toLocaleString()} XP`;

  document.getElementById('profileBio').innerHTML = e(user.bio || '').replace(/\n/g, '<br/>');
  document.getElementById('statCourses').textContent     = stats.course_count  ?? 0;
  document.getElementById('statFollowers').textContent   = stats.follower_count ?? 0;
  document.getElementById('statFollowing').textContent   = stats.following_count ?? 0;
  document.getElementById('viewPublicPage').href         = `/user?id=${user.id}`;
}

// ── 탭 ────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.activity-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.activity-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      switchTab(tab.dataset.tab);
    });
  });
}

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

  document.getElementById(`${key}Spinner`).style.display = '';

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
    const grid   = document.getElementById(gridId);

    if (courses.length === 0 && st.page === 0) {
      document.getElementById(`${key}Empty`).style.display = '';
    } else {
      const frag = document.createDocumentFragment();
      courses.forEach(c => frag.appendChild(key === 'plan' ? buildPlanItem(c) : buildCard(c)));
      grid.appendChild(frag);
    }

    if (courses.length < PAGE_SIZE) st.allLoaded = true;
    else st.page++;
  } catch (err) {
    console.error(`[profile] ${key} 오류:`, err);
  } finally {
    document.getElementById(`${key}Spinner`).style.display = 'none';
    st.loading = false;
  }
}

// ── 카드 / 계획 아이템 ────────────────────────────────────
function buildCard(course) {
  const places = (course.course_places || []).sort((a, b) => a.order_index - b.order_index);
  const thumb  = course.thumbnail_url || places.find(p => p.photo_url)?.photo_url || '';
  const card   = document.createElement('div');
  card.className = 'feed-card';
  card.innerHTML = `
    <div class="feed-thumb">
      ${thumb
        ? `<img src="${e(thumb)}" alt="${e(course.name)}" loading="lazy"/>`
        : `<div class="feed-thumb-placeholder"></div>`}
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

function buildPlanItem(course) {
  const region = [course.region_main, course.region_sub].filter(Boolean).join(' · ');
  const min    = course.total_time || 0;
  const time   = min
    ? (() => { const h = Math.floor(min/60), m = min%60; return m ? `${h?h+'시간 ':''}${m}분` : `${h}시간`; })()
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
    if (el) { el.dataset.key = key; io.observe(el); }
  });
}

// ── 팔로워/팔로잉 패널 ────────────────────────────────────
function setupFollowPanel(userId) {
  const overlay   = document.getElementById('followPanelOverlay');
  const panel     = document.getElementById('followPanel');
  const titleEl   = document.getElementById('followPanelTitle');
  const listEl    = document.getElementById('followPanelList');
  const closeBtn  = document.getElementById('followPanelClose');
  const spinner   = document.getElementById('followPanelSpinner');

  function openPanel(type) {
    titleEl.textContent = type === 'followers' ? '팔로워' : '팔로잉';
    listEl.innerHTML    = '';
    overlay.classList.add('show');
    panel.classList.add('open');
    loadFollowList(type);
  }
  function closePanel() {
    overlay.classList.remove('show');
    panel.classList.remove('open');
  }

  async function loadFollowList(type) {
    spinner.style.display = '';
    try {
      const data = type === 'followers'
        ? await fetchFollowers(userId)
        : await fetchFollowings(userId);

      listEl.innerHTML = '';
      if (!data.length) {
        listEl.innerHTML = `<li style="padding:24px;text-align:center;color:var(--sub);font-size:14px">${type === 'followers' ? '팔로워가' : '팔로잉이'} 없어요</li>`;
        return;
      }
      data.forEach(u => {
        const li = document.createElement('li');
        li.className = 'follow-panel-item';
        li.innerHTML = `
          <div class="follow-panel-avatar">
            ${u.profile_image_url
              ? `<img src="${e(u.profile_image_url)}" alt="${e(u.nickname)}"/>`
              : (u.nickname?.[0]?.toUpperCase() ?? '?')}
          </div>
          <span class="follow-panel-nick">${e(u.nickname)}</span>
        `;
        li.addEventListener('click', () => { location.href = `/user?id=${u.user_id}`; });
        listEl.appendChild(li);
      });
    } catch (_) {}
    finally { spinner.style.display = 'none'; }
  }

  document.getElementById('statFollowersWrap')?.addEventListener('click', () => openPanel('followers'));
  document.getElementById('statFollowingWrap')?.addEventListener('click', () => openPanel('followings'));
  closeBtn?.addEventListener('click', closePanel);
  overlay?.addEventListener('click', closePanel);
}

// ── 프로필 편집 바텀시트 ──────────────────────────────────
function setupEditSheet(user) {
  const overlay    = document.getElementById('editSheetOverlay');
  const sheet      = document.getElementById('editSheet');
  const openBtn    = document.getElementById('profileEditBtn');
  const closeBtn   = document.getElementById('editSheetClose');
  const saveBtn    = document.getElementById('editSaveBtn');
  const nickInput  = document.getElementById('editNicknameInput');
  const bioInput   = document.getElementById('editBioInput');
  const bioCounter = document.getElementById('bioCounter');
  const avatarBtn  = document.getElementById('editAvatarBtn');
  const fileInput  = document.getElementById('profileImageInput');
  const editAvatar = document.getElementById('editAvatar');

  // 편집 아바타 초기 렌더
  function renderEditAvatar(url) {
    if (url) {
      editAvatar.innerHTML = `<img src="${e(url)}" alt="프로필"/>`;
    } else {
      editAvatar.textContent = user.nickname?.[0]?.toUpperCase() ?? '?';
    }
  }
  renderEditAvatar(user.profile_image_url);

  function openSheet() {
    nickInput.value    = user.nickname || '';
    bioInput.value     = user.bio || '';
    bioCounter.textContent = (user.bio || '').length;
    overlay.classList.add('show');
    sheet.classList.add('open');
  }
  function closeSheet() {
    overlay.classList.remove('show');
    sheet.classList.remove('open');
    hideCrop();
  }

  openBtn?.addEventListener('click', openSheet);
  closeBtn?.addEventListener('click', closeSheet);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });

  bioInput?.addEventListener('input', () => {
    bioCounter.textContent = bioInput.value.length;
  });

  // 저장
  saveBtn?.addEventListener('click', async () => {
    const newNick = nickInput.value.trim();
    const newBio  = bioInput.value.trim().slice(0, 80);
    if (!newNick) return showToast('닉네임을 입력해주세요');

    saveBtn.disabled = true;
    try {
      await updateUserProfile(user.id, { nickname: newNick, bio: newBio });
      user.nickname = newNick;
      user.bio      = newBio;
      document.getElementById('profileNickname').textContent = newNick;
      document.getElementById('profileBio').innerHTML = e(newBio).replace(/\n/g, '<br/>');
      closeSheet();
      showToast('저장됐습니다');
    } catch (_) { showToast('저장 실패'); }
    finally { saveBtn.disabled = false; }
  });

  // 사진 변경 버튼
  avatarBtn?.addEventListener('click', () => fileInput.click());
  // 사진 삭제
  document.getElementById('editAvatarDeleteBtn')?.addEventListener('click', async () => {
    if (!confirm('프로필 사진을 삭제할까요?')) return;
    try {
      await updateUserProfile(user.id, { profile_image_url: null });
      user.profile_image_url = null;
      const defaultImg = `<img src="/image/profile_icon.png" alt="프로필"/>`;
      document.getElementById('profileAvatar').innerHTML = defaultImg;
      document.getElementById('editAvatar').innerHTML    = defaultImg;
      const headerBtn = document.getElementById('headerProfileBtn');
      if (headerBtn) headerBtn.innerHTML = `<img src="/image/profile_icon.png" class="header-profile-img" alt="프로필"/>`;
      showToast('프로필 사진이 삭제됐습니다');
    } catch (_) { showToast('삭제 실패'); }
  });
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    startCrop(file, user, editAvatar);
    fileInput.value = '';
  });
}

// ── 인터랙티브 크롭 ───────────────────────────────────────
let cropState = null;

function hideCrop() {
  document.getElementById('cropWrap').style.display    = 'none';
  document.getElementById('editAvatarBtn').style.display = '';
  document.getElementById('editAvatar').style.display  = '';
  cropState = null;
}

function startCrop(file, user, editAvatar) {
  const cropWrap   = document.getElementById('cropWrap');
  const cropArea   = document.getElementById('cropArea');
  const cropImg    = document.getElementById('cropImg');
  const zoomSlider = document.getElementById('cropZoom');
  const cancelBtn  = document.getElementById('cropCancelBtn');
  const confirmBtn = document.getElementById('cropConfirmBtn');

  document.getElementById('editAvatarBtn').style.display = 'none';
  document.getElementById('editAvatar').style.display    = 'none';
  cropWrap.style.display = '';

  const url = URL.createObjectURL(file);
  cropImg.onload = () => {
    const areaSize = cropArea.offsetWidth;
    const scale    = Math.max(areaSize / cropImg.naturalWidth, areaSize / cropImg.naturalHeight);
    cropState = {
      scale, zoom: 1,
      x: (areaSize - cropImg.naturalWidth  * scale) / 2,
      y: (areaSize - cropImg.naturalHeight * scale) / 2,
      dragging: false, lastX: 0, lastY: 0,
      naturalW: cropImg.naturalWidth,
      naturalH: cropImg.naturalHeight,
      areaSize,
      baseScale: scale,
    };
    zoomSlider.value = '1';
    applyTransform();
  };
  cropImg.src = url;

  function applyTransform() {
    if (!cropState) return;
    const s = cropState.baseScale * cropState.zoom;
    cropImg.style.transform = `translate(${cropState.x}px, ${cropState.y}px) scale(${s})`;
    cropImg.style.transformOrigin = '0 0';
    cropImg.style.left = '0';
    cropImg.style.top  = '0';
    cropImg.style.width  = `${cropState.naturalW}px`;
    cropImg.style.height = `${cropState.naturalH}px`;
  }

  function clamp() {
    if (!cropState) return;
    const s    = cropState.baseScale * cropState.zoom;
    const imgW = cropState.naturalW * s;
    const imgH = cropState.naturalH * s;
    const sz   = cropState.areaSize;
    cropState.x = Math.min(0, Math.max(sz - imgW, cropState.x));
    cropState.y = Math.min(0, Math.max(sz - imgH, cropState.y));
  }

  // 드래그 (mouse)
  cropArea.addEventListener('mousedown', e => {
    if (!cropState) return;
    cropState.dragging = true;
    cropState.lastX = e.clientX;
    cropState.lastY = e.clientY;
  });
  window.addEventListener('mousemove', e => {
    if (!cropState?.dragging) return;
    cropState.x += e.clientX - cropState.lastX;
    cropState.y += e.clientY - cropState.lastY;
    cropState.lastX = e.clientX;
    cropState.lastY = e.clientY;
    clamp(); applyTransform();
  });
  window.addEventListener('mouseup', () => { if (cropState) cropState.dragging = false; });

  // 드래그 (touch)
  cropArea.addEventListener('touchstart', e => {
    if (!cropState || e.touches.length !== 1) return;
    cropState.dragging = true;
    cropState.lastX = e.touches[0].clientX;
    cropState.lastY = e.touches[0].clientY;
  }, { passive: true });
  cropArea.addEventListener('touchmove', e => {
    if (!cropState?.dragging || e.touches.length !== 1) return;
    cropState.x += e.touches[0].clientX - cropState.lastX;
    cropState.y += e.touches[0].clientY - cropState.lastY;
    cropState.lastX = e.touches[0].clientX;
    cropState.lastY = e.touches[0].clientY;
    clamp(); applyTransform();
  }, { passive: true });
  cropArea.addEventListener('touchend', () => { if (cropState) cropState.dragging = false; });

  // 줌 슬라이더
  zoomSlider.addEventListener('input', () => {
    if (!cropState) return;
    const prevZoom = cropState.zoom;
    cropState.zoom = parseFloat(zoomSlider.value);
    // 중심 기준 줌
    const sz = cropState.areaSize;
    const ratio = cropState.zoom / prevZoom;
    cropState.x = sz / 2 - ratio * (sz / 2 - cropState.x);
    cropState.y = sz / 2 - ratio * (sz / 2 - cropState.y);
    clamp(); applyTransform();
  });

  cancelBtn.addEventListener('click', () => { URL.revokeObjectURL(url); hideCrop(); });

  confirmBtn.addEventListener('click', async () => {
    if (!cropState) return;
    confirmBtn.disabled = true;
    try {
      const blob = await renderCrop(cropImg, cropState);
      const imgUrl = await uploadProfileImage(blob, user.id);
      await updateUserProfile(user.id, { profile_image_url: imgUrl });
      user.profile_image_url = imgUrl;

      // 프로필 아바타 전체 갱신
      const img = `<img src="${e(imgUrl)}" alt="프로필"/>`;
      document.getElementById('profileAvatar').innerHTML = img;
      document.getElementById('editAvatar').innerHTML    = img;

      // 헤더 프로필 아이콘 갱신
      const headerBtn = document.getElementById('headerProfileBtn');
      if (headerBtn) {
        headerBtn.innerHTML = `<img src="${e(imgUrl)}" class="header-profile-img" alt="프로필"/>`;
      }
      // 사이드바 아바타 갱신
      const sidebarAvatar = document.querySelector('.sidebar-avatar');
      if (sidebarAvatar) {
        sidebarAvatar.innerHTML = `<img src="${e(imgUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="프로필"/>`;
      }

      URL.revokeObjectURL(url);
      hideCrop();
      document.getElementById('editAvatar').style.display = '';
      document.getElementById('editAvatarBtn').style.display = '';
      showToast('프로필 사진이 변경됐습니다');
    } catch (_) { showToast('업로드 실패'); }
    finally { confirmBtn.disabled = false; }
  });
}

function renderCrop(img, cs) {
  return new Promise((resolve, reject) => {
    const OUTPUT = 300;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');

    const s    = cs.baseScale * cs.zoom;
    const sz   = cs.areaSize;
    // 원형 마스크 영역 (areaSize의 80%)
    const maskR = sz * 0.8 / 2;
    const maskX = sz / 2 - maskR;
    const maskY = sz / 2 - maskR;

    // 원형 클리핑
    ctx.beginPath();
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
    ctx.clip();

    // 이미지 좌표 → 캔버스 좌표 변환
    const srcX = (maskX - cs.x) / s;
    const srcY = (maskY - cs.y) / s;
    const srcW = (maskR * 2) / s;

    ctx.drawImage(img, srcX, srcY, srcW, srcW, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob fail')), 'image/webp', 0.88);
  });
}

// ── 유틸 ─────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function e(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}