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
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        keyword = search.value.trim();
        offset = 0;
        fetchLogs();
      }, 350);
    });
  }

  await fetchLogs();
}

async function fetchLogs() {
  const wrap = document.getElementById('logsTableWrap');
  wrap.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  let q = supabase
    .from('event_logs')
    .select(
      'id, session_id, user_id, event_name, target_type, target_id, event_page, created_at',
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
    renderPagination({ hasPrev: offset > 0, hasNext: false, count: 0 });
    return;
  }

  if (!data?.length) {
    wrap.innerHTML = '<div class="admin-empty">로그 없음</div>';
    renderPagination({ hasPrev: offset > 0, hasNext: false, count: count || 0 });
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>user_id</th>
          <th>session_id</th>
          <th>event_name</th>
          <th>event_page</th>
          <th>target_type</th>
          <th>target_id</th>
          <th>생성일</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(l => {
          const sid = l.session_id || '-';
          const eventPage = l.event_page ? escHtml(JSON.stringify(l.event_page)) : '-';

          return `
            <tr>
              <td style="font-size:11px;color:#888">${l.user_id ? escHtml(l.user_id) : '-'}</td>
              <td style="font-size:11px;color:#888">${sid !== '-' ? escHtml(sid) : '-'}</td>
              <td>${escHtml(l.event_name || '-')}</td>
              <td title="${eventPage}" style="max-width:220px;">${truncate(eventPage, 40)}</td>
              <td>${escHtml(l.target_type || '-')}</td>
              <td style="font-size:11px;color:#888">${l.target_id ? escHtml(String(l.target_id)) : '-'}</td>
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
    count: count || 0
  });
}

function renderPagination({ hasPrev, hasNext, count }) {
  const pg = document.getElementById('logsPagination');
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
    .replace(/"/g, '&quot;');
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function fmtDate(s) {
  return s
    ? new Date(s).toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';
}