// photo.js — 사진 크롭/압축 유틸리티 (v3)
// 4:5 세로형 크롭 팝업, 드래그/핀치줌/휠줌, WebP 압축

const OUTPUT_WIDTH   = 800;
const OUTPUT_QUALITY = 0.82;
const ASPECT         = 4 / 5; // width / height

/**
 * 이미지 파일을 받아 크롭 팝업 → WebP Blob 반환
 * @param {File} file
 * @returns {Promise<Blob>} WebP Blob (~80KB 목표)
 */
export function cropAndCompress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => openCropModal(e.target.result, resolve, reject);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 크롭 모달 ─────────────────────────────────────────────

function openCropModal(dataUrl, resolve, reject) {
  // 모달 생성
  const modal = document.createElement('div');
  modal.id = 'photoCropModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.92);
    z-index:9999;display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    touch-action:none;
  `;

  modal.innerHTML = `
    <div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:12px">
      사진 영역 선택 (4:5 비율)
    </div>
    <div id="cropViewport" style="
      position:relative;overflow:hidden;
      width:min(90vw,360px);
      aspect-ratio:4/5;
      border:2px solid rgba(255,255,255,.6);
      border-radius:8px;
      background:#000;
      cursor:grab;
    ">
      <img id="cropImg" src="${dataUrl}" style="
        position:absolute;
        transform-origin:center center;
        user-select:none;
        -webkit-user-drag:none;
        max-width:none;
      "/>
      <!-- 3x3 가이드 -->
      <div style="
        position:absolute;inset:0;
        display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);
        pointer-events:none;
      ">
        ${Array.from({length:9}).map((_,i) =>
          `<div style="border:0.5px solid rgba(255,255,255,.25)"></div>`
        ).join('')}
      </div>
    </div>
    <div style="color:rgba(255,255,255,.6);font-size:12px;margin-top:10px">
      드래그로 이동 · 핀치/휠로 확대/축소
    </div>
    <div style="display:flex;gap:12px;margin-top:18px">
      <button id="cropCancel" style="
        padding:11px 24px;border-radius:8px;border:1.5px solid rgba(255,255,255,.4);
        background:none;color:#fff;font-size:14px;font-weight:600;cursor:pointer;
      ">취소</button>
      <button id="cropConfirm" style="
        padding:11px 28px;border-radius:8px;border:none;
        background:#fff;color:#1a1a2e;font-size:14px;font-weight:700;cursor:pointer;
      ">적용</button>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const viewport = modal.querySelector('#cropViewport');
  const img = modal.querySelector('#cropImg');

  // 이미지 로드 후 초기 위치/크기 설정
  img.onload = () => initCrop(img, viewport);

  let state = { x: 0, y: 0, scale: 1 };

  function initCrop(imgEl, vp) {
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;
    const natW = imgEl.naturalWidth;
    const natH = imgEl.naturalHeight;

    // 뷰포트를 꽉 채우는 최소 스케일 계산
    const minScale = Math.max(vpW / natW, vpH / natH);
    state.scale = minScale;
    state.x = (vpW - natW * minScale) / 2;
    state.y = (vpH - natH * minScale) / 2;
    applyTransform(imgEl, state);
  }

  function applyTransform(imgEl, s) {
    imgEl.style.left = `${s.x}px`;
    imgEl.style.top  = `${s.y}px`;
    imgEl.style.width  = `${imgEl.naturalWidth * s.scale}px`;
    imgEl.style.height = `${imgEl.naturalHeight * s.scale}px`;
    clamp(imgEl, viewport, s);
  }

  function clamp(imgEl, vp, s) {
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;
    const iW  = imgEl.naturalWidth  * s.scale;
    const iH  = imgEl.naturalHeight * s.scale;

    // 이미지가 뷰포트보다 작아지지 않도록
    if (iW < vpW) s.x = (vpW - iW) / 2;
    else {
      s.x = Math.min(0, Math.max(s.x, vpW - iW));
    }
    if (iH < vpH) s.y = (vpH - iH) / 2;
    else {
      s.y = Math.min(0, Math.max(s.y, vpH - iH));
    }
    imgEl.style.left = `${s.x}px`;
    imgEl.style.top  = `${s.y}px`;
  }

  // ── 드래그 (마우스) ─────────────────────────────────────
  let drag = null;
  viewport.addEventListener('mousedown', e => {
    drag = { startX: e.clientX - state.x, startY: e.clientY - state.y };
    viewport.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    state.x = e.clientX - drag.startX;
    state.y = e.clientY - drag.startY;
    applyTransform(img, state);
  });
  document.addEventListener('mouseup', () => {
    drag = null;
    viewport.style.cursor = 'grab';
  });

  // ── 터치 드래그 / 핀치줌 ────────────────────────────────
  let lastTouches = null;
  viewport.addEventListener('touchstart', e => {
    e.preventDefault();
    lastTouches = e.touches;
  }, { passive: false });

  viewport.addEventListener('touchmove', e => {
    e.preventDefault();
    const touches = e.touches;

    if (touches.length === 1 && lastTouches?.length === 1) {
      // 단일 터치 드래그
      state.x += touches[0].clientX - lastTouches[0].clientX;
      state.y += touches[0].clientY - lastTouches[0].clientY;
      applyTransform(img, state);
    } else if (touches.length === 2 && lastTouches?.length === 2) {
      // 핀치줌
      const curDist  = getTouchDist(touches);
      const prevDist = getTouchDist(lastTouches);
      if (prevDist === 0) { lastTouches = touches; return; }

      const ratio    = curDist / prevDist;
      const minScale = Math.max(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight);
      const newScale = Math.max(minScale, Math.min(state.scale * ratio, minScale * 6));

      // 핀치 중심점 기준 스케일
      const cx = (touches[0].clientX + touches[1].clientX) / 2 - viewport.getBoundingClientRect().left;
      const cy = (touches[0].clientY + touches[1].clientY) / 2 - viewport.getBoundingClientRect().top;
      state.x = cx - (cx - state.x) * (newScale / state.scale);
      state.y = cy - (cy - state.y) * (newScale / state.scale);
      state.scale = newScale;
      applyTransform(img, state);
    }
    lastTouches = touches;
  }, { passive: false });

  viewport.addEventListener('touchend', e => {
    lastTouches = e.touches.length ? e.touches : null;
  });

  // ── 휠줌 ────────────────────────────────────────────────
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const minScale = Math.max(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight);
    const delta    = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(minScale, Math.min(state.scale * delta, minScale * 6));

    const rect = viewport.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    state.x = cx - (cx - state.x) * (newScale / state.scale);
    state.y = cy - (cy - state.y) * (newScale / state.scale);
    state.scale = newScale;
    applyTransform(img, state);
  }, { passive: false });

  // ── 버튼 ────────────────────────────────────────────────
  modal.querySelector('#cropCancel').addEventListener('click', () => {
    cleanup();
    reject(new Error('취소됨'));
  });

  modal.querySelector('#cropConfirm').addEventListener('click', () => {
    const blob = renderCrop(img, viewport, state);
    cleanup();
    resolve(blob);
  });

  function cleanup() {
    document.body.removeChild(modal);
    document.body.style.overflow = '';
  }
}

// ── 실제 크롭 렌더링 → WebP Blob ─────────────────────────
function renderCrop(img, viewport, state) {
  const vpW = viewport.clientWidth;
  const vpH = viewport.clientHeight;

  // 뷰포트 픽셀 → 원본 이미지 픽셀 변환
  const srcX = (-state.x) / state.scale;
  const srcY = (-state.y) / state.scale;
  const srcW = vpW / state.scale;
  const srcH = vpH / state.scale;

  const canvas = document.createElement('canvas');
  canvas.width  = OUTPUT_WIDTH;
  canvas.height = Math.round(OUTPUT_WIDTH / ASPECT);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

  return new Promise(res => canvas.toBlob(res, 'image/webp', OUTPUT_QUALITY));
}

// ── 유틸 ─────────────────────────────────────────────────
function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
