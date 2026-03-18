// map.js — 카카오맵 공통 유틸리티 (v3)
// searchMarkers(검색용)와 courseMarkers(코스용) 배열 분리 관리

/**
 * 카카오맵 SDK 로드 후 map 인스턴스 생성
 * @param {string} containerId
 * @param {object} options - { lat, lng, level }
 * @returns {Promise<kakao.maps.Map>}
 */
export function createMap(containerId, { lat = 37.5665, lng = 126.9780, level = 5 } = {}) {
  // kakao.maps.load() 는 호출부(create.js)에서 이미 완료된 상태로 진입하므로
  // 중첩 호출 없이 바로 Map 인스턴스 생성 — 모바일 호환성 확보
  const container = document.getElementById(containerId);
  const map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(lat, lng),
    level,
  });
  return Promise.resolve(map);
}

// ── 마커 관리 ─────────────────────────────────────────────

/** 검색 결과 마커 배열 */
let searchMarkers = [];

/** 코스 장소 마커 배열 */
let courseMarkers = [];

/** 검색 마커 전체 제거 */
export function clearSearchMarkers() {
  searchMarkers.forEach(({ marker, overlay, tooltip }) => {
    marker?.setMap(null);
    overlay?.setMap(null);
    tooltip?.setMap(null);
  });
  searchMarkers = [];
}

/** 코스 마커 전체 제거 */
export function clearCourseMarkers() {
  courseMarkers.forEach(({ marker, overlay, polyline }) => {
    marker?.setMap(null);
    overlay?.setMap(null);
    polyline?.setMap(null);
  });
  courseMarkers = [];
}

/**
 * 검색 결과 마커 추가 — 클릭 시 툴팁 표시, 툴팁 내 추가 버튼으로 코스 저장
 * @param {kakao.maps.Map} map
 * @param {object} place - { lat, lng, name, address? }
 * @param {function} onAdd - 추가 버튼 클릭 시 호출
 */
export function addSearchMarker(map, place, onAdd) {
  const pos = new kakao.maps.LatLng(place.lat, place.lng);
  const marker = new kakao.maps.Marker({ position: pos, map });

  // 툴팁 오버레이 생성
  const tooltipEl = document.createElement('div');
  tooltipEl.style.cssText = `
    background: #fff;
    border: 1.5px solid #e8648a;
    border-radius: 10px;
    padding: 10px 12px;
    min-width: 160px;
    max-width: 220px;
    box-shadow: 0 4px 12px rgba(0,0,0,.15);
    font-family: inherit;
    position: relative;
    margin-bottom: 8px;
    cursor: default;
  `;
  const address = place.road_address_name || place.address_name || place.address || '';
  tooltipEl.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:#222;margin-bottom:4px;word-break:keep-all">${place.name}</div>
    ${address ? `<div style="font-size:11px;color:#888;margin-bottom:8px;word-break:keep-all">${address}</div>` : ''}
    <button style="
      width:100%;padding:7px 0;
      background:#e8648a;color:#fff;
      border:none;border-radius:7px;
      font-size:13px;font-weight:700;cursor:pointer;
    ">코스에 추가</button>
    <div style="
      position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
      width:12px;height:12px;background:#fff;
      border-right:1.5px solid #e8648a;border-bottom:1.5px solid #e8648a;
      transform:translateX(-50%) rotate(45deg);
    "></div>
  `;

  const tooltip = new kakao.maps.CustomOverlay({
    position: pos,
    content: tooltipEl,
    map: null,
    yAnchor: 1.25,
    xAnchor: 0.5,
    zIndex: 10,
  });

  // 추가 버튼 이벤트
  tooltipEl.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation();
    tooltip.setMap(null);
    onAdd(place);
  });

  // 마커 클릭 → 툴팁 토글
  kakao.maps.event.addListener(marker, 'click', () => {
    // 같은 마커 재클릭 시 닫기
    if (tooltip.getMap()) {
      tooltip.setMap(null);
    } else {
      // 다른 툴팁 모두 닫기
      searchMarkers.forEach(m => m.tooltip?.setMap(null));
      tooltip.setMap(map);
    }
  });

  // 지도 클릭 시 툴팁 닫기
  kakao.maps.event.addListener(map, 'click', () => {
    tooltip.setMap(null);
  });

  searchMarkers.push({ marker, overlay: null, tooltip });
  return marker;
}

/**
 * 코스 장소 번호 마커 추가 (커스텀 오버레이)
 * @param {kakao.maps.Map} map
 * @param {object} place - { lat, lng, name }
 * @param {number} index - 1부터 시작
 */
export function addCourseMarker(map, place, index) {
  const pos = new kakao.maps.LatLng(place.lat, place.lng);

  const content = document.createElement('div');
  content.style.cssText = `
    width: 28px; height: 28px;
    background: #e8648a; color: #fff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    box-shadow: 0 2px 8px rgba(232,100,138,.5);
    border: 2px solid #fff;
    cursor: default;
  `;
  content.textContent = index;

  const overlay = new kakao.maps.CustomOverlay({
    position: pos,
    content,
    map,
    yAnchor: 0.5,
    xAnchor: 0.5,
  });

  courseMarkers.push({ marker: null, overlay });
  return overlay;
}

/**
 * 코스 경로 폴리라인 그리기
 * @param {kakao.maps.Map} map
 * @param {Array<{lat, lng}>} places
 */
export function drawCoursePolyline(map, places) {
  if (places.length < 2) return null;

  const path = places.map(p => new kakao.maps.LatLng(p.lat, p.lng));
  const polyline = new kakao.maps.Polyline({
    path,
    strokeWeight: 3,
    strokeColor: '#e8648a',
    strokeOpacity: .65,
    strokeStyle: 'solid',
    map,
  });

  courseMarkers.push({ marker: null, overlay: null, polyline });
  return polyline;
}

/**
 * 지도를 주어진 장소들에 맞게 fitBounds
 * @param {kakao.maps.Map} map
 * @param {Array<{lat, lng}>} places
 */
export function fitMapToBounds(map, places) {
  if (!places.length) return;
  if (places.length === 1) {
    map.setCenter(new kakao.maps.LatLng(places[0].lat, places[0].lng));
    return;
  }
  const bounds = new kakao.maps.LatLngBounds();
  places.forEach(p => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
  map.setBounds(bounds);
}

/**
 * 장소 정보창 인포윈도우 생성
 * @param {kakao.maps.Map} map
 * @param {kakao.maps.Marker} marker
 * @param {string} content
 */
export function showInfoWindow(map, marker, content) {
  const infoWindow = new kakao.maps.InfoWindow({ content, zIndex: 10 });
  infoWindow.open(map, marker);
  return infoWindow;
}

/**
 * 키워드로 장소 검색 (카카오맵 Places API)
 * @param {string} keyword
 * @param {{ lat?, lng?, radius? }} locationOpts
 * @returns {Promise<Array>}
 */
export function searchPlaces(keyword, { lat, lng, radius = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const ps = new kakao.maps.services.Places();
    const options = {};
    if (lat && lng && radius > 0) {
      // 현위치 기준 거리순 (반경 제한 있을 때만)
      options.location = new kakao.maps.LatLng(lat, lng);
      options.radius = radius;
      options.sort   = kakao.maps.services.SortBy.DISTANCE;
    } else if (lat && lng) {
      // 현위치 기준 정렬만 (반경 제한 없음 — 전국 검색)
      options.location = new kakao.maps.LatLng(lat, lng);
      options.sort     = kakao.maps.services.SortBy.DISTANCE;
    }
    ps.keywordSearch(keyword, (results, status) => {
      if (status === kakao.maps.services.Status.OK) {
        resolve(results);
      } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
      } else {
        reject(new Error('카카오맵 검색 오류: ' + status));
      }
    }, options);
  });
}

/**
 * 주변 장소 카테고리 검색 (지도 클릭 시)
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius - 미터
 * @returns {Promise<Array>}
 */
export function searchNearby(lat, lng, radius = 50) {
  // 카카오 categorySearch는 한 번에 한 카테고리만 지원
  // 주요 카테고리 병렬 조회 후 거리순 합산
  const CATEGORIES = ['FD6','CE7','AT4','AD5','SW8','BK9','PO3','CT1','AG2'];
  const ps  = new kakao.maps.services.Places();
  const loc = new kakao.maps.LatLng(lat, lng);

  const searches = CATEGORIES.map(cat =>
    new Promise(resolve => {
      ps.categorySearch(cat, (results, status) => {
        resolve(status === kakao.maps.services.Status.OK ? results : []);
      }, { location: loc, radius, sort: kakao.maps.services.SortBy.DISTANCE });
    })
  );

  return Promise.all(searches).then(arrays => {
    const seen = new Map();
    arrays.flat().forEach(r => { if (!seen.has(r.id)) seen.set(r.id, r); });
    return [...seen.values()].sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
  });
}

/** 좌표 → 도로명/지번 주소 변환 */
export function coordsToAddress(lat, lng) {
  return new Promise((resolve) => {
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        const addr = result[0].road_address?.address_name
                  || result[0].address?.address_name
                  || '';
        resolve(addr);
      } else {
        resolve('');
      }
    });
  });
}

/**
 * 사용자 현재 위치 가져오기
 * @returns {Promise<{lat, lng}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation 미지원'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }
    );
  });
}