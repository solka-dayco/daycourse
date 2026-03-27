// notifications.js — 알림 페이지 (v3)
import { getCurrentUser, fetchNotifications, markNotificationsRead, logEvent } from './db.js';
import { initSidebar } from './sidebar.js';
import { initIcons, initSidebarIcons } from './icons.js';

initSidebar();
initIcons();
initSidebarIcons();
logEvent('page_view', 'page', null, { page: 'notifications' });

const PAGE_SIZE = 30;
let page = 0, loading = false, allLoaded = false;
let currentUser = null;

const list    = document.getElementById('notifList');
const spinner = document.getElementById('spinner');
const empty   = document.getElementById('notifEmpty');

(async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) { location.href = '/login'; return; }

  // 알림 읽음 처리 (페이지 진입 시)
  await markNotificationsRead(currentUser.id);

  await loadNotifs();
  setupInfiniteScroll();
})();

async function loadNotifs() {
  if (loading || allLoaded) return;
  loading = true;
  if (page === 0) spinner.style.display = '';

  try {
    const notifs = await fetchNotifications(currentUser.id, { page, pageSize: PAGE_SIZE });

    spinner.style.display = 'none';
    list.style.display = '';

    if (notifs.length === 0 && page === 0) {
      empty.style.display = '';
      list.style.display = 'none';
      return;
    }

    const frag = document.createDocumentFragment();
    let lastDateLabel = '';

    notifs.forEach(n => {
      const dateLabel = formatDateLabel(n.created_at);
      if (dateLabel !== lastDateLabel) {
        const labelEl = document.createElement('div');
        labelEl.className = 'notif-date-label';
        labelEl.textContent = dateLabel;
        frag.appendChild(labelEl);
        lastDateLabel = dateLabel;
      }
      frag.appendChild(buildNotifItem(n));
    });

    list.appendChild(frag);

    if (notifs.length < PAGE_SIZE) allLoaded = true;
    else page++;
  } catch (e) {
    console.error(e);
    spinner.style.display = 'none';
  } finally {
    loading = false;
  }
}

// ── 알림 아이템 빌드 ───────────────────────────────────────
function buildNotifItem(n) {
  const iconMap = {
    course_like:      '♥',
    course_comment:   '💬',
    comment_reply:    '↩️',
    course_reference: '🔄',
    follow:           '👤',
  };

  const msgMap = {
    course_like:      buildLikeMsg(n),
    course_comment:   buildCommentMsg(n),
    comment_reply:    buildReplyMsg(n),
    course_reference: buildReferenceMsg(n),
    follow:           buildFollowMsg(n),
  };

  const icon = iconMap[n.type] || '🔔';
  const msg  = msgMap[n.type]  || '';
  const href = n.course_id ? `/course?id=${n.course_id}` : '#';

  const el = document.createElement('a');
  el.className = `notif-item${n.is_read ? '' : ' unread'}`;
  el.href = href;
  el.innerHTML = `
    <div class="notif-icon">${icon}</div>
    <div class="notif-body">
      <div class="notif-text">${msg}</div>
      <div class="notif-time">${relativeTime(n.created_at)}</div>
    </div>
    ${!n.is_read ? '<div class="notif-unread-dot"></div>' : ''}
  `;
  return el;
}

function buildLikeMsg(n) {
  const actor = `<strong>${escHtml(n.actor_nickname)}</strong>`;
  const course = n.course_name ? `<span class="notif-course">${escHtml(n.course_name)}</span>` : '코스';
  if (n.agg_count > 1) {
    return `${actor} 외 ${n.agg_count - 1}명이 ${course}에 좋아요를 눌렀습니다`;
  }
  return `${actor}님이 ${course}에 좋아요를 눌렀습니다`;
}

function buildCommentMsg(n) {
  const actor  = `<strong>${escHtml(n.actor_nickname)}</strong>`;
  const course = n.course_name ? `<span class="notif-course">${escHtml(n.course_name)}</span>` : '코스';
  return `${actor}님이 ${course}에 댓글을 남겼습니다`;
}

function buildReplyMsg(n) {
  const actor  = `<strong>${escHtml(n.actor_nickname)}</strong>`;
  const course = n.course_name ? `<span class="notif-course">${escHtml(n.course_name)}</span>` : '코스';
  return `${actor}님이 ${course} 댓글에 답글을 달았습니다`;
}

function buildReferenceMsg(n) {
  const actor  = `<strong>${escHtml(n.actor_nickname)}</strong>`;
  const course = n.course_name ? `<span class="notif-course">${escHtml(n.course_name)}</span>` : '코스';
  if (n.agg_count > 1) {
    return `${actor} 외 ${n.agg_count - 1}명이 ${course}를 참조했습니다`;
  }
  return `${actor}님이 ${course}를 참조했습니다`;
}

function buildFollowMsg(n) {
  const actor = `<strong>${escHtml(n.actor_nickname)}</strong>`;
  return `${actor}님이 회원님을 팔로우했습니다`;
}

// ── 무한 스크롤 ───────────────────────────────────────────
function setupInfiniteScroll() {
  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadNotifs();
  }, { rootMargin: '200px' });
  io.observe(document.getElementById('sentinel'));
}

// ── 유틸 ─────────────────────────────────────────────────
function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  if (d < 7)  return `${d}일 전`;
  return new Date(isoStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatDateLabel(isoStr) {
  const d = new Date(isoStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - notifDay) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7)  return `${diff}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
