// admin.js — 어드민 메인 컨트롤러
import { supabase } from '../supabase.js';
import { initAdminIcons } from '../icons.js';
import { loadDashboard }  from './dashboard.js';
import { loadReports }    from './reports.js';
import { loadCourses }    from './courses.js';
import { loadComments }   from './comments.js';
import { loadUsers }      from './users.js';
import { loadLogs }       from './logs.js';

// ── Admin 가드 ────────────────────────────────────────
export async function assertAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = '../login.html'; return false; }

  const { data: user } = await supabase
    .from('users').select('role').eq('id', session.user.id).single();

  if (!user || user.role !== 'admin') {
    location.href = '../main.html';
    return false;
  }
  return true;
}

// ── 토스트 ────────────────────────────────────────────
export function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Confirm 모달 ──────────────────────────────────────
export function confirm(title, desc) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmDesc').textContent  = desc;
    modal.classList.remove('hidden');

    const ok     = document.getElementById('confirmOk');
    const cancel = document.getElementById('confirmCancel');

    function cleanup(result) {
      modal.classList.add('hidden');
      ok.replaceWith(ok.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));
      resolve(result);
    }

    document.getElementById('confirmOk').addEventListener('click',     () => cleanup(true),  { once: true });
    document.getElementById('confirmCancel').addEventListener('click',  () => cleanup(false), { once: true });
  });
}

// ── 패널 전환 ─────────────────────────────────────────
const PANEL_LABELS = {
  dashboard: 'Dashboard',
  reports:   'Reports',
  courses:   'Courses',
  comments:  'Comments',
  users:     'Users',
  logs:      'Logs',
};

const panelLoaders = {
  dashboard: loadDashboard,
  reports:   loadReports,
  courses:   loadCourses,
  comments:  loadComments,
  users:     loadUsers,
  logs:      loadLogs,
};

const loaded = new Set();

export function switchPanel(name) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === name);
  });
  document.getElementById(`panel-${name}`).classList.add('active');
  document.getElementById('topbarTitle').textContent = PANEL_LABELS[name] || name;

  if (!loaded.has(name)) {
    loaded.add(name);
    panelLoaders[name]?.();
  }
}

// ── 초기화 ────────────────────────────────────────────
(async () => {
  const ok = await assertAdmin();
  if (!ok) return;

  // 네비 이벤트
  document.querySelectorAll('.admin-nav-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  // 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.href = '../main.html';
  });

  // 첫 패널 로드
  switchPanel('dashboard');
  initAdminIcons();
})();

// window에 노출 (다른 모듈에서 사용)
window.switchPanel = switchPanel;
