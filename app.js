import { db } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

kakao.maps.load(function () {

  // ── 지도 초기화 ──────────────────────────────────
  const map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(37.5665, 126.9780),
    level: 5
  });

  const ps = new kakao.maps.services.Places();

  // ── 상태 변수 ────────────────────────────────────
  let selectedPlace = null;
  let previewMarker = null;
  let previewOverlay = null;
  let coursePlaces = [];
  let polyline = null;
  let activeMarkers = [];
  let activeOverlays = [];
  let myLocationOverlay = null;

  // ── 내 위치 기능 ─────────────────────────────────
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
    if (isIOS) {
      guideText = '설정 → Safari → 위치 → 허용 후 새로고침';
    } else if (isSamsung) {
      guideText = '주소창 왼쪽 🔒 탭 → 위치 → 허용 후 새로고침';
    } else if (isAndroid) {
      guideText = '주소창 왼쪽 🔒 탭 → 권한 → 위치 → 허용 후 새로고침';
    } else {
      guideText = '주소창 왼쪽 🔒 아이콘 → 위치 → 허용 후 새로고침';
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

  const geoOptions = {
    enableHighAccuracy: false,
    timeout: 15000,
    maximumAge: 60000
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(showMyLocation, function () {}, geoOptions);
  }

  document.getElementById('my-location-btn').addEventListener('click', function () {
    if (!navigator.geolocation) {
      showLocationGuide();
      return;
    }
    const btn = document.getElementById('my-location-btn');
    btn.textContent = '⏳';
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        btn.textContent = '📍';
        btn.disabled = false;
        showMyLocation(pos);
      },
      function () {
        btn.textContent = '📍';
        btn.disabled = false;
        showLocationGuide();
      },
      geoOptions
    );
  });

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

  // ── 사진 미리보기 (압축 포함) ────────────────────
  [1, 2, 3, 4].forEach(function (num) {
    document.getElementById('photo' + num).addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (event) {
        const imgEl = new Image();
        imgEl.onload = function () {
          const canvas = document.createElement('canvas');
          const maxSize = 400;
          let width = imgEl.width;
          let height = imgEl.height;

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(imgEl, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.1);
          const preview = document.getElementById('preview' + num);
          preview.src = compressed;
          preview.classList.remove('hidden');
          preview.previousElementSibling.style.display = 'none';
        };
        imgEl.src = event.target.result;
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

    const saveBtn = document.getElementById('save-btn');
    saveBtn.textContent = '저장 중...';
    saveBtn.disabled = true;

    // 사진 base64 수집
    const photos = [null, null, null, null];
    [1, 2, 3, 4].forEach(function (num) {
      const img = document.getElementById('preview' + num);
      if (img && !img.classList.contains('hidden') && img.src && img.src.startsWith('data:')) {
        photos[num - 1] = img.src;
      }
    });

    const courseData = {
      name: courseName,
      places: coursePlaces,
      photos: photos,
      likes: 0,
      comments: 0,
      createdAt: new Date().toLocaleDateString('ko-KR')
    };

    addDoc(collection(db, 'courses'), courseData).then(function () {
      renderSavedList();
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
  });

  // ── 저장된 코스 목록 표시 ────────────────────────
  function renderSavedList() {
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
              ${course.places.map(function(p) { return p.name; }).join(' → ')}
            </div>
          </div>
          <button class="delete-btn" data-id="${id}">🗑</button>
        `;
        list.appendChild(li);
      });

      document.querySelectorAll('.delete-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          deleteCourse(this.dataset.id);
        });
      });

      document.querySelectorAll('.load-course').forEach(function (btn) {
        btn.addEventListener('click', function () {
          loadCourse(this.dataset.id);
        });
      });

    }).catch(function (error) {
      console.error('불러오기 오류:', error);
      list.innerHTML = '<li style="color:#aaa; font-size:13px;">불러오기 실패. 새로고침 해주세요.</li>';
    });
  }

  // ── 코스 삭제 ────────────────────────────────────
  function deleteCourse(id) {
    if (!confirm('이 코스를 삭제할까요?')) return;

    deleteDoc(doc(db, 'courses', id)).then(function () {
      renderSavedList();
    }).catch(function (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    });
  }

  // ── 저장된 코스 지도에 불러오기 ──────────────────
  function loadCourse(id) {
    getDoc(doc(db, 'courses', id)).then(function (docSnap) {
      if (!docSnap.exists()) return;

      const course = docSnap.data();

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

    }).catch(function (error) {
      console.error('불러오기 오류:', error);
    });
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