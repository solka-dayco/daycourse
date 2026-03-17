// reports.js
import { supabase } from '../supabase.js';
import { showToast, confirm } from './admin.js';

let currentReport = null;

export async function loadReports() {
  const filter = document.getElementById('reportStatusFilter');
  filter.addEventListener('change', fetchReports);
  await fetchReports();
}

async function fetchReports() {
  const status = document.getElementById('reportStatusFilter').value;
  const wrap = document.getElementById('reportsTableWrap');
  wrap.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  let q = supabase
    .from('reports')
    .select('id, target_type, target_id, reason, status, created_at, reporter_user_id, users!reports_reporter_user_id_fkey(nickname)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error || !data?.length) {
    wrap.innerHTML = '<div class="admin-empty">신고 없음</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>ID</th><th>타입</th><th>대상 ID</th><th>사유</th><th>상태</th><th>생성일</th><th>액션</th>
      </tr></thead>
      <tbody id="reportsTbody"></tbody>
    </table>`;

  const tbody = document.getElementById('reportsTbody');
  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${r.id}</td>
      <td>${r.target_type}</td>
      <td style="font-size:11px;color:#888">${r.target_id?.slice(0,8)}…</td>
      <td>${escHtml(r.reason)}</td>
      <td><span class="badge badge-${r.status}">${r.status}</span></td>
      <td>${fmtDate(r.created_at)}</td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" data-action="view"    data-id="${r.id}">보기</button>
        <button class="btn btn-success btn-sm" data-action="keep"    data-id="${r.id}" ${r.status==='resolved'?'disabled':''}>유지</button>
        <button class="btn btn-danger  btn-sm" data-action="delete"  data-id="${r.id}" ${r.status==='resolved'?'disabled':''}>삭제</button>
      </td>`;
    tr.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleAction(btn.dataset.action, r, data);
      });
    });
    tbody.appendChild(tr);
  });
}

async function handleAction(action, report, allReports) {
  if (action === 'view') {
    renderDetail(report);
    return;
  }

  const label = action === 'delete' ? '삭제' : '유지';
  const ok = await confirm(
    `신고 처리 — ${label}`,
    action === 'delete'
      ? '대상 콘텐츠를 삭제하고 신고를 resolved 처리합니다.'
      : '콘텐츠를 유지하고 신고를 resolved 처리합니다.'
  );
  if (!ok) return;

  const { error } = await supabase.rpc('admin_resolve_report', {
    p_report_id: report.id,
    p_action:    action === 'delete' ? 'delete' : 'keep',
  });

  if (error) { showToast('처리 실패: ' + error.message); return; }
  showToast('처리 완료');
  document.getElementById('reportDetailWrap').innerHTML = '';
  await fetchReports();
}

function renderDetail(r) {
  document.getElementById('reportDetailWrap').innerHTML = `
    <div class="detail-panel">
      <div class="detail-panel-title">신고 상세 #${r.id}</div>
      <div class="detail-row"><span class="detail-label">타입</span><span class="detail-value">${r.target_type}</span></div>
      <div class="detail-row"><span class="detail-label">대상 ID</span><span class="detail-value">${r.target_id}</span></div>
      <div class="detail-row"><span class="detail-label">사유</span><span class="detail-value">${escHtml(r.reason)}</span></div>
      <div class="detail-row"><span class="detail-label">상태</span><span class="detail-value"><span class="badge badge-${r.status}">${r.status}</span></span></div>
      <div class="detail-row"><span class="detail-label">생성일</span><span class="detail-value">${fmtDate(r.created_at)}</span></div>
      <div class="detail-actions">
        <a class="btn btn-outline btn-sm" href="../course.html?id=${r.target_id}" target="_blank">코스 열기</a>
      </div>
    </div>`;
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(s) { return s ? new Date(s).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''; }
