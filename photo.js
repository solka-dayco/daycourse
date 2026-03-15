// photo.js — 사진 업로드 / 크롭 (4:5) / 압축 → Blob 반환

const CROP_RATIO = 4 / 5;   // 4:5 세로형
const OUTPUT_WIDTH = 800;   // 압축 후 가로 px
const OUTPUT_QUALITY = 0.82; // WebP 품질

// ── 크롭 상태 ────────────────────────────────────────
let cropState = {
  img: null,
  scale: 1,
  minScale: 1,
  offsetX: 0,
  offsetY: 0,
  startX: 0,
  startY: 0,
  dragging: false,
  pinchDist: 0,
  resolve: null,
  reject: null,
};

<<<<<<< HEAD
// ── 공개 API ─────────────────────────────────────────

/**
 * 파일 선택 → 크롭 UI 열기 → 크롭된 Blob 반환
 * @param {File} file
 * @returns {Promise<Blob>} WebP Blob
 */
export function cropPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        cropState.img = img;
        cropState.resolve = resolve;
        cropState.reject = reject;
        openCropOverlay(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
=======
// ── 드래그 앤 드롭 상태 변수 ─────────────────────
let dragFromNum = null;
let isTouching = false;
let touchMoved = false;

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

    // [모바일 잔상 수정] img 브라우저 기본 드래그 차단
    document.getElementById('preview' + num).setAttribute('draggable', 'false');

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
>>>>>>> d3dafc5f7ca6945a22744ee97e673c4bede88adb
  });
}

// ── 크롭 UI ──────────────────────────────────────────
function openCropOverlay(img) {
  const overlay = document.getElementById('cropOverlay');
  const wrap    = document.getElementById('cropWrap');
  const canvas  = document.getElementById('cropCanvas');
  overlay.style.display = 'flex';

  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight; // aspect-ratio 4/5

  // 초기 스케일: 이미지가 크롭 영역을 꽉 채우도록
  const scaleX = wrapW / img.width;
  const scaleY = wrapH / img.height;
  cropState.minScale = Math.max(scaleX, scaleY);
  cropState.scale = cropState.minScale;
  cropState.offsetX = (wrapW - img.width * cropState.scale) / 2;
  cropState.offsetY = (wrapH - img.height * cropState.scale) / 2;

  canvas.width  = wrapW;
  canvas.height = wrapH;
  canvas.style.width  = wrapW + 'px';
  canvas.style.height = wrapH + 'px';

  drawCrop();
  attachCropEvents(canvas, wrapW, wrapH);
}

function drawCrop() {
  const canvas = document.getElementById('cropCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { img, scale, offsetX, offsetY } = cropState;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
}

function clampOffset(wrapW, wrapH) {
  const { img, scale } = cropState;
  const imgW = img.width * scale;
  const imgH = img.height * scale;
  cropState.offsetX = Math.min(0, Math.max(wrapW - imgW, cropState.offsetX));
  cropState.offsetY = Math.min(0, Math.max(wrapH - imgH, cropState.offsetY));
}

function attachCropEvents(canvas, wrapW, wrapH) {
  // 이전 이벤트 제거를 위해 clone
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  // id 재설정
  newCanvas.id = 'cropCanvas';
  const c = newCanvas;

  // 마우스 드래그
  c.addEventListener('mousedown', e => {
    cropState.dragging = true;
    cropState.startX = e.clientX - cropState.offsetX;
    cropState.startY = e.clientY - cropState.offsetY;
    c.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!cropState.dragging) return;
    cropState.offsetX = e.clientX - cropState.startX;
    cropState.offsetY = e.clientY - cropState.startY;
    clampOffset(wrapW, wrapH);
    drawCrop();
  });
  window.addEventListener('mouseup', () => {
    cropState.dragging = false;
    c.style.cursor = 'grab';
  });

  // 휠 줌
  c.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newScale = Math.max(cropState.minScale, cropState.scale + delta);
    // 중심 기준 줌
    const cx = wrapW / 2;
    const cy = wrapH / 2;
    cropState.offsetX = cx - (cx - cropState.offsetX) * (newScale / cropState.scale);
    cropState.offsetY = cy - (cy - cropState.offsetY) * (newScale / cropState.scale);
    cropState.scale = newScale;
    clampOffset(wrapW, wrapH);
    drawCrop();
  }, { passive: false });

  // 터치 드래그 + 핀치줌
  c.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      cropState.dragging = true;
      cropState.startX = e.touches[0].clientX - cropState.offsetX;
      cropState.startY = e.touches[0].clientY - cropState.offsetY;
    } else if (e.touches.length === 2) {
      cropState.dragging = false;
      cropState.pinchDist = getTouchDist(e.touches);
    }
  }, { passive: true });

  c.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && cropState.dragging) {
      cropState.offsetX = e.touches[0].clientX - cropState.startX;
      cropState.offsetY = e.touches[0].clientY - cropState.startY;
      clampOffset(wrapW, wrapH);
      drawCrop();
    } else if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches);
      const ratio = dist / cropState.pinchDist;
      const newScale = Math.max(cropState.minScale, cropState.scale * ratio);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - c.getBoundingClientRect().left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - c.getBoundingClientRect().top;
      cropState.offsetX = cx - (cx - cropState.offsetX) * (newScale / cropState.scale);
      cropState.offsetY = cy - (cy - cropState.offsetY) * (newScale / cropState.scale);
      cropState.scale = newScale;
      cropState.pinchDist = dist;
      clampOffset(wrapW, wrapH);
      drawCrop();
    }
  }, { passive: false });

  c.addEventListener('touchend', () => { cropState.dragging = false; });
}

<<<<<<< HEAD
function getTouchDist(touches) {
=======
// ── 슬롯 드래그 앤 드롭 ──────────────────────────
function initSlotDragDrop() {
  [1, 2, 3, 4].forEach(function (num) {
    const slot = document.getElementById('slot' + num);

    // 데스크탑 전용 (모바일은 터치 이벤트로 처리)
    if (!('ontouchstart' in window)) {
      slot.setAttribute('draggable', 'true');
    }

    slot.addEventListener('dragstart', function (e) {
      // [모바일 잔상 수정] 터치 중 이동이 감지됐을 때만 브라우저 기본 드래그 차단
      if (isTouching && touchMoved) { e.preventDefault(); return; }
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
      touchMoved = false;
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
      touchMoved = true;
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
      touchMoved = false;
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
>>>>>>> d3dafc5f7ca6945a22744ee97e673c4bede88adb
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

// ── 크롭 버튼 초기화 (create.js에서 호출) ────────────
export function initCropButtons() {
  document.getElementById('cropConfirm')?.addEventListener('click', finishCrop);
  document.getElementById('cropCancel')?.addEventListener('click', () => {
    document.getElementById('cropOverlay').style.display = 'none';
    cropState.reject?.(new Error('cancelled'));
    cropState.resolve = null;
    cropState.reject = null;
  });
}

<<<<<<< HEAD
function finishCrop() {
  const wrap   = document.getElementById('cropWrap');
  const wrapW  = wrap.clientWidth;
  const wrapH  = wrap.clientHeight;
  const canvas = document.getElementById('cropCanvas'); // 클론 후 최신 참조

  // 실제 출력 캔버스 (OUTPUT_WIDTH x OUTPUT_WIDTH/CROP_RATIO)
  const outW = OUTPUT_WIDTH;
  const outH = Math.round(OUTPUT_WIDTH / CROP_RATIO);
  const out  = document.createElement('canvas');
  out.width  = outW;
  out.height = outH;
  const ctx  = out.getContext('2d');

  const { img, scale, offsetX, offsetY } = cropState;
  // 크롭 영역(wrapW x wrapH)의 왼쪽 상단이 이미지의 어느 좌표인지
  const srcX = -offsetX / scale;
  const srcY = -offsetY / scale;
  const srcW = wrapW / scale;
  const srcH = wrapH / scale;

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

  out.toBlob(blob => {
    document.getElementById('cropOverlay').style.display = 'none';
    cropState.resolve?.(blob);
    cropState.resolve = null;
    cropState.reject  = null;
  }, 'image/webp', OUTPUT_QUALITY);
}

// ── 썸네일 URL ───────────────────────────────────────
/** Blob → objectURL (미리보기용) */
export function blobToUrl(blob) {
  return URL.createObjectURL(blob);
}
=======
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
>>>>>>> d3dafc5f7ca6945a22744ee97e673c4bede88adb
