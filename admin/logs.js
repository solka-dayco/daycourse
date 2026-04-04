// logs.js
import { supabase } from '../supabase.js';

const PAGE = 50;
let offset = 0;
let keyword = '';
let initialized = false;

export async function loadLogs() {
  const search = document.getElementById('logSearch');

  if (!initialized) {
    initialized = true;

    let timer;
    search?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        keyword = search.value.trim();
        offset = 0;
        fetchLogs();
      }, 300);
    });
  }

  await fetchLogs();
}

async function fetchLogs() {
  const wrap = document.getElementById('logsTableWrap');
  if (!wrap) return;

  wrap.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  let q = supabase
    .from('event_logs')
    .select(
      'id, user_id, anonymous_id, event_name, target_type, target_id, session_id, event_page, referrer, current_url, utm_source, utm_medium, utm_campaign, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE - 1);

  if (keyword) {
    q = q.ilike('event_name', `%${keyword}%`);
  }

  const { data, error, count } = await q;

  if (error) {
    console.error('[fetchLogs error]', error);
    wrap.innerHTML = `<div class="admin-empty">로그 조회 실패: ${escHtml(error.message || 'unknown error')}</div>`;
    renderPagination({
      hasPrev: offset > 0,
      hasNext: false,
      count: count || 0,
    });
    return;
  }

  if (!data?.length) {
    wrap.innerHTML = '<div class="admin-empty">로그 없음</div>';
    renderPagination({
      hasPrev: offset > 0,
      hasNext: false,
      count: count || 0,
    });
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>user_id</th>
          <th>anonymous_id</th>
          <th>session_id</th>
          <th>event_name</th>
          <th>event_page</th>
          <th>referrer</th>
          <th>current_url</th>
          <th>utm</th>
          <th>target_type</th>
          <th>target_id</th>
          <th>생성일</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((l) => {
          const userId = l.user_id ? escHtml(String(l.user_id)) : '-';
          const anonymousId = l.anonymous_id ? escHtml(String(l.anonymous_id)) : '-';
          const sessionId = l.session_id ? escHtml(String(l.session_id)) : '-';
          const eventName = escHtml(l.event_name || '-');
          const eventPageRaw = l.event_page ? safeJsonStringify(l.event_page) : '-';
          const targetType = escHtml(l.target_type || '-');
          const targetId = l.target_id ? escHtml(String(l.target_id)) : '-';
          const eventPageEscaped = escHtml(eventPageRaw);
          const eventPageShort = truncate(eventPageEscaped, 56);

          return `
            <tr>
              <td style="font-size:11px;color:#888">${userId}</td>
              <td style="font-size:11px;color:#888">${anonymousId}</td>
              <td style="font-size:11px;color:#888">${sessionId}</td>  
              <td>${eventName}</td>
              <td title="${eventPageEscaped}" style="max-width:260px">${eventPageShort}</td>
              <td style="font-size:11px;color:#888" title="${escHtml(l.referrer || '')}">${truncate(escHtml(l.referrer || '-'), 30)}</td>
              <td style="font-size:11px;color:#888" title="${escHtml(l.current_url || '')}">${truncate(escHtml(l.current_url || '-'), 30)}</td>
              <td style="font-size:11px;color:#888">${escHtml([l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(' / ') || '-')}</td>
              <td>${targetType}</td>
              <td style="font-size:11px;color:#888">${targetId}</td>
              <td>${fmtDate(l.created_at)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  renderPagination({
    hasPrev: offset > 0,
    hasNext: offset + PAGE < (count || 0),
    count: count || 0,
  });
}

function renderPagination({ hasPrev, hasNext, count }) {
  const pg = document.getElementById('logsPagination');
  if (!pg) return;

  const currentPage = Math.floor(offset / PAGE) + 1;
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE));

  pg.innerHTML = `
    <button class="btn btn-outline btn-sm" ${!hasPrev ? 'disabled' : ''} id="lpg-prev">이전</button>
    <span class="page-info">${currentPage} / ${totalPages} 페이지</span>
    <button class="btn btn-outline btn-sm" ${!hasNext ? 'disabled' : ''} id="lpg-next">다음</button>
  `;

  pg.querySelector('#lpg-prev')?.addEventListener('click', () => {
    if (!hasPrev) return;
    offset = Math.max(0, offset - PAGE);
    fetchLogs();
  });

  pg.querySelector('#lpg-next')?.addEventListener('click', () => {
    if (!hasNext) return;
    offset += PAGE;
    fetchLogs();
  });
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '-');
  }
}

function fmtDate(s) {
  return s
    ? new Date(s).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';
}