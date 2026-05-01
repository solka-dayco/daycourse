// main.js — 피드 페이지 (v4 — 원본 유지 + 퍼널 로그 보강)
import {
  fetchCourses,
  fetchFollowingCourses,
  fetchNonFollowingCourses,
  fetchFollowings,
  autocompleteSearch,
  isCourseLiked,
  toggleCourseLike,
  logEvent,
  getCurrentUser
} from './db.js';
import { initSidebar } from './sidebar.js';
import { initIcons, initSidebarIcons } from './icons.js';
import { supabase } from './supabase.js';

initSidebar();
initIcons();
initSidebarIcons();

// 최초 페이지 진입 로그
logEvent('page_view', 'page', null, { page: 'feed' });

// ── 상태 ──────────────────────────────────────────────────
const PAGE_SIZE = 20;
let state = {
  keyword: '',
  regionMain: '',
  regionSub: '',
  maxTime: 0,
  sort: 'latest',
  page: 0,
  total: 0,
  loading: false,
  allLoaded: false,
  userLat: null,
  userLng: null,
  tab: 'all',           // 'all' | 'following'
  followingIds: [],     // 팔로잉 유저 ID 목록
  followingDone: false, // 팔로잉 코스 소진 여부
  followingPage: 0,
  followingTotal: 0,
};

let currentUser = null;

// ── 초기화 ─────────────────────────────────────────────────
const feedGrid = document.getElementById('feedGrid');
const seoCourseLinks = document.getElementById('seoCourseLinks');
const spinner = document.getElementById('spinner');
const feedEmpty = document.getElementById('feedEmpty');
const ptrIndicator = document.getElementById('ptrIndicator');
const searchInput = document.getElementById('searchInput');
const autocompleteList = document.getElementById('autocompleteList');
const filterPanel = document.getElementById('filterPanel');
const filterBadge = document.getElementById('filterBadge');

(async () => {
  currentUser = await getCurrentUser();
  if (currentUser) {
    // Google OAuth 신규 유저: users 테이블에 없으면 프로필 설정으로 이동
    const { data: profile } = await supabase
      .from('users')
      .select('id, nickname')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (!profile || !profile.nickname) {
      location.href = '/nickname';
      return;
    }

    document.getElementById('headerCreateBtn').style.display = '';
    // 팔로잉 목록 미리 로드
    try {
      const followings = await fetchFollowings(currentUser.id, { pageSize: 200 });
      console.log('[followings sample]', followings[0]); // 필드 확인용
state.followingIds = followings.map(f => f.user_id).filter(Boolean);
    } catch (_) {}
  }
  bindTabEvents();
  loadFeed(true);
})();

// 뒤로가기(BFCache) 시 피드 다시 로드
window.addEventListener('pageshow', e => {
  if (e.persisted) {
    state.page = 0;
    state.allLoaded = false;
    feedGrid.innerHTML = '';
    logEvent('page_restore', 'page', null, { page: 'feed' });
    loadFeed(true);
  }
});

// ── 검색 자동완성 ─────────────────────────────────────────
let acTimer = null;
let feedSearchTimer = null;
let acFocusedIdx = -1;

searchInput.addEventListener('input', () => {
  clearTimeout(acTimer);
  clearTimeout(feedSearchTimer);
  const kw = searchInput.value.trim();

  // 자동완성: 2글자 이상, 0.32초 딜레이
  if (kw.length >= 2) {
    acTimer = setTimeout(async () => {
      const results = await autocompleteSearch(kw);
      showAutocomplete(results, kw);
    }, 320);
  } else {
    hideAutocomplete();
  }

  // 피드 검색: 입력이 완전히 비었을 때만 자동 초기화
  if (kw.length === 0) {
    feedSearchTimer = setTimeout(() => {
      if (state.keyword !== '') {
        state.keyword = '';
        logEvent('search_clear', 'search', null, { page: 'feed' });
        reload();
      }
    }, 400);
  }
});

searchInput.addEventListener('keydown', e => {
  const items = autocompleteList.querySelectorAll('.autocomplete-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    acFocusedIdx = Math.min(acFocusedIdx + 1, items.length - 1);
    updateAcFocus(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    acFocusedIdx = Math.max(acFocusedIdx - 1, -1);
    updateAcFocus(items);
  } else if (e.key === 'Enter') {
    if (acFocusedIdx >= 0 && items[acFocusedIdx]) {
      selectAutocomplete(items[acFocusedIdx].dataset.label);
    } else {
      state.keyword = searchInput.value.trim();
      hideAutocomplete();
      logEvent('search', 'search', null, {
        page: 'feed',
        keyword: state.keyword || ''
      });
      reload();
    }
  } else if (e.key === 'Escape') {
    hideAutocomplete();
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) hideAutocomplete();
});

function showAutocomplete(results, kw) {
  if (!results.length) {
    hideAutocomplete();
    return;
  }

  acFocusedIdx = -1;
  autocompleteList.innerHTML = results.map(r => `
    <li class="autocomplete-item" role="option" data-label="${escAttr(r.label)}" data-type="${escAttr(r.type || '')}">
      <span>${highlightKw(escHtml(r.label), kw)}</span>
      <span class="autocomplete-item-type">${r.type === 'course' ? '코스' : '장소'}</span>
    </li>
  `).join('');

  autocompleteList.classList.add('show');

  autocompleteList.querySelectorAll('.autocomplete-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      selectAutocomplete(el.dataset.label, el.dataset.type || '');
    });
  });
}

function hideAutocomplete() {
  autocompleteList.classList.remove('show');
  autocompleteList.innerHTML = '';
  acFocusedIdx = -1;
}

function updateAcFocus(items) {
  items.forEach((el, i) => el.classList.toggle('focused', i === acFocusedIdx));
}

function selectAutocomplete(label, type = '') {
  searchInput.value = label;
  state.keyword = label;
  hideAutocomplete();

  logEvent('autocomplete_select', 'search', null, {
    page: 'feed',
    keyword: label,
    suggestion_type: type || null
  });

  reload();
}

function highlightKw(text, kw) {
  if (!kw) return text;
  return text.replace(
    new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
    '<strong>$1</strong>'
  );
}

// 검색 버튼
document.getElementById('searchBtn').addEventListener('click', () => {
  state.keyword = searchInput.value.trim();
  hideAutocomplete();

  logEvent('search', 'search', null, {
    page: 'feed',
    keyword: state.keyword || ''
  });

  reload();
});

// ── 지역 세부 매핑 ─────────────────────────────────────────
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

// ── 필터 UI ───────────────────────────────────────────────
document.getElementById('filterToggleBtn').addEventListener('click', () => {
  filterPanel.classList.toggle('open');
  document.getElementById('filterToggleBtn')
    .classList.toggle('active', filterPanel.classList.contains('open'));
});

document.getElementById('filterRegionMain').addEventListener('change', function () {
  state.regionMain = this.value;
  state.regionSub = '';

  const subSel = document.getElementById('filterRegionSub');
  const subs = REGION_SUB[this.value] || [];

  if (subs.length) {
    subSel.innerHTML =
      `<option value="">세부 전체</option>` +
      subs.map(s => `<option>${s}</option>`).join('');
    subSel.style.display = '';
  } else {
    subSel.style.display = 'none';
  }

  updateFilterBadge();

  logEvent('filter_change', 'filter', null, {
    page: 'feed',
    region_main: state.regionMain || '',
    region_sub: '',
    max_time: state.maxTime,
    sort: state.sort
  });

  reload();
});

document.getElementById('filterRegionSub').addEventListener('change', function () {
  state.regionSub = this.value;
  updateFilterBadge();

  logEvent('filter_change', 'filter', null, {
    page: 'feed',
    region_main: state.regionMain || '',
    region_sub: state.regionSub || '',
    max_time: state.maxTime,
    sort: state.sort
  });

  reload();
});

document.querySelectorAll('#filterTimeChips .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filterTimeChips .chip')
      .forEach(b => b.classList.remove('active'));

    btn.classList.add('active');
    state.maxTime = parseInt(btn.dataset.time, 10);
    updateFilterBadge();

    logEvent('filter_change', 'filter', null, {
      page: 'feed',
      region_main: state.regionMain || '',
      region_sub: state.regionSub || '',
      max_time: state.maxTime,
      sort: state.sort
    });

    reload();
  });
});

document.querySelectorAll('#filterSortChips .chip').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (btn.dataset.sort === 'nearby') {
      if (!state.userLat || !state.userLng) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000, maximumAge: 60000, enableHighAccuracy: false
            })
          );
          state.userLat = pos.coords.latitude;
          state.userLng = pos.coords.longitude;
        } catch (_) {
          showToast('위치 정보를 가져올 수 없습니다');
          return;
        }
      }
    }

    document.querySelectorAll('#filterSortChips .chip')
      .forEach(b => b.classList.remove('active'));

    btn.classList.add('active');
    state.sort = btn.dataset.sort;

    logEvent('sort_change', 'sort', null, {
      page: 'feed',
      sort: state.sort,
      keyword: state.keyword || '',
      region_main: state.regionMain || '',
      region_sub: state.regionSub || '',
      max_time: state.maxTime
    });

    reload();
  });
});

document.getElementById('filterResetBtn').addEventListener('click', () => {
  state.keyword = '';
  state.regionMain = '';
  state.regionSub = '';
  state.maxTime = 0;
  state.sort = 'latest';

  searchInput.value = '';
  document.getElementById('filterRegionMain').value = '';
  document.getElementById('filterRegionSub').style.display = 'none';

  document.querySelectorAll('#filterTimeChips .chip')
    .forEach((b, i) => b.classList.toggle('active', i === 0));

  document.querySelectorAll('#filterSortChips .chip')
    .forEach(b => b.classList.toggle('active', b.dataset.sort === 'latest'));

  updateFilterBadge();

  logEvent('filter_reset', 'filter', null, { page: 'feed' });

  reload();
});

function updateFilterBadge() {
  let count = 0;
  if (state.regionMain) count++;
  if (state.maxTime > 0) count++;

  filterBadge.textContent = count || '';
  filterBadge.style.display = count ? '' : 'none';
}

// ── Pull to Refresh ───────────────────────────────────────
let ptrStartY = 0;
let ptrActive = false;
const PTR_THRESHOLD = 64;

document.addEventListener('touchstart', e => {
  if (window.scrollY === 0) {
    ptrStartY = e.touches[0].clientY;
    ptrActive = true;
  }
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!ptrActive) return;
  const dy = e.touches[0].clientY - ptrStartY;
  if (dy > 20 && window.scrollY === 0) {
    ptrIndicator.classList.remove('hidden');
  }
}, { passive: true });

document.addEventListener('touchend', async e => {
  if (!ptrActive) return;
  ptrActive = false;

  const dy = e.changedTouches[0].clientY - ptrStartY;
  if (dy > PTR_THRESHOLD && window.scrollY === 0) {
    logEvent('feed_refresh', 'page', null, { page: 'feed' });
    await reload();
  }

  setTimeout(() => ptrIndicator.classList.add('hidden'), 400);
}, { passive: true });

// ── 무한 스크롤 ───────────────────────────────────────────
const sentinel = document.getElementById('infiniteSentinel');
const observer = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !state.loading && !state.allLoaded) {
    loadFeed(false);
  }
}, { rootMargin: '200px' });

observer.observe(sentinel);

// ── 코어 ─────────────────────────────────────────────────
async function reload() {
  state.page = 0;
  state.allLoaded = false;
  state.followingPage = 0;
  state.followingTotal = 0;
  state.followingDone = false;
  feedGrid.innerHTML = '';
  if (seoCourseLinks) seoCourseLinks.innerHTML = '';
  await loadFeed(true);
}

function renderSeoCourseLinks(courses, reset = false) {
  if (!seoCourseLinks || !Array.isArray(courses)) return;

  if (reset) {
    seoCourseLinks.innerHTML = '';
  }

  const linksHtml = courses.map(course => `
    <a href="/course?id=${encodeURIComponent(course.id)}">
      ${escHtml(course.name)}
    </a>
  `).join('');

  seoCourseLinks.insertAdjacentHTML('beforeend', linksHtml);
}
// ── 피드 탭 ───────────────────────────────────────────────
function bindTabEvents() {
  const tabs = document.querySelectorAll('.feed-tab');
  if (!tabs.length) return;

  // 비로그인 시 팔로잉 탭 숨김
  if (!currentUser) {
    document.getElementById('feedTabs').style.display = 'none';
    return;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      if (tab.dataset.tab === state.tab) return;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.tab = tab.dataset.tab;

      if (state.tab === 'following') {
        try {
          const followings = await fetchFollowings(currentUser.id, { pageSize: 200 });
          state.followingIds = followings.map(f => f.user_id).filter(Boolean);
        } catch (_) {}
      }

      reload();
    });
  });
}
async function loadFeed(isFirstPage) {
  if (state.loading || state.allLoaded) return;

  state.loading = true;
  if (isFirstPage) {
    spinner.style.display = '';
    feedEmpty.style.display = 'none';
  }

  try {
    let courses = [], total = 0;

    if (state.tab === 'following') {
      if (!state.followingDone) {
        const result = await fetchFollowingCourses(state.followingIds, {
          page: state.followingPage,
          pageSize: PAGE_SIZE,
        });
        courses = result.courses;
        state.followingTotal = result.total;

        const isLastFollowingPage =
          courses.length < PAGE_SIZE ||
          (state.followingPage + 1) * PAGE_SIZE >= state.followingTotal;

        if (isLastFollowingPage) {
          state.followingDone = true;
          state.page = 0;
        } else {
          state.followingPage += 1;
        }
        // allLoaded는 절대 true로 만들지 않음 — 전체 피드가 남아있음
        total = 999999;
      } else {
        // 팔로잉 소진 → 전체 최신순 (팔로잉 유저 DB에서 직접 제외)
        const result = await fetchNonFollowingCourses(state.followingIds, {
          keyword: state.keyword,
          regionMain: state.regionMain,
          regionSub: state.regionSub,
          maxTime: state.maxTime,
          page: state.page,
          pageSize: PAGE_SIZE,
        });
        courses = result.courses;
        total = result.total;
      }
    } else {
      const result = await fetchCourses({
        keyword: state.keyword,
        regionMain: state.regionMain,
        regionSub: state.regionSub,
        maxTime: state.maxTime,
        sort: state.sort,
        page: state.page,
        pageSize: PAGE_SIZE,
      });
      courses = result.courses;
      total = result.total;
    }

    state.total = total;

    if (courses.length === 0 && isFirstPage) {
      feedEmpty.style.display = '';
    } else {
      // 병렬로 좋아요 상태 조회
      const likedMap = {};

      if (currentUser && courses.length) {
        await Promise.all(courses.map(async c => {
          const liked = await isCourseLiked(c.id, currentUser.id);
          likedMap[c.id] = liked;
        }));
      }

      let sorted = courses;
      if (state.sort === 'nearby' && state.userLat && state.userLng) {
        sorted = [...courses].sort((a, b) => {
          const firstPlaceA = (a.course_places || []).sort((x, y) => x.order_index - y.order_index)[0];
          const firstPlaceB = (b.course_places || []).sort((x, y) => x.order_index - y.order_index)[0];
          const distA = firstPlaceA ? haversine(state.userLat, state.userLng, firstPlaceA.lat, firstPlaceA.lng) : Infinity;
          const distB = firstPlaceB ? haversine(state.userLat, state.userLng, firstPlaceB.lat, firstPlaceB.lng) : Infinity;
          return distA - distB;
        });
      }

      const frag = document.createDocumentFragment();
      for (const course of sorted) {
        const card = buildCard(course, likedMap[course.id] ?? false);
        frag.appendChild(card);
      }
      feedGrid.appendChild(frag);
      renderSeoCourseLinks(courses, isFirstPage);
    }

    if (state.tab === 'following') {
      if (!state.followingDone) {
        // followingPage는 위에서 이미 처리 — 아무것도 안 함
      } else if (total !== 999999) {
        // 전체 피드 구간 — 정확한 total 기반으로 판정
        if (courses.length < PAGE_SIZE || (state.page + 1) * PAGE_SIZE >= total) {
          state.allLoaded = true;
        } else {
          state.page += 1;
        }
      }
      // total===999999: 팔로잉 마지막 턴, 다음 턴에 전체 피드 로드
    } else {
      if (courses.length < PAGE_SIZE || (state.page + 1) * PAGE_SIZE >= total) {
        state.allLoaded = true;
      } else {
        state.page += 1;
      }
    }

  } catch (e) {
    console.error('피드 로딩 오류:', e);
  } finally {
    spinner.style.display = 'none';
    state.loading = false;
  }
}

// ── 카드 빌드 ─────────────────────────────────────────────
function buildCard(course, liked) {
  const places = (course.course_places || []).sort((a, b) => a.order_index - b.order_index);
  const thumb = course.thumbnail_url || places.find(p => p.photo_url)?.photo_url || '';
  const pathText = places.map(p => p.name).join(' → ');
  const timeText = formatMinutes(course.total_time);

  const card = document.createElement('div');
  card.className = 'feed-card';
  card.dataset.courseId = course.id;

  card.innerHTML = `
    <div class="feed-thumb">
      ${thumb
        ? `<img src="${escAttr(thumb)}" alt="${escAttr(course.name)}" loading="lazy"/>`
        : `<div class="feed-thumb-placeholder">🗺️</div>`
      }
      ${course.region_main
        ? `<span class="feed-region-badge">${escHtml(course.region_main)}${course.region_sub ? ' · ' + escHtml(course.region_sub) : ''}</span>`
        : ''
      }
    </div>
    <div class="feed-body">
      <div class="feed-course-name">${escHtml(course.name)}</div>
      <div class="feed-places-path">${escHtml(pathText)}</div>
      <div class="feed-description ${!course.description ? 'is-empty' : ''}">
        ${course.description ? escHtml(course.description) : '&nbsp;'}
      </div>
      <div class="feed-meta">
        <span
          class="feed-author"
          data-user-id="${escAttr(course.author_id)}"
          style="cursor:pointer"
          title="${escAttr(course.author_nickname)}"
        >${escHtml(course.author_nickname)}</span>
        <div class="feed-actions">
          ${timeText ? `<span class="feed-time-badge">⏱ ${escHtml(timeText)}</span>` : ''}
          <button class="feed-like-btn ${liked ? 'liked' : ''}" data-id="${escAttr(course.id)}" aria-label="좋아요">
            <span class="heart">♥</span>
            <span class="like-count">${fmtCount(course.like_count)}</span>
          </button>
          <button class="feed-comment-btn" data-id="${escAttr(course.id)}" aria-label="댓글">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="comment-count">${fmtCount(course.comment_count)}</span>
          </button>
          <span class="feed-view-count">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${fmtCount(course.view_count)}
          </span>
        </div>
      </div>
    </div>
  `;

  bindCardEvents(card, course);
  return card;
}

function bindCardEvents(card, course) {
  // 카드 클릭
  card.addEventListener('click', e => {
    if (
      e.target.closest('.feed-like-btn') ||
      e.target.closest('.feed-comment-btn') ||
      e.target.closest('.feed-author')
    ) return;

    logEvent('course_view', 'course', course.id, {
      page: 'feed',
      region_main: course.region_main || '',
      region_sub: course.region_sub || '',
      author_id: course.author_id || null
    });

    location.href = `/course?id=${course.id}`;
  });

  // 작성자 클릭 → 유저 페이지
  card.querySelector('.feed-author')?.addEventListener('click', e => {
    e.stopPropagation();

    logEvent('author_click', 'user', course.author_id, {
      page: 'feed',
      course_id: course.id
    });

    location.href = `/user?id=${course.author_id}`;
  });

  // 댓글 버튼
  card.querySelector('.feed-comment-btn')?.addEventListener('click', e => {
    e.stopPropagation();

    logEvent('comment_cta_click', 'course', course.id, {
      page: 'feed'
    });

    location.href = `/course?id=${course.id}#commentSection`;
  });

  // 좋아요
  card.querySelector('.feed-like-btn')?.addEventListener('click', async e => {
    e.stopPropagation();

    if (!currentUser) {
      logEvent('login_required_click', 'course', course.id, {
        page: 'feed',
        action: 'like'
      });
      location.href = '/login';
      return;
    }

    const btn = e.currentTarget;
    const countEl = btn.querySelector('.like-count');
    const wasLiked = btn.classList.contains('liked');

    // 낙관적 UI
    btn.classList.toggle('liked', !wasLiked);
    countEl.textContent = String(parseInt(countEl.textContent, 10) + (!wasLiked ? 1 : -1));

    try {
      const liked = await toggleCourseLike(course.id, currentUser.id);

      logEvent(liked ? 'like_click' : 'like_cancel', 'course', course.id, {
        page: 'feed'
      });
    } catch (err) {
      console.error('좋아요 처리 오류:', err);
      // 롤백
      btn.classList.toggle('liked', wasLiked);
      countEl.textContent = String(parseInt(countEl.textContent, 10) + (wasLiked ? 1 : -1));
    }
  });
}

// ── 유틸 ─────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtCount(n) {
  n = n ?? 0;
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10).toFixed(1) + 'M';
  if (n >= 1_000) return (Math.round(n / 100) / 10).toFixed(1) + 'K';
  return String(n);
}

function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h ? h + '시간 ' : ''}${m}분` : `${h}시간`;
}