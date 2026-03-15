// sidebar.js — 공통 사이드바
import { supabase } from './supabase.js';

export async function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle  = document.getElementById('sidebarToggle');

  if (!sidebar) return;

  const { data } = await supabase.auth.getSession();
  const session = data.session;

  let userNickname = '';
  if (session) {
    const { data: user } = await supabase
      .from('users')
      .select('nickname')
      .eq('id', session.user.id)
      .single();
    userNickname = user?.nickname ?? '';
  }

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-logo">데이코스</span>
      <button class="sidebar-close" id="sidebarClose">✕</button>
    </div>
    <ul class="sidebar-menu">
      <li><a href="main.html">🏠 피드</a></li>
      ${session ? `<li><a href="create.html">✏️ 새 게시물</a></li>` : ''}
    </ul>
    <div class="sidebar-bottom">
      ${session
        ? `<span class="sidebar-user">👤 ${userNickname}</span>
           <button class="sidebar-logout" id="logoutBtn">로그아웃</button>`
        : `<a href="login.html" class="sidebar-login-btn">로그인 / 가입</a>`
      }
    </div>
  `;

  // 토글
  toggle?.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  });
  overlay?.addEventListener('click', closeSidebar);
  document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }

  // 로그아웃
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.href = 'login.html';
  });
}
