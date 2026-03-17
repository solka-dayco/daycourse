// logs.js
import { supabase } from '../supabase.js';

const PAGE = 50;
let offset = 0, keyword = '';

export async function loadLogs() {
  const search = document.getElementById('logSearch');
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { keyword = search.value.trim(); offset = 0; fetchLogs(); }, 350);
  });
  await fetchLogs();
}

async function fetchLogs() {
  const wrap = document.getElementById('logsTableWrap');
  wrap.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  let q = supabase
    .from('event_logs')
    .select('id, user_id, event_name, target_type, target_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE - 1);

  if (keyword) q = q.ilike('event_name', `%${keyword}%`);

  const { data, error } = await q;

  if (error || !data?.length) {
    wrap.innerHTML = '<div class="admin-empty">로그 없음</div>';
    renderPagination(false);
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>event_name</th><th>target_type</th><th>target_id</th><th>user_id</th><th>session_id</th><th>생성일</th>
      </tr></thead>
      <tbody>
        ${data.map(l => {
          let sid = '-';
          try {
            const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : (l.metadata || {});
            sid = meta.session_id || '-';
          } catch(_) {}
          return `
          <tr>
            <td>${escHtml(l.event_name)}</td>
            <td>${l.target_type || '-'}</td>
            <td style="font-size:11px;color:#888">${l.target_id ? l.target_id.toString().slice(0,8)+'…' : '-'}</td>
            <td style="font-size:11px;color:#888">${l.user_id ? l.user_id.slice(0,8)+'…' : '-'}</td>
            <td style="font-size:11px;color:#888">${sid !== '-' ? sid.slice(0,8)+'…' : '-'}</td>
            <td>${fmtDate(l.created_at)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  renderPagination(data.length === PAGE);
}

function renderPagination(hasNext) {
  const pg = document.getElementById('logsPagination');
  pg.innerHTML = `
    <button class="btn btn-outline btn-sm" ${offset===0?'disabled':''} id="lpg-prev">이전</button>
    <span class="page-info">${Math.floor(offset/PAGE)+1} 페이지</span>
    <button class="btn btn-outline btn-sm" ${!hasNext?'disabled':''} id="lpg-next">다음</button>`;
  pg.querySelector('#lpg-prev')?.addEventListener('click', () => { offset=Math.max(0,offset-PAGE); fetchLogs(); });
  pg.querySelector('#lpg-next')?.addEventListener('click', () => { offset+=PAGE; fetchLogs(); });
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(s) { return s ? new Date(s).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''; }