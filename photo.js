// photo.js — 사진 크롭/압축 유틸리티 (v6)
// 4:5 세로형 크롭, 타원 블러(이미지 상대좌표, 4꼭짓점 핸들, 복사/삭제 아이콘), WebP 압축

const OUTPUT_WIDTH   = 800;
const OUTPUT_QUALITY = 0.82;
const ASPECT         = 4 / 5;

export function cropAndCompress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => openCropModal(e.target.result, resolve, reject);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function reopenCrop(dataUrl, existingBlurRegions = []) {
  return new Promise((resolve, reject) => {
    openCropModal(dataUrl, resolve, reject, existingBlurRegions);
  });
}

// ── 이미지 상대좌표 ↔ 뷰포트 절대좌표 변환 ───────────────
// blurRegions 저장형식: { cx_r, cy_r, rx_r, ry_r, strength }
// cx_r = (뷰포트cx - cropState.x) / (naturalWidth * scale)  → 0~1 범위
function toAbs(r, cs, img) {
  const iW = img.naturalWidth  * cs.scale;
  const iH = img.naturalHeight * cs.scale;
  return {
    cx: cs.x + r.cx_r * iW,
    cy: cs.y + r.cy_r * iH,
    rx: r.rx_r * iW,
    ry: r.ry_r * iH,
    strength: r.strength,
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
    strength: a.strength,
  };
}

// ── 크롭 모달 ─────────────────────────────────────────────
function openCropModal(dataUrl, resolve, reject, initialBlurRegions = []) {
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
      <svg id="blurSvg" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;"></svg>
      <div style="
        position:absolute;inset:0;
        display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);
        pointer-events:none;
      ">${Array.from({length:9}).map(() =>
        `<div style="border:0.5px solid rgba(255,255,255,.25)"></div>`
      ).join('')}</div>
    </div>

    <div id="blurStrengthRow" style="display:none;align-items:center;gap:8px;margin-top:10px;width:min(90vw,360px)">
      <span style="color:rgba(255,255,255,.7);font-size:12px;white-space:nowrap">블러 강도</span>
      <input id="blurStrengthSlider" type="range" min="4" max="40" value="16" style="flex:1;accent-color:#fff"/>
      <span id="blurStrengthVal" style="color:#fff;font-size:12px;width:24px;text-align:right">16</span>
    </div>

    <div id="cropHint" style="color:rgba(255,255,255,.6);font-size:12px;margin-top:10px">
      드래그로 이동 · 핀치/휠로 확대/축소
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center">
      <input id="cropChangeInput" type="file" accept="image/*" style="display:none"/>
      <button id="cropCancel" style="padding:10px 20px;border-radius:8px;border:1.5px solid rgba(255,255,255,.4);background:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">취소</button>
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
  const strengthRow = modal.querySelector('#blurStrengthRow');
  const slider      = modal.querySelector('#blurStrengthSlider');
  const sliderVal   = modal.querySelector('#blurStrengthVal');
  const cropHint    = modal.querySelector('#cropHint');
  const confirmBtn  = modal.querySelector('#cropConfirm');

  // ── 상태 ────────────────────────────────────────────────
  let cropState    = { x: 0, y: 0, scale: 1 };
  let blurMode     = false;
  let blurRegions  = initialBlurRegions.map(r => ({...r})); // 기존 블러 복원
  let selectedIdx  = -1;
  let blurStrength = 16;

  let cropDrag    = null;
  let _changedOriginal = null;
  let blurDraw    = null;
  let ellipseDrag = null;
  let handleDrag  = null; // { idx, handle: 'nw'|'ne'|'se'|'sw', lastX, lastY }

  const HANDLE_R = 7;
  // 4꼭짓점 핸들만 사용
  const CORNER_HANDLES = ['nw', 'ne', 'se', 'sw'];

  // 꼭짓점 핸들 위치 (외접 사각형 기준)
  function cornerPos(a, h) {
    return {
      nw: [a.cx - a.rx, a.cy - a.ry],
      ne: [a.cx + a.rx, a.cy - a.ry],
      se: [a.cx + a.rx, a.cy + a.ry],
      sw: [a.cx - a.rx, a.cy + a.ry],
    }[h];
  }

  // 핸들 드래그 → 절대좌표 abs 수정 (직접 변이)
  function applyCornerDelta(a, h, dx, dy) {
    const MIN = 10;
    if (h === 'ne' || h === 'se') { a.rx = Math.max(MIN, a.rx + dx); }
    if (h === 'nw' || h === 'sw') { a.rx = Math.max(MIN, a.rx - dx); a.cx += dx; }
    if (h === 'se' || h === 'sw') { a.ry = Math.max(MIN, a.ry + dy); }
    if (h === 'ne' || h === 'nw') { a.ry = Math.max(MIN, a.ry - dy); a.cy += dy; }
  }

  // ── 초기 배치 ───────────────────────────────────────────
  img.onload = () => {
    const vpW = viewport.clientWidth, vpH = viewport.clientHeight;
    const fit = Math.min(vpW / img.naturalWidth, vpH / img.naturalHeight);
    cropState = { scale: fit, x: (vpW - img.naturalWidth*fit)/2, y: (vpH - img.naturalHeight*fit)/2 };
    applyTransform();
  };

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
    const iW = img.naturalWidth*cropState.scale, iH = img.naturalHeight*cropState.scale;
    const MIN = 40;
    cropState.x = Math.min(vpW-MIN, Math.max(cropState.x, -iW+MIN));
    cropState.y = Math.min(vpH-MIN, Math.max(cropState.y, -iH+MIN));
    img.style.left = `${cropState.x}px`;
    img.style.top  = `${cropState.y}px`;
  }

  // ── SVG 렌더 ────────────────────────────────────────────
  function renderSvg() {
    svg.innerHTML = '';
    if (blurRegions.length === 0) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    blurRegions.forEach((r, i) => {
      const a = toAbs(r, cropState, img);
      defs.innerHTML += `
        <filter id="bf${i}" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="${(r.strength||16)/2}"/>
        </filter>
        <clipPath id="bc${i}">
          <ellipse cx="${a.cx}" cy="${a.cy}" rx="${a.rx}" ry="${a.ry}"/>
        </clipPath>`;
    });
    svg.appendChild(defs);

    blurRegions.forEach((r, i) => {
      const a   = toAbs(r, cropState, img);
      const sel = (i === selectedIdx);

      // 블러 이미지
      const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      imgEl.setAttribute('href', img.src);
      imgEl.setAttribute('x', cropState.x);
      imgEl.setAttribute('y', cropState.y);
      imgEl.setAttribute('width',  img.naturalWidth  * cropState.scale);
      imgEl.setAttribute('height', img.naturalHeight * cropState.scale);
      imgEl.setAttribute('filter', `url(#bf${i})`);
      imgEl.setAttribute('clip-path', `url(#bc${i})`);
      imgEl.setAttribute('preserveAspectRatio', 'none');
      imgEl.style.pointerEvents = 'none';
      svg.appendChild(imgEl);

      // 타원 테두리
      const ellEl = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ellEl.setAttribute('cx', a.cx); ellEl.setAttribute('cy', a.cy);
      ellEl.setAttribute('rx', a.rx); ellEl.setAttribute('ry', a.ry);
      ellEl.setAttribute('fill', 'transparent');
      ellEl.setAttribute('stroke', sel ? '#fff' : 'rgba(255,255,255,0.4)');
      ellEl.setAttribute('stroke-width', sel ? '2' : '1.5');
      ellEl.setAttribute('stroke-dasharray', '4 3');
      ellEl.style.cursor = 'move';
      ellEl.style.pointerEvents = 'all';

      const startEllipseDrag = (clientX, clientY) => {
        if (!blurMode) {
          // 이동 모드에서 타원 클릭 → 블러 모드 자동 전환
          blurMode = true;
          blurModeBtn.textContent = '이동 모드';
          blurModeBtn.style.background = 'rgba(255,255,255,0.15)';
          confirmBtn.textContent = '적용';
          viewport.style.cursor = 'crosshair';
          strengthRow.style.display = 'flex';
          cropHint.textContent = '드래그로 새 블러 추가 · 타원 선택 후 핸들로 조절';
        }
        selectedIdx = i;
        ellipseDrag = { idx: i, lastX: clientX, lastY: clientY };
        renderSvg();
      };
      ellEl.addEventListener('mousedown', e => { e.stopPropagation(); startEllipseDrag(e.clientX, e.clientY); });
      ellEl.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); startEllipseDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
      svg.appendChild(ellEl);

      // 선택된 타원: 4꼭짓점 핸들 + 상단 복사/삭제 아이콘
      if (sel && blurMode) {
        // 4꼭짓점 핸들
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
          const startH = (clientX, clientY) => {
            handleDrag = { idx: i, handle: h, lastX: clientX, lastY: clientY };
          };
          c.addEventListener('mousedown', e => { e.stopPropagation(); startH(e.clientX, e.clientY); });
          c.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); startH(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
          svg.appendChild(c);
        });

        // 상단 복사/삭제 아이콘 (타원 상단 위 28px)
        const iconY  = a.cy - a.ry - 28;
        const iconCX = a.cx; // 중앙 기준

        // 삭제 아이콘 (휴지통) — 왼쪽
        const delG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        delG.style.cursor = 'pointer';
        delG.style.pointerEvents = 'all';
        delG.innerHTML = `
          <circle cx="${iconCX - 18}" cy="${iconY}" r="12" fill="rgba(220,60,60,0.85)"/>
          <text x="${iconCX - 18}" y="${iconY + 5}" text-anchor="middle" font-size="13" fill="#fff">🗑</text>`;
        delG.addEventListener('mousedown', e => { e.stopPropagation(); });
        delG.addEventListener('click', e => {
          e.stopPropagation();
          blurRegions.splice(selectedIdx, 1);
          selectedIdx = -1;
          renderSvg();
        });
        svg.appendChild(delG);

        // 복사 아이콘 — 오른쪽
        const copyG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        copyG.style.cursor = 'pointer';
        copyG.style.pointerEvents = 'all';
        copyG.innerHTML = `
          <circle cx="${iconCX + 18}" cy="${iconY}" r="12" fill="rgba(80,80,80,0.85)"/>
          <text x="${iconCX + 18}" y="${iconY + 5}" text-anchor="middle" font-size="13" fill="#fff">⧉</text>`;
        copyG.addEventListener('mousedown', e => { e.stopPropagation(); });
        copyG.addEventListener('click', e => {
          e.stopPropagation();
          const copy = { ...blurRegions[selectedIdx], cx_r: blurRegions[selectedIdx].cx_r + 0.05, cy_r: blurRegions[selectedIdx].cy_r + 0.05 };
          blurRegions.push(copy);
          selectedIdx = blurRegions.length - 1;
          renderSvg();
        });
        svg.appendChild(copyG);
      }
    });
  }

  // ── 슬라이더 ────────────────────────────────────────────
  slider.addEventListener('input', () => {
    blurStrength = Number(slider.value);
    sliderVal.textContent = blurStrength;
    if (selectedIdx >= 0) blurRegions[selectedIdx].strength = blurStrength;
    renderSvg();
  });

  // ── 블러 모드 토글 ──────────────────────────────────────
  blurModeBtn.addEventListener('click', () => {
    blurMode = !blurMode;
    blurModeBtn.textContent = blurMode ? '이동 모드' : '블러';
    blurModeBtn.style.background = blurMode ? 'rgba(255,255,255,0.15)' : 'none';
    confirmBtn.textContent = blurMode ? '적용' : '완료';
    viewport.style.cursor = blurMode ? 'crosshair' : 'grab';
    strengthRow.style.display = blurMode ? 'flex' : 'none';
    cropHint.textContent = blurMode
      ? '드래그로 새 블러 추가 · 타원 선택 후 핸들로 조절'
      : '드래그로 이동 · 핀치/휠로 확대/축소';
    if (!blurMode) selectedIdx = -1;
    renderSvg();
  });

  // ── 뷰포트 좌표 변환 ────────────────────────────────────
  function vpCoords(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // ── 포인터 핸들러 ────────────────────────────────────────
  function onDown(clientX, clientY) {
    if (!blurMode) {
      cropDrag = { startX: clientX - cropState.x, startY: clientY - cropState.y };
      viewport.style.cursor = 'grabbing';
      return;
    }
    if (!ellipseDrag && !handleDrag) {
      const p = vpCoords(clientX, clientY);
      blurDraw = { sx: p.x, sy: p.y };
      selectedIdx = -1;
      renderSvg();
    }
  }

  function onMove(clientX, clientY) {
    if (handleDrag) {
      const dx = clientX - handleDrag.lastX, dy = clientY - handleDrag.lastY;
      // 상대 → 절대 → 핸들 적용 → 다시 상대로 저장
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
      const p = vpCoords(clientX, clientY);
      renderSvg();
      const rx = Math.abs(p.x - blurDraw.sx) / 2;
      const ry = Math.abs(p.y - blurDraw.sy) / 2;
      if (rx > 4 && ry > 4) {
        const draft = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        draft.setAttribute('cx', (p.x + blurDraw.sx) / 2);
        draft.setAttribute('cy', (p.y + blurDraw.sy) / 2);
        draft.setAttribute('rx', rx); draft.setAttribute('ry', ry);
        draft.setAttribute('fill', 'rgba(255,255,255,0.08)');
        draft.setAttribute('stroke', '#fff');
        draft.setAttribute('stroke-width', '1.5');
        draft.setAttribute('stroke-dasharray', '4 3');
        draft.style.pointerEvents = 'none';
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
    if (ellipseDrag) { ellipseDrag = null; return; }
    if (blurDraw) {
      const p  = vpCoords(clientX, clientY);
      const sx = blurDraw.sx, sy = blurDraw.sy;
      const rx = Math.abs(p.x - sx) / 2;
      const ry = Math.abs(p.y - sy) / 2;
      const cx = (p.x + sx) / 2;
      const cy = (p.y + sy) / 2;
      blurDraw = null;
      if (rx >= 8 && ry >= 8) {
        blurRegions.push(toRel({ cx, cy, rx, ry, strength: blurStrength }, cropState, img));
        selectedIdx = blurRegions.length - 1;
      }
      renderSvg(); return;
    }
    cropDrag = null;
    if (!blurMode) viewport.style.cursor = 'grab';
  }

  // ── 마우스 ───────────────────────────────────────────────
  viewport.addEventListener('mousedown', e => { e.preventDefault(); onDown(e.clientX, e.clientY); });
  document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  document.addEventListener('mouseup',   e => onUp(e.clientX, e.clientY));

  // ── 터치 ────────────────────────────────────────────────
  let lastTouches = null;
  viewport.addEventListener('touchstart', e => {
    e.preventDefault();
    onDown(e.touches[0].clientX, e.touches[0].clientY);
    lastTouches = e.touches;
  }, { passive: false });

  viewport.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches;
    if (blurMode || handleDrag || ellipseDrag || blurDraw) {
      onMove(t[0].clientX, t[0].clientY);
      lastTouches = t; return;
    }
    if (t.length === 2 && lastTouches?.length === 2) {
      const cur = getTouchDist(t), prev = getTouchDist(lastTouches);
      if (prev === 0) { lastTouches = t; return; }
      const minS = Math.min(viewport.clientWidth/img.naturalWidth, viewport.clientHeight/img.naturalHeight);
      const newS = Math.max(minS, Math.min(cropState.scale*(cur/prev), minS*6));
      const rect = viewport.getBoundingClientRect();
      const cx = (t[0].clientX+t[1].clientX)/2 - rect.left;
      const cy = (t[0].clientY+t[1].clientY)/2 - rect.top;
      cropState.x = cx - (cx - cropState.x)*(newS/cropState.scale);
      cropState.y = cy - (cy - cropState.y)*(newS/cropState.scale);
      cropState.scale = newS;
      applyTransform();
    } else if (t.length === 1 && lastTouches?.length === 1) {
      cropState.x += t[0].clientX - lastTouches[0].clientX;
      cropState.y += t[0].clientY - lastTouches[0].clientY;
      applyTransform();
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
    const minS = Math.min(viewport.clientWidth/img.naturalWidth, viewport.clientHeight/img.naturalHeight);
    const newS = Math.max(minS, Math.min(cropState.scale*(e.deltaY>0?0.9:1.1), minS*6));
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    cropState.x = cx - (cx - cropState.x)*(newS/cropState.scale);
    cropState.y = cy - (cy - cropState.y)*(newS/cropState.scale);
    cropState.scale = newS;
    applyTransform();
  }, { passive: false });

  // ── 버튼 ────────────────────────────────────────────────
  modal.querySelector('#cropCancel').addEventListener('click', () => { cleanup(); reject(new Error('취소됨')); });

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
      renderSvg();
    };
    reader.readAsDataURL(file);
  });
  confirmBtn.addEventListener('click', async () => {
    if (blurMode) {
      // 블러 모드에서 '추가' = 블러 확정 후 이동 모드로 전환
      blurMode = false;
      blurModeBtn.textContent = '블러';
      blurModeBtn.style.background = 'none';
      confirmBtn.textContent = '완료';
      viewport.style.cursor = 'grab';
      strengthRow.style.display = 'none';
      cropHint.textContent = '드래그로 이동 · 핀치/휠로 확대/축소';
      selectedIdx = -1;
      renderSvg();
      return;
    }
    const blob = await renderCrop(img, viewport, cropState, blurRegions);
    cleanup(); resolve({ blob, blurRegions: blurRegions.map(r => ({...r})), changedOriginal: _changedOriginal });
  });

  function cleanup() { document.body.removeChild(modal); document.body.style.overflow = ''; }
}

// ── 크롭 렌더링 ──────────────────────────────────────────
async function renderCrop(img, viewport, state, blurRegions) {
  const vpW = viewport.clientWidth, vpH = viewport.clientHeight;
  const canvas = document.createElement('canvas');
  canvas.width  = OUTPUT_WIDTH;
  canvas.height = Math.round(OUTPUT_WIDTH / ASPECT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const clipX = Math.max(0, state.x), clipY = Math.max(0, state.y);
  const clipW = Math.min(vpW, state.x + img.naturalWidth*state.scale) - clipX;
  const clipH = Math.min(vpH, state.y + img.naturalHeight*state.scale) - clipY;
  if (clipW > 0 && clipH > 0) {
    ctx.drawImage(img,
      (clipX-state.x)/state.scale, (clipY-state.y)/state.scale,
      clipW/state.scale, clipH/state.scale,
      (clipX/vpW)*canvas.width, (clipY/vpH)*canvas.height,
      (clipW/vpW)*canvas.width,  (clipH/vpH)*canvas.height
    );
  }

  const scaleX = canvas.width/vpW, scaleY = canvas.height/vpH;
  for (const rRel of blurRegions) {
    // 상대좌표 → 뷰포트 절대좌표 → 캔버스 좌표
    const a  = toAbs(rRel, state, img);
    const cx = a.cx * scaleX, cy = a.cy * scaleY;
    const rx = a.rx * scaleX, ry = a.ry * scaleY;
    const strength = rRel.strength || 16;
    const pad  = strength * 3;
    const offX = Math.max(0, Math.floor(cx-rx-pad));
    const offY = Math.max(0, Math.floor(cy-ry-pad));
    const offW = Math.min(canvas.width,  Math.ceil(cx+rx+pad)) - offX;
    const offH = Math.min(canvas.height, Math.ceil(cy+ry+pad)) - offY;
    if (offW <= 0 || offH <= 0) continue;

    const rd = ctx.getImageData(offX, offY, offW, offH);
    stackBlur(rd, strength);
    const tmp = document.createElement('canvas');
    tmp.width = offW; tmp.height = offH;
    tmp.getContext('2d').putImageData(rd, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(tmp, offX, offY);
    ctx.restore();
  }

  return new Promise(res => canvas.toBlob(res, 'image/webp', OUTPUT_QUALITY));
}

// ── Stack Blur ────────────────────────────────────────────
function stackBlur(imageData, radius) {
  const {data, width, height} = imageData;
  radius = Math.max(1, Math.round(radius));
  boxBlurH(data,width,height,radius); boxBlurV(data,width,height,radius);
  boxBlurH(data,width,height,radius); boxBlurV(data,width,height,radius);
}
function boxBlurH(data,w,h,r) {
  for (let y=0;y<h;y++) {
    let sR=0,sG=0,sB=0,sA=0;
    const base=y*w*4;
    for (let x=-r;x<=r;x++) { const px=Math.max(0,Math.min(w-1,x))*4+base; sR+=data[px];sG+=data[px+1];sB+=data[px+2];sA+=data[px+3]; }
    const cnt=r*2+1;
    for (let x=0;x<w;x++) {
      const px=(y*w+x)*4;
      data[px]=sR/cnt;data[px+1]=sG/cnt;data[px+2]=sB/cnt;data[px+3]=sA/cnt;
      const a=Math.min(x+r+1,w-1)*4+base, b=Math.max(x-r,0)*4+base;
      sR+=data[a]-data[b];sG+=data[a+1]-data[b+1];sB+=data[a+2]-data[b+2];sA+=data[a+3]-data[b+3];
    }
  }
}
function boxBlurV(data,w,h,r) {
  for (let x=0;x<w;x++) {
    let sR=0,sG=0,sB=0,sA=0;
    for (let y=-r;y<=r;y++) { const py=Math.max(0,Math.min(h-1,y)),px=(py*w+x)*4; sR+=data[px];sG+=data[px+1];sB+=data[px+2];sA+=data[px+3]; }
    const cnt=r*2+1;
    for (let y=0;y<h;y++) {
      const px=(y*w+x)*4;
      data[px]=sR/cnt;data[px+1]=sG/cnt;data[px+2]=sB/cnt;data[px+3]=sA/cnt;
      const aY=Math.min(y+r+1,h-1),bY=Math.max(y-r,0);
      const a=(aY*w+x)*4,b=(bY*w+x)*4;
      sR+=data[a]-data[b];sG+=data[a+1]-data[b+1];sB+=data[a+2]-data[b+2];sA+=data[a+3]-data[b+3];
    }
  }
}

function getTouchDist(touches) {
  const dx=touches[0].clientX-touches[1].clientX, dy=touches[0].clientY-touches[1].clientY;
  return Math.sqrt(dx*dx+dy*dy);
}