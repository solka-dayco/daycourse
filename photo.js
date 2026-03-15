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

function getTouchDist(touches) {
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
