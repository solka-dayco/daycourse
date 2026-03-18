// create.js — 코스 만들기 / 수정 / 참조 (draft 복원 개선판)
import {
  getCurrentUser,
  createCourse,
  updateCourse,
  createReferenceCourse,
  fetchCourseById,
  uploadPhoto,
  logEvent,
} from './db.js';
import {
  createMap,
  clearSearchMarkers,
  clearCourseMarkers,
  addSearchMarker,
  addCourseMarker,
  drawCoursePolyline,
  fitMapToBounds,
  searchPlaces,
  getCurrentPosition,
  coordsToAddress,
} from './map.js';
import { cropAndCompress } from './photo.js';

// ── 인증 체크 ─────────────────────────────────────────────
let currentUser = await getCurrentUser();
if (!currentUser) {
  location.href = 'login.html?redirect=' + encodeURIComponent(location.href);
}

// ── 지역 세부 매핑 ─────────────────────────────────────────
const REGION_SUB = {
  서울: ['강남', '서초', '송파', '강동', '마포', '홍대', '이태원', '용산', '종로', '중구', '성수', '건대', '혜화', '신촌', '여의도', '강북', '노원', '기타'],
  경기: ['수원', '성남', '분당', '판교', '용인', '고양', '일산', '부천', '안양', '안산', '화성', '평택', '광주', '하남', '남양주', '의정부', '파주', '기타'],
  인천: ['중구', '동구', '미추홀', '연수', '남동', '부평', '계양', '서구', '강화', '기타'],
  부산: ['해운대', '광안리', '남포', '서면', '기장', '수영', '동래', '사하', '기타'],
  대구: ['동성로', '수성', '달서', '북구', '동구', '기타'],
  대전: ['둔산', '유성', '중구', '동구', '서구', '기타'],
  광주: ['충장로', '상무', '광산', '북구', '남구', '기타'],
  울산: ['중구', '남구', '북구', '동구', '울주', '기타'],
  세종: ['세종시', '기타'],
  강원: ['춘천', '원주', '강릉', '속초', '홍천', '태백', '기타'],
  충북: ['청주', '충주', '제천', '기타'],
  충남: ['천안', '아산', '공주', '논산', '기타'],
  전북: ['전주', '익산', '군산', '정읍', '기타'],
  전남: ['여수', '순천', '목포', '광양', '기타'],
  경북: ['포항', '경주', '구미', '안동', '기타'],
  경남: ['창원', '진주', '김해', '거제', '통영', '기타'],
  제주: ['제주시', '서귀포', '기타'],
};

// ── URL 파라미터 ────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const mode = params.get('mode'); // 'edit' | 'copy' | null
const sourceId = params.get('id');
const restoreLatest = params.get('restoreLatest') === '1';

// ── 상태 ─────────────────────────────────────────────────
let places = [];
let myLat = null;
let myLng = null;
let mapInstance = null;
let pendingStayIdx = null;
let pendingTravelIdx = null;
let sourceCourse = null;
let thumbnailBlob = null;
let thumbnailExistingUrl = '';

const MAX_PLACES = 10;
const MIN_PLACES = 2;

let draftTimer;
let _draftEnabled = false;
let _isSaved = false;

const DRAFT_VERSION = 3;
const DRAFT_KEY =
  mode === 'edit'
    ? `dc_draft_edit_${sourceId}`
    : mode === 'copy'
      ? `dc_draft_copy_${sourceId}`
      : 'dc_draft_new';

// ── DOM 캐시 ─────────────────────────────────────────────
const courseNameEl = document.getElementById('courseName');
const courseDescEl = document.getElementById('courseDesc');
const descCountEl = document.getElementById('descCount');
const regionMainEl = document.getElementById('regionMain');
const regionSubEl = document.getElementById('regionSub');
const draftSaveBtnEl = document.getElementById('draftSaveBtn');
const saveBtnEl = document.getElementById('saveBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// ── 유틸 ─────────────────────────────────────────────────
function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h ? `${h}시간 ` : ''}${m}분` : `${h}시간`;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function normalizePlace(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  const lat = Number(raw.lat);
  const lng = Number(raw.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    name: raw.name || '',
    lat,
    lng,
    category: raw.category || '',
    address: raw.address || '',
    phone: raw.phone || '',
    place_url: raw.place_url || '',
    comment: raw.comment || '',
    stay_time: Number.isFinite(Number(raw.stay_time)) ? Number(raw.stay_time) : null,
    travel_time:
      index === 0
        ? null
        : Number.isFinite(Number(raw.travel_time))
          ? Number(raw.travel_time)
          : null,
    photo_url: raw.photo_url || '',
    _photoBlob: null,
    _photoPreview: raw._photoPreview || '',
  };
}

function normalizeDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const normalizedPlaces = Array.isArray(raw.places)
    ? raw.places.map((p, idx) => normalizePlace(p, idx)).filter(Boolean)
    : [];

  return {
    version: raw.version || 1,
    mode: raw.mode || null,
    sourceId: raw.sourceId || null,
    courseName: raw.courseName || '',
    courseDesc: raw.courseDesc || '',
    regionMain: raw.regionMain || '',
    regionSub: raw.regionSub || '',
    places: normalizedPlaces,
    thumbnailExistingUrl: raw.thumbnailExistingUrl || '',
    savedAt: Number.isFinite(Number(raw.savedAt)) ? Number(raw.savedAt) : 0,
  };
}

function isDraftCompatible(draft) {
  if (!draft) return false;
  if ((draft.mode || null) !== (mode || null)) return false;
  if ((draft.sourceId || null) !== (sourceId || null)) return false;
  return true;
}

function hasMeaningfulDraft(draft) {
  if (!draft) return false;
  return Boolean(
    (draft.courseName && draft.courseName.trim()) ||
    (draft.courseDesc && draft.courseDesc.trim()) ||
    draft.regionMain ||
    draft.regionSub ||
    (Array.isArray(draft.places) && draft.places.length > 0) ||
    draft.thumbnailExistingUrl
  );
}

function setDescCount(value) {
  if (descCountEl) descCountEl.textContent = String((value || '').length);
}

function updateRegionSub(main, selectedSub = '') {
  const subSel = regionSubEl;
  if (!subSel) return;

  const subs = REGION_SUB[main] || [];
  if (subs.length) {
    subSel.innerHTML =
      `<option value="">세부 지역</option>` +
      subs.map((s) => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
    subSel.style.display = '';
    subSel.value = selectedSub && subs.includes(selectedSub) ? selectedSub : '';
  } else {
    subSel.innerHTML = '';
    subSel.style.display = 'none';
    subSel.value = '';
  }
}

function setThumbnailPreview(src) {
  const preview = document.getElementById('thumbnailPreview');
  const placeholder = document.getElementById('thumbnailPlaceholder');
  const removeBtn = document.getElementById('thumbnailRemoveBtn');
  const wrap = document.getElementById('thumbnailWrap');

  if (!preview || !placeholder || !removeBtn || !wrap) return;

  preview.src = src;
  preview.style.display = '';
  placeholder.style.display = 'none';
  removeBtn.style.display = '';
  wrap.classList.add('has-image');
}

function clearThumbnailPreview() {
  const preview = document.getElementById('thumbnailPreview');
  const placeholder = document.getElementById('thumbnailPlaceholder');
  const removeBtn = document.getElementById('thumbnailRemoveBtn');
  const wrap = document.getElementById('thumbnailWrap');
  const input = document.getElementById('thumbnailInput');

  if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = '';
  if (removeBtn) removeBtn.style.display = 'none';
  if (wrap) wrap.classList.remove('has-image');
  if (input) input.value = '';
}

function applyDraftToForm(draft) {
  if (!draft) return;

  if (courseNameEl) courseNameEl.value = draft.courseName || '';
  if (courseDescEl) courseDescEl.value = draft.courseDesc || '';
  setDescCount(draft.courseDesc || '');

  if (regionMainEl) {
    regionMainEl.value = draft.regionMain || '';
    updateRegionSub(draft.regionMain || '', draft.regionSub || '');
  }
  if (regionSubEl) {
    regionSubEl.value = draft.regionSub || '';
  }

  places = Array.isArray(draft.places)
    ? draft.places.map((p, idx) => normalizePlace(p, idx)).filter(Boolean)
    : [];

  thumbnailBlob = null;
  thumbnailExistingUrl = draft.thumbnailExistingUrl || '';

  if (thumbnailExistingUrl) {
    setThumbnailPreview(thumbnailExistingUrl);
  } else {
    clearThumbnailPreview();
  }

  renderPlaceList();
  updateTotalTime();
}

function applySourceCourseToForm(course) {
  if (!course) return;

  if (mode === 'edit') {
    if (courseNameEl) courseNameEl.value = course.name || '';
    if (courseDescEl) courseDescEl.value = course.description || '';
    setDescCount(course.description || '');

    if (regionMainEl) {
      regionMainEl.value = course.region_main || '';
      updateRegionSub(course.region_main || '', course.region_sub || '');
    }
    if (regionSubEl) {
      regionSubEl.value = course.region_sub || '';
    }

    thumbnailBlob = null;
    thumbnailExistingUrl = course.thumbnail_url || '';
    if (thumbnailExistingUrl) {
      setThumbnailPreview(thumbnailExistingUrl);
    } else {
      clearThumbnailPreview();
    }
  } else {
    if (courseNameEl) courseNameEl.value = '';
    if (courseDescEl) courseDescEl.value = '';
    setDescCount('');
    if (regionMainEl) {
      regionMainEl.value = '';
      updateRegionSub('', '');
    }
    if (regionSubEl) {
      regionSubEl.value = '';
    }
    thumbnailBlob = null;
    thumbnailExistingUrl = '';
    clearThumbnailPreview();
  }

  places = (course.course_places || []).map((p, idx) => ({
    name: p.name || '',
    lat: Number(p.lat),
    lng: Number(p.lng),
    category: p.category || '',
    address: p.address || '',
    phone: p.phone || '',
    place_url: p.place_url || '',
    comment: p.comment || '',
    stay_time: Number.isFinite(Number(p.stay_time)) ? Number(p.stay_time) : null,
    travel_time:
      idx === 0
        ? null
        : Number.isFinite(Number(p.travel_time))
          ? Number(p.travel_time)
          : null,
    photo_url: mode === 'edit' ? (p.photo_url || '') : '',
    _photoBlob: null,
    _photoPreview: '',
  }));

  renderPlaceList();
  updateTotalTime();
}

function resetFormToEmpty() {
  if (courseNameEl) courseNameEl.value = '';
  if (courseDescEl) courseDescEl.value = '';
  setDescCount('');

  if (regionMainEl) {
    regionMainEl.value = '';
    updateRegionSub('', '');
  }
  if (regionSubEl) {
    regionSubEl.value = '';
  }

  places = [];
  sourceCourse = null;
  thumbnailBlob = null;
  thumbnailExistingUrl = '';
  clearThumbnailPreview();

  renderPlaceList();
  updateTotalTime();
}

function hasDirtyContent() {
  const name = courseNameEl?.value || '';
  const desc = courseDescEl?.value || '';
  const regionMain = regionMainEl?.value || '';
  const regionSub = regionSubEl?.value || '';

  return Boolean(
    !_isSaved &&
      (
        name.trim() ||
        desc.trim() ||
        regionMain ||
        regionSub ||
        places.length > 0 ||
        thumbnailBlob ||
        thumbnailExistingUrl
      )
  );
}

// ── draft 조회/삭제 ───────────────────────────────────────
function loadAllDrafts() {
  const drafts = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('dc_draft_')) continue;

    const raw = safeJsonParse(localStorage.getItem(key) || 'null');
    const draft = normalizeDraft(raw);
    if (!hasMeaningfulDraft(draft)) continue;

    drafts.push({
      ...draft,
      _key: key,
    });
  }

  drafts.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return drafts;
}

function loadLatestDraft() {
  const drafts = loadAllDrafts();
  return drafts.length ? drafts[0] : null;
}

function buildDraftPayload() {
  return {
    version: DRAFT_VERSION,
    mode: mode || null,
    sourceId: sourceId || null,
    courseName: courseNameEl?.value || '',
    courseDesc: courseDescEl?.value || '',
    regionMain: regionMainEl?.value || '',
    regionSub: regionSubEl?.value || '',
    places: places.map((p, idx) => ({
      name: p.name || '',
      lat: p.lat,
      lng: p.lng,
      category: p.category || '',
      address: p.address || '',
      phone: p.phone || '',
      place_url: p.place_url || '',
      comment: p.comment || '',
      stay_time: p.stay_time || null,
      travel_time: idx === 0 ? null : (p.travel_time || null),
      photo_url: p.photo_url || '',
      _photoBlob: null,
      _photoPreview: '',
    })),
    thumbnailExistingUrl: thumbnailExistingUrl || '',
    savedAt: Date.now(),
  };
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(buildDraftPayload()));
  } catch (e) {
    console.warn('[draft] save failed:', e);
  }
}

function loadDraft() {
  const raw = safeJsonParse(localStorage.getItem(DRAFT_KEY) || 'null');
  const draft = normalizeDraft(raw);
  if (!isDraftCompatible(draft)) return null;
  return {
    ...draft,
    _key: DRAFT_KEY,
  };
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (_) {}
}

function clearAllDrafts() {
  try {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dc_draft_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (_) {}
}

function scheduleDraft() {
  if (!_draftEnabled) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    saveDraft();
  }, 800);
}

function indicateDraftSaved() {
  if (!draftSaveBtnEl) return;
  draftSaveBtnEl.textContent = '저장됨 ✓';
  draftSaveBtnEl.classList.add('saved');
  setTimeout(() => {
    draftSaveBtnEl.textContent = '임시저장';
    draftSaveBtnEl.classList.remove('saved');
  }, 2000);
}

// ── 페이지 제목 ───────────────────────────────────────────
if (mode === 'edit') document.title = '코스 수정 — 데이코스';
if (mode === 'copy') document.title = '참조 코스 만들기 — 데이코스';

logEvent('course_create_start', 'page', null, { mode: mode || 'new' });

// ── + 버튼 진입 시 최신 draft 자동 연결 ───────────────────
let redirectedToLatestDraft = false;

if (!mode && !sourceId && !restoreLatest) {
  const latest = loadLatestDraft();

  if (latest && hasMeaningfulDraft(latest)) {
    redirectedToLatestDraft = true;

    if ((latest.mode === 'edit' || latest.mode === 'copy') && latest.sourceId) {
      location.replace(`create.html?mode=${latest.mode}&id=${latest.sourceId}&restoreLatest=1`);
    } else {
      location.replace('create.html?restoreLatest=1');
    }
  }
}

// ── 임시저장 버튼 ─────────────────────────────────────────
draftSaveBtnEl?.addEventListener('click', () => {
  saveDraft();
  indicateDraftSaved();
});

// 탭 닫기/새로고침 시 자동 임시저장
window.addEventListener('beforeunload', () => {
  if (hasDirtyContent()) saveDraft();
});

// ── 초기 데이터 로드 ──────────────────────────────────────
if (!redirectedToLatestDraft) {
  let initialDraft = null;

  if (mode || sourceId) {
    initialDraft = loadDraft();
  } else {
    initialDraft = loadLatestDraft();
  }

  let shouldRestoreDraft = false;
  let shouldResetToEmpty = false;

  if (hasMeaningfulDraft(initialDraft)) {
    const ago = Math.max(0, Math.round((Date.now() - (initialDraft.savedAt || 0)) / 60000));

    const msg =
      initialDraft.mode === 'edit'
        ? `${ago}분 전 수정 중이던 글이 있습니다.\n불러오시겠습니까?`
        : initialDraft.mode === 'copy'
          ? `${ago}분 전 인용 작성 중이던 글이 있습니다.\n불러오시겠습니까?`
          : `${ago}분 전 작성 중이던 코스가 있습니다.\n불러오시겠습니까?`;

    shouldRestoreDraft = confirm(msg);

    if (!shouldRestoreDraft) {
      clearAllDrafts();
      clearDraft();
      initialDraft = null;
      sourceCourse = null;
      shouldResetToEmpty = true;
    }
  }

  if (!shouldResetToEmpty && sourceId && (mode === 'edit' || mode === 'copy')) {
    try {
      sourceCourse = await fetchCourseById(sourceId);
      console.log('[create] 코스 로드 성공:', sourceCourse?.id, '장소수:', sourceCourse?.course_places?.length);
    } catch (e) {
      console.error('[create] 코스 로드 실패:', e);
      sourceCourse = null;
    }
  }

  if (shouldRestoreDraft && initialDraft) {
    applyDraftToForm(initialDraft);
  } else if (shouldResetToEmpty) {
    resetFormToEmpty();
  } else if (sourceCourse) {
    applySourceCourseToForm(sourceCourse);
  }
}

// 자동저장 활성화는 초기 세팅 후
_draftEnabled = true;

// ── 소개글 글자수 카운터 ──────────────────────────────────
if (courseDescEl && descCountEl) {
  courseDescEl.addEventListener('input', () => {
    setDescCount(courseDescEl.value);
    scheduleDraft();
  });
  setDescCount(courseDescEl.value);
}

// ── 자동저장 트리거 ────────────────────────────────────────
courseNameEl?.addEventListener('input', scheduleDraft);

regionMainEl?.addEventListener('change', function () {
  updateRegionSub(this.value, '');
  scheduleDraft();
});

regionSubEl?.addEventListener('change', scheduleDraft);

// ── 썸네일 업로드 ────────────────────────────────────────
(function initThumbnailUploader() {
  const wrap = document.getElementById('thumbnailWrap');
  const input = document.getElementById('thumbnailInput');
  const removeBtn = document.getElementById('thumbnailRemoveBtn');

  if (!wrap || !input || !removeBtn) return;

  removeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  removeBtn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    thumbnailBlob = null;
    thumbnailExistingUrl = '';
    clearThumbnailPreview();
    scheduleDraft();
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      thumbnailBlob = await cropAndCompress(file);
      thumbnailExistingUrl = '';
      const previewUrl = URL.createObjectURL(thumbnailBlob);
      setThumbnailPreview(previewUrl);
      scheduleDraft();
    } catch (e) {
      if (e.message !== '취소됨') showToast('사진 처리 오류');
    } finally {
      input.value = '';
    }
  });
})();

// ── 카카오맵 초기화 ───────────────────────────────────────
kakao.maps.load(async () => {
  let initLat = 37.5665;
  let initLng = 126.9780;

  try {
    const pos = await Promise.race([
      getCurrentPosition(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    myLat = pos.lat;
    myLng = pos.lng;
    initLat = myLat;
    initLng = myLng;
  } catch (_) {}

  mapInstance = await createMap('createMap', { lat: initLat, lng: initLng, level: 5 });

  if (mapInstance) {
    setTimeout(() => {
      kakao.maps.event.trigger(mapInstance, 'resize');
    }, 100);
  }

  kakao.maps.event.addListener(mapInstance, 'click', async (e) => {
    const lat = e.latLng.getLat();
    const lng = e.latLng.getLng();
    let results = [];
    let addr = '';

    try {
      const { searchNearby } = await import('./map.js');
      [results, addr] = await Promise.all([
        searchNearby(lat, lng, 50),
        coordsToAddress(lat, lng),
      ]);
    } catch (_) {}

    showMapClickResults(results, lat, lng, addr);
  });

  if (places.length) {
    renderPlaceList();
    updateMap();
    updateTotalTime();
    mapInstance.setCenter(new kakao.maps.LatLng(places[0].lat, places[0].lng));
  }

  searchBtn?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
});

// 내 위치 버튼
document.getElementById('myLocationBtn')?.addEventListener('click', async () => {
  try {
    const pos = await getCurrentPosition();
    myLat = pos.lat;
    myLng = pos.lng;
    if (mapInstance) mapInstance.setCenter(new kakao.maps.LatLng(myLat, myLng));
  } catch (_) {
    showToast('위치 정보를 가져올 수 없습니다');
  }
});

// ── 장소 검색 ─────────────────────────────────────────────
let searchTimer;

searchInput?.addEventListener('input', () => {
  clearTimeout(searchTimer);

  if (!searchInput.value.trim()) {
    const ul = document.getElementById('keywordResults');
    if (ul) {
      ul.style.display = 'none';
      ul.innerHTML = '';
    }
    if (mapInstance) clearSearchMarkers();
    return;
  }

  searchTimer = setTimeout(doSearch, 400);
});

async function doSearch() {
  const keyword = searchInput?.value.trim();
  if (!keyword) return;

  if (typeof kakao === 'undefined' || !kakao.maps || !kakao.maps.services) {
    showToast('지도 로딩 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  try {
    let searchCenter = {};
    if (mapInstance) {
      const center = mapInstance.getCenter();
      searchCenter = {
        lat: center.getLat(),
        lng: center.getLng(),
        radius: 0,
      };
    } else if (myLat && myLng) {
      searchCenter = {
        lat: myLat,
        lng: myLng,
        radius: 0,
      };
    }

    const results = await searchPlaces(keyword, searchCenter);
    showKeywordResults(results);
  } catch (e) {
    showToast('검색 오류: ' + (e?.message || '알 수 없는 오류'));
  }
}

// ── 직접 입력 UI ─────────────────────────────────────────
const KAKAO_CATEGORIES = [
  '음식점', '카페', '술집', '베이커리', '패스트푸드',
  '쇼핑', '마트/편의점', '문화시설', '관광명소', '숙박',
  '병원', '약국', '은행', '공공기관', '교통',
  '스포츠', '레저', '공원', '학교', '기타',
];

function buildCategorySelect(selectedVal = '') {
  return `
    <select id="manualPlaceCategory" class="create-select" style="margin-bottom:6px;width:100%;padding:10px 12px">
      <option value="">카테고리 선택</option>
      ${KAKAO_CATEGORIES.map((c) =>
        `<option value="${escHtml(c)}"${selectedVal === c ? ' selected' : ''}>${escHtml(c)}</option>`
      ).join('')}
    </select>
  `;
}

function showKeywordResults(results) {
  const ul = document.getElementById('keywordResults');
  if (!ul) return;

  ul.innerHTML = '';

  if (!Array.isArray(results) || !results.length) {
    ul.innerHTML = '<li class="search-result-item" style="color:var(--sub);font-size:13px">검색 결과가 없습니다</li>';
    ul.style.display = '';
    return;
  }

  ul.innerHTML = results.slice(0, 10).map((r, i) => `
    <li class="search-result-item" data-idx="${i}">
      <span class="result-name">${escHtml(r.place_name)}</span>
      <span class="result-address">${escHtml(r.road_address_name || r.address_name || '')}</span>
    </li>
  `).join('');

  if (mapInstance) {
    clearSearchMarkers();
    results.slice(0, 10).forEach((r) => {
      addSearchMarker(
        mapInstance,
        {
          lat: parseFloat(r.y),
          lng: parseFloat(r.x),
          name: r.place_name,
        },
        () => {
          addPlace(r);
          ul.style.display = 'none';
          ul.innerHTML = '';
        }
      );
    });
  }

  ul.querySelectorAll('.search-result-item[data-idx]').forEach((li) => {
    li.addEventListener('click', () => {
      addPlace(results[parseInt(li.dataset.idx, 10)]);
      ul.style.display = 'none';
      ul.innerHTML = '';
    });
  });

  ul.style.display = 'block';
  ul.style.zIndex = '9999';
}

function showMapClickResults(results, lat, lng, addr) {
  const keywordUl = document.getElementById('keywordResults');
  if (keywordUl) {
    keywordUl.style.display = 'none';
    keywordUl.innerHTML = '';
  }

  if (mapInstance) clearSearchMarkers();

  const overlayUl = document.getElementById('keywordResults');
  if (overlayUl) {
    overlayUl.innerHTML = '';
    const slice = (results || []).slice(0, 8);

    slice.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'search-result-item';
      li.innerHTML = `
        <span class="result-name">${escHtml(r.place_name)}</span>
        <span class="result-address">${escHtml(r.road_address_name || r.address_name || '')}</span>
      `;
      li.addEventListener('click', () => {
        addPlace(r);
        overlayUl.style.display = 'none';
        overlayUl.innerHTML = '';
        if (mapInstance) clearSearchMarkers();
      });
      overlayUl.appendChild(li);

      if (mapInstance) {
        addSearchMarker(
          mapInstance,
          {
            lat: parseFloat(r.y),
            lng: parseFloat(r.x),
            name: r.place_name,
            road_address_name: r.road_address_name || '',
            address_name: r.address_name || '',
          },
          () => {
            addPlace(r);
            overlayUl.style.display = 'none';
            overlayUl.innerHTML = '';
            clearSearchMarkers();
          }
        );
      }
    });

    if (slice.length) overlayUl.style.display = 'block';
  }

  showManualInputCard(lat, lng, addr);
}

function showManualInputCard(lat, lng, addr) {
  const card = document.getElementById('mapClickCard');
  const ul = document.getElementById('mapClickResults');
  if (!card || !ul) return;

  ul.innerHTML = '';

  const li = document.createElement('li');
  li.className = 'search-result-item manual-input-item';
  li.style.cursor = 'default';
  li.innerHTML = `
    <div style="font-size:12px;color:var(--sub);margin-bottom:8px">
      ${addr ? `📍 ${escHtml(addr)}` : '선택한 위치'} — 직접 입력
    </div>
    <input
      type="text"
      id="manualPlaceName"
      class="create-search-input"
      placeholder="장소 이름"
      style="margin-bottom:6px;width:100%"
      autocomplete="off"
    />
    ${buildCategorySelect()}
    <button id="manualAddBtn" class="create-search-btn" style="width:100%;margin-top:6px">직접 추가</button>
  `;
  ul.appendChild(li);
  card.style.display = '';

  li.querySelector('#manualAddBtn')?.addEventListener('click', () => {
    const name = (li.querySelector('#manualPlaceName')?.value || '').trim();
    if (!name) {
      showToast('장소 이름을 입력해주세요');
      return;
    }

    const category = li.querySelector('#manualPlaceCategory')?.value || '';
    addPlace({
      place_name: name,
      category_name: category,
      road_address_name: addr || '',
      address_name: addr || '',
      x: lng != null ? String(lng) : '',
      y: lat != null ? String(lat) : '',
    });

    card.style.display = 'none';
    ul.innerHTML = '';
  });
}

// ── 장소 추가 ─────────────────────────────────────────────
function addPlace(r) {
  if (places.length >= MAX_PLACES) {
    showToast(`최대 ${MAX_PLACES}개 장소까지 추가할 수 있습니다`);
    return;
  }

  const lat = parseFloat(r.y ?? r.lat);
  const lng = parseFloat(r.x ?? r.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    showToast('장소 좌표를 확인할 수 없습니다');
    return;
  }

  if (places.some((p) => Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lng - lng) < 0.0001)) {
    showToast('이미 추가된 장소입니다');
    return;
  }

  const place = {
    name: r.place_name || r.name || '',
    lat,
    lng,
    category: r.category_name || r.category || '',
    address: r.road_address_name || r.address_name || r.address || '',
    phone: r.phone || '',
    place_url: r.place_url || '',
    comment: '',
    stay_time: null,
    travel_time: places.length === 0 ? null : null,
    photo_url: '',
    _photoBlob: null,
    _photoPreview: '',
  };

  places.push(place);

  const keywordResultsEl = document.getElementById('keywordResults');
  if (keywordResultsEl) {
    keywordResultsEl.style.display = 'none';
    keywordResultsEl.innerHTML = '';
  }

  const mapClickResultsEl = document.getElementById('mapClickResults');
  if (mapClickResultsEl) {
    mapClickResultsEl.style.display = 'none';
    mapClickResultsEl.innerHTML = '';
  }

  const mapClickCardEl = document.getElementById('mapClickCard');
  if (mapClickCardEl) mapClickCardEl.style.display = 'none';

  if (mapInstance) clearSearchMarkers();
  if (searchInput) searchInput.value = '';

  renderPlaceList();
  updateMap();
  updateTotalTime();
  scheduleDraft();

  logEvent('place_add', 'course', null, { place_name: place.name });
}

// ── 장소 목록 렌더 ────────────────────────────────────────
function renderPlaceList() {
  const ul = document.getElementById('placeList');
  const empty = document.getElementById('placesEmpty');
  const count = document.getElementById('placeCount');

  if (!ul || !empty || !count) return;

  count.textContent = `${places.length}/${MAX_PLACES}`;
  empty.classList.toggle('show', places.length === 0);
  ul.innerHTML = '';

  places.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'create-place-item';
    li.dataset.idx = String(i);

    const stayLabel = p.stay_time ? formatMinutes(p.stay_time) : '체류 시간 *';
    const photoSrc = p._photoPreview || p.photo_url || '';

    li.innerHTML = `
      <div class="place-main-row">
        <div class="place-drag-handle" title="드래그하여 순서 변경">⠿</div>
        <div class="place-num">${i + 1}</div>
        <div class="place-info">
          <div class="place-name">${escHtml(p.name)}</div>
          <div class="place-sub">${escHtml(p.category)}${p.address ? ` · ${escHtml(p.address)}` : ''}</div>
          <div style="position:relative">
            <input
              type="text"
              class="place-comment-input"
              placeholder="한줄평 (선택, 최대 100자)"
              value="${escHtml(p.comment)}"
              maxlength="100"
              data-idx="${i}"
            />
            <span
              class="place-comment-count"
              data-idx="${i}"
              style="position:absolute;right:0;bottom:-14px;font-size:10px;color:#ccc"
            >${(p.comment || '').length}/100</span>
          </div>
          <div class="place-times">
            <button class="place-time-btn ${p.stay_time ? 'set' : ''}" data-type="stay" data-idx="${i}">
              🕐 ${stayLabel}
            </button>
          </div>
        </div>
        <div class="place-photo-slot" data-idx="${i}" title="사진 추가">
          ${
            photoSrc
              ? `<img src="${escHtml(photoSrc)}" alt="장소 사진"/>`
              : `<span class="photo-add-icon">📷</span>`
          }
          <input type="file" accept="image/*" class="place-photo-input" data-idx="${i}" />
        </div>
        <button class="place-delete-btn" data-idx="${i}" aria-label="삭제">✕</button>
      </div>
    `;

    if (i > 0) {
      const travelRow = document.createElement('div');
      travelRow.className = 'place-travel-row place-travel-above';
      travelRow.innerHTML = `
        <span>↓</span>
        <button class="place-time-btn ${p.travel_time ? 'set' : ''}" data-type="travel" data-idx="${i}">
          ${p.travel_time ? formatMinutes(p.travel_time) : '이동 시간 *'}
        </button>
      `;
      li.insertBefore(travelRow, li.firstChild);
    }

    ul.appendChild(li);
  });

  bindPlaceListEvents(ul);

  if (window.Sortable) {
    if (ul._sortableInstance) {
      ul._sortableInstance.destroy();
    }

    ul._sortableInstance = Sortable.create(ul, {
      handle: '.place-drag-handle',
      animation: 150,
      filter: '.place-time-btn, .place-comment-input, .place-photo-input',
      preventOnFilter: false,
      forceFallback: true,
      fallbackTolerance: 5,
      onEnd() {
        const items = [...ul.querySelectorAll('.create-place-item')];
        const reordered = items.map((el) => {
          const idx = parseInt(el.dataset.idx, 10);
          return places[idx];
        });

        reordered.forEach((p, idx) => {
          p.travel_time = idx === 0 ? null : (p.travel_time || null);
        });

        places = reordered;
        renderPlaceList();
        updateMap();
        updateTotalTime();
        scheduleDraft();
      },
    });
  }
}

function bindPlaceListEvents(ul) {
  ul.querySelectorAll('.place-comment-input').forEach((input) => {
    const idx = parseInt(input.dataset.idx, 10);
    const countEl = ul.querySelector(`.place-comment-count[data-idx="${idx}"]`);
    input.addEventListener('input', () => {
      if (!places[idx]) return;
      places[idx].comment = input.value;
      if (countEl) countEl.textContent = `${input.value.length}/100`;
      scheduleDraft();
    });
  });

  ul.querySelectorAll('[data-type="stay"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingStayIdx = parseInt(btn.dataset.idx, 10);
      const titleEl = document.getElementById('stayTimeModalTitle');
      if (titleEl && places[pendingStayIdx]) {
        titleEl.textContent = `체류 시간 — ${places[pendingStayIdx].name}`;
      }
      openModal('stayTimeModal');
    });
  });

  ul.querySelectorAll('[data-type="travel"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingTravelIdx = parseInt(btn.dataset.idx, 10);
      openModal('travelTimeModal');
    });
  });

  ul.querySelectorAll('.place-photo-input').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const blob = await cropAndCompress(file);
        const idx = parseInt(input.dataset.idx, 10);
        if (!places[idx]) return;

        places[idx]._photoBlob = blob;
        places[idx]._photoPreview = URL.createObjectURL(blob);
        places[idx].photo_url = '';
        renderPlaceList();
        scheduleDraft();
      } catch (err) {
        if (err.message !== '취소됨') showToast('사진 처리 오류');
      } finally {
        input.value = '';
      }
    });
  });

  ul.querySelectorAll('.place-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (!Number.isInteger(idx) || !places[idx]) return;

      places.splice(idx, 1);

      if (places[0]) places[0].travel_time = null;
      places = places.map((p, orderIdx) => ({
        ...p,
        travel_time: orderIdx === 0 ? null : (p.travel_time || null),
      }));

      renderPlaceList();
      updateMap();
      updateTotalTime();
      scheduleDraft();
    });
  });
}

// ── 시간 모달 ─────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('show');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('show');
}

document.querySelectorAll('#stayTimeChips .time-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    if (pendingStayIdx === null || !places[pendingStayIdx]) return;
    places[pendingStayIdx].stay_time = parseInt(chip.dataset.min, 10);
    pendingStayIdx = null;
    closeModal('stayTimeModal');
    renderPlaceList();
    updateTotalTime();
    scheduleDraft();
  });
});

document.querySelectorAll('#travelTimeChips .time-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    if (pendingTravelIdx === null || !places[pendingTravelIdx]) return;
    places[pendingTravelIdx].travel_time = parseInt(chip.dataset.min, 10);
    pendingTravelIdx = null;
    closeModal('travelTimeModal');
    renderPlaceList();
    updateTotalTime();
    scheduleDraft();
  });
});

['stayTimeModal', 'travelTimeModal'].forEach((id) => {
  document.getElementById(id)?.addEventListener('click', (e) => {
    if (e.target.id === id) closeModal(id);
  });
});

// ── 총 소요시간 계산 ──────────────────────────────────────
function updateTotalTime() {
  const total = places.reduce((sum, p) => sum + (p.stay_time || 0) + (p.travel_time || 0), 0);

  const wrap = document.getElementById('totalTimeDisplay');
  const text = document.getElementById('totalTimeText');
  if (!wrap || !text) return;

  if (total > 0) {
    wrap.style.display = '';
    text.textContent = formatMinutes(total);
  } else {
    wrap.style.display = 'none';
    text.textContent = '';
  }
}

// ── 지도 업데이트 ─────────────────────────────────────────
function updateMap() {
  if (!mapInstance) return;

  clearCourseMarkers();

  if (!places.length) return;

  places.forEach((p, i) => addCourseMarker(mapInstance, p, i + 1));
  if (places.length > 1) drawCoursePolyline(mapInstance, places);
  fitMapToBounds(mapInstance, places);
}

// ── 저장 ─────────────────────────────────────────────────
saveBtnEl?.addEventListener('click', async () => {
  const name = courseNameEl?.value.trim() || '';
  const desc = courseDescEl?.value.trim() || '';
  const regionMain = regionMainEl?.value || '';
  const regionSub = regionSubEl?.value || '';

  if (!name) {
    showToast('코스 이름을 입력해주세요');
    courseNameEl?.focus();
    return;
  }
  if (!regionMain) {
    showToast('지역을 선택해주세요');
    return;
  }
  if (places.length < MIN_PLACES) {
    showToast(`최소 ${MIN_PLACES}개 장소를 추가해주세요`);
    return;
  }

  const noStay = places.findIndex((p) => !p.stay_time);
  if (noStay >= 0) {
    showToast(`${places[noStay].name}의 체류 시간을 설정해주세요`);
    return;
  }

  const noTravel = places.slice(1).findIndex((p) => !p.travel_time);
  if (noTravel >= 0) {
    showToast(`${places[noTravel + 1].name}의 이동 시간을 설정해주세요`);
    return;
  }

  if (!saveBtnEl) return;

  saveBtnEl.disabled = true;
  saveBtnEl.textContent = '저장 중…';

  try {
    const tempId = mode === 'edit' ? sourceId : `tmp_${Date.now()}`;

    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      if (p._photoBlob) {
        const path = `${tempId}/place_${i}_${Date.now()}.webp`;
        p.photo_url = await uploadPhoto(p._photoBlob, path);
        p._photoBlob = null;
        p._photoPreview = '';
      }
    }

    const totalTime = places.reduce((sum, p) => sum + (p.stay_time || 0) + (p.travel_time || 0), 0);

    let finalThumbnailUrl = thumbnailExistingUrl || '';
    if (thumbnailBlob) {
      const thumbPath = `thumbnails/${currentUser.id}/${Date.now()}.webp`;
      finalThumbnailUrl = await uploadPhoto(thumbnailBlob, thumbPath);
      thumbnailBlob = null;
    }

    const courseData = {
      name,
      description: desc || null,
      region_main: regionMain,
      region_sub: regionSub || '',
      total_time: totalTime,
      thumbnail_url: finalThumbnailUrl || null,
      author_id: currentUser.id,
      author_nickname: currentUser.nickname,
    };

    const placeRows = places.map((p, i) => ({
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      category: p.category || null,
      address: p.address || null,
      phone: p.phone || null,
      place_url: p.place_url || null,
      comment: p.comment || null,
      photo_url: p.photo_url || null,
      stay_time: p.stay_time || null,
      travel_time: i === 0 ? null : (p.travel_time || null),
      order_index: i,
    }));

    let courseId;

    if (mode === 'edit') {
      await updateCourse(sourceId, courseData, placeRows);
      courseId = sourceId;
      logEvent('course_edit', 'course', courseId);
    } else if (mode === 'copy' && sourceCourse) {
      courseData.parent_course_id = sourceCourse.id;
      courseData.parent_course_name = sourceCourse.name;
      courseData.parent_author_nickname = sourceCourse.author_nickname;
      courseData.original_course_id = sourceCourse.original_course_id || sourceCourse.id;
      courseData.original_course_name = sourceCourse.original_course_name || sourceCourse.name;
      courseData.original_author_nickname = sourceCourse.original_author_nickname || sourceCourse.author_nickname;

      courseId = await createReferenceCourse(courseData, placeRows, sourceCourse.id);
      logEvent('course_reference', 'course', sourceCourse.id);
    } else {
      courseId = await createCourse(courseData, placeRows);
      logEvent('course_create_complete', 'course', courseId);
    }

    clearDraft();
    _isSaved = true;
    location.href = `course.html?id=${courseId}`;
  } catch (e) {
    console.error(e);
    showToast('저장 실패: ' + (e?.message || '알 수 없는 오류'));
  } finally {
    saveBtnEl.disabled = false;
    saveBtnEl.textContent = '저장하기';
  }
});