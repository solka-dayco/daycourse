// dashboard.js
import { supabase } from '../supabase.js';

let trendChartInstance = null;

export async function loadDashboard() {
  // 추이 차트
  await loadTrendChart(14);
  await loadDonutChart();
  document.getElementById('trendDays')?.addEventListener('change', e => {
    loadTrendChart(parseInt(e.target.value));
  });
  // 요약 카드
  const { data: summary } = await supabase.rpc('get_admin_summary');
  const cards = document.getElementById('summaryCards');
  if (summary) {
    const items = [
      { label: '총 코스',       val: summary.total_courses,   cls: '' },
      { label: '총 유저',       val: summary.total_users,     cls: '' },
      { label: 'Pending 신고',  val: summary.pending_reports, cls: 'danger' },
      { label: '오늘 코스',     val: summary.today_courses,   cls: '' },
      { label: '오늘 댓글',     val: summary.today_comments,  cls: '' },
    ];
    cards.innerHTML = items.map(i => `
      <div class="summary-card ${i.cls}">
        <div class="summary-card-label">${i.label}</div>
        <div class="summary-card-num">${i.val ?? 0}</div>
      </div>
    `).join('');

    // pending badge
    if (summary.pending_reports > 0) {
      const badge = document.getElementById('pendingBadge');
      badge.textContent = summary.pending_reports;
      badge.style.display = '';
    }
  }

  // 최근 신고 5건
  const { data: reports } = await supabase
    .from('reports')
    .select('id, target_type, reason, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const wrap = document.getElementById('dashRecentReports');
  if (!reports?.length) {
    wrap.innerHTML = '<div class="admin-empty">신고 없음</div>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>ID</th><th>타입</th><th>사유</th><th>상태</th><th>생성일</th>
      </tr></thead>
      <tbody>
        ${reports.map(r => `
          <tr style="cursor:pointer" onclick="window.switchPanel('reports')">
            <td>#${r.id}</td>
            <td>${r.target_type}</td>
            <td>${escHtml(r.reason)}</td>
            <td><span class="badge badge-${r.status}">${r.status}</span></td>
            <td>${fmtDate(r.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

async function loadDonutChart() {
  const { data, error } = await supabase.rpc('get_admin_today_stats');
  if (error || !data) return;

  const ctx = document.getElementById('donutChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['방문자', '코스 생성', '활동(좋아요·댓글·참조 등)'],
      datasets: [{
        data: [data.today_visits, data.today_courses, data.today_activity],
        backgroundColor: ['#9b59b6', '#3498db', '#e8648a'],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: '오늘 활동', font: { size: 13, weight: '700' }, padding: { bottom: 8 } },
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
      },
      cutout: '60%',
    },
  });
}

async function loadTrendChart(days) {
  const { data, error } = await supabase.rpc('get_admin_trends', { p_days: days });
  if (error || !data?.length) return;

  const labels  = data.map(d => d.day.slice(5));  // MM-DD
  const visits  = data.map(d => Number(d.visits));
  const signups = data.map(d => Number(d.signups));
  const courses = data.map(d => Number(d.courses));

  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  if (trendChartInstance) trendChartInstance.destroy();

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '방문', data: visits,  borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,.08)', tension: 0, pointRadius: 3 },
        { label: '가입', data: signups, borderColor: '#e8648a', backgroundColor: 'rgba(232,100,138,.08)', tension: 0, pointRadius: 3 },
        { label: '코스', data: courses, borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,.08)',  tension: 0, pointRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { font: { size: 12 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
      },
    },
  });
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDate(s) {
  return s ? new Date(s).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
}
