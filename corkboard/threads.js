// threads.js – rysowanie nitek SVG między pinezkami

import { THREAD_COLORS } from './cards.js';

// DRY: helper tworzący element SVG
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag) { return document.createElementNS(NS, tag); }

// DRY: bezier path z atrybutami stroke
function makeStrokePath(x1, y1, cpX, cpY, x2, y2, stroke, width, dasharray, dashoffset) {
  const p = svgEl('path');
  p.setAttribute('d', `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', stroke);
  p.setAttribute('stroke-width', String(width));
  p.setAttribute('stroke-linecap', 'round');
  if (dasharray) p.setAttribute('stroke-dasharray', dasharray);
  if (dashoffset) p.setAttribute('stroke-dashoffset', String(dashoffset));
  return p;
}

function resolveColor(c) {
  return THREAD_COLORS[c] || c || '#cc3333';
}

// ── Renderowanie wszystkich nitek ─────────────────────
export function renderAllThreads(svg, threads, pins, onThreadClick) {
  [...svg.querySelectorAll('.thread-group')].forEach(el => el.remove());
  // DRY: zbuduj pinMap raz
  const pinMap = buildPinMap(pins);
  threads.forEach(t => {
    const from = pinMap[t.fromPin];
    const to   = pinMap[t.toPin];
    if (!from || !to) return;
    renderThread(svg, t, from, to, onThreadClick);
  });
}

// DRY: helper pinMap – używany też przez minimap przez import
export function buildPinMap(pins) {
  const map = {};
  pins.forEach(p => { map[p.id] = p; });
  return map;
}

export function renderThread(svg, thread, fromPin, toPin, onThreadClick) {
  const g = svgEl('g');
  g.classList.add('thread-group');
  g.dataset.id = thread.id;

  const x1 = fromPin.x, y1 = fromPin.y;
  const x2 = toPin.x,   y2 = toPin.y;
  const midX = (x1 + x2) / 2;
  const dist  = Math.hypot(x2 - x1, y2 - y1);
  const sag   = Math.min(60, dist * 0.18);
  const cpY   = Math.max(y1, y2) + sag;
  const cpX   = midX;
  const color  = resolveColor(thread.color);
  const width  = thread.width || 1.8;

  // Niewidoczna szeroka linia hit-area
  const hitPath = makeStrokePath(x1, y1, cpX, cpY, x2, y2, 'transparent', 12);
  hitPath.style.pointerEvents = 'stroke';
  hitPath.style.cursor = 'pointer';
  if (onThreadClick) {
    hitPath.addEventListener('click', e => { e.stopPropagation(); onThreadClick(thread.id); });
  }
  g.appendChild(hitPath);

  // Linia(e) nitki
  const dash = `${8 * width / 1.8},${8 * width / 1.8}`;
  if (thread.striped && thread.stripeColor2) {
    const color2 = resolveColor(thread.stripeColor2);
    g.appendChild(makeStrokePath(x1, y1, cpX, cpY, x2, y2, color,  width, dash));
    g.appendChild(makeStrokePath(x1, y1, cpX, cpY, x2, y2, color2, width, dash, 8 * width / 1.8));
  } else {
    g.appendChild(makeStrokePath(x1, y1, cpX, cpY, x2, y2, color, width));
  }

  // Etykieta
  if (thread.label?.trim()) {
    const labelX  = cpX;
    const labelY  = (y1 + y2) / 2 + sag * 0.5;
    const approxW = thread.label.length * 7 + 8;
    const approxH = 16;

    const bg = svgEl('rect');
    bg.setAttribute('x',      labelX - approxW / 2);
    bg.setAttribute('y',      labelY - approxH / 2);
    bg.setAttribute('width',  approxW);
    bg.setAttribute('height', approxH);
    bg.setAttribute('rx',     '3');
    bg.setAttribute('fill',   'rgba(255,250,240,0.88)');
    bg.setAttribute('stroke', color);
    bg.setAttribute('stroke-width', '0.8');
    bg.style.pointerEvents = 'none';

    const txt = svgEl('text');
    txt.setAttribute('x',                labelX);
    txt.setAttribute('y',                labelY);
    txt.setAttribute('text-anchor',      'middle');
    txt.setAttribute('dominant-baseline','middle');
    txt.setAttribute('font-size',        '11');
    txt.setAttribute('font-family',      'Caveat, cursive');
    txt.setAttribute('fill',             '#1a1a1a');
    txt.style.pointerEvents = 'none';
    txt.textContent = thread.label;

    g.appendChild(bg);
    g.appendChild(txt);
  }

  svg.appendChild(g);
}

// ── Tymczasowa nitka podczas rysowania ────────────────
export function drawTempThread(svg, x1, y1, x2, y2, color) {
  let temp = svg.querySelector('#temp-thread');
  if (!temp) {
    temp = svgEl('path');
    temp.id = 'temp-thread';
    temp.setAttribute('fill', 'none');
    temp.setAttribute('stroke-width', '2');
    temp.setAttribute('stroke-linecap', 'round');
    temp.setAttribute('stroke-dasharray', '6,4');
    svg.appendChild(temp);
  }
  const midX = (x1 + x2) / 2;
  const sag  = Math.min(40, Math.hypot(x2 - x1, y2 - y1) * 0.15);
  const cpY  = Math.max(y1, y2) + sag;
  temp.setAttribute('d', `M ${x1} ${y1} Q ${midX} ${cpY} ${x2} ${y2}`);
  temp.setAttribute('stroke', resolveColor(color));
}

export function removeTempThread(svg) {
  svg.querySelector('#temp-thread')?.remove();
}
