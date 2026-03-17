// comments.js
import { supabase } from '../supabase.js';
import { showToast, confirm } from './admin.js';

const PAGE = 30;
let offset = 0;

export async function loadComments() {
  await fetchComments();
}

async function fetchComments() {
  const wrap = document.getElementById('commentsTableWrap');
  wrap.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  const { data, error } = await supabase.rpc('admin_get_comments', { p_offset: offset, p_limit: PAGE });

  if (error || !data?.length) {
    wrap.innerHTML = '<div class="admin-empty">댓글 없음</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>내용</th><th>작성자</th><th>코스</th><th>생성일</th><th>상태</th><th>액션</th>
      </tr></thead>
      <tbody id="commentsTbody"></tbody>
    </table>`;

  const tbody = document.getElementById('commentsTbody');
  data.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td title="${escHtml(c.content)}">${escHtml(c.content)}</td>
      <td>${escHtml(c.nickname)}</td>
      <td><a href="../course.html?id=${c.course_id}#commentSection" target="_blank" style="color:var(--primary);font-size:11px">열기</a></td>
      <td>${fmtDate(c.created_at)}</td>
      <td>${c.is_deleted ? '<span class="badge badge-deleted">삭제됨</span>' : '<span class="badge badge-resolved">정상</span>'}</td>
      <td><button class="btn btn-danger btn-sm" data-id="${c.id}" ${c.is_deleted?'disabled':''}>삭제</button></td>`;
    tr.querySelector('[data-id]')?.addEventListener('click', () => deleteComment(c.id));
    tbody.appendChild(tr);
  });

  const pg = document.getElementById('commentsPagination');
  pg.innerHTML = `
    <button class="btn btn-outline btn-sm" ${offset===0?'disabled':''} id="cpg-prev">이전</button>
    <span class="page-info">${Math.floor(offset/PAGE)+1} 페이지</span>
    <button class="btn btn-outline btn-sm" ${data.length<PAGE?'disabled':''} id="cpg-next">다음</button>`;
  pg.querySelector('#cpg-prev')?.addEventListener('click', () => { offset=Math.max(0,offset-PAGE); fetchComments(); });
  pg.querySelector('#cpg-next')?.addEventListener('click', () => { offset+=PAGE; fetchComments(); });
}

async function deleteComment(id) {
  const ok = await confirm('댓글 삭제', '이 댓글을 숨김 처리합니다. (soft delete)');
  if (!ok) return;
  const { error } = await supabase.rpc('admin_soft_delete_comment', { p_comment_id: id });
  if (error) { showToast('실패: ' + error.message); return; }
  showToast('삭제 완료');
  fetchComments();
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('ko-KR') : ''; }
