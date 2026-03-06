// URL에서 코스 id 가져오기
// 예: course.html?id=1234567890
const params = new URLSearchParams(window.location.search);
const courseId = parseInt(params.get('id'));

// localStorage에서 해당 코스 찾기
const saved = JSON.parse(localStorage.getItem('courses') || '[]');
const course = saved.find(function(c) { return c.id === courseId; });

// 코스가 없으면 피드로 돌아가기
if (!course) {
  window.location.href = 'feed.html';
}

// 4분할 썸네일 표시
const thumbnail = document.getElementById('detail-thumbnail');
const photos = course.photos || [];
for (let i = 0; i < 4; i++) {
  if (photos[i]) {
    thumbnail.innerHTML += `<img src="${photos[i]}" alt="코스 사진">`;
  } else {
    thumbnail.innerHTML += `<div class="empty-slot">📍</div>`;
  }
}

// 제목 + 날짜 표시
document.getElementById('detail-title').textContent = course.name;
document.getElementById('detail-date').textContent = course.createdAt;

// 장소 목록 표시
const placeList = document.getElementById('detail-places');
course.places.forEach(function(place, index) {
  const li = document.createElement('li');
  li.innerHTML = `
    <span class="place-number">${index + 1}</span>
    <span>${place.name}</span>
  `;
  placeList.appendChild(li);
});

// 좋아요 / 댓글 수 표시
document.getElementById('like-count').textContent = course.likes || 0;
document.getElementById('comment-count').textContent = course.comments || 0;

// 삭제 버튼
document.getElementById('delete-btn').addEventListener('click', function() {

  // 삭제 확인
  if (!confirm('이 코스를 삭제할까요?')) return;

  // 해당 코스 제거
  const filtered = saved.filter(function(c) { return c.id !== courseId; });
  localStorage.setItem('courses', JSON.stringify(filtered));

  // 피드 페이지로 이동
  window.location.href = 'feed.html';
});

// 좋아요 버튼
document.getElementById('like-btn').addEventListener('click', function() {
  course.likes = (course.likes || 0) + 1;

  // localStorage 업데이트
  const index = saved.findIndex(function(c) { return c.id === courseId; });
  saved[index] = course;
  localStorage.setItem('courses', JSON.stringify(saved));

  document.getElementById('like-count').textContent = course.likes;
});

// 지도 + 동선 표시
kakao.maps.load(function() {
  const map = new kakao.maps.Map(document.getElementById('detail-map'), {
    center: new kakao.maps.LatLng(course.places[0].lat, course.places[0].lng),
    level: 5
  });

  const path = [];

  course.places.forEach(function(place) {
    const position = new kakao.maps.LatLng(place.lat, place.lng);

    // 마커 표시
    new kakao.maps.Marker({ position: position, map: map });

    // 말풍선 표시
    new kakao.maps.CustomOverlay({
      position: position,
      content: '<div class="label">' + place.name + '</div>',
      yAnchor: 2.5
    }).setMap(map);

    path.push(position);
  });

  // 동선 표시
  new kakao.maps.Polyline({
    path: path,
    strokeWeight: 4,
    strokeColor: '#ff4e6a',
    strokeOpacity: 0.8,
    strokeStyle: 'solid'
  }).setMap(map);
});