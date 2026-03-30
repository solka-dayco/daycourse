// photo.js — 사진 크롭/압축 유틸리티 (v7)
// 4:5 세로형 크롭, 타원 블러(반투명 미리보기, canvas 블러 처리), WebP 압축

const OUTPUT_WIDTH   = 800;
const OUTPUT_QUALITY = 0.82;
const ASPECT         = 4 / 5;
const BLUR_STRENGTH  = 8; // 고정 블러 강도

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/webp', 'image/png'];

export function cropAndCompress(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SIZE) { reject(new Error('파일 크기는 5MB 이하여야 합니다.')); return; }
    if (!ALLOWED_TYPES.includes(file.type)) { reject(new Error('이미지 파일만 업로드 가능합니다.')); return; }
    const reader = new FileReader();
    reader.onload = e => openCropModal(e.target.result, resolve, reject, []);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function reopenCrop(dataUrl, existingBlurRegions = []) {
  return new Promise((resolve, reject) => {
    openCropModal(dataUrl, resolve, reject, existingBlurRegions);
  });
}

// ── 상대좌표 변환 ─────────────────────────────────────────
// blurRegions 저장형식: { cx_r, cy_r, rx_r, ry_r }
// 이미지 표시 영역 대비 비율 (0~1)
function toAbs(r, cs, img) {
  const iW = img.naturalWidth  * cs.scale;
  const iH = img.naturalHeight * cs.scale;
  return {
    cx: cs.x + r.cx_r * iW,
    cy: cs.y + r.cy_r * iH,
    rx: r.rx_r * iW,
    ry: r.ry_r * iH,
  };
}

function toRel(a, cs, img) {
  const iW = img.naturalWidth  * cs.scale;
  const iH = img.naturalHeight * cs.scale;
  return {
    cx_r: (a.cx - cs.x) / iW,
    cy_r: (a.cy - cs.y) / iH,
    rx_r: a.rx / iW,
    ry_r: a.ry / iH,
  };
}

// ── 크롭 모달 ─────────────────────────────────────────────
function openCropModal(dataUrl, resolve, reject, initialBlurRegions) {
  const modal = document.createElement('div');
  modal.id = 'photoCropModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.92);
    z-index:9999;display:flex;flex-direction:column;
    align-items:center;justify-content:center;touch-action:none;
  `;

  modal.innerHTML = `
    <div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:12px">
      사진 영역 선택 (4:5 비율)
    </div>
    <div id="cropViewport" style="
      position:relative;overflow:hidden;
      width:min(90vw,360px);aspect-ratio:4/5;
      border:2px solid rgba(255,255,255,.6);
      border-radius:8px;background:#000;cursor:grab;
    ">
      <img id="cropImg" src="${dataUrl}" style="
        position:absolute;user-select:none;-webkit-user-drag:none;max-width:none;
      "/>
      <svg id="blurSvg" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;"></svg>
      <canvas id="blurCanvas" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></canvas>
      <div style="
        position:absolute;inset:0;
        display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);
        pointer-events:none;
      ">${Array.from({length:9}).map(() =>
        `<div style="border:0.5px solid rgba(255,255,255,.25)"></div>`
      ).join('')}</div>
    </div>
    <div id="cropHint" style="color:rgba(255,255,255,.6);font-size:12px;margin-top:10px">
      드래그로 이동 · 핀치/휠로 확대/축소
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center">
      <input id="cropChangeInput" type="file" accept="image/*" style="display:none"/>
      <button id="cropCancel" style="padding:10px 20px;border-radius:8px;border:1.5px solid rgba(255,255,255,.4);background:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">취소</button>
      <button id="cropUndoBtn" style="padding:10px 20px;border-radius:8px;border:1.5px solid rgba(255,255,255,.4);background:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">되돌리기</button>
      <button id="cropChangeBtn" style="padding:10px 20px;border-radius:8px;border:1.5px solid rgba(255,255,255,.4);background:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">사진 변경</button>
      <button id="blurModeBtn" style="padding:10px 20px;border-radius:8px;border:1.5px solid rgba(255,255,255,.4);background:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">블러</button>
      <button id="cropConfirm" style="padding:10px 24px;border-radius:8px;border:none;background:#fff;color:#1a1a2e;font-size:13px;font-weight:700;cursor:pointer;">완료</button>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const viewport    = modal.querySelector('#cropViewport');
  const img         = modal.querySelector('#cropImg');
  const svg         = modal.querySelector('#blurSvg');
  const blurModeBtn = modal.querySelector('#blurModeBtn');
  const cropHint    = modal.querySelector('#cropHint');
  const confirmBtn  = modal.querySelector('#cropConfirm');

  // ── 상태 ────────────────────────────────────────────────
  let cropState   = { x: 0, y: 0, scale: 1 };
  let blurMode    = false;
  let blurRegions = initialBlurRegions.map(r => ({ ...r }));
  let selectedIdx = -1;

  let _changedOriginal = null;
  let cropHistory = []; // { cropState, blurRegions } 스냅샷 스택
  let cropDrag    = null;
  let blurDraw    = null; // { sx, sy } 뷰포트 좌표
  let ellipseDrag = null; // { idx, lastX, lastY }
  let handleDrag  = null; // { idx, handle, lastX, lastY }

  const HANDLE_R       = 8;
  const CORNER_HANDLES = ['nw', 'ne', 'se', 'sw'];

  function cornerPos(a, h) {
    return {
      nw: [a.cx - a.rx, a.cy - a.ry],
      ne: [a.cx + a.rx, a.cy - a.ry],
      se: [a.cx + a.rx, a.cy + a.ry],
      sw: [a.cx - a.rx, a.cy + a.ry],
    }[h];
  }

  function applyCornerDelta(a, h, dx, dy) {
    const MIN = 12;
    if (h === 'ne' || h === 'se') a.rx = Math.max(MIN, a.rx + dx);
    if (h === 'nw' || h === 'sw') { a.rx = Math.max(MIN, a.rx - dx); a.cx += dx; }
    if (h === 'se' || h === 'sw') a.ry = Math.max(MIN, a.ry + dy);
    if (h === 'ne' || h === 'nw') { a.ry = Math.max(MIN, a.ry - dy); a.cy += dy; }
  }

  // ── 초기 배치 ───────────────────────────────────────────
  img.onload = () => {
    const vpW = viewport.clientWidth, vpH = viewport.clientHeight;
    const fit = Math.min(vpW / img.naturalWidth, vpH / img.naturalHeight);
    cropState = { scale: fit, x: (vpW - img.naturalWidth * fit) / 2, y: (vpH - img.naturalHeight * fit) / 2 };
    applyTransform();
  };

  function saveHistory() {
    cropHistory.push({
      cropState: { ...cropState },
      blurRegions: blurRegions.map(r => ({ ...r })),
    });
    if (cropHistory.length > 20) cropHistory.shift();
  }

  function applyTransform() {
    img.style.left   = `${cropState.x}px`;
    img.style.top    = `${cropState.y}px`;
    img.style.width  = `${img.naturalWidth  * cropState.scale}px`;
    img.style.height = `${img.naturalHeight * cropState.scale}px`;
    clampCrop();
    renderSvg();
  }

  function clampCrop() {
    const vpW = viewport.clientWidth, vpH = viewport.clientHeight;
    const iW  = img.naturalWidth * cropState.scale;
    const iH  = img.naturalHeight * cropState.scale;
    const MIN = 40;
    cropState.x = Math.min(vpW - MIN, Math.max(cropState.x, -iW + MIN));
    cropState.y = Math.min(vpH - MIN, Math.max(cropState.y, -iH + MIN));
    img.style.left = `${cropState.x}px`;
    img.style.top  = `${cropState.y}px`;
  }

  // ── SVG 렌더 (반투명 타원 + 핸들) ───────────────────────
  function renderSvg() {
    svg.innerHTML = '';
    if (blurRegions.length === 0) return;

    blurRegions.forEach((r, i) => {
      const a   = toAbs(r, cropState, img);
      const sel = (i === selectedIdx);

      // 반투명 채우기 타원
      const fillEl = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      fillEl.setAttribute('cx', a.cx); fillEl.setAttribute('cy', a.cy);
      fillEl.setAttribute('rx', a.rx); fillEl.setAttribute('ry', a.ry);
      fillEl.setAttribute('fill', 'rgba(0,0,0,0.4)');
      svg.appendChild(fillEl);

      // 테두리 타원 (인터랙션)
      const ellEl = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ellEl.setAttribute('cx', a.cx); ellEl.setAttribute('cy', a.cy);
      ellEl.setAttribute('rx', a.rx); ellEl.setAttribute('ry', a.ry);
      ellEl.setAttribute('fill', 'transparent');
      ellEl.setAttribute('stroke', sel ? '#fff' : 'rgba(255,255,255,0.5)');
      ellEl.setAttribute('stroke-width', sel ? '2' : '1.5');
      ellEl.setAttribute('stroke-dasharray', '5 3');
      ellEl.style.cursor = blurMode ? 'move' : 'default';
      ellEl.style.pointerEvents = blurMode ? 'all' : 'none';

      ellEl.addEventListener('mousedown', e => {
        e.stopPropagation();
        saveHistory();
        selectedIdx = i;
        ellipseDrag = { idx: i, lastX: e.clientX, lastY: e.clientY };
        renderSvg();
      });
      ellEl.addEventListener('touchstart', e => {
        e.stopPropagation(); e.preventDefault();
        saveHistory();
        selectedIdx = i;
        ellipseDrag = { idx: i, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
        renderSvg();
      }, { passive: false });
      ellEl.addEventListener('touchmove', e => {
        e.stopPropagation(); e.preventDefault();
        if (!ellipseDrag) return;
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false });
      ellEl.addEventListener('touchend', e => {
        e.stopPropagation();
        ellipseDrag = null;
        renderSvg();
      }, { passive: false });
      svg.appendChild(ellEl);

      // 선택된 타원 핸들 + 아이콘
      if (sel && blurMode) {
        CORNER_HANDLES.forEach(h => {
          const [hx, hy] = cornerPos(a, h);
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('cx', hx); c.setAttribute('cy', hy);
          c.setAttribute('r', HANDLE_R);
          c.setAttribute('fill', '#fff');
          c.setAttribute('stroke', '#333');
          c.setAttribute('stroke-width', '1.5');
          c.style.cursor = 'pointer';
          c.style.pointerEvents = 'all';
          c.addEventListener('mousedown', e => {
            e.stopPropagation();
            saveHistory();
            handleDrag = { idx: i, handle: h, lastX: e.clientX, lastY: e.clientY };
          });
          c.addEventListener('touchstart', e => {
            e.stopPropagation(); e.preventDefault();
            saveHistory();
            handleDrag = { idx: i, handle: h, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
          }, { passive: false });
          c.addEventListener('touchmove', e => {
            e.stopPropagation(); e.preventDefault();
            if (!handleDrag) return;
            onMove(e.touches[0].clientX, e.touches[0].clientY);
          }, { passive: false });
          c.addEventListener('touchend', e => {
            e.stopPropagation();
            handleDrag = null;
            renderSvg();
          }, { passive: false });
          svg.appendChild(c);
        });

        // 삭제/복사 아이콘
        const iconY  = a.cy - a.ry - 28;
        const iconCX = a.cx;

        const delG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        delG.style.cursor = 'pointer';
        delG.style.pointerEvents = 'all';
        delG.innerHTML = `
          <circle cx="${iconCX - 20}" cy="${iconY}" r="13" fill="rgba(220,60,60,0.9)"/>
          <text x="${iconCX - 20}" y="${iconY + 5}" text-anchor="middle" font-size="14" fill="#fff">🗑</text>`;
        delG.addEventListener('mousedown', e => e.stopPropagation());
        delG.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
        delG.addEventListener('click', e => {
          e.stopPropagation();
          saveHistory();
          blurRegions.splice(i, 1);
          selectedIdx = -1;
          renderSvg();
        });
        delG.addEventListener('touchend', e => {
          e.stopPropagation();
          e.preventDefault();
          ellipseDrag = null;
          handleDrag = null;
          saveHistory();
          blurRegions.splice(i, 1);
          selectedIdx = -1;
          renderSvg();
        }, { passive: false });
        svg.appendChild(delG);

        const copyG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        copyG.style.cursor = 'pointer';
        copyG.style.pointerEvents = 'all';
        copyG.innerHTML = `
          <circle cx="${iconCX + 20}" cy="${iconY}" r="13" fill="rgba(80,80,80,0.9)"/>
          <text x="${iconCX + 20}" y="${iconY + 5}" text-anchor="middle" font-size="14" fill="#fff">⧉</text>`;
        copyG.addEventListener('mousedown', e => e.stopPropagation());
        copyG.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
        copyG.addEventListener('click', e => {
          e.stopPropagation();
          blurRegions.push({ ...blurRegions[i], cx_r: blurRegions[i].cx_r + 0.04, cy_r: blurRegions[i].cy_r + 0.04 });
          selectedIdx = blurRegions.length - 1;
          renderSvg();
        });
        copyG.addEventListener('touchend', e => {
          e.stopPropagation();
          e.preventDefault();
          blurRegions.push({ ...blurRegions[i], cx_r: blurRegions[i].cx_r + 0.04, cy_r: blurRegions[i].cy_r + 0.04 });
          selectedIdx = blurRegions.length - 1;
          renderSvg();
        }, { passive: false });
        svg.appendChild(copyG);
      }
    });
  }

  // ── 블러 모드 토글 ──────────────────────────────────────
  blurModeBtn.addEventListener('click', () => {
    blurMode = !blurMode;
    blurModeBtn.textContent      = blurMode ? '이동 모드' : '블러';
    blurModeBtn.style.background = blurMode ? 'rgba(255,255,255,0.15)' : 'none';
    confirmBtn.textContent       = blurMode ? '적용' : '완료';
    viewport.style.cursor        = blurMode ? 'crosshair' : 'grab';
    cropHint.textContent         = blurMode
      ? '드래그로 블러 영역 추가 · 타원 선택 후 이동/핸들 조절'
      : '드래그로 이동 · 핀치/휠로 확대/축소';
    if (!blurMode) selectedIdx = -1;
    renderSvg();
  });

  // ── 뷰포트 좌표 ─────────────────────────────────────────
  function vpCoords(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // ── 포인터 핸들러 ────────────────────────────────────────
  function onDown(clientX, clientY) {
    // handleDrag/ellipseDrag는 SVG 요소에서 직접 설정되므로 여기선 건드리지 않음
    if (handleDrag || ellipseDrag) return;

    saveHistory();

    if (!blurMode) {
      cropDrag = { startX: clientX - cropState.x, startY: clientY - cropState.y };
      viewport.style.cursor = 'grabbing';
      return;
    }
    // 블러 모드: 빈 곳 드래그 → 새 타원 그리기
    const p = vpCoords(clientX, clientY);
    blurDraw = { sx: p.x, sy: p.y };
    selectedIdx = -1;
    renderSvg();
  }

  function onMove(clientX, clientY) {
    if (handleDrag) {
      const dx = clientX - handleDrag.lastX, dy = clientY - handleDrag.lastY;
      const a = toAbs(blurRegions[handleDrag.idx], cropState, img);
      applyCornerDelta(a, handleDrag.handle, dx, dy);
      blurRegions[handleDrag.idx] = toRel(a, cropState, img);
      handleDrag.lastX = clientX; handleDrag.lastY = clientY;
      renderSvg(); return;
    }
    if (ellipseDrag) {
      const iW = img.naturalWidth  * cropState.scale;
      const iH = img.naturalHeight * cropState.scale;
      blurRegions[ellipseDrag.idx].cx_r += (clientX - ellipseDrag.lastX) / iW;
      blurRegions[ellipseDrag.idx].cy_r += (clientY - ellipseDrag.lastY) / iH;
      ellipseDrag.lastX = clientX; ellipseDrag.lastY = clientY;
      renderSvg(); return;
    }
    if (blurDraw) {
      const p  = vpCoords(clientX, clientY);
      const rx = Math.abs(p.x - blurDraw.sx) / 2;
      const ry = Math.abs(p.y - blurDraw.sy) / 2;
      renderSvg();
      if (rx > 4 && ry > 4) {
        const draft = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        draft.setAttribute('cx', (p.x + blurDraw.sx) / 2);
        draft.setAttribute('cy', (p.y + blurDraw.sy) / 2);
        draft.setAttribute('rx', rx); draft.setAttribute('ry', ry);
        draft.setAttribute('fill', 'rgba(255,255,255,0.12)');
        draft.setAttribute('stroke', '#fff');
        draft.setAttribute('stroke-width', '1.5');
        draft.setAttribute('stroke-dasharray', '5 3');
        svg.appendChild(draft);
      }
      return;
    }
    if (cropDrag) {
      cropState.x = clientX - cropDrag.startX;
      cropState.y = clientY - cropDrag.startY;
      applyTransform();
    }
  }

  function onUp(clientX, clientY) {
    if (handleDrag)  { handleDrag = null;  renderSvg(); return; }
    if (ellipseDrag) { ellipseDrag = null; renderSvg(); return; }
    if (blurDraw) {
      const p  = vpCoords(clientX, clientY);
      const rx = Math.abs(p.x - blurDraw.sx) / 2;
      const ry = Math.abs(p.y - blurDraw.sy) / 2;
      const cx = (p.x + blurDraw.sx) / 2;
      const cy = (p.y + blurDraw.sy) / 2;
      blurDraw = null;
      if (rx >= 8 && ry >= 8) {
        blurRegions.push(toRel({ cx, cy, rx, ry }, cropState, img));
        selectedIdx = blurRegions.length - 1;
      }
      renderSvg(); return;
    }
    cropDrag = null;
    if (!blurMode) viewport.style.cursor = 'grab';
  }

  // ── 마우스 이벤트 ───────────────────────────────────────
  viewport.addEventListener('mousedown', e => { e.preventDefault(); onDown(e.clientX, e.clientY); });
  document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  document.addEventListener('mouseup',   e => onUp(e.clientX, e.clientY));

  // ── 터치 이벤트 ─────────────────────────────────────────
  let lastTouches = null;

  viewport.addEventListener('touchstart', e => {
    e.preventDefault();
    // SVG 핸들/타원에서 이미 handleDrag/ellipseDrag 설정됐을 수 있으므로 체크
    if (!handleDrag && !ellipseDrag) {
      onDown(e.touches[0].clientX, e.touches[0].clientY);
    }
    lastTouches = e.touches;
  }, { passive: false });

  viewport.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches;

    // 블러 관련 드래그 처리
    if (handleDrag || ellipseDrag || blurDraw) {
      onMove(t[0].clientX, t[0].clientY);
      lastTouches = t; return;
    }

    // 크롭 이동 모드
    if (!blurMode) {
      if (t.length === 2) {
        // 핀치줌 시작 시 1회만 저장
        if (!lastTouches || lastTouches.length !== 2) saveHistory();
        if (lastTouches?.length !== 2) { lastTouches = t; return; }
        const cur  = getTouchDist(t), prev = getTouchDist(lastTouches);
        if (prev === 0) { lastTouches = t; return; }
        const minS = Math.min(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight);
        const newS = Math.max(minS, Math.min(cropState.scale * (cur / prev), minS * 6));
        const rect = viewport.getBoundingClientRect();
        const cx   = (t[0].clientX + t[1].clientX) / 2 - rect.left;
        const cy   = (t[0].clientY + t[1].clientY) / 2 - rect.top;
        cropState.x = cx - (cx - cropState.x) * (newS / cropState.scale);
        cropState.y = cy - (cy - cropState.y) * (newS / cropState.scale);
        cropState.scale = newS;
        applyTransform();
      } else if (t.length === 1 && lastTouches?.length === 1 && cropDrag) {
        cropState.x = t[0].clientX - cropDrag.startX;
        cropState.y = t[0].clientY - cropDrag.startY;
        applyTransform();
      }
    } else {
      // 블러 모드 단일 터치 이동 (blurDraw)
      if (t.length === 1) {
        onMove(t[0].clientX, t[0].clientY);
      }
    }
    lastTouches = t;
  }, { passive: false });

  viewport.addEventListener('touchend', e => {
    onUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    lastTouches = e.touches.length ? e.touches : null;
  });

  // ── 휠줌 ────────────────────────────────────────────────
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    saveHistory();
    const minS = Math.min(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight);
    const newS = Math.max(minS, Math.min(cropState.scale * (e.deltaY > 0 ? 0.9 : 1.1), minS * 6));
    const rect = viewport.getBoundingClientRect();
    const cx   = e.clientX - rect.left, cy = e.clientY - rect.top;
    cropState.x = cx - (cx - cropState.x) * (newS / cropState.scale);
    cropState.y = cy - (cy - cropState.y) * (newS / cropState.scale);
    cropState.scale = newS;
    applyTransform();
  }, { passive: false });

  // ── 버튼 ────────────────────────────────────────────────
  modal.querySelector('#cropCancel').addEventListener('click', () => {
    cleanup();
    reject(new Error('취소됨'));
  });

  modal.querySelector('#cropUndoBtn').addEventListener('click', () => {
    if (!cropHistory.length) return;
    const prev = cropHistory.pop();
    cropState = { ...prev.cropState };
    blurRegions = prev.blurRegions.map(r => ({ ...r }));
    selectedIdx = -1;
    applyTransform();
  });

  const cropChangeInput = modal.querySelector('#cropChangeInput');
  modal.querySelector('#cropChangeBtn').addEventListener('click', () => {
    cropChangeInput.click();
  });
  cropChangeInput.addEventListener('change', () => {
    const file = cropChangeInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      _changedOriginal = e.target.result;
      img.src = e.target.result;
      blurRegions = [];
      selectedIdx = -1;
      cropHistory = [];
      renderSvg();
    };
    reader.readAsDataURL(file);
  });

  confirmBtn.addEventListener('click', async () => {
    if (blurMode) {
      // 블러 모드 → 이동 모드로 전환
      blurMode = false;
      blurModeBtn.textContent      = '블러';
      blurModeBtn.style.background = 'none';
      confirmBtn.textContent       = '완료';
      viewport.style.cursor        = 'grab';
      cropHint.textContent         = '드래그로 이동 · 핀치/휠로 확대/축소';
      selectedIdx = -1;
      renderSvg();
      return;
    }
    try {
      const blob = await renderCrop(img, viewport, cropState, blurRegions);
      cleanup();
      resolve({ blob, blurRegions: blurRegions.map(r => ({ ...r })), changedOriginal: _changedOriginal });
    } catch (err) {
      cleanup();
      reject(err);
    }
  });

  function cleanup() {
    if (modal.parentNode) modal.parentNode.removeChild(modal);
    document.body.style.overflow = '';
  }
}

// ── 크롭 렌더링 → WebP Blob ──────────────────────────────
async function renderCrop(img, viewport, state, blurRegions) {
  const vpW = viewport.clientWidth, vpH = viewport.clientHeight;

  const canvas = document.createElement('canvas');
  canvas.width  = OUTPUT_WIDTH;
  canvas.height = Math.round(OUTPUT_WIDTH / ASPECT);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // 검정 배경
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 이미지 렌더 (letterbox)
  const clipX = Math.max(0, state.x), clipY = Math.max(0, state.y);
  const clipW = Math.min(vpW, state.x + img.naturalWidth * state.scale) - clipX;
  const clipH = Math.min(vpH, state.y + img.naturalHeight * state.scale) - clipY;
  if (clipW > 0 && clipH > 0) {
    ctx.drawImage(img,
      (clipX - state.x) / state.scale, (clipY - state.y) / state.scale,
      clipW / state.scale, clipH / state.scale,
      (clipX / vpW) * canvas.width, (clipY / vpH) * canvas.height,
      (clipW / vpW) * canvas.width,  (clipH / vpH) * canvas.height
    );
  }

  // 블러 영역 처리 (모든 영역 순서대로)
  const scaleX = canvas.width / vpW;
  const scaleY = canvas.height / vpH;

  for (const rRel of blurRegions) {
    const a  = toAbs(rRel, state, img);
    const cx = a.cx * scaleX, cy = a.cy * scaleY;
    const rx = a.rx * scaleX, ry = a.ry * scaleY;
    const pad  = BLUR_STRENGTH * 4;
    const offX = Math.max(0, Math.floor(cx - rx - pad));
    const offY = Math.max(0, Math.floor(cy - ry - pad));
    const offW = Math.min(canvas.width,  Math.ceil(cx + rx + pad)) - offX;
    const offH = Math.min(canvas.height, Math.ceil(cy + ry + pad)) - offY;
    if (offW <= 0 || offH <= 0) continue;

    const rd = ctx.getImageData(offX, offY, offW, offH);
    stackBlur(rd, BLUR_STRENGTH);

    const tmp = document.createElement('canvas');
    tmp.width = offW; tmp.height = offH;
    tmp.getContext('2d').putImageData(rd, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(tmp, offX, offY);
    ctx.restore();
  }

  return new Promise((res, rej) => {
    canvas.toBlob(blob => {
      if (blob) res(blob);
      else rej(new Error('Blob 생성 실패'));
    }, 'image/webp', OUTPUT_QUALITY);
  });
}

// ── Stack Blur (box blur 2패스) ───────────────────────────
function stackBlur(imageData, radius) {
  const { data, width, height } = imageData;
  radius = Math.max(1, Math.round(radius));
  boxBlurH(data, width, height, radius);
  boxBlurV(data, width, height, radius);
  boxBlurH(data, width, height, radius);
  boxBlurV(data, width, height, radius);
}

function boxBlurH(data, w, h, r) {
  for (let y = 0; y < h; y++) {
    let sR = 0, sG = 0, sB = 0, sA = 0;
    const base = y * w * 4;
    for (let x = -r; x <= r; x++) {
      const px = Math.max(0, Math.min(w - 1, x)) * 4 + base;
      sR += data[px]; sG += data[px+1]; sB += data[px+2]; sA += data[px+3];
    }
    const cnt = r * 2 + 1;
    for (let x = 0; x < w; x++) {
      const px = (y * w + x) * 4;
      data[px] = sR/cnt; data[px+1] = sG/cnt; data[px+2] = sB/cnt; data[px+3] = sA/cnt;
      const a = Math.min(x+r+1, w-1) * 4 + base;
      const b = Math.max(x-r,   0)   * 4 + base;
      sR += data[a]-data[b]; sG += data[a+1]-data[b+1]; sB += data[a+2]-data[b+2]; sA += data[a+3]-data[b+3];
    }
  }
}

function boxBlurV(data, w, h, r) {
  for (let x = 0; x < w; x++) {
    let sR = 0, sG = 0, sB = 0, sA = 0;
    for (let y = -r; y <= r; y++) {
      const py = Math.max(0, Math.min(h - 1, y));
      const px = (py * w + x) * 4;
      sR += data[px]; sG += data[px+1]; sB += data[px+2]; sA += data[px+3];
    }
    const cnt = r * 2 + 1;
    for (let y = 0; y < h; y++) {
      const px = (y * w + x) * 4;
      data[px] = sR/cnt; data[px+1] = sG/cnt; data[px+2] = sB/cnt; data[px+3] = sA/cnt;
      const aY = Math.min(y+r+1, h-1), bY = Math.max(y-r, 0);
      const a  = (aY * w + x) * 4, b = (bY * w + x) * 4;
      sR += data[a]-data[b]; sG += data[a+1]-data[b+1]; sB += data[a+2]-data[b+2]; sA += data[a+3]-data[b+3];
    }
  }
}

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}