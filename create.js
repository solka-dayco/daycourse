<<<<<<< HEAD
// create.js — 코스 만들기 핵심 로직
import { initMap, searchPlaces, showPlaceMarker, clearSearchMarkers,
         renderCourseOnMap, initMyLocation, onNearbyResult, getDistance, formatDistance } from './map.js';
import { cropPhoto, blobToUrl, initCropButtons } from './photo.js';
import { createCourse, createReferenceCourse, updateCourse,
         getCurrentUser, uploadPhoto, fetchCourseById, logEvent } from './db.js';
import { initSidebar } from './sidebar.js';

initSidebar();
logEvent('course_create_start', 'course');

// bfcache
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

// ── 지역 세부 매핑 ────────────────────────────────────
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

// 체류 시간 선택지 (분)
const STAY_OPTIONS = [30,60,90,120,150,180,210,240,270,300];
const STAY_LABELS  = ['30분','1시간','1시간 30분','2시간','2시간 30분','3시간','3시간 30분','4시간','4시간 30분','5시간 이상'];

// 이동 시간 선택지 (분)
const TRAVEL_OPTIONS = [5,10,15,20,30,40,50,60,90,120];
const TRAVEL_LABELS  = ['5분','10분','15분','20분','30분','40분','50분','1시간','1시간 30분','2시간 이상'];

// ── 상태 ─────────────────────────────────────────────
let places = [];   // { name, lat, lng, category, address, phone, place_url, comment, photoBlob, photoUrl, stay_time, travel_time }
let currentUser = null;
let editCourseId = null;   // 수정 모드
let refParentId = null;    // 참조 모드
let refOriginalId = null;
let saving = false;

// ── URL 파라미터 파싱 ─────────────────────────────────
const params = new URLSearchParams(location.search);
const mode = params.get('mode');   // 'edit' | 'copy' | null
const targetId = params.get('id');

// ── 초기화 ───────────────────────────────────────────
(async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) { location.replace('login.html'); return; }

  await initMap('map');
  initMyLocation();
  onNearbyResult(handleNearbyResult);
  setupSearchUI();
  setupRegionUI();
  setupSaveBtn();
  initCropButtons();

  // 수정 / 참조 모드 데이터 로드
  if ((mode === 'edit' || mode === 'copy') && targetId) {
    await loadCourseForMode(mode, targetId);
  }
})();

// ── 지역 UI ──────────────────────────────────────────
function setupRegionUI() {
  const mainSel = document.getElementById('regionMain');
  const subSel  = document.getElementById('regionSub');

  mainSel.addEventListener('change', () => {
    const subs = REGION_SUB[mainSel.value] || [];
    if (subs.length) {
      subSel.innerHTML = `<option value="">세부 선택</option>` +
        subs.map(s => `<option>${s}</option>`).join('');
      subSel.style.display = '';
    } else {
      subSel.style.display = 'none';
    }
  });
}

// ── 검색 UI ──────────────────────────────────────────
let selectedPlace = null; // 현재 미리보기 중인 장소

function setupSearchUI() {
  const input   = document.getElementById('placeSearch');
  const btn     = document.getElementById('placeSearchBtn');
  const results = document.getElementById('searchResults');

  function doSearch() {
    const kw = input.value.trim();
    if (!kw) return;
    searchPlaces(kw, (data, status) => {
      if (status !== kakao.maps.services.Status.OK) {
        results.innerHTML = '<div style="padding:12px;font-size:13px;color:#aaa">검색 결과가 없습니다</div>';
        results.classList.add('open');
        return;
      }
      results.innerHTML = data.map(p => `
        <div class="search-result-item" data-id="${p.id}"
             data-name="${escAttr(p.place_name)}"
             data-y="${p.y}" data-x="${p.x}"
             data-cat="${escAttr(p.category_name||'')}"
             data-addr="${escAttr(p.address_name||'')}"
             data-phone="${escAttr(p.phone||'')}"
             data-url="${escAttr(p.place_url||'')}">
          <span class="result-name">${escHtml(p.place_name)}</span>
          <span class="result-address">${escHtml(p.address_name||'')}</span>
        </div>
      `).join('');
      results.classList.add('open');
    });
  }

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // 자동검색 (입력 후 0.4초)
  let autoTimer;
  input.addEventListener('input', () => {
    clearTimeout(autoTimer);
    if (input.value.trim().length < 2) { results.classList.remove('open'); return; }
    autoTimer = setTimeout(doSearch, 400);
  });

  results.addEventListener('click', e => {
    const item = e.target.closest('.search-result-item');
    if (!item) return;
    const place = {
      place_name: item.dataset.name,
      y: item.dataset.y,
      x: item.dataset.x,
      category_name: item.dataset.cat,
      address_name: item.dataset.addr,
      phone: item.dataset.phone,
      place_url: item.dataset.url,
    };
    showPreview(place);
    showPlaceMarker(place);
    results.classList.remove('open');
    input.value = '';
  });

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', e => {
    if (!e.target.closest('.map-search-row') && !e.target.closest('.search-results')) {
      results.classList.remove('open');
    }
  });

  // 내 위치
  document.getElementById('myLocationBtn').addEventListener('click', () => {
    initMyLocation();
  });
}

// 지도 클릭 근처 결과
function handleNearbyResult(data, lat, lng) {
  if (!data.length) {
    showPreviewByLatLng(null, lat, lng); // 주소로만 표시 가능 → 빈 장소
    return;
  }
  showPreview(data[0]);
  showPlaceMarker(data[0]);
}

// ── 미리보기 ─────────────────────────────────────────
function showPreview(place) {
  selectedPlace = place;
  document.getElementById('previewName').textContent = place.place_name || '';
  document.getElementById('previewCategory').textContent = place.category_name || '';
  document.getElementById('previewAddress').textContent = place.address_name || '';
  document.getElementById('previewPhone').textContent = place.phone || '';
  document.getElementById('placePreview').style.display = '';
}

function showPreviewByLatLng(place, lat, lng) {
  // 클릭 위치에 이름 없는 장소 미리보기 (위/경도만)
  if (!place) {
    selectedPlace = { place_name: `위치 (${lat.toFixed(4)},${lng.toFixed(4)})`, y: String(lat), x: String(lng) };
  } else {
    selectedPlace = place;
  }
  document.getElementById('previewName').textContent = selectedPlace.place_name;
  document.getElementById('previewCategory').textContent = '';
  document.getElementById('previewAddress').textContent = '';
  document.getElementById('previewPhone').textContent = '';
  document.getElementById('placePreview').style.display = '';
}

document.getElementById('previewClose').addEventListener('click', () => {
  document.getElementById('placePreview').style.display = 'none';
  selectedPlace = null;
  clearSearchMarkers();
});

document.getElementById('previewAddBtn').addEventListener('click', () => {
  if (!selectedPlace) return;
  const placeName = selectedPlace.place_name; // null 처리 전에 저장
  addPlace(selectedPlace);
  document.getElementById('placePreview').style.display = 'none';
  selectedPlace = null;
  clearSearchMarkers();
  logEvent('place_add', 'course', null, { place_name: placeName });
});

// ── 장소 추가 ─────────────────────────────────────────
function addPlace(p) {
  places.push({
    name:      p.place_name || '',
    lat:       parseFloat(p.y),
    lng:       parseFloat(p.x),
    category:  p.category_name || '',
    address:   p.address_name || '',
    phone:     p.phone || '',
    place_url: p.place_url || '',
    comment:   '',
    photoBlob: null,
    photoUrl:  null,
    stay_time:   null,
    travel_time: null,
  });
  renderPlaceList();
  renderCourseOnMap(places);
}

// ── 렌더 ─────────────────────────────────────────────
let sortableInstance = null;

function renderPlaceList() {
  const list  = document.getElementById('placeList');
  const empty = document.getElementById('placeListEmpty');
  const count = document.getElementById('placeCount');

  count.textContent = `${places.length}곳`;
  empty.style.display = places.length ? 'none' : '';

  list.innerHTML = '';

  places.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'place-item';
    item.dataset.index = i;

    // 이전 장소와의 거리
    let distText = '';
    if (i > 0) {
      const prev = places[i - 1];
      const d = getDistance(prev.lat, prev.lng, p.lat, p.lng);
      distText = formatDistance(d);
    }

    item.innerHTML = `
      <div class="place-item-main">
        <span class="place-drag-handle">⠿</span>
        <div class="place-num">${i + 1}</div>
        <div class="place-info">
          <div class="place-item-name">${escHtml(p.name)}</div>
          <div class="place-item-sub">${escHtml(p.category)}${p.address ? ' · ' + p.address : ''}</div>
        </div>
        <div class="place-photo-slot" data-index="${i}">
          ${p.photoBlob
            ? `<img src="${blobToUrl(p.photoBlob)}" alt="사진"/>`
            : p.photoUrl
              ? `<img src="${p.photoUrl}" alt="사진"/>`
              : '📷'}
          <input type="file" accept="image/*" class="photo-file-input" data-index="${i}"/>
        </div>
        <button class="place-delete-btn" data-index="${i}">✕</button>
      </div>
      <div class="place-comment-wrap">
        <input type="text" class="place-comment-input" placeholder="한줄평 (선택)"
          value="${escAttr(p.comment)}" data-index="${i}" maxlength="50"/>
      </div>
      <div class="place-time-row">
        <button class="time-btn ${p.stay_time ? 'set' : ''}" data-action="stay" data-index="${i}">
          🕐 ${p.stay_time ? STAY_LABELS[STAY_OPTIONS.indexOf(p.stay_time)] || p.stay_time + '분' : '체류 시간 *'}
        </button>
      </div>
      ${i > 0 ? `
      <div class="place-travel-row">
        <div class="travel-line"></div>
        <button class="travel-time-btn ${p.travel_time ? 'set' : ''}" data-action="travel" data-index="${i}">
          ${distText ? distText + ' · ' : ''}이동 ${p.travel_time ? TRAVEL_LABELS[TRAVEL_OPTIONS.indexOf(p.travel_time)] || p.travel_time + '분' : '시간 *'}
        </button>
      </div>` : ''}
    `;
    list.appendChild(item);
  });

  // 삭제 버튼
  list.querySelectorAll('.place-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      places.splice(idx, 1);
      renderPlaceList();
      renderCourseOnMap(places);
    });
  });

  // 한줄평 입력
  list.querySelectorAll('.place-comment-input').forEach(input => {
    input.addEventListener('input', () => {
      places[parseInt(input.dataset.index)].comment = input.value;
    });
  });

  // 체류/이동 시간 버튼
  list.querySelectorAll('[data-action="stay"], [data-action="travel"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx    = parseInt(btn.dataset.index);
      const action = btn.dataset.action;
      openTimeModal(action, idx);
    });
  });

  // 사진 업로드
  list.querySelectorAll('.photo-file-input').forEach(input => {
    input.addEventListener('change', async () => {
      const idx  = parseInt(input.dataset.index);
      const file = input.files[0];
      if (!file) return;
      try {
        const blob = await cropPhoto(file);
        places[idx].photoBlob = blob;
        places[idx].photoUrl  = null;
        renderPlaceList();
      } catch (e) {
        if (e.message !== 'cancelled') console.error(e);
      }
    });
  });

  // SortableJS 드래그 정렬
  if (window.Sortable) {
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = Sortable.create(list, {
      handle: '.place-drag-handle',
      animation: 150,
      onEnd(e) {
        const moved = places.splice(e.oldIndex, 1)[0];
        // 순서 변경 시 첫 번째 장소 travel_time 무조건 null
        places.splice(e.newIndex, 0, moved);
        places.forEach((p, i) => { if (i === 0) p.travel_time = null; });
        renderPlaceList();
        renderCourseOnMap(places);
      },
    });
  }
}

// ── 시간 선택 모달 ────────────────────────────────────
function openTimeModal(action, placeIdx) {
  const overlay = document.getElementById('timeModalOverlay');
  const title   = document.getElementById('timeModalTitle');
  const chips   = document.getElementById('timeModalChips');

  const isStay = action === 'stay';
  title.textContent = isStay ? '체류 시간 선택' : '이동 시간 선택';
  const options = isStay ? STAY_OPTIONS : TRAVEL_OPTIONS;
  const labels  = isStay ? STAY_LABELS  : TRAVEL_LABELS;
  const current = isStay ? places[placeIdx].stay_time : places[placeIdx].travel_time;

  chips.innerHTML = options.map((v, i) => `
    <button class="time-modal-chip ${current === v ? 'selected' : ''}" data-val="${v}">
      ${labels[i]}
    </button>
  `).join('');

  chips.querySelectorAll('.time-modal-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = parseInt(chip.dataset.val);
      if (isStay) places[placeIdx].stay_time = val;
      else        places[placeIdx].travel_time = val;
      overlay.style.display = 'none';
      renderPlaceList();
    });
  });

  overlay.style.display = 'flex';
  document.getElementById('timeModalClose').onclick = () => { overlay.style.display = 'none'; };
}

// ── 저장 버튼 ─────────────────────────────────────────
function setupSaveBtn() {
  document.getElementById('saveBtn').addEventListener('click', saveCourse);
}

async function saveCourse() {
  if (saving) return;

  const name       = document.getElementById('courseName').value.trim();
  const desc       = document.getElementById('courseDesc').value.trim();
  const regionMain = document.getElementById('regionMain').value;
  const regionSub  = document.getElementById('regionSub').value;

  // 유효성
  if (!name) { showToast('코스 이름을 입력해주세요'); return; }
  if (!regionMain) { showToast('지역 태그를 선택해주세요'); return; }
  if (places.length < 2) { showToast('장소를 2개 이상 추가해주세요'); return; }

  // 체류 시간 필수 검사
  const missingStay = places.findIndex(p => !p.stay_time);
  if (missingStay !== -1) { showToast(`${missingStay + 1}번 장소의 체류 시간을 선택해주세요`); return; }

  // 이동 시간 필수 검사 (2번째 장소부터)
  const missingTravel = places.slice(1).findIndex(p => !p.travel_time);
  if (missingTravel !== -1) { showToast(`${missingTravel + 2}번 장소의 이동 시간을 선택해주세요`); return; }

  saving = true;
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = '저장 중…';

  try {
    // 사진 업로드
    const tempId = crypto.randomUUID(); // 저장 전 임시 경로 ID
    const placeRows = await Promise.all(places.map(async (p, i) => {
      let photoUrl = p.photoUrl || null;
      if (p.photoBlob) {
        const path = `${currentUser.id}/${editCourseId || tempId}/place${i}.webp`;
        photoUrl = await uploadPhoto(p.photoBlob, path);
      }
      return {
        order_index: i,
        name:        p.name,
        lat:         p.lat,
        lng:         p.lng,
        category:    p.category || null,
        address:     p.address  || null,
        phone:       p.phone    || null,
        place_url:   p.place_url|| null,
        comment:     p.comment  || null,
        photo_url:   photoUrl,
        stay_time:   p.stay_time,
        travel_time: i === 0 ? null : p.travel_time,
      };
    }));

    // 총 소요시간 계산
    const totalStay   = places.reduce((s, p) => s + (p.stay_time || 0), 0);
    const totalTravel = places.slice(1).reduce((s, p) => s + (p.travel_time || 0), 0);
    const totalTime   = totalStay + totalTravel;

    const courseData = {
      name,
      description:  desc || null,
      region_main:  regionMain,
      region_sub:   regionSub || '',
      total_time:   totalTime,
      author_id:    currentUser.id,
      author_nickname: currentUser.nickname,
    };

    let courseId;
    if (mode === 'edit' && editCourseId) {
      await updateCourse(editCourseId, courseData, placeRows);
      courseId = editCourseId;
    } else if (mode === 'copy' && refParentId) {
      // 참조 정보 첨부
      courseData.parent_course_id       = refParentId;
      courseData.parent_author_nickname = params.get('pnick') || '';
      courseData.parent_course_name     = params.get('pname') || '';
      courseData.original_course_id     = refOriginalId || refParentId;
      courseData.original_author_nickname = params.get('onick') || courseData.parent_author_nickname;
      courseData.original_course_name   = params.get('oname') || courseData.parent_course_name;
      courseId = await createReferenceCourse(courseData, placeRows, refParentId);
    } else {
      courseId = await createCourse(courseData, placeRows);
    }

    logEvent('course_create_complete', 'course', courseId, { place_count: places.length, total_time: totalTime });
    location.href = `course.html?id=${courseId}`;
  } catch (e) {
    console.error('저장 오류:', e);
    showToast('저장 중 오류가 발생했습니다');
    saving = false;
    btn.disabled = false;
    btn.textContent = '저장';
  }
}

// ── 수정/참조 모드 데이터 로드 ───────────────────────
async function loadCourseForMode(modeType, id) {
  try {
    const course = await fetchCourseById(id);
    if (!course) return;

    if (modeType === 'edit') {
      // 권한 체크
      if (course.author_id !== currentUser.id) { location.href = 'main.html'; return; }
      editCourseId = id;
      document.getElementById('courseName').value = course.name || '';
      document.getElementById('courseDesc').value  = course.description || '';
      // 지역
      document.getElementById('regionMain').value = course.region_main || '';
      document.getElementById('regionMain').dispatchEvent(new Event('change'));
      setTimeout(() => {
        document.getElementById('regionSub').value = course.region_sub || '';
      }, 50);
    } else {
      // copy — 참조 정보 저장
      refParentId    = id;
      refOriginalId  = course.original_course_id || id;
    }

    // 장소 로드 (copy: 사진/한줄평 제외)
    const sorted = (course.course_places || []).sort((a,b) => a.order_index - b.order_index);
    places = sorted.map(p => ({
      name:       p.name,
      lat:        p.lat,
      lng:        p.lng,
      category:   p.category  || '',
      address:    p.address   || '',
      phone:      p.phone     || '',
      place_url:  p.place_url || '',
      comment:    modeType === 'edit' ? (p.comment || '') : '',
      photoBlob:  null,
      photoUrl:   modeType === 'edit' ? (p.photo_url || null) : null,
      stay_time:  p.stay_time   || null,
      travel_time:p.travel_time || null,
    }));

    renderPlaceList();
    renderCourseOnMap(places);
  } catch (e) {
    console.error('코스 로드 오류:', e);
  }
}

// ── 유틸 ─────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(str) {
  if (!str) return '';
  return str.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
=======
// ── create.js ────────────────────────────────────
// 담당: 코스 목록 관리, 드래그 순서, Firebase 저장/불러오기/삭제

import { db } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { drawPolyline, renderCourseMarkers } from './map.js';
import { getPhotoData } from './photo.js';

export let coursePlaces = [];

export function initCourse() {
  window.onPlaceAdd = function (place) {
    coursePlaces.push({
      name: place.place_name,
      lat: place.y,
      lng: place.x
    });
    addToCourseList(place);
    drawPolyline(coursePlaces);
  };

  document.getElementById('save-btn').addEventListener('click', saveCourse);

  Sortable.create(document.getElementById('course-list'), {
    animation: 150,
    handle: '.drag-handle',
    onEnd: updateNumbers
  });
}

function addToCourseList(place) {
  const list = document.getElementById('course-list');
  const number = list.children.length + 1;

  const li = document.createElement('li');
  li.dataset.index = number - 1;
  li.innerHTML = `
    <span class="course-number">${number}</span>
    <span>${place.place_name}</span>
    <span class="drag-handle">☰</span>
  `;
  list.appendChild(li);
  updateNumbers();
}

function updateNumbers() {
  const items = document.querySelectorAll('#course-list li');
  const reordered = [];

  items.forEach(function (item, index) {
    item.querySelector('.course-number').textContent = index + 1;
    const originalIndex = parseInt(item.dataset.index);
    reordered.push(coursePlaces[originalIndex]);
    item.dataset.index = index;
  });

  coursePlaces = reordered;
  drawPolyline(coursePlaces);
}

function saveCourse() {
  const courseName = document.getElementById('course-name').value.trim();
  if (!courseName) { alert('코스 이름을 입력해주세요.'); return; }
  if (coursePlaces.length === 0) { alert('장소를 1개 이상 추가해주세요.'); return; }

  const saveBtn = document.getElementById('save-btn');
  saveBtn.textContent = '저장 중...';
  saveBtn.disabled = true;

  const courseData = {
    name: courseName,
    places: coursePlaces,
    photos: getPhotoData(),
    likes: 0,
    comments: 0,
    createdAt: new Date().toLocaleDateString('ko-KR'),
    authorId: localStorage.getItem('userId') || null,
    authorNickname: localStorage.getItem('nickname') || '익명'
  };

  addDoc(collection(db, 'courses'), courseData).then(function () {
    document.getElementById('course-name').value = '';
    saveBtn.textContent = '저장';
    saveBtn.disabled = false;
    alert('코스가 저장됐습니다! 🎉');
  }).catch(function (error) {
    console.error('저장 오류:', error);
    alert('저장 중 오류가 발생했습니다.');
    saveBtn.textContent = '저장';
    saveBtn.disabled = false;
  });
}

export function renderSavedList() {
  const list = document.getElementById('saved-list');
  list.innerHTML = '<li style="color:#aaa; font-size:13px;">불러오는 중...</li>';

  getDocs(collection(db, 'courses')).then(function (snapshot) {
    if (snapshot.empty) {
      list.innerHTML = '<li style="color:#aaa; font-size:13px;">저장된 코스가 없습니다.</li>';
      return;
    }

    list.innerHTML = '';

    snapshot.forEach(function (docSnap) {
      const course = docSnap.data();
      const id = docSnap.id;

      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong style="cursor:pointer; color:#ff4e6a;" class="load-course" data-id="${id}">${course.name}</strong>
          <span style="font-size:12px; color:#aaa; margin-left:8px;">${course.createdAt}</span>
          <div style="font-size:12px; color:#888; margin-top:4px;">
            ${course.places.map(p => p.name).join(' → ')}
          </div>
        </div>
        <button class="delete-btn" data-id="${id}">🗑</button>
      `;
      list.appendChild(li);
    });

    document.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteCourse(this.dataset.id); });
    });

    document.querySelectorAll('.load-course').forEach(function (btn) {
      btn.addEventListener('click', function () { loadCourse(this.dataset.id); });
    });

  }).catch(function (error) {
    console.error('불러오기 오류:', error);
    list.innerHTML = '<li style="color:#aaa; font-size:13px;">불러오기 실패. 새로고침 해주세요.</li>';
  });
}

function deleteCourse(id) {
  if (!confirm('이 코스를 삭제할까요?')) return;

  deleteDoc(doc(db, 'courses', id)).then(function () {
    renderSavedList();
  }).catch(function (error) {
    console.error('삭제 오류:', error);
    alert('삭제 중 오류가 발생했습니다.');
  });
}

function loadCourse(id) {
  getDoc(doc(db, 'courses', id)).then(function (docSnap) {
    if (!docSnap.exists()) return;

    const course = docSnap.data();
    document.getElementById('course-list').innerHTML = '';
    coursePlaces = course.places;

    renderCourseMarkers(coursePlaces);
    drawPolyline(coursePlaces);

    coursePlaces.forEach(function (place, index) {
      const list = document.getElementById('course-list');
      const li = document.createElement('li');
      li.dataset.index = index;
      li.innerHTML = `
        <span class="course-number">${index + 1}</span>
        <span>${place.name}</span>
        <span class="drag-handle">☰</span>
      `;
      list.appendChild(li);
    });

  }).catch(function (error) {
    console.error('불러오기 오류:', error);
  });
}
>>>>>>> d3dafc5f7ca6945a22744ee97e673c4bede88adb
