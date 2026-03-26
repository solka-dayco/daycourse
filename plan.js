// plan.js — 코스 계획 목록 페이지
import {
  getCurrentUser,
  fetchPlanCourses,
  deletePlanCourse,
  logEvent,
} from './db.js';
import { initSidebar } from './sidebar.js';
import { initIcons, ICONS } from './icons.js';

// ── 인증 체크 ─────────────────────────────────────────────
const currentUser = await getCurrentUser();
if (!currentUser) {
  location.href = '/login?redirect=' + encodeURIComponent(location.href);
}

await initSidebar();
initIcons();
logEvent('page_view', 'page', null, { page: 'plan' });

// ── 상태 ──────────────────────────────────────────────────
const PAGE_SIZE = 20;
let page = 0;
let isLoading = false;
let hasMore = true;

// ── DOM ───────────────────────────────────────────────────
const planList     = document.getElementById('planList');
const planEmpty    = document.getElementById('planEmpty');
const spinner      = document.getElementById('spinner');
const planSentinel = document.getElementById('planSentinel');
const planNewBtn   = document.getElementById('planNewBtn');

// ── 유틸 ──────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h ? `${h}시간 ` : ''}${m}분` : `${h}시간`;
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── 리스트 아이템 렌더 ───────────────────────────────────
function renderItem(course) {
  const region = [course.region_main, course.region_sub].filter(Boolean).join(' · ');
  const time   = course.total_time ? formatMinutes(course.total_time) : '';

  const li = document.createElement('li');
  li.className = 'plan-list-item';
  li.dataset.id = course.id;

  const date = course.created_at
    ? new Date(course.created_at).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' })
    : '';

  li.innerHTML = `
    <div class="plan-item-row">
      <div class="plan-item-content">
        <div class="plan-item-title">${escHtml(course.name || '(이름 없음)')}</div>
        ${course.description ? `<div class="plan-item-desc">${escHtml(course.description)}</div>` : ''}
        <div class="plan-item-meta">
          ${region ? `<span>${escHtml(region)}</span>` : ''}
          ${region && time ? `<span class="plan-item-meta-dot">·</span>` : ''}
          ${time ? `<span>예상 ${time}</span>` : ''}
          ${date ? `<span class="plan-item-meta-dot">·</span><span>${date}</span>` : ''}
        </div>
      </div>
      <div class="plan-item-icons">
        <button class="plan-icon-btn edit-btn" data-id="${escHtml(course.id)}" title="수정">
          ${ICONS.pencil(14)}
        </button>
        <button class="plan-icon-btn delete-btn" data-id="${escHtml(course.id)}" title="삭제">
          ${ICONS.x(14)}
        </button>
      </div>
    </div>
  `;

  // 아이템 클릭 → 상세 페이지
  li.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    location.href = `/plan-detail?id=${course.id}`;
  });

  // 연필 아이콘 → 수정 모드
  li.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    location.href = `/create?mode=edit&id=${course.id}`;
  });

  // X 아이콘 → 삭제
  li.querySelector('.delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('계획 코스를 삭제할까요?')) return;
    try {
      await deletePlanCourse(course.id);
      li.remove();
      if (!planList.querySelector('.plan-list-item')) planEmpty.style.display = '';
      showToast('삭제했습니다');
      logEvent('plan_delete', 'course', course.id);
    } catch (err) {
      showToast('삭제 실패: ' + (err?.message || ''));
    }
  });

  return li;
}

// ── 데이터 로드 ───────────────────────────────────────────
async function loadMore() {
  if (isLoading || !hasMore) return;
  isLoading = true;
  spinner.style.display = '';

  try {
    const { courses, total } = await fetchPlanCourses(currentUser.id, {
      page,
      pageSize: PAGE_SIZE,
    });

    if (page === 0 && courses.length === 0) {
      planEmpty.style.display = '';
    }

    courses.forEach(c => planList.appendChild(renderItem(c)));
    page += 1;
    hasMore = planList.querySelectorAll('.plan-list-item').length < total;
  } catch (err) {
    showToast('불러오기 실패');
    console.error(err);
  } finally {
    isLoading = false;
    spinner.style.display = 'none';
  }
}

// ── 무한 스크롤 ───────────────────────────────────────────
const observer = new IntersectionObserver(
  (entries) => { if (entries[0].isIntersecting) loadMore(); },
  { rootMargin: '200px' }
);
observer.observe(planSentinel);

// ── 새 계획 버튼 ──────────────────────────────────────────
planNewBtn?.addEventListener('click', () => {
  location.href = '/create?mode=plan';
});

// ── 초기 로드 ─────────────────────────────────────────────
loadMore();