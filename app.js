kakao.maps.load(function () {

  // 지도 생성
  const map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(37.5665, 126.9780),
    level: 5
  });

  // 장소 검색 객체 생성
  const ps = new kakao.maps.services.Places();

  // 미리보기 중인 장소 임시 저장
  let selectedPlace = null;

  // 미리보기용 마커/말풍선
  let previewMarker = null;
  let previewOverlay = null;

  // 확정된 장소 목록 (좌표 포함)
  let coursePlaces = [];

  // 현재 그려진 선
  let polyline = null;

  // 지도에 표시된 확정 마커/말풍선 목록 (코스 불러올 때 초기화용)
  let activeMarkers = [];
  let activeOverlays = [];

  // 검색 버튼 클릭
  document.getElementById('search-btn').addEventListener('click', function () {
    const keyword = document.getElementById('search-input').value;
    if (!keyword) return;

    ps.keywordSearch(keyword, function (data, status) {
      if (status === kakao.maps.services.Status.OK) {
        const list = document.getElementById('search-result');
        list.innerHTML = '';

        data.forEach(function (place) {
          const li = document.createElement('li');
          li.textContent = place.place_name;

          li.addEventListener('click', function () {
            selectedPlace = place;

            if (previewMarker) previewMarker.setMap(null);
            if (previewOverlay) previewOverlay.setMap(null);

            const position = new kakao.maps.LatLng(place.y, place.x);
            previewMarker = new kakao.maps.Marker({ position: position, map: map });
            previewOverlay = new kakao.maps.CustomOverlay({
              position: position,
              content: '<div class="label">' + place.place_name + '</div>',
              yAnchor: 2.5
            });
            previewOverlay.setMap(map);
            map.setCenter(position);

            document.getElementById('preview-name').textContent = place.place_name;
            document.getElementById('preview-address').textContent = '📌 ' + (place.road_address_name || place.address_name);
            document.getElementById('preview-category').textContent = '🏷 ' + place.category_name;
            document.getElementById('place-preview').classList.remove('hidden');

            list.innerHTML = '';
          });

          list.appendChild(li);
        });
      }
    });
  });

  // 코스에 추가 버튼 클릭
  document.getElementById('add-btn').addEventListener('click', function () {
    if (!selectedPlace) return;

    coursePlaces.push({
      name: selectedPlace.place_name,
      lat: selectedPlace.y,
      lng: selectedPlace.x
    });

    previewMarker = null;
    previewOverlay = null;

    addToCourseList(selectedPlace);
    drawPolyline();

    document.getElementById('place-preview').classList.add('hidden');
    selectedPlace = null;
  });

  // 코스 목록 UI에 장소 추가
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

  // 번호 재정렬 + coursePlaces 배열 순서 동기화
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
    drawPolyline();
  }

  // 마커끼리 선 연결
  function drawPolyline() {
    if (polyline) polyline.setMap(null);
    if (coursePlaces.length < 2) return;

    const path = coursePlaces.map(function (place) {
      return new kakao.maps.LatLng(place.lat, place.lng);
    });

    polyline = new kakao.maps.Polyline({
      path: path,
      strokeWeight: 4,
      strokeColor: '#ff4e6a',
      strokeOpacity: 0.8,
      strokeStyle: 'solid'
    });

    polyline.setMap(map);
  }

  // ── 저장 기능 ──────────────────────────────────────

  // 저장 버튼 클릭
  document.getElementById('save-btn').addEventListener('click', function () {
    const courseName = document.getElementById('course-name').value.trim();

    // 코스 이름 없으면 저장 안 함
    if (!courseName) {
      alert('코스 이름을 입력해주세요.');
      return;
    }

    // 장소가 없으면 저장 안 함
    if (coursePlaces.length === 0) {
      alert('장소를 1개 이상 추가해주세요.');
      return;
    }

    // 저장할 코스 데이터 구성
    const courseData = {
      id: Date.now(),           // 고유 ID (저장 시각 기준)
      name: courseName,
      places: coursePlaces,
      createdAt: new Date().toLocaleDateString('ko-KR')
    };

    // localStorage에서 기존 저장 목록 불러오기
    const existing = JSON.parse(localStorage.getItem('courses') || '[]');

    // 새 코스 추가
    existing.push(courseData);

    // 다시 저장
    localStorage.setItem('courses', JSON.stringify(existing));

    // 저장된 코스 목록 UI 갱신
    renderSavedList();

    // 입력창 초기화
    document.getElementById('course-name').value = '';

    alert('코스가 저장됐습니다! 🎉');
  });

  // 저장된 코스 목록을 화면에 표시하는 함수
  function renderSavedList() {
    const saved = JSON.parse(localStorage.getItem('courses') || '[]');
    const list = document.getElementById('saved-list');
    list.innerHTML = '';

    // 저장된 코스가 없으면 안내 문구 표시
    if (saved.length === 0) {
      list.innerHTML = '<li style="color:#aaa; font-size:13px;">저장된 코스가 없습니다.</li>';
      return;
    }

    saved.forEach(function (course) {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong style="cursor:pointer; color:#ff4e6a;" class="load-course" data-id="${course.id}">${course.name}</strong>
          <span style="font-size:12px; color:#aaa; margin-left:8px;">${course.createdAt}</span>
          <div style="font-size:12px; color:#888; margin-top:4px;">
            ${course.places.map(p => p.name).join(' → ')}
          </div>
        </div>
        <button class="delete-btn" data-id="${course.id}">🗑</button>
      `;
      list.appendChild(li);
    });

    // 삭제 버튼 이벤트 연결
    document.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteCourse(parseInt(this.dataset.id));
      });
    });

    document.querySelectorAll('.load-course').forEach(function (btn) {
      btn.addEventListener('click', function () {
        loadCourse(parseInt(this.dataset.id));
      });
    });
  }

  // 코스 삭제 함수
  function loadCourse(id) {
    const saved = JSON.parse(localStorage.getItem('courses') || '[]');
    const course = saved.find(function (c) { return c.id === id; });
    if (!course) return;

    // 기존 마커 + 말풍선 전부 제거
    activeMarkers.forEach(function (marker) { marker.setMap(null); });
    activeOverlays.forEach(function (overlay) { overlay.setMap(null); });
    activeMarkers = [];
    activeOverlays = [];

    // 기존 코스 목록 UI 초기화
    document.getElementById('course-list').innerHTML = '';

    // coursePlaces 배열 교체
    coursePlaces = course.places;

    // 마커 + 말풍선 + 코스 목록 UI 복원
    coursePlaces.forEach(function (place) {
      const position = new kakao.maps.LatLng(place.lat, place.lng);

      const marker = new kakao.maps.Marker({ position: position, map: map });
      activeMarkers.push(marker);

      const overlay = new kakao.maps.CustomOverlay({
        position: position,
        content: '<div class="label">' + place.name + '</div>',
        yAnchor: 2.5
      });
      overlay.setMap(map);
      activeOverlays.push(overlay);

      const list = document.getElementById('course-list');
      const number = list.children.length + 1;
      const li = document.createElement('li');
      li.dataset.index = number - 1;
      li.innerHTML = `
        <span class="course-number">${number}</span>
        <span>${place.name}</span>
        <span class="drag-handle">☰</span>
      `;
      list.appendChild(li);
    });

    // 선 다시 그리기
    drawPolyline();

    // 지도 첫 번째 장소로 이동
    map.setCenter(new kakao.maps.LatLng(coursePlaces[0].lat, coursePlaces[0].lng));
  }

  // 페이지 로드 시 저장된 코스 목록 바로 표시
  renderSavedList();

  // ── 드래그 순서 조정 ───────────────────────────────

  Sortable.create(document.getElementById('course-list'), {
    animation: 150,
    handle: '.drag-handle',
    onEnd: updateNumbers
  });

});