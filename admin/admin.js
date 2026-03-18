// admin.js — 어드민 메인 컨트롤러 (v2 안정화 버전)

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

  if (!session) {
    location.href = '../login.html';
    return false;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (error || !user || user.role !== 'admin') {
    location.href = '../main.html';
    return false;
  }

  return true;
}

// ── 토스트 ────────────────────────────────────────────
export function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;

  el.textContent = msg;
  el.classList.add('show');

  setTimeout(() => {
    el.classList.remove('show');
  }, 2200);
}

// ── Confirm 모달 ──────────────────────────────────────
export function confirm(title, desc) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) return resolve(false);

    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmDesc').textContent  = desc;

    modal.classList.remove('hidden');

    const ok     = document.getElementById('confirmOk');
    const cancel = document.getElementById('confirmCancel');

    function cleanup(result) {
      modal.classList.add('hidden');

      // 이벤트 중복 방지
      ok.replaceWith(ok.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));

      resolve(result);
    }

    document.getElementById('confirmOk')
      .addEventListener('click', () => cleanup(true), { once: true });

    document.getElementById('confirmCancel')
      .addEventListener('click', () => cleanup(false), { once: true });
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

// 이미 로드된 패널 추적 (중복 실행 방지)
const loadedPanels = new Set();

export function switchPanel(name) {
  // 패널 숨기기
  document.querySelectorAll('.admin-panel')
    .forEach(p => p.classList.remove('active'));

  // 네비 상태
  document.querySelectorAll('.admin-nav-item')
    .forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === name);
    });

  // 패널 표시
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.add('active');

  // 타이틀 변경
  const title = document.getElementById('topbarTitle');
  if (title) {
    title.textContent = PANEL_LABELS[name] || name;
  }

  // 최초 1회만 로딩
  if (!loadedPanels.has(name)) {
    loadedPanels.add(name);

    try {
      panelLoaders[name]?.();
    } catch (err) {
      console.error(`[panel load error] ${name}`, err);
    }
  }
}

// ── 초기화 ────────────────────────────────────────────
(async () => {
  const ok = await assertAdmin();
  if (!ok) return;

  // 네비 이벤트
  document.querySelectorAll('.admin-nav-item[data-panel]')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        const panelName = btn.dataset.panel;
        if (!panelName) return;

        switchPanel(panelName);
      });
    });

  // 로그아웃
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn?.addEventListener('click', async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('logout error', err);
    } finally {
      location.href = '../main.html';
    }
  });

  // 최초 패널
  switchPanel('dashboard');

  // 아이콘 초기화
  initAdminIcons();
})();

// 전역 노출
window.switchPanel = switchPanel;