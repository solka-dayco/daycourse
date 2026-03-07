// ── photo.js ─────────────────────────────────────
// 담당: 사진 업로드, 크롭 팝업, 슬롯 관리, 사진 뷰어

// ── 크롭 상태 변수 ───────────────────────────────
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

// ── 뷰어 상태 변수 ───────────────────────────────
let viewerPhotos = [];
let viewerIndex = 0;

// ── 드래그 앤 드롭 상태 변수 ─────────────────────
let dragFromNum = null;
let isTouching = false;

// ── 초기화 (app.js에서 호출) ─────────────────────
export function initPhoto() {
  const cropArea = document.getElementById('crop-area');

  // 사진 선택 버튼
  document.getElementById('photo-add-btn').addEventListener('click', function () {
    const filledCount = [1, 2, 3, 4].filter(function (num) {
      return !document.getElementById('preview' + num).classList.contains('hidden');
    }).length;

    const input = document.getElementById('photo-input');
    input.removeAttribute('capture');

    if (filledCount >= 4) {
      [1, 2, 3, 4].forEach(function (num) {
        const preview = document.getElementById('preview' + num);
        const slot = document.getElementById('slot' + num);
        preview.src = '';
        preview.classList.add('hidden');
        slot.querySelector('span').style.display = '';
      });
    }

    input.click();
  });

  // 다중 사진 선택
  document.getElementById('photo-input').addEventListener('change', function (e) {
    const files = Array.from(e.target.files).slice(0, 4);
    if (files.length === 0) return;

    const emptySlots = [];
    [1, 2, 3, 4].forEach(function (num) {
      if (document.getElementById('preview' + num).classList.contains('hidden')) {
        emptySlots.push(num);
      }
    });

    pendingFiles = files.slice(0, emptySlots.length);
    pendingSlots = emptySlots.slice(0, files.length);
    pendingIndex = 0;

    openNextCrop();
    e.target.value = '';
  });

  // 슬롯 클릭 이벤트
  // [버블링 수정] e.stopPropagation() 으로 이벤트 차단
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

    // [버블링 수정] img 클릭을 slot 클릭으로 위임
    document.getElementById('preview' + num).addEventListener('click', function (e) {
      e.stopPropagation();
      document.getElementById('slot' + num).click();
    });
  });

  // 옵션 팝업 - 크게 보기
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

  // 옵션 팝업 - 사진 교체
  document.getElementById('slot-option-replace').addEventListener('click', function () {
    document.getElementById('slot-options').classList.add('hidden');
    pendingFiles = [];
    pendingSlots = [replaceSlotNum];
    pendingIndex = 0;
    const input = document.getElementById('photo-replace-input');
    input.removeAttribute('capture');
    input.click();
  });

  // 옵션 팝업 - 사진 삭제
  document.getElementById('slot-option-delete').addEventListener('click', function () {
    document.getElementById('slot-options').classList.add('hidden');
    const preview = document.getElementById('preview' + replaceSlotNum);
    const slot = document.getElementById('slot' + replaceSlotNum);
    preview.src = '';
    preview.classList.add('hidden');
    slot.querySelector('span').style.display = '';
    replaceSlotNum = null;
  });

  // 옵션 팝업 - 취소
  document.getElementById('slot-option-cancel').addEventListener('click', function () {
    document.getElementById('slot-options').classList.add('hidden');
    replaceSlotNum = null;
  });

  // [버블링 수정] 옵션 팝업 배경 클릭 시 닫기
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

  // 슬롯 간 드래그 앤 드롭
  initSlotDragDrop();

  // 크롭 이벤트
  initCropEvents(cropArea);

  // 크롭 취소
  document.getElementById('crop-cancel').addEventListener('click', function () {
    document.getElementById('crop-modal').classList.add('hidden');
    cropTargetNum = null;
    pendingFiles = [];
    pendingSlots = [];
    pendingIndex = 0;
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

  // 뷰어 이벤트
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
}

// ── 크롭 이벤트 등록 ─────────────────────────────
function initCropEvents(cropArea) {
  // 마우스 드래그
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

  // 휠 줌
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

  // 터치 드래그 + 핀치줌
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
      if (lastPinchDist === null) { lastPinchDist = dist; return; }

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
}

// ── 슬롯 드래그 앤 드롭 ──────────────────────────
function initSlotDragDrop() {
  [1, 2, 3, 4].forEach(function (num) {
    const slot = document.getElementById('slot' + num);

    // 데스크탑
    slot.setAttribute('draggable', 'true');

    slot.addEventListener('dragstart', function (e) {
      // [모바일 잔상 수정] 터치 중이면 브라우저 기본 드래그 차단
      if (isTouching) { e.preventDefault(); return; }
      const preview = document.getElementById('preview' + num);
      if (preview.classList.contains('hidden')) { e.preventDefault(); return; }
      dragFromNum = num;
      slot.classList.add('drag-active');
      e.dataTransfer.effectAllowed = 'move';
    });

    slot.addEventListener('dragend', function () {
      dragFromNum = null;
      slot.classList.remove('drag-active');
      document.querySelectorAll('.photo-slot').forEach(s => s.classList.remove('drag-over'));
    });

    slot.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (dragFromNum && dragFromNum !== num) slot.classList.add('drag-over');
    });

    slot.addEventListener('dragleave', function () {
      slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', function (e) {
      e.preventDefault();
      slot.classList.remove('drag-over');
      if (dragFromNum && dragFromNum !== num) swapSlots(dragFromNum, num);
      dragFromNum = null;
    });

    // 모바일 터치
    let touchDragEl = null;
    let touchDragFrom = null;

    slot.addEventListener('touchstart', function (e) {
      // [크롭 충돌 수정] 크롭 팝업 열려있으면 슬롯 터치 무시
      if (!document.getElementById('crop-modal').classList.contains('hidden')) return;
      isTouching = true;
      const preview = document.getElementById('preview' + num);
      if (preview.classList.contains('hidden')) return;

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;

      slot._touchTimer = setTimeout(function () {
        touchDragFrom = num;
        slot.classList.add('drag-active');

        touchDragEl = slot.cloneNode(true);
        touchDragEl.style.cssText = `
          position: fixed;
          width: ${slot.offsetWidth}px;
          height: ${slot.offsetHeight}px;
          opacity: 0.8;
          pointer-events: none;
          z-index: 3000;
          border-radius: 8px;
          overflow: hidden;
          left: ${startX - slot.offsetWidth / 2}px;
          top: ${startY - slot.offsetHeight / 2}px;
        `;
        document.body.appendChild(touchDragEl);
      }, 300);
    }, { passive: true });

    slot.addEventListener('touchmove', function (e) {
      // [크롭 충돌 수정] 크롭 팝업 열려있으면 슬롯 터치 무시
      if (!document.getElementById('crop-modal').classList.contains('hidden')) return;
      if (!touchDragFrom) { clearTimeout(slot._touchTimer); return; }
      e.preventDefault();
      const touch = e.touches[0];

      if (touchDragEl) {
        touchDragEl.style.left = (touch.clientX - touchDragEl.offsetWidth / 2) + 'px';
        touchDragEl.style.top = (touch.clientY - touchDragEl.offsetHeight / 2) + 'px';
      }

      document.querySelectorAll('.photo-slot').forEach(s => s.classList.remove('drag-over'));

      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el) {
        const targetSlot = el.closest('.photo-slot');
        if (targetSlot && targetSlot !== slot) targetSlot.classList.add('drag-over');
      }
    }, { passive: false });

    slot.addEventListener('touchend', function (e) {
      // [크롭 충돌 수정] 크롭 팝업 열려있으면 슬롯 터치 무시
      if (!document.getElementById('crop-modal').classList.contains('hidden')) return;
      clearTimeout(slot._touchTimer);
      if (!touchDragFrom) return;

      if (touchDragEl) { document.body.removeChild(touchDragEl); touchDragEl = null; }

      slot.classList.remove('drag-active');
      document.querySelectorAll('.photo-slot').forEach(s => s.classList.remove('drag-over'));

      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el) {
        const targetSlot = el.closest('.photo-slot');
        if (targetSlot) {
          const targetNum = parseInt(targetSlot.id.replace('slot', ''));
          if (targetNum && targetNum !== touchDragFrom) swapSlots(touchDragFrom, targetNum);
        }
      }
      touchDragFrom = null;
      isTouching = false;
    });
  });
}

// ── 슬롯 간 사진 교환 ────────────────────────────
function swapSlots(fromNum, toNum) {
  const previewFrom = document.getElementById('preview' + fromNum);
  const previewTo = document.getElementById('preview' + toNum);
  const slotFrom = document.getElementById('slot' + fromNum);
  const slotTo = document.getElementById('slot' + toNum);

  const fromSrc = previewFrom.src;
  const fromHidden = previewFrom.classList.contains('hidden');
  const toSrc = previewTo.src;
  const toHidden = previewTo.classList.contains('hidden');

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

// ── 크롭 팝업 열기 ───────────────────────────────
function openNextCrop() {
  if (pendingIndex >= pendingFiles.length) return;
  openCropWithFile(pendingFiles[pendingIndex], pendingSlots[pendingIndex]);
}

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

  const minOffsetX = Math.min(0, CROP_SIZE - w);
  const minOffsetY = Math.min(0, CROP_SIZE - h);

  cropOffsetX = Math.min(0, Math.max(minOffsetX, cropOffsetX));
  cropOffsetY = Math.min(0, Math.max(minOffsetY, cropOffsetY));

  document.getElementById('crop-box').style.left = cropOffsetX + 'px';
  document.getElementById('crop-box').style.top = cropOffsetY + 'px';
}

function getPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── 사진 뷰어 ────────────────────────────────────
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

// ── 외부에서 사진 데이터 수집용 ──────────────────
export function getPhotoData() {
  const photos = [null, null, null, null];
  [1, 2, 3, 4].forEach(function (num) {
    const img = document.getElementById('preview' + num);
    if (img && !img.classList.contains('hidden') && img.src && img.src.startsWith('data:')) {
      photos[num - 1] = img.src;
    }
  });
  return photos;
}