// icons.js — Lucide 아이콘 교체 (기능 코드 무관)
// 각 페이지 JS에서 import { initIcons } from './icons.js'; 후 initIcons() 호출

const SVG = (path, size = 18) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

export const ICONS = {
  menu:                (s=20) => SVG('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',s),
  plus:                (s=22) => SVG('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',s),
  'arrow-left':        (s=20) => SVG('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',s),
  search:              (s=18) => SVG('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',s),
  'sliders-horizontal':(s=15) => SVG('<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><circle cx="12" cy="4" r="2"/><line x1="21" y1="12" x2="16" y2="12"/><line x1="12" y1="12" x2="3" y2="12"/><circle cx="14" cy="12" r="2"/><line x1="21" y1="20" x2="10" y2="20"/><line x1="6" y1="20" x2="3" y2="20"/><circle cx="8" cy="20" r="2"/>',s),
  'funnel':              (s=15) => SVG('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',s),
  heart:               (s=15) => SVG('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',s),
  bookmark:            (s=15) => SVG('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',s),
  'message-circle':    (s=15) => SVG('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',s),
  clock:               (s=14) => SVG('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',s),
  'chevron-left':      (s=24) => SVG('<polyline points="15 18 9 12 15 6"/>',s),
  'chevron-right':     (s=24) => SVG('<polyline points="9 18 15 12 9 6"/>',s),
  link:                (s=15) => SVG('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',s),
  'map-pin':           (s=17) => SVG('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',s),
  'crosshair':         (s=17) => SVG('<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',s),
  'git-fork':          (s=15) => SVG('<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><line x1="12" y1="12" x2="12" y2="15"/>',s),
  x:                   (s=18) => SVG('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',s),
  home:                (s=16) => SVG('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',s),
  bell:                (s=16) => SVG('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',s),
  pencil:              (s=14) => SVG('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',s),
  'bar-chart-2':       (s=15) => SVG('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',s),
  'alert-triangle':    (s=15) => SVG('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',s),
  map:                 (s=15) => SVG('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',s),
  users:               (s=15) => SVG('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',s),
  'clipboard-list':    (s=15) => SVG('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>',s),
  'share-2':           (s=15) => SVG('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',s),
  'log-out':           (s=14) => SVG('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',s),
  'walk':              (s=16) => SVG('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',s),
  'bus':               (s=16) => SVG('<path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/>',s),
  'car':               (s=16) => SVG('<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',s),
};

function setIcon(el, name, size) {
  if (!el || !ICONS[name]) return;
  el.innerHTML = ICONS[name](size);
}

export function initIcons() {
  // ── 공통 헤더 ──────────────────────────────────────────
  setIcon(document.getElementById('sidebarToggle'), 'menu', 20);
  setIcon(document.getElementById('headerCreateBtn'), 'plus', 22);

  // 뒤로가기
  const backBtn = document.querySelector('.header-menu[onclick]');
  if (backBtn && !backBtn.id) setIcon(backBtn, 'arrow-left', 20);

  // ── 검색 ───────────────────────────────────────────────
  setIcon(document.getElementById('searchBtn'), 'search', 18);

  // ── 필터 ───────────────────────────────────────────────
  const filterBtn = document.getElementById('filterToggleBtn');
  if (filterBtn) {
    const textSpan = filterBtn.querySelector('span:first-child');
    if (textSpan) textSpan.innerHTML = ICONS['sliders-horizontal'](15);
  }

  // ── 캐러셀 ─────────────────────────────────────────────
  setIcon(document.getElementById('carouselPrev'), 'chevron-left', 24);
  setIcon(document.getElementById('carouselNext'), 'chevron-right', 24);

  // ── 좋아요 버튼 ────────────────────────────────────────
  const likeBtn = document.getElementById('likeBtn');
  if (likeBtn) {
    const countEl = likeBtn.querySelector('#likeCount');
    const countHtml = countEl ? countEl.outerHTML : '<span id="likeCount">0</span>';
    likeBtn.innerHTML = `${ICONS.heart(15)} ${countHtml}`;
  }

  // ── 북마크 버튼 ────────────────────────────────────────
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  if (bookmarkBtn) {
    const inner = bookmarkBtn.innerHTML;
    if (!inner.includes('svg')) setIcon(bookmarkBtn, 'bookmark', 15);
  }

  // ── 댓글 수 배지 ───────────────────────────────────────
  const commentBadge = document.getElementById('commentCountBadge');
  if (commentBadge?.parentElement) {
    const p = commentBadge.parentElement;
    if (!p.innerHTML.includes('svg')) {
      p.innerHTML = `${ICONS['message-circle'](15)} ${commentBadge.outerHTML}`;
    }
  }

  // ── 공유 버튼 ──────────────────────────────────────────
  const shareActionBtn = document.getElementById('shareActionBtn');
  if (shareActionBtn) shareActionBtn.innerHTML = ICONS['share-2'](15);

  // ── 참조 버튼 ──────────────────────────────────────────
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    const refCount = copyBtn.querySelector('.ref-count') || copyBtn.querySelector('#refCount');
    if (refCount && !refCount.textContent.trim()) refCount.textContent = '0';
    const countHtml = refCount ? refCount.outerHTML : '<span class="ref-count" id="refCount">0</span>';
    copyBtn.innerHTML = `${ICONS['git-fork'](15)} ${countHtml} 코스인용`;
  }

  // ── 지도 내 위치 버튼 ──────────────────────────────────
  setIcon(document.getElementById('myLocationBtn'), 'crosshair', 17);

  // ── 마이페이지 탭 ──────────────────────────────────────
  document.querySelectorAll('.activity-tab[data-tab]').forEach(tab => {
    const t = tab.dataset.tab;
    if (t === 'myCourse') tab.innerHTML = `${ICONS.pencil(14)} 내 코스`;
    if (t === 'bookmark') tab.innerHTML = `${ICONS.bookmark(14)} 북마크`;
    if (t === 'liked')    tab.innerHTML = `${ICONS.heart(14)} 좋아요`;
    if (t === 'plan')     tab.innerHTML = `${ICONS['map-pin'](14)} 코스 계획`;
  });
}

// ── 사이드바 전용 ───────────────────────────────────────
export function initSidebarIcons() {
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    const icon = item.querySelector('.sidebar-nav-icon');
    if (!icon) return;
    const href = item.getAttribute('href') || '';
    if (href.includes('main'))          icon.innerHTML = ICONS.home(16);
    if (href.includes('bookmarks'))     icon.innerHTML = ICONS.bookmark(16);
    if (href.includes('notifications')) icon.innerHTML = ICONS.bell(16);
  });
  const closeBtn = document.getElementById('sidebarClose');
  if (closeBtn) setIcon(closeBtn, 'x', 18);
  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn) logoutBtn.innerHTML = `${ICONS['log-out'](14)} 로그아웃`;
}

// ── 어드민 전용 ─────────────────────────────────────────
export function initAdminIcons() {
  const map = {
    dashboard: 'bar-chart-2',
    reports:   'alert-triangle',
    courses:   'map',
    comments:  'message-circle',
    users:     'users',
    logs:      'clipboard-list',
  };
  document.querySelectorAll('.admin-nav-item[data-panel]').forEach(btn => {
    const iconEl = btn.querySelector('.admin-nav-icon');
    if (!iconEl) return;
    const name = map[btn.dataset.panel];
    if (name) iconEl.innerHTML = ICONS[name](15);
  });
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.innerHTML = `${ICONS['log-out'](14)} 로그아웃`;
}