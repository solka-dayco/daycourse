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

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }

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