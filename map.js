// map.js — 카카오맵 유틸리티

let map = null;
let ps = null;
let searchMarkers = [];   // 검색 결과 마커 (단일)
let courseMarkers = [];   // 코스 넘버링 마커
let polyline = null;
let myLocationMarker = null;
let myLat = null;
let myLng = null;

// ── 초기화 ───────────────────────────────────────────
export function initMap(containerId = 'map') {
  return new Promise(resolve => {
    kakao.maps.load(() => {
      const container = document.getElementById(containerId);
      const options = {
        center: new kakao.maps.LatLng(37.5665, 126.9780),
        level: 5,
      };
      map = new kakao.maps.Map(container, options);
      ps = new kakao.maps.services.Places();

      kakao.maps.event.addListener(map, 'click', e => {
        searchNearby(e.latLng.getLat(), e.latLng.getLng());
      });

      resolve(map);
    });
  });
}

// ── 키워드 검색 ───────────────────────────────────────
export function searchPlaces(keyword, callback) {
  if (!ps) return;
  const options = {};
  if (myLat && myLng) {
    options.location = new kakao.maps.LatLng(myLat, myLng);
    options.sort = kakao.maps.services.SortBy.DISTANCE;
  }
  ps.keywordSearch(keyword, callback, options);
}

// ── 반경 30m 카테고리 검색 (지도 클릭) ──────────────
const NEARBY_CATEGORIES = ['FD6','CE7','AT4','CT1'];
let nearbyCallbacks = [];

export function onNearbyResult(callback) {
  nearbyCallbacks.push(callback);
}

function searchNearby(lat, lng) {
  if (!ps) return;
  let results = [];
  let done = 0;

  NEARBY_CATEGORIES.forEach(cat => {
    ps.categorySearch(cat, (data, status) => {
      if (status === kakao.maps.services.Status.OK) results.push(...data);
      done++;
      if (done === NEARBY_CATEGORIES.length) {
        const near = results.filter(p => {
          const d = getDistance(lat, lng, parseFloat(p.y), parseFloat(p.x));
          return d <= 30;
        });
        nearbyCallbacks.forEach(cb => cb(near, lat, lng));
      }
    }, {
      location: new kakao.maps.LatLng(lat, lng),
      radius: 30,
      sort: kakao.maps.services.SortBy.DISTANCE,
    });
  });
}

// ── 검색 마커 (미리보기용 단일 마커) ─────────────────
export function showPlaceMarker(place) {
  clearSearchMarkers();
  const pos = new kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x));

  const marker = new kakao.maps.Marker({ map, position: pos });
  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: pos,
    content: `<div style="
      background:white; border:2px solid #ff4e6a; border-radius:8px;
      padding:5px 10px; font-size:12px; font-weight:700; color:#222;
      box-shadow:0 2px 6px rgba(0,0,0,0.15); white-space:nowrap;
      transform:translateY(-100%) translateY(-12px);
    ">${place.place_name}</div>`,
    yAnchor: 0,
  });

  searchMarkers.push({ marker, overlay });
  map.setCenter(pos);
  map.setLevel(3);
}

export function clearSearchMarkers() {
  searchMarkers.forEach(({ marker, overlay }) => {
    marker.setMap(null);
    overlay.setMap(null);
  });
  searchMarkers = [];
}

// ── 코스 Polyline + 넘버링 마커 ─────────────────────
export function renderCourseOnMap(places) {
  // 기존 코스 마커 정리
  if (polyline) { polyline.setMap(null); polyline = null; }
  courseMarkers.forEach(({ marker, overlay }) => {
    if (marker && marker.setMap) marker.setMap(null);
    if (overlay && overlay.setMap) overlay.setMap(null);
  });
  courseMarkers = [];

  if (!places.length) return;

  const path = places.map(p => new kakao.maps.LatLng(p.lat, p.lng));

  // Polyline
  polyline = new kakao.maps.Polyline({
    map,
    path,
    strokeWeight: 3,
    strokeColor: '#ff4e6a',
    strokeOpacity: 0.8,
    strokeStyle: 'solid',
  });

  // 넘버링 마커 (실제 Marker + CustomOverlay)
  places.forEach((p, i) => {
    const pos = new kakao.maps.LatLng(p.lat, p.lng);

    // 더미 마커 (지도에 추가 안 함 — 오버레이만 사용)
    const marker = { setMap: () => {} };

    // 넘버링 오버레이
    const overlay = new kakao.maps.CustomOverlay({
      map,
      position: pos,
      content: `<div style="
        width:26px; height:26px; border-radius:50%;
        background:#ff4e6a; color:white;
        font-size:12px; font-weight:700;
        line-height:26px; text-align:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        border:2px solid white;
        margin-left:-13px; margin-top:-13px;
      ">${i + 1}</div>`,
      xAnchor: 0,
      yAnchor: 0,
      zIndex: 3,
    });

    courseMarkers.push({ marker, overlay });
  });

  // 지도 범위 조정
  const bounds = new kakao.maps.LatLngBounds();
  path.forEach(p => bounds.extend(p));
  map.setBounds(bounds, 40);
}

// ── 내 위치 ───────────────────────────────────────────
export function initMyLocation(onSuccess) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      const latlng = new kakao.maps.LatLng(myLat, myLng);

      if (myLocationMarker) myLocationMarker.setMap(null);
      myLocationMarker = new kakao.maps.Marker({
        map,
        position: latlng,
        image: new kakao.maps.MarkerImage(
          'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
          new kakao.maps.Size(24, 35)
        ),
      });
      map.setCenter(latlng);
      if (onSuccess) onSuccess(myLat, myLng);
    },
    () => {
      alert('위치 권한이 필요합니다.\n설정 > 개인정보 보호 > 위치 서비스에서 허용해주세요.');
    }
  );
}

// ── Haversine 직선거리 (m) ───────────────────────────
export function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}