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
  let cropScale = 1;
  let cropMinScale = 1;
  let cropMaxScale = 4;
  let lastPinchDist = null;
  let pendingFiles = [];
  let pendingSlots = [];
  let pendingIndex = 0;
  const CROP_SIZE = 280;

  const cropArea = document.getElementById('crop-area');

  // 사진 선택 버튼 → 갤러리 열기
  document.getElementById('photo-add-btn').addEventListener('click', function () {
    const input = document.getElementById('photo-input');
    input.removeAttribute('capture');
    input.click();
  });

  // 다중 사진 선택 → 순서대로 빈 슬롯에 크롭
  document.getElementById('photo-input').addEventListener('change', function (e) {
    const files = Array.from(e.target.files).slice(0, 4);
    if (files.length === 0) return;

    const emptySlots = [];
    [1, 2, 3, 4].forEach(function (num) {
      if (document.getElementById('preview' + num).classList.contains('hidden')) {
        emptySlots.push(num);
      }
    });

    // 빈 슬롯이 없으면 아무것도 하지 않음
    if (emptySlots.length === 0) {
      alert('사진 슬롯이 모두 가득 찼습니다.\n기존 사진을 클릭해서 교체하거나 삭제해주세요.');
      e.target.value = '';
      return;
    }

    pendingFiles = files.slice(0, emptySlots.length);
    pendingSlots = emptySlots.slice(0, files.length);
    pendingIndex = 0;

    openNextCrop();
    e.target.value = '';
  });

  function openNextCrop() {
    if (pendingIndex >= pendingFiles.length) return;
    openCropWithFile(pendingFiles[pendingIndex], pendingSlots[pendingIndex]);
  }

  // 슬롯 클릭 → 사진 있으면 옵션 팝업, 없으면 파일 선택
  [1, 2, 3, 4].forEach(function (num) {
    document.getElementById('slot' + num).addEventListener('click', function (e) {
      e.stopPropagation();
      const preview = document.getElementById('preview' + num);
      const hasPhoto = !preview.classList.contains('hidden');
      replaceSlotNum = num;

      if (hasPhoto) {
        document.getElementById('slot-options').classList.remove('hidden');
      } else {
        pendingFiles = [];
        pendingSlots = [num];
        pendingIndex = 0;
        const input = document.getElementById('photo-replace-input');
        input.removeAttribute('capture');
        input.click();
      }
    });

    // img 태그 클릭도 slot 이벤트로 위임
    document.getElementById('preview' + num).addEventListener('click', function (e) {
      e.stopPropagation();
      document.getElementById('slot' + num).click();
    });
  });

  // 크게 보기
  document.getElementById('slot-option-view').addEventListener('click', function () {
    document.getElementById('slot-options').classList.add('hidden');
    const photos = [];
    [1, 2, 3, 4].forEach(function (num) {
      const p = document.getElementById('preview' + num);
      if (p && !p.classList.contains('hidden')) photos.push(p.src);
    });
    const preview = document.getElementById('preview' + replaceSlotNum);
    const startIndex = photos.indexOf(preview.src);
    openViewer(photos, startIndex >= 0 ? startIndex : 0);
    replaceSlotNum = null;
  });

  // 순서 변경 버튼 클릭 → 순서 선택 팝업
  document.getElementById('slot-option-order').addEventListener('click', function () {
    document.getElementById('slot-options').classList.add('hidden');
    
    // 현재 채워진 슬롯 목록
    const filledSlots = [];
    [1, 2, 3, 4].forEach(function (num) {
      const p = document.getElementById('preview' + num);
      if (p && !p.classList.contains('hidden')) filledSlots.push(num);
    });

    // 본인 슬롯 제외하고 이동 가능한 위치 표시
    const orderList = document.getElementById('slot-order-list');
    orderList.innerHTML = '';
    filledSlots.forEach(function (num) {
      const btn = document.createElement('button');
      btn.textContent = num === replaceSlotNum ? num + '번 (현재 위치)' : num + '번 위치로 이동';
      btn.disabled = num === replaceSlotNum;
      btn.addEventListener('click', function () {
        if (num !== replaceSlotNum) swapSlots(replaceSlotNum, num);
        document.getElementById('slot-order-modal').classList.add('hidden');
        replaceSlotNum = null;
      });
      orderList.appendChild(btn);
    });

    document.getElementById('slot-order-modal').classList.remove('hidden');
  });

  document.getElementById('slot-order-cancel').addEventListener('click', function () {
    document.getElementById('slot-order-modal').classList.add('hidden');
    replaceSlotNum = null;
  });

  // [버블링 수정] 배경 클릭 시 닫기
  document.getElementById('slot-order-modal').addEventListener('click', function (e) {
    if (e.target === this) {
      this.classList.add('hidden');
      replaceSlotNum = null;
    }
  });

  // 슬롯 간 사진 교환
  function swapSlots(fromNum, toNum) {
    const previewFrom = document.getElementById('preview' + fromNum);
    const previewTo = document.getElementById('preview' + toNum);
    const slotFrom = document.getElementById('slot' + fromNum);
    const slotTo = document.getElementById('slot' + toNum);

    const fromSrc = previewFrom.src;
    const fromHidden = previewFrom.classList.contains('hidden');
    const toSrc = previewTo.src;
    const toHidden = previewTo.classList.contains('hidden');

    // 사진 교환
    previewFrom.src = toSrc;
    previewTo.src = fromSrc;

    if (toHidden) {
      previewFrom.classList.add('hidden');
      slotFrom.querySelector('span').style.display = '';
    } else {
      previewFrom.classList.remove('hidden');
      slotFrom.querySelector('span').style.display = 'none';
    }

    if (fromHidden) {
      previewTo.classList.add('hidden');
      slotTo.querySelector('span').style.display = '';
    } else {
      previewTo.classList.remove('hidden');
      slotTo.querySelector('span').style.display = 'none';
    }
  }

  // 사진 교체
  document.getElementById('slot-option-replace').addEventListener('click', function () {
    document.getElementById('slot-options').classList.add('hidden');
    pendingFiles = [];
    pendingSlots = [replaceSlotNum];
    pendingIndex = 0;
    const input = document.getElementById('photo-replace-input');
    input.removeAttribute('capture');
    input.click();
  });

  // 사진 삭제
  document.getElementById('slot-option-delete').addEventListener('click', function () {
    document.getElementById('slot-options').classList.add('hidden');
    const preview = document.getElementById('preview' + replaceSlotNum);
    const slot = document.getElementById('slot' + replaceSlotNum);
    preview.src = '';
    preview.classList.add('hidden');
    slot.querySelector('span').style.display = '';
    replaceSlotNum = null;
  });

  // 취소
  document.getElementById('slot-option-cancel').addEventListener('click', function () {
    document.getElementById('slot-options').classList.add('hidden');
    replaceSlotNum = null;
  });

  document.getElementById('slot-options').addEventListener('click', function (e) {
    if (e.target === this) {
      this.classList.add('hidden');
      replaceSlotNum = null;
    }
  });

  // 교체 파일 선택
  document.getElementById('photo-replace-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    pendingFiles = [file];
    openNextCrop();
    e.target.value = '';
  });

  // 파일 → 크롭 팝업 열기
  function openCropWithFile(file, num) {
    const reader = new FileReader();
    reader.onload = function (event) {
      cropTargetNum = num;
      cropImgEl = document.getElementById('crop-image');
      cropImgEl.src = event.target.result;

      cropImgEl.onload = function () {
        const naturalW = cropImgEl.naturalWidth;
        const naturalH = cropImgEl.naturalHeight;
        const ratio = naturalW / naturalH;

        let baseW, baseH;
        if (ratio > 1) {
          baseH = CROP_SIZE;
          baseW = Math.round(CROP_SIZE * ratio);
        } else {
          baseW = CROP_SIZE;
          baseH = Math.round(CROP_SIZE / ratio);
        }

        cropImgEl.dataset.baseW = baseW;
        cropImgEl.dataset.baseH = baseH;
        cropImgEl.style.width = baseW + 'px';
        cropImgEl.style.height = baseH + 'px';

        cropScale = 1;
        cropMinScale = 1;
        cropMaxScale = 4;

        cropOffsetX = -Math.round((baseW - CROP_SIZE) / 2);
        cropOffsetY = -Math.round((baseH - CROP_SIZE) / 2);
        applyTransform();

        const total = pendingFiles.length;
        const current = pendingIndex + 1;
        const progressEl = document.getElementById('crop-progress');
        if (progressEl) {
          progressEl.textContent = total > 1 ? current + ' / ' + total : '';
        }

        document.getElementById('crop-modal').classList.remove('hidden');
      };
    };
    reader.readAsDataURL(file);
  }

  function applyTransform() {
    const baseW = parseFloat(cropImgEl.dataset.baseW);
    const baseH = parseFloat(cropImgEl.dataset.baseH);
    const w = Math.round(baseW * cropScale);
    const h = Math.round(baseH * cropScale);

    cropImgEl.style.width = w + 'px';
    cropImgEl.style.height = h + 'px';

    const maxOffsetX = 0;
    const minOffsetX = Math.min(0, CROP_SIZE - w);
    const maxOffsetY = 0;
    const minOffsetY = Math.min(0, CROP_SIZE - h);

    cropOffsetX = Math.min(maxOffsetX, Math.max(minOffsetX, cropOffsetX));
    cropOffsetY = Math.min(maxOffsetY, Math.max(minOffsetY, cropOffsetY));

    document.getElementById('crop-box').style.left = cropOffsetX + 'px';
    document.getElementById('crop-box').style.top = cropOffsetY + 'px';
  }

  // ── 마우스 드래그 ────────────────────────────────
  cropArea.addEventListener('mousedown', function (e) {
    isDragging = true;
    cropStartX = e.clientX - cropOffsetX;
    cropStartY = e.clientY - cropOffsetY;
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    cropOffsetX = e.clientX - cropStartX;
    cropOffsetY = e.clientY - cropStartY;
    applyTransform();
  });

  document.addEventListener('mouseup', function () {
    isDragging = false;
  });

  // ── 휠 줌 ────────────────────────────────────────
  cropArea.addEventListener('wheel', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const rect = cropArea.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;

    const prevScale = cropScale;
    cropScale = Math.min(cropMaxScale, Math.max(cropMinScale, cropScale + delta));
    const scaleRatio = cropScale / prevScale;

    cropOffsetX = centerX - scaleRatio * (centerX - cropOffsetX);
    cropOffsetY = centerY - scaleRatio * (centerY - cropOffsetY);

    applyTransform();
  }, { passive: false });

  // ── 터치 드래그 + 핀치줌 ────────────────────────
  cropArea.addEventListener('touchstart', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 1) {
      isDragging = true;
      lastPinchDist = null;
      cropStartX = e.touches[0].clientX - cropOffsetX;
      cropStartY = e.touches[0].clientY - cropOffsetY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      lastPinchDist = getPinchDist(e.touches);
    }
  }, { passive: false });

  cropArea.addEventListener('touchmove', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 1 && isDragging) {
      cropOffsetX = e.touches[0].clientX - cropStartX;
      cropOffsetY = e.touches[0].clientY - cropStartY;
      applyTransform();
    } else if (e.touches.length === 2) {
      const dist = getPinchDist(e.touches);
      if (lastPinchDist === null) {
        lastPinchDist = dist;
        return;
      }
      const delta = (dist - lastPinchDist) * 0.008;
      lastPinchDist = dist;

      const rect = cropArea.getBoundingClientRect();
      const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
      const midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

      const prevScale = cropScale;
      cropScale = Math.min(cropMaxScale, Math.max(cropMinScale, cropScale + delta));
      const scaleRatio = cropScale / prevScale;

      cropOffsetX = midX - scaleRatio * (midX - cropOffsetX);
      cropOffsetY = midY - scaleRatio * (midY - cropOffsetY);

      applyTransform();
    }
  }, { passive: false });

  cropArea.addEventListener('touchend', function (e) {
    e.stopPropagation();
    if (e.touches.length < 2) lastPinchDist = null;
    if (e.touches.length === 0) isDragging = false;
  });

  function getPinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── 크롭 취소 ────────────────────────────────────
  document.getElementById('crop-cancel').addEventListener('click', function () {
    document.getElementById('crop-modal').classList.add('hidden');
    cropTargetNum = null;
    pendingFiles = [];
    pendingSlots = [];
    pendingIndex = 0;
  });

  // ── 크롭 확인 ────────────────────────────────────
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

    const compressed = canvas.toDataURL('image/jpeg', 0.5);
    const preview = document.getElementById('preview' + cropTargetNum);
    const slot = document.getElementById('slot' + cropTargetNum);
    preview.src = compressed;
    preview.classList.remove('hidden');
    slot.querySelector('span').style.display = 'none';

    document.getElementById('crop-modal').classList.add('hidden');
    cropTargetNum = null;
    cropScale = 1;

    pendingIndex++;
    if (pendingIndex < pendingFiles.length) {
      setTimeout(openNextCrop, 200);
    }
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