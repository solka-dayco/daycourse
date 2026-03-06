kakao.maps.load(function () {

  // ── 지도 초기화 ──────────────────────────────────
  const map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(37.5665, 126.9780),
    level: 5
  });

  // 내 위치 표시 함수
  let myLocationOverlay = null;

  function moveToMyLocation() {
    if (!navigator.geolocation) {
      alert('위치 정보를 혀용해 주세요.');
      return;
    }

    navigator.geolocation.getCurrentPosition(function (pos) {
      const myLat = pos.coords.latitude;
      const myLng = pos.coords.longitude;
      const position = new kakao.maps.LatLng(myLat, myLng);

      // 이전 내 위치 마커 제거
      if (myLocationOverlay) myLocationOverlay.setMap(null);

      // 내 위치에 파란 점 표시
      myLocationOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: '<div style="width:14px; height:14px; background:#4a90e2; border:2px solid white; border-radius:50%; box-shadow:0 0 6px rgba(74,144,226,0.8);"></div>',
        yAnchor: 0.5
      });
      myLocationOverlay.setMap(map);

      // 지도 이동
      map.setCenter(position);

    }, function (error) {
      // 위치 권한 거부 또는 오류 시 안내
      showLocationGuide();
    });
  }

  // 위치 권한 안내 메시지 표시
  function showLocationGuide() {
    const existing = document.getElementById('location-guide');
    if (existing) return;

    // 기기 종류 감지
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;

    let guideText = '';

    if (isIOS) {
      // 아이폰 안내
      guideText = '설정 → Safari → 위치 → 허용 후 새로고침';
    } else if (isAndroid) {
      // 안드로이드 안내
      guideText = '브라우저 주소창 🔒 아이콘 → 권한 → 위치 → 허용 후 새로고침';
    } else {
      // 데스크탑 안내
      guideText = '브라우저 주소창 왼쪽 🔒 아이콘 → 위치 → 허용 후 새로고침';
    }

    const guide = document.createElement('div');
    guide.id = 'location-guide';
    guide.innerHTML = `
      <span>📍 위치 권한이 필요합니다.</span>
      <span class="location-guide-sub">${guideText}</span>
      <button onclick="document.getElementById('location-guide').remove()">✕</button>
    `;
    document.querySelector('.map-wrapper').appendChild(guide);
  }

  // 페이지 로드 시 조용히 내 위치로 이동 (실패해도 안내 안 띄움)
  navigator.geolocation && navigator.geolocation.getCurrentPosition(function (pos) {
    const position = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
    myLocationOverlay = new kakao.maps.CustomOverlay({
      position: position,
      content: '<div style="width:14px; height:14px; background:#4a90e2; border:2px solid white; border-radius:50%; box-shadow:0 0 6px rgba(74,144,226,0.8);"></div>',
      yAnchor: 0.5
    });
    myLocationOverlay.setMap(map);
    map.setCenter(position);
  });

  // 버튼 클릭 시 내 위치로 이동
  document.getElementById('my-location-btn').addEventListener('click', moveToMyLocation);

  const ps = new kakao.maps.services.Places();

  // ── 상태 변수 ────────────────────────────────────
  let selectedPlace = null;   // 미리보기 중인 장소
  let previewMarker = null;   // 미리보기 임시 마커
  let previewOverlay = null;  // 미리보기 임시 말풍선
  let coursePlaces = [];      // 확정된 장소 목록
  let polyline = null;        // 현재 그려진 동선
  let activeMarkers = [];     // 확정 마커 목록 (코스 불러올 때 초기화용)
  let activeOverlays = [];    // 확정 말풍선 목록

  // ── 장소 미리보기 패널 표시 ──────────────────────
  function showPreview(place) {
    selectedPlace = place;

    document.getElementById('preview-name').textContent = place.place_name;
    document.getElementById('preview-category').textContent = '🏷 ' + (place.category_name || '');
    document.getElementById('preview-address').textContent = '📌 ' + (place.road_address_name || place.address_name || '');
    document.getElementById('preview-phone').textContent = place.phone ? '📞 ' + place.phone : '';

    const link = document.getElementById('preview-link');
    if (place.place_url) {
      link.href = place.place_url;
      link.style.display = 'inline-block';
    } else {
      link.style.display = 'none';
    }

    document.getElementById('place-preview').classList.remove('hidden');
  }

  // ── 검색창 검색 ──────────────────────────────────
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
            showPreview(place);
            list.innerHTML = '';
          });

          list.appendChild(li);
        });
      }
    });
  });

  // ── 지도 클릭 시 반경 30m 내 장소 검색 ──────────
  kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
    const position = mouseEvent.latLng;

    // 음식점, 카페, 관광명소, 문화시설 카테고리 순서대로 검색
    const categories = ['FD6', 'CE7', 'AT4', 'CT1'];
    let allResults = [];
    let searchCount = 0;

    categories.forEach(function (category) {
      ps.categorySearch(category, function (data, status) {
        searchCount++;

        if (status === kakao.maps.services.Status.OK) {
          allResults = allResults.concat(data);
        }

        // 모든 카테고리 검색 완료 시 목록 표시
        if (searchCount === categories.length) {
          if (allResults.length === 0) return;

          // 거리순 정렬
          allResults.sort(function (a, b) {
            return parseInt(a.distance) - parseInt(b.distance);
          });

          const list = document.getElementById('search-result');
          list.innerHTML = '';

          allResults.forEach(function (place) {
            const li = document.createElement('li');
            li.innerHTML = `
              <span>${place.place_name}</span>
              <span style="font-size:11px; color:#aaa; margin-left:6px;">${place.distance}m</span>
            `;

            li.addEventListener('click', function () {
              if (previewMarker) previewMarker.setMap(null);
              if (previewOverlay) previewOverlay.setMap(null);

              const placePosition = new kakao.maps.LatLng(place.y, place.x);
              previewMarker = new kakao.maps.Marker({ position: placePosition, map: map });
              previewOverlay = new kakao.maps.CustomOverlay({
                position: placePosition,
                content: '<div class="label">' + place.place_name + '</div>',
                yAnchor: 2.5
              });
              previewOverlay.setMap(map);
              showPreview(place);
              list.innerHTML = '';
            });

            list.appendChild(li);
          });
        }
      }, {
        location: position,
        radius: 30,
        sort: kakao.maps.services.SortBy.DISTANCE
      });
    });
  });

  // ── 코스에 추가 버튼 ─────────────────────────────
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

  // ── 코스 목록 UI에 장소 추가 ─────────────────────
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

  // ── 번호 재정렬 + 배열 순서 동기화 ──────────────
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

  // ── 동선 그리기 ──────────────────────────────────
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

  // ── 사진 미리보기 ────────────────────────────────
  [1, 2, 3, 4].forEach(function (num) {
    document.getElementById('photo' + num).addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (event) {
        const img = document.getElementById('preview' + num);
        img.src = event.target.result;
        img.classList.remove('hidden');
        img.previousElementSibling.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  });

  // ── 코스 저장 ────────────────────────────────────
  document.getElementById('save-btn').addEventListener('click', function () {
    const courseName = document.getElementById('course-name').value.trim();

    if (!courseName) {
      alert('코스 이름을 입력해주세요.');
      return;
    }

    if (coursePlaces.length === 0) {
      alert('장소를 1개 이상 추가해주세요.');
      return;
    }

    // 사진 4장 수집
    const photos = [];
    [1, 2, 3, 4].forEach(function (num) {
      const img = document.getElementById('preview' + num);
      photos.push(img && !img.classList.contains('hidden') ? img.src : null);
    });

    const courseData = {
      id: Date.now(),
      name: courseName,
      places: coursePlaces,
      photos: photos,
      createdAt: new Date().toLocaleDateString('ko-KR')
    };

    const existing = JSON.parse(localStorage.getItem('courses') || '[]');
    existing.push(courseData);
    localStorage.setItem('courses', JSON.stringify(existing));

    renderSavedList();
    document.getElementById('course-name').value = '';
    alert('코스가 저장됐습니다! 🎉');
  });

  // ── 저장된 코스 목록 표시 ────────────────────────
  function renderSavedList() {
    const saved = JSON.parse(localStorage.getItem('courses') || '[]');
    const list = document.getElementById('saved-list');
    list.innerHTML = '';

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

  // ── 코스 삭제 ────────────────────────────────────
  function deleteCourse(id) {
    const saved = JSON.parse(localStorage.getItem('courses') || '[]');
    const filtered = saved.filter(function (c) { return c.id !== id; });
    localStorage.setItem('courses', JSON.stringify(filtered));
    renderSavedList();
  }

  // ── 저장된 코스 지도에 불러오기 ──────────────────
  function loadCourse(id) {
    const saved = JSON.parse(localStorage.getItem('courses') || '[]');
    const course = saved.find(function (c) { return c.id === id; });
    if (!course) return;

    // 기존 마커/말풍선 초기화
    activeMarkers.forEach(function (marker) { marker.setMap(null); });
    activeOverlays.forEach(function (overlay) { overlay.setMap(null); });
    activeMarkers = [];
    activeOverlays = [];

    document.getElementById('course-list').innerHTML = '';
    coursePlaces = course.places;

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

    drawPolyline();
    map.setCenter(new kakao.maps.LatLng(coursePlaces[0].lat, coursePlaces[0].lng));
  }

  // ── 페이지 로드 시 저장 목록 표시 ───────────────
  renderSavedList();

  // ── 드래그 순서 조정 ─────────────────────────────
  Sortable.create(document.getElementById('course-list'), {
    animation: 150,
    handle: '.drag-handle',
    onEnd: updateNumbers
  });

});