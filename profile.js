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
  document.getElementById('statCourses').textContent   = stats.course_count  ?? 0;
  document.getElementById('statFollowers').textContent = stats.follower_count ?? 0;
  document.getElementById('statFollowing').textContent = stats.following_count ?? 0;
  document.getElementById('viewPublicPage').href       = `/user?id=${user.id}`;
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
  const overlay  = document.getElementById('followPanelOverlay');
  const panel    = document.getElementById('followPanel');
  const titleEl  = document.getElementById('followPanelTitle');
  const listEl   = document.getElementById('followPanelList');
  const closeBtn = document.getElementById('followPanelClose');
  const spinner  = document.getElementById('followPanelSpinner');

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
            <img src="${e(u.profile_image_url || '/image/profile_icon.png')}" alt="${e(u.nickname)}"/>
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

  function renderEditAvatar(url) {
    editAvatar.innerHTML = `<img src="${e(url || '/image/profile_icon.png')}" alt="프로필"/>`;
  }
  renderEditAvatar(user.profile_image_url);

  function openSheet() {
    nickInput.value        = user.nickname || '';
    bioInput.value         = user.bio || '';
    bioCounter.textContent = (user.bio || '').length;
    overlay.classList.add('show');
    sheet.classList.add('open');
  }
  function closeSheet() {
    overlay.classList.remove('show');
    sheet.classList.remove('open');
  }

  openBtn?.addEventListener('click', openSheet);
  closeBtn?.addEventListener('click', closeSheet);
  overlay?.addEventListener('click', ev => { if (ev.target === overlay) closeSheet(); });

  bioInput?.addEventListener('input', () => {
    bioCounter.textContent = bioInput.value.length;
  });

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

  // 사진 변경
  avatarBtn?.addEventListener('click', () => fileInput.click());

  // 사진 삭제
  document.getElementById('editAvatarDeleteBtn')?.addEventListener('click', async () => {
    if (!confirm('프로필 사진을 삭제할까요?')) return;
    try {
      await updateUserProfile(user.id, { profile_image_url: null });
      user.profile_image_url = null;
      const defaultImg = `<img src="/image/profile_icon.png" alt="프로필"/>`;
      document.getElementById('profileAvatar').innerHTML = defaultImg;
      editAvatar.innerHTML = defaultImg;
      const headerBtn = document.getElementById('headerProfileBtn');
      if (headerBtn) headerBtn.innerHTML = `<img src="/image/profile_icon.png" class="header-profile-img" alt="프로필"/>`;
      showToast('프로필 사진이 삭제됐습니다');
    } catch (_) { showToast('삭제 실패'); }
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    openAvatarCropModal(file, user, editAvatar);
    fileInput.value = '';
  });
}

// ── 프로필 사진 크롭 모달 (photo.js 방식) ────────────────
function openAvatarCropModal(file, user, editAvatarEl) {
  const reader = new FileReader();
  reader.onload = ev => _showAvatarCropModal(ev.target.result, user, editAvatarEl);
  reader.readAsDataURL(file);
}

function _showAvatarCropModal(dataUrl, user, editAvatarEl) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.92);
    z-index:9999;display:flex;flex-direction:column;
    align-items:center;justify-content:center;touch-action:none;
  `;

  modal.innerHTML = `
    <div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:12px">
      프로필 사진 설정
    </div>
    <div id="avatarCropViewport" style="
      position:relative;overflow:hidden;
      width:min(80vw,320px);height:min(80vw,320px);
      border-radius:50%;border:2px solid rgba(255,255,255,.6);
      background:#000;cursor:grab;
    ">
      <img id="avatarCropImg" src="${dataUrl}" style="
        position:absolute;user-select:none;-webkit-user-drag:none;max-width:none;
      "/>
      <div style="
        position:absolute;inset:0;border-radius:50%;
        box-shadow:0 0 0 9999px rgba(0,0,0,.5);
        pointer-events:none;
      "></div>
    </div>
    <div style="color:rgba(255,255,255,.6);font-size:12px;margin-top:10px">
      드래그로 이동 · 핀치/휠로 확대/축소
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button id="avatarCropCancel" style="padding:10px 24px;border-radius:8px;border:1.5px solid rgba(255,255,255,.4);background:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">취소</button>
      <button id="avatarCropConfirm" style="padding:10px 24px;border-radius:8px;border:none;background:#fff;color:#1a1a2e;font-size:13px;font-weight:700;cursor:pointer;">완료</button>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const viewport  = modal.querySelector('#avatarCropViewport');
  const img       = modal.querySelector('#avatarCropImg');
  let cropState   = { x: 0, y: 0, scale: 1 };
  let cropDrag    = null;
  let lastTouches = null;

  img.onload = () => {
    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;
    const fit = Math.min(vpW / img.naturalWidth, vpH / img.naturalHeight);
    cropState = {
      scale: fit,
      x: (vpW - img.naturalWidth  * fit) / 2,
      y: (vpH - img.naturalHeight * fit) / 2,
    };
    applyTransform();
  };

  function applyTransform() {
    img.style.left   = `${cropState.x}px`;
    img.style.top    = `${cropState.y}px`;
    img.style.width  = `${img.naturalWidth  * cropState.scale}px`;
    img.style.height = `${img.naturalHeight * cropState.scale}px`;
  }

  // 마우스 드래그
  viewport.addEventListener('mousedown', ev => {
    cropDrag = { startX: ev.clientX - cropState.x, startY: ev.clientY - cropState.y };
    viewport.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', ev => {
    if (!cropDrag) return;
    cropState.x = ev.clientX - cropDrag.startX;
    cropState.y = ev.clientY - cropDrag.startY;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    cropDrag = null;
    viewport.style.cursor = 'grab';
  });

  // 터치 드래그 + 핀치줌
  viewport.addEventListener('touchstart', ev => {
    ev.preventDefault();
    lastTouches = ev.touches;
    if (ev.touches.length === 1) {
      cropDrag = { startX: ev.touches[0].clientX - cropState.x, startY: ev.touches[0].clientY - cropState.y };
    }
  }, { passive: false });

  viewport.addEventListener('touchmove', ev => {
    ev.preventDefault();
    const t = ev.touches;
    if (t.length === 2 && lastTouches?.length === 2) {
      const prevDist = getTouchDist(lastTouches);
      const newDist  = getTouchDist(t);
      const minS = Math.min(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight);
      const newS = Math.max(minS, Math.min(cropState.scale * (newDist / prevDist), minS * 6));
      const cx = (t[0].clientX + t[1].clientX) / 2 - viewport.getBoundingClientRect().left;
      const cy = (t[0].clientY + t[1].clientY) / 2 - viewport.getBoundingClientRect().top;
      cropState.x = cx - (cx - cropState.x) * (newS / cropState.scale);
      cropState.y = cy - (cy - cropState.y) * (newS / cropState.scale);
      cropState.scale = newS;
      applyTransform();
    } else if (t.length === 1 && cropDrag) {
      cropState.x = t[0].clientX - cropDrag.startX;
      cropState.y = t[0].clientY - cropDrag.startY;
      applyTransform();
    }
    lastTouches = t;
  }, { passive: false });

  viewport.addEventListener('touchend', ev => {
    lastTouches = ev.touches.length ? ev.touches : null;
    if (ev.touches.length === 0) cropDrag = null;
  });

  // 휠줌
  viewport.addEventListener('wheel', ev => {
    ev.preventDefault();
    const minS = Math.min(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight);
    const newS = Math.max(minS, Math.min(cropState.scale * (ev.deltaY > 0 ? 0.9 : 1.1), minS * 6));
    const rect = viewport.getBoundingClientRect();
    const cx   = ev.clientX - rect.left;
    const cy   = ev.clientY - rect.top;
    cropState.x = cx - (cx - cropState.x) * (newS / cropState.scale);
    cropState.y = cy - (cy - cropState.y) * (newS / cropState.scale);
    cropState.scale = newS;
    applyTransform();
  }, { passive: false });

  function cleanup() {
    modal.remove();
    document.body.style.overflow = '';
  }

  modal.querySelector('#avatarCropCancel').addEventListener('click', cleanup);

  modal.querySelector('#avatarCropConfirm').addEventListener('click', async () => {
    const confirmBtn = modal.querySelector('#avatarCropConfirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '저장 중…';
    try {
      const blob = await renderAvatarCrop(img, viewport, cropState);
      const imgUrl = await uploadProfileImage(blob, user.id);
      await updateUserProfile(user.id, { profile_image_url: imgUrl });
      user.profile_image_url = imgUrl;

      const imgTag = `<img src="${e(imgUrl)}" alt="프로필"/>`;
      document.getElementById('profileAvatar').innerHTML = imgTag;
      editAvatarEl.innerHTML = imgTag;

      const headerBtn = document.getElementById('headerProfileBtn');
      if (headerBtn) headerBtn.innerHTML = `<img src="${e(imgUrl)}" class="header-profile-img" alt="프로필"/>`;

      const sidebarAvatar = document.querySelector('.sidebar-avatar');
      if (sidebarAvatar) sidebarAvatar.innerHTML = `<img src="${e(imgUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="프로필"/>`;

      cleanup();
      showToast('프로필 사진이 변경됐습니다');
    } catch (_) {
      showToast('업로드 실패');
      confirmBtn.disabled = false;
      confirmBtn.textContent = '완료';
    }
  });
}

function renderAvatarCrop(img, viewport, state) {
  return new Promise((resolve, reject) => {
    const OUTPUT = 300;
    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');

    // 원형 클리핑
    ctx.beginPath();
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
    ctx.clip();

    // 검정 배경
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);

    // 뷰포트 기준으로 이미지 렌더 (여백 포함)
    const clipX = Math.max(0, state.x);
    const clipY = Math.max(0, state.y);
    const clipW = Math.min(vpW, state.x + img.naturalWidth  * state.scale) - clipX;
    const clipH = Math.min(vpH, state.y + img.naturalHeight * state.scale) - clipY;

    if (clipW > 0 && clipH > 0) {
      ctx.drawImage(
        img,
        (clipX - state.x) / state.scale, (clipY - state.y) / state.scale,
        clipW / state.scale, clipH / state.scale,
        (clipX / vpW) * OUTPUT, (clipY / vpH) * OUTPUT,
        (clipW / vpW) * OUTPUT, (clipH / vpH) * OUTPUT
      );
    }

    canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob fail')), 'image/webp', 0.88);
  });
}

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
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