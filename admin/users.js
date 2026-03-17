// users.js
import { supabase } from '../supabase.js';

const PAGE = 30;
let offset = 0;

export async function loadUsers() {
  await fetchUsers();
}

async function fetchUsers() {
  const wrap = document.getElementById('usersTableWrap');
  wrap.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  const { data, error } = await supabase.rpc('admin_get_users', { p_offset: offset, p_limit: PAGE });

  if (error || !data?.length) {
    wrap.innerHTML = '<div class="admin-empty">유저 없음</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>아이디</th><th>닉네임</th><th>역할</th><th>가입일</th><th>코스 수</th><th>액션</th>
      </tr></thead>
      <tbody id="usersTbody"></tbody>
    </table>`;

  const tbody = document.getElementById('usersTbody');
  data.forEach(u => {
    const tr = document.createElement('tr');
    const isAdmin = u.role === 'admin';
    tr.innerHTML = `
      <td>${escHtml(u.username)}</td>
      <td>${escHtml(u.nickname)}</td>
      <td>${isAdmin ? '<span class="badge badge-admin">admin</span>' : 'user'}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>${u.course_count}</td>
      <td style="display:flex;gap:6px">
        <a class="btn btn-outline btn-sm" href="../user.html?id=${u.id}" target="_blank">프로필</a>
        <button class="btn btn-sm ${isAdmin ? 'btn-outline' : 'btn-primary'}" data-id="${u.id}" data-role="${u.role}">
          ${isAdmin ? 'user로' : 'admin으로'}
        </button>
      </td>`;
    tr.querySelector('[data-id]').addEventListener('click', () => toggleRole(u.id, u.role, tr));
    tbody.appendChild(tr);
  });

  const pg = document.getElementById('usersPagination');
  pg.innerHTML = `
    <button class="btn btn-outline btn-sm" ${offset===0?'disabled':''} id="upg-prev">이전</button>
    <span class="page-info">${Math.floor(offset/PAGE)+1} 페이지</span>
    <button class="btn btn-outline btn-sm" ${data.length<PAGE?'disabled':''} id="upg-next">다음</button>`;
  pg.querySelector('#upg-prev')?.addEventListener('click', () => { offset=Math.max(0,offset-PAGE); fetchUsers(); });
  pg.querySelector('#upg-next')?.addEventListener('click', () => { offset+=PAGE; fetchUsers(); });
}

async function toggleRole(userId, currentRole, tr) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
  if (error) { alert('변경 실패: ' + error.message); return; }
  tr.querySelector('td:nth-child(3)').innerHTML = newRole === 'admin'
    ? '<span class="badge badge-admin">admin</span>' : 'user';
  const btn = tr.querySelector('[data-id]');
  btn.dataset.role  = newRole;
  btn.textContent   = newRole === 'admin' ? 'user로' : 'admin으로';
  btn.className     = `btn btn-sm ${newRole === 'admin' ? 'btn-outline' : 'btn-primary'}`;
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('ko-KR') : ''; }
