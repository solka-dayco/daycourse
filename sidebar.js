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

  let user = null;
  if (session) {
    const { data: u } = await supabase
      .from('users')
      .select('id, nickname')
      .eq('id', session.user.id)
      .single();
    user = u;
  }

  const unreadCount = 0; // TODO: schema_v3_additions.sql 실행 후 user?.unread_notification_count ?? 0 으로 변경
  const unreadBadge = unreadCount > 0
    ? `<span class="notif-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>`
    : '';

  sidebar.innerHTML = `
    <div class="sidebar-inner">
      <div class="sidebar-top">
        <button class="sidebar-close" id="sidebarClose" aria-label="사이드바 닫기">✕</button>

        ${session ? `
          <div class="sidebar-profile">
            <div class="sidebar-avatar">${escFirstChar(user?.nickname ?? '?')}</div>
            <div class="sidebar-nickname">${escHtml(user?.nickname ?? '')}</div>
          </div>
          <div class="sidebar-profile-btns">
            <a href="profile.html" class="sidebar-profile-btn">마이페이지</a>
          </div>
        ` : `
          <div class="sidebar-login-prompt">
            <p>로그인하고 코스를 만들어보세요</p>
            <a href="login.html" class="sidebar-login-btn">로그인 / 가입</a>
          </div>
        `}
      </div>

      <div class="sidebar-divider"></div>

      <nav class="sidebar-nav">
        <a href="main.html" class="sidebar-nav-item ${isCurrentPage('main') ? 'active' : ''}">
          <span class="sidebar-nav-icon">🏠</span>
          <span>홈</span>
        </a>
        ${session ? `
          <a href="bookmarks.html" class="sidebar-nav-item ${isCurrentPage('bookmarks') ? 'active' : ''}">
            <span class="sidebar-nav-icon">🔖</span>
            <span>북마크</span>
          </a>
          <a href="notifications.html" class="sidebar-nav-item ${isCurrentPage('notifications') ? 'active' : ''}">
            <span class="sidebar-nav-icon">🔔</span>
            <span>알림</span>
            ${unreadBadge}
          </a>
        ` : ''}
      </nav>

      <div class="sidebar-bottom">
        ${session ? `
          <button class="sidebar-logout-btn" id="sidebarLogoutBtn">로그아웃</button>
        ` : ''}
      </div>
    </div>
  `;

  // 헤더 + 버튼
  if (headerCreateBtn) {
    if (session) {
      headerCreateBtn.style.display = '';
      headerCreateBtn.addEventListener('click', () => { location.href = 'create.html'; });
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
    location.href = 'main.html';
  });
}

function isCurrentPage(name) {
  return location.pathname.includes(name + '.html');
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escFirstChar(str) {
  const safe = escHtml(str);
  return safe ? safe[0].toUpperCase() : '?';
}
