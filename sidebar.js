<<<<<<< HEAD
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
=======
// ── sidebar.js ───────────────────────────────────
// 담당: 전체 페이지 공통 사이드바

export function initSidebar() {
  // 뒤로가기/앞으로가기 시 항상 새로고침
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      window.location.reload();
    }
  });

  const overlay = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menu-btn');
  const closeBtn = document.getElementById('sidebar-close');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  }

>>>>>>> d3dafc5f7ca6945a22744ee97e673c4bede88adb
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }

<<<<<<< HEAD
  // 로그아웃
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.href = 'login.html';
  });
}
=======
  menuBtn.addEventListener('click', openSidebar);
  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  // 로그인 상태에 따라 메뉴 표시
  const userId = localStorage.getItem('userId');
  const nickname = localStorage.getItem('nickname');
  const authMenu = document.getElementById('sidebar-auth');

  if (userId) {
    authMenu.innerHTML = `
      <span class="sidebar-nickname">${nickname || '사용자'}</span>
      <button class="sidebar-logout" id="sidebar-logout-btn">로그아웃</button>
    `;
    document.getElementById('sidebar-logout-btn').addEventListener('click', function () {
      localStorage.clear();
      window.location.href = 'login.html';
    });
  } else {
    authMenu.innerHTML = `
      <div class="sidebar-auth-btns">
        <a href="signup.html" class="sidebar-auth-btn">회원가입</a>
        <a href="login.html" class="sidebar-auth-btn">로그인</a>
      </div>
    `;
  }
}
>>>>>>> d3dafc5f7ca6945a22744ee97e673c4bede88adb
