// plan-detail.js — 계획 코스 상세 (본인만 열람)
import { getCurrentUser, fetchCourseById, logEvent, publishPlanCourse } from './db.js';
import { initSidebar } from './sidebar.js';
import { initIcons, ICONS } from './icons.js';
import { createMap, addCourseMarker, drawCoursePolyline, fitMapToBounds } from './map.js';
// ── 인증 체크 ─────────────────────────────────────────────
const currentUser = await getCurrentUser();
if (!currentUser) {
  location.href = '/login?redirect=' + encodeURIComponent(location.href);
}

await initSidebar();
initIcons();
document.getElementById('editBtn').innerHTML = `${ICONS.pencil(13)} 수정`;
document.getElementById('publishBtn').textContent = '게시하기';

// ── URL 파라미터 ──────────────────────────────────────────
const params   = new URLSearchParams(location.search);
const courseId = params.get('id');
if (!courseId) { location.href = '/plan'; }

// ── 코스 로드 ─────────────────────────────────────────────
let course;
try {
  course = await fetchCourseById(courseId);
} catch (_) {
  location.href = '/plan';
}

// 본인 확인
if (!course || course.author_id !== currentUser.id || !course.is_plan) {
  location.href = '/plan';
}

logEvent('page_view', 'page', null, { page: 'plan_detail', course_id: courseId });

// ── 유틸 ──────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatMinutes(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h ? `${h}시간 ` : ''}${m}분` : `${h}시간`;
}
function haversineDist(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
function formatDist(m) {
  if (!Number.isFinite(m)) return '';
  return m < 1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(1)}km`;
}

// ── 렌더 ──────────────────────────────────────────────────
const places = (course.course_places || []).sort((a, b) => a.order_index - b.order_index);

// 헤더
const region = [course.region_main, course.region_sub].filter(Boolean).join(' · ');
document.getElementById('courseRegion').textContent = region;
document.getElementById('courseTime').textContent = course.total_time ? formatMinutes(course.total_time) : '';
document.getElementById('courseName').textContent   = course.name || '';
document.getElementById('courseDesc').textContent   = course.description || '';
document.title = `${course.name} — 데이코스`;
const dateStr = course.created_at
  ? new Date(course.created_at).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' })
  : '';
document.getElementById('courseDate').textContent = dateStr ? `저장일 ${dateStr}` : '';

// 타임라인 (사진 없음)
const timeline = document.getElementById('timeline');
places.forEach((p, i) => {
  if (i > 0) {
    const dist = haversineDist(places[i-1], p);
    const travelEl = document.createElement('div');
    travelEl.className = 'tl-travel';
    travelEl.innerHTML = `
      <div class="tl-travel-line-area">
        <span class="tl-travel-dist">${formatDist(dist)}</span>
      </div>
      ${p.travel_time ? `<span class="tl-travel-time">이동 ${formatMinutes(p.travel_time)}</span>` : ''}
    `;
    timeline.appendChild(travelEl);
  }

  const item = document.createElement('div');
  item.className = 'tl-item';
  item.innerHTML = `
    <div class="tl-left">
      <div class="tl-line"></div>
      <div class="tl-num">${i + 1}</div>
    </div>
    <div class="tl-right">
      <div class="tl-place-row">
        <div class="tl-place-info">
          ${p.place_url
            ? `<a class="tl-name tl-name-link" href="${escHtml(p.place_url)}" target="_blank" rel="noopener">${escHtml(p.name)}</a>`
            : `<div class="tl-name">${escHtml(p.name)}</div>`}
          <div class="tl-sub">${escHtml(p.category||'')}${p.address ? ` · ${escHtml(p.address)}` : ''}</div>
          ${p.stay_time ? `<div class="tl-duration">${formatMinutes(p.stay_time)}</div>` : ''}
        </div>
      </div>
      ${p.comment ? `<div class="tl-comment">${escHtml(p.comment)}</div>` : ''}
    </div>
  `;
  timeline.appendChild(item);
});

document.getElementById('timelineSummary').innerHTML = `
  <span>총 <strong>${places.length}개</strong> 장소</span>
  ${course.total_time ? `<span>총 소요 <strong>${formatMinutes(course.total_time)}</strong></span>` : ''}
`;

// 지도
kakao.maps.load(async () => {
  const mapEl = document.getElementById('detailMap');
  const center = places[0] || { lat: 37.5665, lng: 126.978 };
  const map = await createMap('detailMap', { lat: center.lat, lng: center.lng, level: 5 });
  if (!map) return;
  places.forEach((p, i) => addCourseMarker(map, p, i + 1));
  if (places.length > 1) drawCoursePolyline(map, places);
  if (places.length) fitMapToBounds(map, places);

  document.getElementById('myLocationBtn')?.addEventListener('click', async () => {
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej
        )
      );
      map.setCenter(new kakao.maps.LatLng(pos.lat, pos.lng));
    } catch (_) {}
  });
});

// 숨김 해제
document.getElementById('spinner').style.display = 'none';
document.getElementById('detailContent').style.display = '';

// ── 버튼 ──────────────────────────────────────────────────
document.getElementById('editBtn')?.addEventListener('click', () => {
  location.href = `/create?mode=edit&id=${courseId}`;
});

document.getElementById('publishBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('publishBtn');
  btn.style.pointerEvents = 'none';
  btn.textContent = '게시 중…';
  try {
    const courseData = {
      name: course.name,
      description: course.description || null,
      region_main: course.region_main,
      region_sub: course.region_sub || '',
      total_time: course.total_time || null,
      thumbnail_url: course.thumbnail_url || null,
      author_id: currentUser.id,
      author_nickname: currentUser.nickname,
      is_plan: false,
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
    await publishPlanCourse(courseId, courseData, placeRows);
    location.href = `/course?id=${courseId}`;
  } catch (e) {
    console.error(e);
    const toast = document.getElementById('toast');
    if (toast) { toast.textContent = '게시 실패: ' + (e?.message || '알 수 없는 오류'); toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
    btn.style.pointerEvents = '';
    btn.textContent = '게시하기';
  }
});