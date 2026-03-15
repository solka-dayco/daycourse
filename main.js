// main.js — 피드 페이지
import { fetchCourses, isCourseLiked, toggleCourseLike, logEvent, getCurrentUser } from './db.js';
import { initSidebar } from './sidebar.js';
import { supabase } from './supabase.js';

initSidebar();
logEvent('page_view', 'page', null, { page: 'feed' });

window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

// ── 상태 ─────────────────────────────────────────────
let state = {
  keyword: '',
  regionMain: '',
  regionSub: '',
  maxTime: 0,
  sort: 'latest',
  page: 0,
  total: 0,
  loading: false,
};
const PAGE_SIZE = 12;
let currentUser = null;

// ── 로그인 상태 ───────────────────────────────────────
(async () => {
  currentUser = await getCurrentUser();
  if (currentUser) document.getElementById('headerCreateBtn').style.display = '';
})();

// ── 지역 세부 매핑 ─────────────────────────────────────
const REGION_SUB = {
  서울: ['강남','서초','송파','강동','마포','홍대','이태원','용산','종로','중구','성수','건대','혜화','신촌','여의도','강북','노원','기타'],
  경기: ['수원','성남','분당','판교','용인','고양','일산','부천','안양','안산','화성','평택','광주','하남','남양주','의정부','파주','기타'],
  인천: ['중구','동구','미추홀','연수','남동','부평','계양','서구','강화','기타'],
  부산: ['해운대','광안리','남포','서면','기장','수영','동래','사하','기타'],
  대구: ['동성로','수성','달서','북구','동구','기타'],
  대전: ['둔산','유성','중구','동구','서구','기타'],
  광주: ['충장로','상무','광산','북구','남구','기타'],
  울산: ['중구','남구','북구','동구','울주','기타'],
  세종: ['세종시','기타'],
  강원: ['춘천','원주','강릉','속초','홍천','태백','기타'],
  충북: ['청주','충주','제천','기타'],
  충남: ['천안','아산','공주','논산','기타'],
  전북: ['전주','익산','군산','정읍','기타'],
  전남: ['여수','순천','목포','광양','기타'],
  경북: ['포항','경주','구미','안동','기타'],
  경남: ['창원','진주','김해','거제','통영','기타'],
  제주: ['제주시','서귀포','기타'],
};

// ── 필터 UI ───────────────────────────────────────────
document.getElementById('filterToggleBtn').addEventListener('click', () => {
  const panel = document.getElementById('filterPanel');
  const btn = document.getElementById('filterToggleBtn');
  panel.classList.toggle('open');
  btn.classList.toggle('active');
});

document.getElementById('filterRegionMain').addEventListener('change', function() {
  state.regionMain = this.value;
  state.regionSub = '';
  const subSel = document.getElementById('filterRegionSub');
  const subs = REGION_SUB[this.value] || [];
  if (subs.length) {
    subSel.innerHTML = `<option value="">세부 전체</option>` + subs.map(s => `<option>${s}</option>`).join('');
    subSel.style.display = '';
  } else {
    subSel.style.display = 'none';
  }
  reload();
});

document.getElementById('filterRegionSub').addEventListener('change', function() {
  state.regionSub = this.value;
  reload();
});

document.querySelectorAll('#filterTimeChips .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filterTimeChips .chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.maxTime = parseInt(btn.dataset.time);
    reload();
  });
});

document.querySelectorAll('#filterSortChips .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filterSortChips .chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.sort = btn.dataset.sort;
    reload();
  });
});

// ── 검색 ─────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.keyword = searchInput.value.trim();
    reload();
  }, 400);
});
document.getElementById('searchBtn').addEventListener('click', () => {
  state.keyword = searchInput.value.trim();
  reload();
});

// 더 보기
document.getElementById('loadMoreBtn').addEventListener('click', () => {
  state.page += 1;
  loadFeed(false);
});

// ── 코어 ─────────────────────────────────────────────
const feedGrid    = document.getElementById('feedGrid');
const spinner     = document.getElementById('spinner');
const feedEmpty   = document.getElementById('feedEmpty');
const loadMoreWrap = document.getElementById('loadMoreWrap');

function reload() {
  state.page = 0;
  feedGrid.innerHTML = '';
  loadFeed(true);
}

async function loadFeed(reset) {
  if (state.loading) return;
  state.loading = true;
  spinner.style.display = '';
  feedEmpty.style.display = 'none';
  loadMoreWrap.style.display = 'none';

  try {
    const { courses, total } = await fetchCourses({
      keyword: state.keyword,
      regionMain: state.regionMain,
      regionSub: state.regionSub,
      maxTime: state.maxTime,
      sort: state.sort,
      page: state.page,
      pageSize: PAGE_SIZE,
    });
    state.total = total;

    if (reset) feedGrid.innerHTML = '';

    if (courses.length === 0 && state.page === 0) {
      feedEmpty.style.display = '';
    } else {
      for (const course of courses) {
        const card = await buildCard(course);
        feedGrid.appendChild(card);
      }
    }

    const loaded = (state.page + 1) * PAGE_SIZE;
    if (loaded < total) loadMoreWrap.style.display = '';
  } catch (e) {
    console.error('피드 로딩 오류:', e);
  } finally {
    spinner.style.display = 'none';
    state.loading = false;
  }
}

// ── 댓글 수 조회 ─────────────────────────────────────
async function fetchCommentCount(courseId) {
  try {
    // 댓글 수
    const { count: commentCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);

    // 답글 수 (comments → replies join)
    const { data: comments } = await supabase
      .from('comments')
      .select('id')
      .eq('course_id', courseId);

    let replyCount = 0;
    if (comments && comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      const { count } = await supabase
        .from('replies')
        .select('*', { count: 'exact', head: true })
        .in('comment_id', commentIds);
      replyCount = count || 0;
    }

    return (commentCount || 0) + replyCount;
  } catch {
    return 0;
  }
}

// ── 카드 빌드 ─────────────────────────────────────────
async function buildCard(course) {
  const places = (course.course_places || []).sort((a, b) => a.order_index - b.order_index);
  const thumbPlace = places.find(p => p.photo_url);
  const thumbUrl = thumbPlace?.photo_url || '';
  const pathText = places.map(p => p.name).join(' → ');
  const timeText = formatMinutes(course.total_time);

  let liked = false;
  if (currentUser) {
    liked = await isCourseLiked(course.id, currentUser.id);
  }

  // 댓글 수 조회
  const commentCount = await fetchCommentCount(course.id);

  const card = document.createElement('div');
  card.className = 'feed-card';
  card.innerHTML = `
    <div class="feed-thumb">
      ${thumbUrl
        ? `<img src="${thumbUrl}" alt="${escHtml(course.name)}" loading="lazy"/>`
        : `<div class="feed-thumb-placeholder">🗺️</div>`
      }
      ${course.region_main ? `<span class="feed-region-badge">${escHtml(course.region_main)}${course.region_sub ? ' · ' + course.region_sub : ''}</span>` : ''}
    </div>
    <div class="feed-body">
      <div class="feed-course-name">${escHtml(course.name)}</div>
      <div class="feed-places-path">${escHtml(pathText)}</div>
      ${course.description ? `<div class="feed-description">${escHtml(course.description)}</div>` : ''}
      <div class="feed-meta">
        <span class="feed-author">${escHtml(course.author_nickname)}</span>
        <div class="feed-actions">
          ${timeText ? `<span class="feed-time-badge">⏱ ${timeText}</span>` : ''}
          <button class="feed-like-btn ${liked ? 'liked' : ''}" data-id="${course.id}">
            <span class="heart">♥</span>
            <span class="like-count">${course.like_count || 0}</span>
          </button>
          <button class="feed-comment-btn" data-id="${course.id}">
            💬 <span>${commentCount}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // 카드 클릭 → 상세 페이지
  card.addEventListener('click', e => {
    if (e.target.closest('.feed-like-btn') || e.target.closest('.feed-comment-btn')) return;
    logEvent('course_view', 'course', course.id);
    location.href = `course.html?id=${course.id}`;
  });

  // 댓글 버튼 → 상세 페이지 댓글 섹션
  card.querySelector('.feed-comment-btn').addEventListener('click', e => {
    e.stopPropagation();
    location.href = `course.html?id=${course.id}#commentSection`;
  });

  // 좋아요 토글
  card.querySelector('.feed-like-btn').addEventListener('click', async e => {
    e.stopPropagation();
    if (!currentUser) { location.href = 'login.html'; return; }
    const btn = e.currentTarget;
    const nowLiked = btn.classList.contains('liked');
    const countEl = btn.querySelector('.like-count');
    btn.classList.toggle('liked', !nowLiked);
    countEl.textContent = parseInt(countEl.textContent) + (!nowLiked ? 1 : -1);
    try {
      await toggleCourseLike(course.id, currentUser.id);
      logEvent('course_like', 'course', course.id);
    } catch {
      btn.classList.toggle('liked', nowLiked);
      countEl.textContent = parseInt(countEl.textContent) + (nowLiked ? 1 : -1);
    }
  });

  return card;
}

// ── 유틸 ─────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h ? h+'시간 ' : ''}${m}분` : `${h}시간`;
}

// ── 초기 로딩 ─────────────────────────────────────────
loadFeed(true);