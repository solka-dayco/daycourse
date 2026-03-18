// create.js — 코스 만들기 / 수정 / 참조 (v3)
import { getCurrentUser, createCourse, updateCourse, createReferenceCourse, fetchCourseById, uploadPhoto, logEvent } from './db.js';
import { createMap, clearSearchMarkers, clearCourseMarkers, addSearchMarker, addCourseMarker, drawCoursePolyline, fitMapToBounds, searchPlaces, getCurrentPosition, coordsToAddress } from './map.js';
import { cropAndCompress } from './photo.js';

// ── 인증 체크 ─────────────────────────────────────────────
let currentUser = await getCurrentUser();
if (!currentUser) { location.href = 'login.html?redirect=' + encodeURIComponent(location.href); }

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

// ── URL 파라미터 ────────────────────────────────────────────
const params  = new URLSearchParams(location.search);
const mode    = params.get('mode');    // 'edit' | 'copy' | null
const sourceId = params.get('id');

// ── 상태 ─────────────────────────────────────────────────
let places = [];     // [{ name, lat, lng, category, address, phone, place_url, comment, stay_time, travel_time, photo_url, _photoBlob }]
let myLat = null, myLng = null;
let mapInstance = null;
let pendingStayIdx   = null;  // 체류시간 선택 대기 인덱스
let pendingTravelIdx = null;  // 이동시간 선택 대기 인덱스
let sourceCourse = null;      // 수정/참조 원본
let thumbnailBlob = null;     // 새로 업로드할 썸네일 Blob
let thumbnailExistingUrl = ''; // 수정 모드 기존 썸네일 URL

const MAX_PLACES = 10;
const MIN_PLACES = 2;

let draftTimer;
let _draftEnabled = false;
let _isSaved = false;

function scheduleDraft() {
  if (!_draftEnabled) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 800);
}

// ── 뒤로가기 임시저장 팝업 ────────────────────────────────
function hasDirtyContent() {
  const name = document.getElementById('courseName')?.value || '';
  return (name || places.length > 0) && !_isSaved;
}

// ── 임시저장 모달 (커스텀 UI) ────────────────────────────
// 탭 닫기/새로고침 시 자동 임시저장
window.addEventListener('beforeunload', () => {
  if (hasDirtyContent()) saveDraft();
});

// ── 임시저장 버튼 ─────────────────────────────────────────
document.getElementById('draftSaveBtn')?.addEventListener('click', () => {
  saveDraft();
  const btn = document.getElementById('draftSaveBtn');
  if (btn) {
    btn.textContent = '저장됨 ✓';
    btn.classList.add('saved');
    setTimeout(() => {
      btn.textContent = '임시저장';
      btn.classList.remove('saved');
    }, 2000);
  }
});

// ── 임시저장 ───────────────────────────────────────────────
const DRAFT_KEY = mode === 'edit' ? `dc_draft_edit_${sourceId}`
                : mode === 'copy' ? `dc_draft_copy_${sourceId}`
                : 'dc_draft_new';

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      courseName:          document.getElementById('courseName')?.value || '',
      courseDesc:          document.getElementById('courseDesc')?.value || '',
      regionMain:          document.getElementById('regionMain')?.value || '',
      regionSub:           document.getElementById('regionSub')?.value  || '',
      places:              places.map(p => ({ ...p, _photoBlob: null })),
      thumbnailExistingUrl,
      savedAt:             Date.now(),
    }));
  } catch(_) {}
}
function loadDraft()  { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch(_) { return null; } }
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

// ── 페이지 제목 ───────────────────────────────────────────
if (mode === 'edit') document.title = '코스 수정 — 데이코스';
if (mode === 'copy') document.title = '참조 코스 만들기 — 데이코스';

// descCountEl 미리 선언 (수정 모드 로드 시 사용)
const courseDescEl = document.getElementById('courseDesc');
const descCountEl  = document.getElementById('descCount');

logEvent('course_create_start', 'page', null, { mode: mode || 'new' });

// ── 임시저장 복원 (신규 모드만) ────────────────────────────
if (!sourceId) {
  const draft = loadDraft();
  if (draft?.places?.length || draft?.courseName) {
    const ago = Math.round((Date.now() - (draft.savedAt || 0)) / 60000);
    if (confirm(`${ago}분 전 임시저장된 작성 중인 코스가 있습니다.\n복원할까요?`)) {
      document.getElementById('courseName').value = draft.courseName || '';
      document.getElementById('courseDesc').value  = draft.courseDesc  || '';
      if (descCountEl) descCountEl.textContent = (draft.courseDesc || '').length;
      if (draft.regionMain) {
        document.getElementById('regionMain').value = draft.regionMain;
        updateRegionSub(draft.regionMain);
        setTimeout(() => {
          document.getElementById('regionSub').value = draft.regionSub || '';
        }, 50);
      }
      places = draft.places || [];
      thumbnailExistingUrl = draft.thumbnailExistingUrl || '';
      if (thumbnailExistingUrl) setThumbnailPreview(thumbnailExistingUrl);
      renderPlaceList();
      updateTotalTime();
    } else {
      clearDraft();
    }
  }
}

// 신규 모드: 복원 여부 확인 후 자동저장 활성화
if (!sourceId) _draftEnabled = true;

// ── 원본 코스 로드 (수정/참조 모드) ──────────────────────
if (sourceId && (mode === 'edit' || mode === 'copy')) {
  try {
    sourceCourse = await fetchCourseById(sourceId);
    console.log('[create] 코스 로드 성공:', sourceCourse?.id, '장소수:', sourceCourse?.course_places?.length);
  } catch (e) {
    console.error('[create] 코스 로드 실패:', e);
    sourceCourse = null;
  }
  if (sourceCourse) {
    // 수정/인용 모드는 원본 데이터 우선 — draft는 무시
    clearDraft();
    if (mode === 'edit') {
      // 폼에 기존 데이터 채우기
      document.getElementById('courseName').value    = sourceCourse.name || '';
      document.getElementById('courseDesc').value    = sourceCourse.description || '';
      if (descCountEl) descCountEl.textContent = (sourceCourse.description || '').length;
      document.getElementById('regionMain').value    = sourceCourse.region_main || '';
      updateRegionSub(sourceCourse.region_main);
      setTimeout(() => {
        document.getElementById('regionSub').value = sourceCourse.region_sub || '';
      }, 0);
      // 기존 썸네일 미리보기
      if (sourceCourse.thumbnail_url) {
        thumbnailExistingUrl = sourceCourse.thumbnail_url;
        setThumbnailPreview(sourceCourse.thumbnail_url);
      }
    }
    // 장소 목록 복사
    places = (sourceCourse.course_places || []).map(p => ({
      name: p.name, lat: p.lat, lng: p.lng,
      category: p.category || '', address: p.address || '',
      phone: p.phone || '', place_url: p.place_url || '',
      comment: p.comment || '',
      stay_time:   p.stay_time   || null,
      travel_time: p.travel_time || null,
      photo_url: mode === 'edit' ? (p.photo_url || '') : '',  // 참조는 사진 미복사
      _photoBlob: null,
    }));
    // 지도 초기화 이전이라 renderPlaceList만 실행 (updateMap은 kakao.maps.load에서 처리)
    renderPlaceList();
    updateTotalTime();
  }
}
// 수정/인용 모드: 원본 로드 완료 후 자동저장 활성화
if (sourceId) _draftEnabled = true;

// ── 지역 선택 ─────────────────────────────────────────────
// 소개글 글자수 카운터
if (courseDescEl && descCountEl) {
  courseDescEl.addEventListener('input', () => {
    descCountEl.textContent = courseDescEl.value.length;
  });
  descCountEl.textContent = courseDescEl.value.length;
}

// ── 자동저장 트리거 ────────────────────────────────────────

document.getElementById('courseName')?.addEventListener('input', scheduleDraft);
document.getElementById('courseDesc')?.addEventListener('input', scheduleDraft);

document.getElementById('regionMain').addEventListener('change', function () {
  updateRegionSub(this.value);
  scheduleDraft();
});

function updateRegionSub(main) {
  const subSel = document.getElementById('regionSub');
  const subs = REGION_SUB[main] || [];
  if (subs.length) {
    subSel.innerHTML = `<option value="">세부 지역</option>` + subs.map(s => `<option>${s}</option>`).join('');
    subSel.style.display = '';
  } else {
    subSel.style.display = 'none';
  }
}

// ── 썸네일 업로드 ────────────────────────────────────────
(function() {
  const wrap        = document.getElementById('thumbnailWrap');
  const input       = document.getElementById('thumbnailInput');
  const preview     = document.getElementById('thumbnailPreview');
  const placeholder = document.getElementById('thumbnailPlaceholder');
  const removeBtn   = document.getElementById('thumbnailRemoveBtn');

  if (!wrap || !input) return;

  // 제거 버튼 — input 클릭 전파 차단 (모바일 포함)
  removeBtn.addEventListener('mousedown', e => e.stopPropagation());
  removeBtn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    thumbnailBlob = null;
    thumbnailExistingUrl = '';
    preview.style.display = 'none';
    preview.src = '';
    placeholder.style.display = '';
    removeBtn.style.display = 'none';
    wrap.classList.remove('has-image');
    input.value = '';
  });

  // 파일 선택 → 크롭 → 미리보기
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      thumbnailBlob = await cropAndCompress(file);
      setThumbnailPreview(URL.createObjectURL(thumbnailBlob));
    } catch (e) {
      if (e.message !== '취소됨') showToast('사진 처리 오류');
    }
    input.value = '';
  });
})();

function setThumbnailPreview(src) {
  const preview     = document.getElementById('thumbnailPreview');
  const placeholder = document.getElementById('thumbnailPlaceholder');
  const removeBtn   = document.getElementById('thumbnailRemoveBtn');
  const wrap        = document.getElementById('thumbnailWrap');
  preview.src = src;
  preview.style.display = '';
  placeholder.style.display = 'none';
  removeBtn.style.display = '';
  wrap.classList.add('has-image');
}

// ── 카카오맵 초기화 ───────────────────────────────────────
kakao.maps.load(async () => {
  let initLat = 37.5665, initLng = 126.9780;
  try {
    // 모바일 호환: 위치 권한 없거나 느릴 경우 3초 내 기본값으로 폴백
    const pos = await Promise.race([
      getCurrentPosition(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    myLat = pos.lat; myLng = pos.lng;
    initLat = myLat; initLng = myLng;
  } catch (_) {}

  mapInstance = await createMap('createMap', { lat: initLat, lng: initLng, level: 5 });
  
  // 모바일에서 지도 컨테이너 크기 재계산 강제
  if (mapInstance) {
    setTimeout(() => kakao.maps.event.trigger(mapInstance, 'resize'), 100);
  }

  // 지도 클릭 → 반경 50m 검색 + 직접 입력 항상 표시
  kakao.maps.event.addListener(mapInstance, 'click', async e => {
    const lat = e.latLng.getLat();
    const lng = e.latLng.getLng();
    let results = [], addr = '';
    try {
      const { searchNearby } = await import('./map.js');
      [results, addr] = await Promise.all([
        searchNearby(lat, lng, 50),
        coordsToAddress(lat, lng),
      ]);
    } catch (_) {}
    // 결과 없어도 직접입력 UI는 항상 표시
    showMapClickResults(results, lat, lng, addr);
  });

  // 수정/참조 모드 — 지도 초기화 후 장소 렌더링
  if (places.length) {
    renderPlaceList();
    updateMap();
    updateTotalTime();
    mapInstance.setCenter(new kakao.maps.LatLng(places[0].lat, places[0].lng));
  }

  // 검색 이벤트 — kakao.maps.load 완료 후 등록
  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
});

// 내 위치 버튼
document.getElementById('myLocationBtn').addEventListener('click', async () => {
  try {
    const pos = await getCurrentPosition();
    myLat = pos.lat; myLng = pos.lng;
    if (mapInstance) mapInstance.setCenter(new kakao.maps.LatLng(myLat, myLng));
  } catch (_) { showToast('위치 정보를 가져올 수 없습니다'); }
});

// ── 장소 검색 ─────────────────────────────────────────────
let searchTimer;
const searchInput = document.getElementById('searchInput');
const searchBtn   = document.getElementById('searchBtn');

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  if (!searchInput.value.trim()) {
    const ul = document.getElementById('keywordResults');
    ul.style.display = 'none';
    ul.innerHTML = '';
    if (mapInstance) clearSearchMarkers();
    return;
  }
  searchTimer = setTimeout(doSearch, 400);
});

async function doSearch() {
  const keyword = searchInput.value.trim();
  if (!keyword) return;
  if (typeof kakao === 'undefined' || !kakao.maps || !kakao.maps.services) {
    showToast('지도 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return;
  }
  try {
    // 지도 중심 기준 거리순 정렬 — radius 제한 없이 전국 검색
    let searchCenter = {};
    if (mapInstance) {
      const center = mapInstance.getCenter();
      searchCenter = { lat: center.getLat(), lng: center.getLng(), radius: 0 };
    } else if (myLat && myLng) {
      searchCenter = { lat: myLat, lng: myLng, radius: 0 };
    }
    const results = await searchPlaces(keyword, searchCenter);
    showKeywordResults(results);
  } catch (e) { showToast('검색 오류: ' + e.message); }
}

// ── 직접 입력 UI (장소 정보 없을 때) ────────────────────────
function showManualInput(lat, lng, address) {
  const ul = document.getElementById('mapClickResults');
  ul.innerHTML = '';

  const li = document.createElement('li');
  li.className = 'search-result-item manual-input-item';
  li.style.cursor = 'default';
  li.innerHTML = `
    <div style="font-size:12px;color:var(--sub);margin-bottom:8px">
      📍 ${escHtml(address) || '선택한 위치'} — 장소 정보 없음
    </div>
    <input type="text" id="manualPlaceName" class="create-search-input"
      placeholder="장소 이름을 직접 입력하세요"
      style="margin-bottom:6px;width:100%" autocomplete="off"/>
    ${buildCategorySelect()}
    <button id="manualAddBtn" class="create-search-btn" style="width:100%;margin-top:4px">추가</button>
  `;
  ul.appendChild(li);
  ul.style.display = '';

  li.querySelector('#manualAddBtn').addEventListener('click', () => {
    const name = (li.querySelector('#manualPlaceName')?.value || '').trim();
    if (!name) { showToast('장소 이름을 입력해주세요'); return; }
    const category = li.querySelector('#manualPlaceCategory')?.value || '';
    addPlace({
      place_name: name,
      category_name: category,
      road_address_name: address || '',
      address_name: address || '',
      x: lat != null ? String(lng) : '',
      y: lat != null ? String(lat) : '',
    });
    ul.style.display = 'none';
    ul.innerHTML = '';
  });
}

// ── 직접 검색 결과 표시 (키워드 검색) ───────────────────
function showKeywordResults(results) {
  const ul = document.getElementById('keywordResults');
  ul.innerHTML = '';

  if (!results.length) {
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
    results.slice(0, 10).forEach(r => {
      addSearchMarker(mapInstance, { lat: parseFloat(r.y), lng: parseFloat(r.x), name: r.place_name }, () => {
        addPlace(r);
        ul.style.display = 'none';
        ul.innerHTML = '';
      });
    });
  }

  ul.querySelectorAll('.search-result-item[data-idx]').forEach(li => {
    li.addEventListener('click', () => {
      addPlace(results[parseInt(li.dataset.idx)]);
      ul.style.display = 'none';
      ul.innerHTML = '';
    });
  });

  ul.style.display = 'block';
  ul.style.zIndex = '9999';
  console.log('[showMapClickResults] ul display after:', ul.style.display, 'children:', ul.children.length);
}

// ── 지도 클릭 결과 표시 (주변 검색 + 직접입력) ───────────
// 카카오맵 카테고리 목록
const KAKAO_CATEGORIES = [
  '음식점', '카페', '술집', '베이커리', '패스트푸드',
  '쇼핑', '마트/편의점', '문화시설', '관광명소', '숙박',
  '병원', '약국', '은행', '공공기관', '교통',
  '스포츠', '레저', '공원', '학교', '기타'
];

function buildCategorySelect(selectedVal = '') {
  return `<select id="manualPlaceCategory" class="create-select" style="margin-bottom:6px;width:100%;padding:10px 12px">
    <option value="">카테고리 선택</option>
    ${KAKAO_CATEGORIES.map(c => `<option value="${c}"${selectedVal === c ? ' selected' : ''}>${c}</option>`).join('')}
  </select>`;
}

function showMapClickResults(results, lat, lng, addr) {
  // 키워드 결과 숨김
  const kul = document.getElementById('keywordResults');
  if (kul) { kul.style.display = 'none'; kul.innerHTML = ''; }

  // 기존 마커 제거
  if (mapInstance) clearSearchMarkers();

  // ── 1. 검색 결과 → keywordResults (오버레이)
  const kul2 = document.getElementById('keywordResults');
  if (kul2) {
    kul2.innerHTML = '';
    const slice = results.slice(0, 8);
    slice.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'search-result-item';
      li.innerHTML = `
        <span class="result-name">${escHtml(r.place_name)}</span>
        <span class="result-address">${escHtml(r.road_address_name || r.address_name || '')}</span>
      `;
      li.addEventListener('click', () => {
        addPlace(r);
        kul2.style.display = 'none';
        kul2.innerHTML = '';
        if (mapInstance) clearSearchMarkers();
      });
      kul2.appendChild(li);

      // 지도 마커
      if (mapInstance) {
        addSearchMarker(mapInstance, {
          lat: parseFloat(r.y), lng: parseFloat(r.x),
          name: r.place_name,
          road_address_name: r.road_address_name || '',
          address_name: r.address_name || '',
        }, () => {
          addPlace(r);
          kul2.style.display = 'none';
          kul2.innerHTML = '';
          clearSearchMarkers();
        });
      }
    });
    if (results.length) kul2.style.display = 'block';
  }

  // ── 2. 직접입력 → mapClickCard (지도-코스목록 사이)
  showManualInputCard(lat, lng, addr);
}

function showManualInputCard(lat, lng, addr) {
  const card = document.getElementById('mapClickCard');
  const ul   = document.getElementById('mapClickResults');
  if (!card || !ul) return;

  ul.innerHTML = '';

  const li = document.createElement('li');
  li.className = 'search-result-item manual-input-item';
  li.style.cursor = 'default';
  li.innerHTML = `
    <div style="font-size:12px;color:var(--sub);margin-bottom:8px">
      ${addr ? `📍 ${escHtml(addr)}` : '선택한 위치'} — 직접 입력
    </div>
    <input type="text" id="manualPlaceName" class="create-search-input"
      placeholder="장소 이름" style="margin-bottom:6px;width:100%" autocomplete="off"/>
    ${buildCategorySelect()}
    <button id="manualAddBtn" class="create-search-btn" style="width:100%;margin-top:6px">직접 추가</button>
  `;
  ul.appendChild(li);
  card.style.display = '';

  li.querySelector('#manualAddBtn').addEventListener('click', () => {
    const name = (li.querySelector('#manualPlaceName')?.value || '').trim();
    if (!name) { showToast('장소 이름을 입력해주세요'); return; }
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

  // 중복 체크
  const lat = parseFloat(r.y ?? r.lat);
  const lng = parseFloat(r.x ?? r.lng);
  if (places.some(p => Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lng - lng) < 0.0001)) {
    showToast('이미 추가된 장소입니다');
    return;
  }

  const place = {
    name:      r.place_name || r.name,
    lat,
    lng,
    category:  r.category_name  || r.category  || '',
    address:   r.road_address_name || r.address_name || r.address || '',
    phone:     r.phone     || '',
    place_url: r.place_url || '',
    comment:   '',
    stay_time:   null,
    travel_time: places.length === 0 ? null : null,  // 모든 장소 초기값 null(미선택), 첫 장소는 저장 시 제외
    photo_url:   '',
    _photoBlob:  null,
  };

  places.push(place);

  // 검색 결과 숨기기
  const _kr = document.getElementById('keywordResults');
  if (_kr) { _kr.style.display = 'none'; _kr.innerHTML = ''; }
  const _mr = document.getElementById('mapClickResults');
  if (_mr) { _mr.style.display = 'none'; _mr.innerHTML = ''; }
  const _mc = document.getElementById('mapClickCard');
  if (_mc) { _mc.style.display = 'none'; }
  if (mapInstance) clearSearchMarkers();
  searchInput.value = '';

  renderPlaceList();
  updateMap();
  updateTotalTime();

  logEvent('place_add', 'course', null, { place_name: place.name });
}

// ── 장소 목록 렌더 ────────────────────────────────────────
function renderPlaceList() {
  const ul    = document.getElementById('placeList');
  const empty = document.getElementById('placesEmpty');
  const count = document.getElementById('placeCount');

  count.textContent = `${places.length}/${MAX_PLACES}`;
  empty.classList.toggle('show', places.length === 0);
  ul.innerHTML = '';

  places.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'create-place-item';
    li.dataset.idx = i;

    const stayLabel = p.stay_time ? formatMinutes(p.stay_time) : '체류 시간 *';

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
            <span class="place-comment-count" data-idx="${i}" style="position:absolute;right:0;bottom:-14px;font-size:10px;color:#ccc">${(p.comment||'').length}/100</span>
          </div>
          <div class="place-times">
            <button class="place-time-btn ${p.stay_time ? 'set' : ''}" data-type="stay" data-idx="${i}">
              🕐 ${stayLabel}
            </button>
          </div>
        </div>
        <div class="place-photo-slot" data-idx="${i}" title="사진 추가">
          ${p.photo_url || p._photoBlob
            ? `<img src="${p._photoPreview || p.photo_url}" alt="장소 사진"/>`
            : `<span class="photo-add-icon">📷</span>`
          }
          <input type="file" accept="image/*" class="place-photo-input" data-idx="${i}"/>
        </div>
        <button class="place-delete-btn" data-idx="${i}" aria-label="삭제">✕</button>
      </div>
    `;

    // 이동 시간 행은 li 내부에 삽입 (SortableJS가 li 단위로 정렬하므로 div를 ul에 직접 추가하면 안 됨)
    if (i > 0) {
      const travelRow = document.createElement('div');
      travelRow.className = 'place-travel-row place-travel-above';
      travelRow.innerHTML = `
        <span>↓</span>
        <button class="place-time-btn ${p.travel_time ? 'set' : ''}" data-type="travel" data-idx="${i}">
          ${p.travel_time ? formatMinutes(p.travel_time) : '이동 시간 *'}
        </button>
      `;
      // li 맨 위에 삽입
      li.insertBefore(travelRow, li.firstChild);
    }

    ul.appendChild(li);
  });

  // 이벤트 바인딩
  bindPlaceListEvents(ul);

  // SortableJS — .place-travel-above 포함 li 전체를 이동, travel-row는 li 안에 있으므로 함께 이동됨
  if (window.Sortable) {
    Sortable.create(ul, {
      handle:    '.place-drag-handle',
      animation: 150,
      filter:    '.place-time-btn, .place-comment-input, .place-photo-input',
      preventOnFilter: false,
      forceFallback: true,   // 모바일 터치 드래그 활성화
      fallbackTolerance: 5,  // 터치 민감도
      onEnd() {
        const items = [...ul.querySelectorAll('.create-place-item')];
        const reordered = items.map(el => places[parseInt(el.dataset.idx)]);

        // 첫 번째 장소의 travel_time은 항상 null(없음)
        reordered.forEach((p, idx) => {
          if (idx === 0) p.travel_time = null;
        });

        places = reordered;
        renderPlaceList();
        updateMap();
        updateTotalTime();
      },
    });
  }
  scheduleDraft();
}

function bindPlaceListEvents(ul) {
  // 한줄평
  ul.querySelectorAll('.place-comment-input').forEach(input => {
    const idx = parseInt(input.dataset.idx);
    const countEl = ul.querySelector(`.place-comment-count[data-idx="${idx}"]`);
    input.addEventListener('input', () => {
      places[idx].comment = input.value;
      if (countEl) countEl.textContent = `${input.value.length}/100`;
    });
  });

  // 체류 시간 버튼
  ul.querySelectorAll('[data-type="stay"]').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingStayIdx = parseInt(btn.dataset.idx);
      document.getElementById('stayTimeModalTitle').textContent =
        `체류 시간 — ${places[pendingStayIdx].name}`;
      openModal('stayTimeModal');
    });
  });

  // 이동 시간 버튼
  ul.querySelectorAll('[data-type="travel"]').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingTravelIdx = parseInt(btn.dataset.idx);
      openModal('travelTimeModal');
    });
  });

  // 사진 입력
  ul.querySelectorAll('.place-photo-input').forEach(input => {
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const blob = await cropAndCompress(file);
        const idx  = parseInt(input.dataset.idx);
        places[idx]._photoBlob    = blob;
        places[idx]._photoPreview = URL.createObjectURL(blob);
        places[idx].photo_url     = '';  // 업로드 후 교체
        renderPlaceList();
      } catch (err) {
        if (err.message !== '취소됨') showToast('사진 처리 오류');
      }
    });
  });

  // 삭제
  ul.querySelectorAll('.place-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      places.splice(idx, 1);
      // 첫 번째 장소 travel_time 초기화
      if (places[0]) places[0].travel_time = 0;
      renderPlaceList();
      updateMap();
      updateTotalTime();
    });
  });
}

// ── 시간 모달 ─────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('show');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

document.querySelectorAll('#stayTimeChips .time-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (pendingStayIdx === null) return;
    places[pendingStayIdx].stay_time = parseInt(chip.dataset.min);
    pendingStayIdx = null;
    closeModal('stayTimeModal');
    renderPlaceList();
    updateTotalTime();
  });
});

document.querySelectorAll('#travelTimeChips .time-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (pendingTravelIdx === null) return;
    places[pendingTravelIdx].travel_time = parseInt(chip.dataset.min);
    pendingTravelIdx = null;
    closeModal('travelTimeModal');
    renderPlaceList();
    updateTotalTime();
  });
});

// 모달 배경 클릭 닫기
['stayTimeModal','travelTimeModal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target.id === id) closeModal(id);
  });
});

// ── 총 소요시간 계산 ──────────────────────────────────────
function updateTotalTime() {
  const total = places.reduce((s, p) => s + (p.stay_time || 0) + (p.travel_time || 0), 0);
  const el = document.getElementById('totalTimeDisplay');
  if (total > 0) {
    el.style.display = '';
    document.getElementById('totalTimeText').textContent = formatMinutes(total);
  } else {
    el.style.display = 'none';
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
document.getElementById('saveBtn').addEventListener('click', async () => {
  const name       = document.getElementById('courseName').value.trim();
  const desc       = document.getElementById('courseDesc').value.trim();
  const regionMain = document.getElementById('regionMain').value;
  const regionSub  = document.getElementById('regionSub').value;

  // 유효성 검사
  if (!name) { showToast('코스 이름을 입력해주세요'); document.getElementById('courseName').focus(); return; }
  if (!regionMain) { showToast('지역을 선택해주세요'); return; }
  if (places.length < MIN_PLACES) { showToast(`최소 ${MIN_PLACES}개 장소를 추가해주세요`); return; }

  // 체류 시간 미설정 체크
  const noStay = places.findIndex(p => !p.stay_time);
  if (noStay >= 0) { showToast(`${places[noStay].name}의 체류 시간을 설정해주세요`); return; }

  // 이동 시간 미설정 체크 (두 번째부터)
  const noTravel = places.slice(1).findIndex(p => !p.travel_time);
  if (noTravel >= 0) { showToast(`${places[noTravel + 1].name}의 이동 시간을 설정해주세요`); return; }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중…';

  try {
    // 사진 업로드
    const tempId = mode === 'edit' ? sourceId : `tmp_${Date.now()}`;
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      if (p._photoBlob) {
        const path = `${tempId}/place_${i}_${Date.now()}.webp`;
        p.photo_url = await uploadPhoto(p._photoBlob, path);
        p._photoBlob = null;
      }
    }

    // 총 소요시간
    const totalTime = places.reduce((s, p) => s + (p.stay_time || 0) + (p.travel_time || 0), 0);

    // 썸네일 업로드
    let finalThumbnailUrl = thumbnailExistingUrl || '';
    if (thumbnailBlob) {
      const thumbPath = `thumbnails/${currentUser.id}/${Date.now()}.webp`;
      finalThumbnailUrl = await uploadPhoto(thumbnailBlob, thumbPath);
    }

    const courseData = {
      name,
      description:   desc || null,
      region_main:   regionMain,
      region_sub:    regionSub || '',
      total_time:    totalTime,
      thumbnail_url: finalThumbnailUrl || null,
      author_id:       currentUser.id,
      author_nickname: currentUser.nickname,
    };

    const placeRows = places.map((p, i) => ({
      name:       p.name,
      lat:        p.lat,
      lng:        p.lng,
      category:   p.category  || null,
      address:    p.address   || null,
      phone:      p.phone     || null,
      place_url:  p.place_url || null,
      comment:    p.comment   || null,
      photo_url:  p.photo_url || null,
      stay_time:  p.stay_time   || null,
      travel_time: i === 0 ? null : (p.travel_time || null),
      order_index: i,
    }));

    let courseId;
    if (mode === 'edit') {
      await updateCourse(sourceId, courseData, placeRows);
      courseId = sourceId;
      logEvent('course_edit', 'course', courseId);
    } else if (mode === 'copy' && sourceCourse) {
      // 참조 체인: original_course_id는 원본 원본, parent는 직접 참조
      courseData.parent_course_id = sourceCourse.id;
      courseData.parent_course_name    = sourceCourse.name;
      courseData.parent_author_nickname = sourceCourse.author_nickname;
      courseData.original_course_id    = sourceCourse.original_course_id || sourceCourse.id;
      courseData.original_course_name  = sourceCourse.original_course_name || sourceCourse.name;
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
    showToast('저장 실패: ' + e.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '저장';
  }
});

// ── 유틸 ─────────────────────────────────────────────────
function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h ? h+'시간 ' : ''}${m}분` : `${h}시간`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}