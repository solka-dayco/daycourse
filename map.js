// ── map.js ───────────────────────────────────────
// 담당: 카카오맵 초기화, 장소 검색, 마커, Polyline, 내 위치

// ── 상태 변수 ────────────────────────────────────
let map = null;
let ps = null;
let previewMarker = null;
let previewOverlay = null;
let myLocationOverlay = null;
let polyline = null;

export let activeMarkers = [];
export let activeOverlays = [];

// ── 지도 초기화 ──────────────────────────────────
export function initMap() {
  map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(37.5665, 126.9780),
    level: 5
  });

  ps = new kakao.maps.services.Places();

  initMyLocation();
  initSearch();
  initMapClick();

  return map;
}

// ── 내 위치 기능 ─────────────────────────────────
function initMyLocation() {
  const geoOptions = {
    enableHighAccuracy: false,
    timeout: 15000,
    maximumAge: 60000
  };

  function showMyLocation(pos) {
    const position = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
    if (myLocationOverlay) myLocationOverlay.setMap(null);
    myLocationOverlay = new kakao.maps.CustomOverlay({
      position: position,
      content: '<div style="width:14px; height:14px; background:#4a90e2; border:2px solid white; border-radius:50%; box-shadow:0 0 6px rgba(74,144,226,0.8);"></div>',
      yAnchor: 0.5
    });
    myLocationOverlay.setMap(map);
    map.setCenter(position);
  }

  function showLocationGuide() {
    const existing = document.getElementById('location-guide');
    if (existing) return;

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    let guideText = '';
    if (isIOS) guideText = '설정 → Safari → 위치 → 허용 후 새로고침';
    else if (isSamsung) guideText = '주소창 왼쪽 🔒 탭 → 위치 → 허용 후 새로고침';
    else if (isAndroid) guideText = '주소창 왼쪽 🔒 탭 → 권한 → 위치 → 허용 후 새로고침';
    else guideText = '주소창 왼쪽 🔒 아이콘 → 위치 → 허용 후 새로고침';

    const guide = document.createElement('div');
    guide.id = 'location-guide';
    guide.innerHTML = `
      <span>📍 위치 권한이 필요합니다.</span>
      <span class="location-guide-sub">${guideText}</span>
      <button onclick="document.getElementById('location-guide').remove()">✕</button>
    `;
    document.querySelector('.map-wrapper').appendChild(guide);
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(showMyLocation, function () {}, geoOptions);
  }

  document.getElementById('my-location-btn').addEventListener('click', function () {
    if (!navigator.geolocation) { showLocationGuide(); return; }
    const btn = document.getElementById('my-location-btn');
    btn.textContent = '⏳';
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      function (pos) { btn.textContent = '📍'; btn.disabled = false; showMyLocation(pos); },
      function () { btn.textContent = '📍'; btn.disabled = false; showLocationGuide(); },
      geoOptions
    );
  });
}

// ── 장소 검색 ────────────────────────────────────
function initSearch() {
  document.getElementById('search-btn').addEventListener('click', function () {
    const keyword = document.getElementById('search-input').value;
    if (!keyword) return;

    ps.keywordSearch(keyword, function (data, status) {
      if (status !== kakao.maps.services.Status.OK) return;
      const list = document.getElementById('search-result');
      list.innerHTML = '';

      data.forEach(function (place) {
        const li = document.createElement('li');
        li.textContent = place.place_name;
        li.addEventListener('click', function () {
          setPreviewMarker(place);
          list.innerHTML = '';
        });
        list.appendChild(li);
      });
    });
  });
}

// ── 지도 클릭 시 반경 30m 내 장소 검색 ──────────
function initMapClick() {
  kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
    const position = mouseEvent.latLng;
    const categories = ['FD6', 'CE7', 'AT4', 'CT1'];
    let allResults = [];
    let searchCount = 0;

    categories.forEach(function (category) {
      ps.categorySearch(category, function (data, status) {
        searchCount++;
        if (status === kakao.maps.services.Status.OK) {
          allResults = allResults.concat(data);
        }
        if (searchCount === categories.length) {
          if (allResults.length === 0) return;
          allResults.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));

          const list = document.getElementById('search-result');
          list.innerHTML = '';

          allResults.forEach(function (place) {
            const li = document.createElement('li');
            li.innerHTML = `
              <span>${place.place_name}</span>
              <span style="font-size:11px; color:#aaa; margin-left:6px;">${place.distance}m</span>
            `;
            li.addEventListener('click', function () {
              setPreviewMarker(place);
              list.innerHTML = '';
            });
            list.appendChild(li);
          });
        }
      }, { location: position, radius: 30, sort: kakao.maps.services.SortBy.DISTANCE });
    });
  });
}

// ── 미리보기 마커 + 장소 패널 표시 ──────────────
function setPreviewMarker(place) {
  if (previewMarker) previewMarker.setMap(null);
  if (previewOverlay) previewOverlay.setMap(null);

  const position = new kakao.maps.LatLng(place.y, place.x);
  previewMarker = new kakao.maps.Marker({ position, map });
  previewOverlay = new kakao.maps.CustomOverlay({
    position,
    content: '<div class="label">' + place.place_name + '</div>',
    yAnchor: 2.5
  });
  previewOverlay.setMap(map);
  map.setCenter(position);
  showPlacePreview(place);
}

function showPlacePreview(place) {
  document.getElementById('preview-name').textContent = place.place_name;
  document.getElementById('preview-category').textContent = '🏷 ' + (place.category_name || '');
  document.getElementById('preview-address').textContent = '📌 ' + (place.road_address_name || place.address_name || '');
  document.getElementById('preview-phone').textContent = place.phone ? '📞 ' + place.phone : '';

  const link = document.getElementById('preview-link');
  if (place.place_url) { link.href = place.place_url; link.style.display = 'inline-block'; }
  else { link.style.display = 'none'; }

  document.getElementById('place-preview').classList.remove('hidden');

  // 코스에 추가 버튼
  document.getElementById('add-btn').onclick = function () {
    if (window.onPlaceAdd) window.onPlaceAdd(place);
    if (previewMarker) previewMarker.setMap(null);
    if (previewOverlay) previewOverlay.setMap(null);
    document.getElementById('place-preview').classList.add('hidden');
  };
}

// ── Polyline 그리기 ──────────────────────────────
export function drawPolyline(coursePlaces) {
  if (polyline) polyline.setMap(null);
  if (coursePlaces.length < 2) return;

  const path = coursePlaces.map(p => new kakao.maps.LatLng(p.lat, p.lng));
  polyline = new kakao.maps.Polyline({
    path,
    strokeWeight: 4,
    strokeColor: '#ff4e6a',
    strokeOpacity: 0.8,
    strokeStyle: 'solid'
  });
  polyline.setMap(map);
}

// ── 코스 마커 표시 ───────────────────────────────
export function renderCourseMarkers(coursePlaces) {
  activeMarkers.forEach(m => m.setMap(null));
  activeOverlays.forEach(o => o.setMap(null));
  activeMarkers = [];
  activeOverlays = [];

  coursePlaces.forEach(function (place) {
    const position = new kakao.maps.LatLng(place.lat, place.lng);
    const marker = new kakao.maps.Marker({ position, map });
    activeMarkers.push(marker);

    const overlay = new kakao.maps.CustomOverlay({
      position,
      content: '<div class="label">' + place.name + '</div>',
      yAnchor: 2.5
    });
    overlay.setMap(map);
    activeOverlays.push(overlay);
  });

  if (coursePlaces.length > 0) {
    map.setCenter(new kakao.maps.LatLng(coursePlaces[0].lat, coursePlaces[0].lng));
  }
}
