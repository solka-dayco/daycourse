import { db } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 비로그인 시 로그인 페이지로 이동
if (!localStorage.getItem('userId')) {
  alert('로그인이 필요합니다.');
  window.location.href = 'login.html';
}

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

// ── 사진 업로드 ──────────────────────────────────
  let cropTargetNum = null;
  let cropImgEl = null;
  let cropOffsetX = 0;
  let cropOffsetY = 0;
  let cropStartX = 0;
  let cropStartY = 0;
  let isDragging = false;
  let replaceSlotNum = null;
  const CROP_SIZE = 280;

  // 사진 선택 버튼 → 갤러리 열기
  document.getElementById('photo-add-btn').addEventListener('click', function () {
    const input = document.getElementById('photo-input');
    input.removeAttribute('capture');
    input.click();
  });

  // 다중 사진 선택 → 순서대로 빈 슬롯에 배치
  document.getElementById('photo-input').addEventListener('change', function (e) {
    const files = Array.from(e.target.files).slice(0, 4);
    if (files.length === 0) return;

    const emptySlots = [];
    [1, 2, 3, 4].forEach(function (num) {
      if (document.getElementById('preview' + num).classList.contains('hidden')) {
        emptySlots.push(num);
      }
    });

    let fileIndex = 0;

    function processNext() {
      if (fileIndex >= files.length || fileIndex >= emptySlots.length) return;
      const file = files[fileIndex];
      const slotNum = emptySlots[fileIndex];
      fileIndex++;

      openCropWithFile(file, slotNum, processNext);
    }

    processNext();
    e.target.value = '';
  });

  // 슬롯 클릭 → 사진 있으면 교체, 없으면 사진 선택
  [1, 2, 3, 4].forEach(function (num) {
    document.getElementById('slot' + num).addEventListener('click', function () {
      replaceSlotNum = num;
      const input = document.getElementById('photo-replace-input');
      input.removeAttribute('capture');
      input.click();
    });
  });

  document.getElementById('photo-replace-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file || !replaceSlotNum) return;
    openCropWithFile(file, replaceSlotNum, null);
    replaceSlotNum = null;
    e.target.value = '';
  });

  // 파일 → 크롭 팝업 열기
  function openCropWithFile(file, num, callback) {
    const reader = new FileReader();
    reader.onload = function (event) {
      cropTargetNum = num;
      cropImgEl = document.getElementById('crop-image');
      cropImgEl.src = event.target.result;
      cropImgEl._onCropDone = callback;

      cropImgEl.onload = function () {
        const ratio = cropImgEl.naturalWidth / cropImgEl.naturalHeight;
        let w, h;
        if (ratio > 1) {
          h = CROP_SIZE;
          w = Math.round(CROP_SIZE * ratio);
        } else {
          w = CROP_SIZE;
          h = Math.round(CROP_SIZE / ratio);
        }
        cropImgEl.style.width = w + 'px';
        cropImgEl.style.height = h + 'px';

        cropOffsetX = -Math.round((w - CROP_SIZE) / 2);
        cropOffsetY = -Math.round((h - CROP_SIZE) / 2);
        cropImgEl.parentElement.style.left = cropOffsetX + 'px';
        cropImgEl.parentElement.style.top = cropOffsetY + 'px';

        document.getElementById('crop-modal').classList.remove('hidden');
      };
    };
    reader.readAsDataURL(file);
  }

  // 크롭 드래그
  const cropArea = document.querySelector('.crop-area');

  cropArea.addEventListener('mousedown', function (e) {
    isDragging = true;
    cropStartX = e.clientX - cropOffsetX;
    cropStartY = e.clientY - cropOffsetY;
    cropArea.style.cursor = 'grabbing';
  });

  cropArea.addEventListener('touchstart', function (e) {
    isDragging = true;
    cropStartX = e.touches[0].clientX - cropOffsetX;
    cropStartY = e.touches[0].clientY - cropOffsetY;
  }, { passive: true });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    moveCrop(e.clientX, e.clientY);
  });

  document.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    moveCrop(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  document.addEventListener('mouseup', function () {
    isDragging = false;
    cropArea.style.cursor = 'grab';
  });

  document.addEventListener('touchend', function () {
    isDragging = false;
  });

  function moveCrop(clientX, clientY) {
    if (!cropImgEl) return;
    const imgW = cropImgEl.offsetWidth;
    const imgH = cropImgEl.offsetHeight;

    let newX = clientX - cropStartX;
    let newY = clientY - cropStartY;

    newX = Math.min(0, Math.max(newX, -(imgW - CROP_SIZE)));
    newY = Math.min(0, Math.max(newY, -(imgH - CROP_SIZE)));

    cropOffsetX = newX;
    cropOffsetY = newY;
    cropImgEl.parentElement.style.left = newX + 'px';
    cropImgEl.parentElement.style.top = newY + 'px';
  }

  // 크롭 취소
  document.getElementById('crop-cancel').addEventListener('click', function () {
    document.getElementById('crop-modal').classList.add('hidden');
    cropTargetNum = null;
    cropImgEl._onCropDone = null;
  });

  // 크롭 확인
  document.getElementById('crop-confirm').addEventListener('click', function () {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const scaleX = cropImgEl.naturalWidth / cropImgEl.offsetWidth;
    const scaleY = cropImgEl.naturalHeight / cropImgEl.offsetHeight;

    const sx = (-cropOffsetX) * scaleX;
    const sy = (-cropOffsetY) * scaleY;
    const sw = CROP_SIZE * scaleX;
    const sh = CROP_SIZE * scaleY;

    ctx.drawImage(cropImgEl, sx, sy, sw, sh, 0, 0, 400, 400);

    const compressed = canvas.toDataURL('image/jpeg', 0.3);
    const preview = document.getElementById('preview' + cropTargetNum);
    const slot = document.getElementById('slot' + cropTargetNum);
    preview.src = compressed;
    preview.classList.remove('hidden');
    slot.querySelector('span').style.display = 'none';

    document.getElementById('crop-modal').classList.add('hidden');

    const callback = cropImgEl._onCropDone;
    cropTargetNum = null;
    cropImgEl._onCropDone = null;

    if (callback) callback();
  });

  // ── 사진 뷰어 팝업 ───────────────────────────────
  let viewerPhotos = [];
  let viewerIndex = 0;

  function openViewer(photos, startIndex) {
    viewerPhotos = photos.filter(function (p) { return p; });
    if (viewerPhotos.length === 0) return;

    viewerIndex = startIndex;
    updateViewer();
    document.getElementById('photo-viewer').classList.remove('hidden');
  }

  function updateViewer() {
    document.getElementById('viewer-img').src = viewerPhotos[viewerIndex];

    const dots = document.getElementById('viewer-dots');
    dots.innerHTML = '';
    viewerPhotos.forEach(function (_, i) {
      const dot = document.createElement('div');
      dot.className = 'viewer-dot' + (i === viewerIndex ? ' active' : '');
      dots.appendChild(dot);
    });
  }

  document.getElementById('viewer-close').addEventListener('click', function () {
    document.getElementById('photo-viewer').classList.add('hidden');
  });

  document.getElementById('viewer-prev').addEventListener('click', function () {
    viewerIndex = (viewerIndex - 1 + viewerPhotos.length) % viewerPhotos.length;
    updateViewer();
  });

  document.getElementById('viewer-next').addEventListener('click', function () {
    viewerIndex = (viewerIndex + 1) % viewerPhotos.length;
    updateViewer();
  });

  // 썸네일 클릭 시 뷰어 열기
  document.querySelector('.photo-grid').addEventListener('click', function (e) {
    const slot = e.target.closest('.photo-slot');
    if (!slot) return;
    const img = slot.querySelector('img');
    if (!img || img.classList.contains('hidden')) return;

    const photos = [];
    [1, 2, 3, 4].forEach(function (num) {
      const p = document.getElementById('preview' + num);
      if (p && !p.classList.contains('hidden')) photos.push(p.src);
    });

    const clickedSrc = img.src;
    const startIndex = photos.indexOf(clickedSrc);
    openViewer(photos, startIndex >= 0 ? startIndex : 0);
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
      createdAt: new Date().toLocaleDateString('ko-KR'),
      authorId: localStorage.getItem('userId') || null,
      authorNickname: localStorage.getItem('nickname') || '익명'
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