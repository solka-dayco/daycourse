import { initSidebarIcons } from './icons.js';
// sidebar.js — 공통 사이드바 (v3)
import { supabase } from './supabase.js';

export async function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle  = document.getElementById('sidebarToggle');
  const headerCreateBtn = document.getElementById('headerCreateBtn');

  if (!sidebar) return;

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const currentPath = location.pathname;

  let user = null;
  if (session) {
    const { data: u } = await supabase
      .from('users')
      .select('id, nickname, unread_notification_count, profile_image_url')
      .eq('id', session.user.id)
      .single();
    user = u;
  }

  const unreadCount = user?.unread_notification_count ?? 0;
  const unreadBadge = unreadCount > 0
    ? `<span class="notif-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>`
    : '';
  const profileImgHtml = session
    ? (user?.profile_image_url
        ? `<img src="${escHtml(user.profile_image_url)}" class="header-profile-img" alt="프로필"/>`
        : `<img src="/image/profile_icon.png" class="header-profile-img" alt="프로필"/>`)
    : `<img src="/image/profile_icon.png" class="header-profile-img" alt="프로필"/>`;

  // 헤더 프로필 아이콘 주입 (sidebar.innerHTML 이전에 DOM 직접 조작)
  const headerRight = document.querySelector('.header-right');
  if (headerRight && !document.getElementById('headerProfileBtn')) {
    const profileBtn = document.createElement('button');
    profileBtn.id = 'headerProfileBtn';
    profileBtn.className = 'header-profile-icon';
    profileBtn.setAttribute('aria-label', '프로필');
    profileBtn.style.position = 'relative';
    profileBtn.innerHTML = profileImgHtml + (unreadCount > 0 ? `<span class="header-red-dot"></span>` : '');
    headerRight.insertBefore(profileBtn, headerRight.firstChild);
  }  
  sidebar.innerHTML = `
    <div class="sidebar-inner">
      <div class="sidebar-top">
        <button class="sidebar-close" id="sidebarClose" aria-label="사이드바 닫기"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>

        ${session ? `
          <div class="sidebar-profile">
            <div class="sidebar-avatar" style="position:relative;overflow:hidden">
              ${user?.profile_image_url
                ? `<img src="${escHtml(user.profile_image_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="프로필"/>`
                : `<img src="/image/profile_icon.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="프로필"/>`}
              ${unreadCount > 0 ? `<span class="sidebar-red-dot"></span>` : ''}
            </div>
            <div class="sidebar-nickname">${escHtml(user?.nickname ?? '')}</div>
          </div>
          <div class="sidebar-profile-btns">
            <a href="/profile" class="sidebar-profile-btn">마이페이지</a>
          </div>
        ` : `
          <div class="sidebar-login-prompt">
            <p>로그인하고 코스를 만들어보세요</p>
            <a href="/login" class="sidebar-login-btn">로그인 / 가입</a>
          </div>
        `}
      </div>

      <div class="sidebar-divider"></div>

      <nav class="sidebar-nav">
        <a href="/" class="sidebar-nav-item ${isCurrentPage('home') ? 'active' : ''}">
          <span class="sidebar-nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
          <span>홈</span>
        </a>
        ${session ? `
          <a href="/bookmarks" class="sidebar-nav-item ${isCurrentPage('bookmarks') ? 'active' : ''}">
            <span class="sidebar-nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></span>
            <span>북마크</span>
          </a>
          <a href="/plan" class="sidebar-nav-item ${isCurrentPage('plan') ? 'active' : ''}">
            <span class="sidebar-nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="14" y2="18"/></svg></span>
            <span>코스 계획</span>
          </a>
          <a href="/notifications" class="sidebar-nav-item ${isCurrentPage('notifications') ? 'active' : ''}">
            <span class="sidebar-nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
            <span>알림</span>
            ${unreadBadge}
          </a>
        ` : ''}
      </nav>

      <div class="sidebar-bottom">
        ${session ? `
          <button class="sidebar-logout-btn" id="sidebarLogoutBtn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> 로그아웃</button>
        ` : ''}
      </div>
    </div>
  `;

  // 프로필 아이콘 클릭 — 드롭다운 모달
  const profileBtn = document.getElementById('headerProfileBtn');
  if (profileBtn) {
    // 드롭다운 생성
    const dropdown = document.createElement('div');
    dropdown.id = 'profileDropdown';
    dropdown.innerHTML = `
      <a href="/notifications" class="profile-dropdown-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        알림
        ${unreadCount > 0 ? `<span class="profile-dropdown-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
      </a>
      <a href="/profile" class="profile-dropdown-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        프로필
      </a>
    `;
    document.body.appendChild(dropdown);

    profileBtn.addEventListener('click', e => {
      if (!session) { location.href = '/login'; return; }
      e.stopPropagation();
      const rect = profileBtn.getBoundingClientRect();
      dropdown.style.top  = `${rect.bottom + 6}px`;
      dropdown.style.right = `${window.innerWidth - rect.right}px`;
      dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => dropdown.classList.remove('show'));
  }

  // 헤더 + 버튼
  if (headerCreateBtn) {
    if (session) {
      headerCreateBtn.style.display = '';
      headerCreateBtn.addEventListener('click', () => { location.href = '/create'; });
    } else {
      headerCreateBtn.style.display = 'none';
    }
  }

  // 토글
  function openSidebar() {
    sidebar.classList.add('open');
    overlay?.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay?.classList.remove('show');
    document.body.style.overflow = '';
  }

  toggle?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);
  document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);

  // ESC 키
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

  // 로그아웃
  document.getElementById('sidebarLogoutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.href = '/';
  });
}

// pathname 기반으로 현재 페이지 판별 (.html 없는 새 URL 구조 대응)
function isCurrentPage(name) {
  const path = location.pathname;
  if (name === 'home') return path === '/' || path === '/index.html';
  return path === `/${name}` || path === `/${name}.html`;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escFirstChar(str) {
  const safe = escHtml(str);
  return safe ? safe[0].toUpperCase() : '?';
}