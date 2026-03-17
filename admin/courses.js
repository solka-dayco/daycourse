// courses.js
import { supabase } from '../supabase.js';
import { showToast, confirm } from './admin.js';

const PAGE = 30;
let offset = 0, keyword = '';

export async function loadCourses() {
  const search = document.getElementById('courseSearch');
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { keyword = search.value.trim(); offset = 0; fetchCourses(); }, 350);
  });
  await fetchCourses();
}

async function fetchCourses() {
  const wrap = document.getElementById('coursesTableWrap');
  wrap.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  const { data, error } = await supabase.rpc('admin_get_courses', { p_offset: offset, p_limit: PAGE });

  if (error || !data?.length) {
    wrap.innerHTML = '<div class="admin-empty">코스 없음</div>';
    renderPagination('coursesPagination', false);
    return;
  }

  const filtered = keyword
    ? data.filter(c => c.name.toLowerCase().includes(keyword.toLowerCase()))
    : data;

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>코스명</th><th>작성자</th><th>생성일</th>
        <th>좋아요</th><th>댓글</th><th>신고</th><th>상태</th><th>액션</th>
      </tr></thead>
      <tbody id="coursesTbody"></tbody>
    </table>`;

  const tbody = document.getElementById('coursesTbody');
  filtered.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td title="${escHtml(c.name)}">${escHtml(c.name)}</td>
      <td>${escHtml(c.author_nickname)}</td>
      <td>${fmtDate(c.created_at)}</td>
      <td>${c.like_count}</td>
      <td>${c.comment_count}</td>
      <td>${c.report_count > 0 ? `<span class="badge badge-deleted">${c.report_count}</span>` : 0}</td>
      <td>${c.is_deleted ? '<span class="badge badge-deleted">삭제됨</span>' : '<span class="badge badge-resolved">정상</span>'}</td>
      <td style="display:flex;gap:6px">
        <a class="btn btn-outline btn-sm" href="../course.html?id=${c.id}" target="_blank">보기</a>
        <button class="btn btn-danger btn-sm" data-id="${c.id}" ${c.is_deleted ? 'disabled' : ''}>삭제</button>
      </td>`;
    tr.querySelector('[data-id]')?.addEventListener('click', () => deleteCourse(c.id));
    tbody.appendChild(tr);
  });

  renderPagination('coursesPagination', data.length === PAGE);
}

async function deleteCourse(id) {
  const ok = await confirm('코스 삭제', '이 코스를 숨김 처리합니다. (soft delete)');
  if (!ok) return;
  const { error } = await supabase.rpc('admin_soft_delete_course', { p_course_id: id });
  if (error) { showToast('실패: ' + error.message); return; }
  showToast('삭제 완료');
  fetchCourses();
}

function renderPagination(elId, hasNext) {
  const el = document.getElementById(elId);
  el.innerHTML = `
    <button class="btn btn-outline btn-sm" id="pg-prev" ${offset===0?'disabled':''}>이전</button>
    <span class="page-info">${Math.floor(offset/PAGE)+1} 페이지</span>
    <button class="btn btn-outline btn-sm" id="pg-next" ${!hasNext?'disabled':''}>다음</button>`;
  el.querySelector('#pg-prev')?.addEventListener('click', () => { offset = Math.max(0, offset-PAGE); fetchCourses(); });
  el.querySelector('#pg-next')?.addEventListener('click', () => { offset += PAGE; fetchCourses(); });
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('ko-KR') : ''; }
