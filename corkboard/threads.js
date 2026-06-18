// threads.js – rysowanie nitek SVG między pinezkami

import { THREAD_COLORS } from './cards.js';

export function renderAllThreads(svg, threads, pins, onThreadClick) {
  [...svg.querySelectorAll('.thread-group')].forEach(el => el.remove());
  const pinMap = {};
  pins.forEach(p => { pinMap[p.id] = p; });
  threads.forEach(t => {
    const from = pinMap[t.fromPin];
    const to   = pinMap[t.toPin];
    if (!from || !to) return;
    renderThread(svg, t, from, to, onThreadClick);
  });
}

export function renderThread(svg, thread, fromPin, toPin, onThreadClick) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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

  // Niewidoczna gruba linia do klikania
  const hitPath = makePath(x1,y1,cpX,cpY,x2,y2);
  hitPath.setAttribute('stroke', 'transparent');
  hitPath.setAttribute('stroke-width', '12');
  hitPath.style.pointerEvents = 'stroke';
  hitPath.style.cursor = 'pointer';
  if (onThreadClick) {
    hitPath.addEventListener('click', e => { e.stopPropagation(); onThreadClick(thread.id); });
  }
  g.appendChild(hitPath);

  if (thread.striped && thread.stripeColor2) {
    const color2 = resolveColor(thread.stripeColor2);
    const path1 = makePath(x1,y1,cpX,cpY,x2,y2);
    path1.setAttribute('stroke', color);
    path1.setAttribute('stroke-width', String(width));
    path1.setAttribute('stroke-dasharray', `${8*width/1.8},${8*width/1.8}`);
    const path2 = makePath(x1,y1,cpX,cpY,x2,y2);
    path2.setAttribute('stroke', color2);
    path2.setAttribute('stroke-width', String(width));
    path2.setAttribute('stroke-dasharray', `${8*width/1.8},${8*width/1.8}`);
    path2.setAttribute('stroke-dashoffset', String(8*width/1.8));
    g.appendChild(path1);
    g.appendChild(path2);
  } else {
    const path = makePath(x1,y1,cpX,cpY,x2,y2);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(width));
    g.appendChild(path);
  }

  // Etykieta na środku nitki
  if (thread.label && thread.label.trim()) {
    const labelX = cpX;
    const labelY = (y1 + y2) / 2 + sag * 0.5;
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', labelX);
    txt.setAttribute('y', labelY);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('dominant-baseline', 'middle');
    txt.setAttribute('font-size', '11');
    txt.setAttribute('font-family', 'Caveat, cursive');
    txt.setAttribute('fill', '#1a1a1a');
    txt.textContent = thread.label;
    // Tło pod etykietą
    const pad = 4;
    const approxW = thread.label.length * 7 + pad * 2;
    const approxH = 16;
    bg.setAttribute('x', labelX - approxW / 2);
    bg.setAttribute('y', labelY - approxH / 2);
    bg.setAttribute('width', approxW);
    bg.setAttribute('height', approxH);
    bg.setAttribute('rx', '3');
    bg.setAttribute('fill', 'rgba(255,250,240,0.88)');
    bg.setAttribute('stroke', color);
    bg.setAttribute('stroke-width', '0.8');
    bg.style.pointerEvents = 'none';
    txt.style.pointerEvents = 'none';
    g.appendChild(bg);
    g.appendChild(txt);
  }

  svg.appendChild(g);
}

function makePath(x1,y1,cpX,cpY,x2,y2) {
  const p = document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d', `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`);
  p.setAttribute('fill','none');
  p.setAttribute('stroke-linecap','round');
  return p;
}

function resolveColor(c) {
  return THREAD_COLORS[c] || c || '#cc3333';
}


export function drawTempThread(svg, x1, y1, x2, y2, color) {
  let temp = svg.querySelector('#temp-thread');
  if (!temp) {
    temp = document.createElementNS('http://www.w3.org/2000/svg','path');
    temp.id = 'temp-thread';
    temp.setAttribute('fill','none');
    temp.setAttribute('stroke-width','2');
    temp.setAttribute('stroke-linecap','round');
    temp.setAttribute('stroke-dasharray','6,4');
    svg.appendChild(temp);
  }
  const midX = (x1+x2)/2;
  const sag  = Math.min(40, Math.hypot(x2-x1,y2-y1)*0.15);
  const cpY  = Math.max(y1,y2)+sag;
  temp.setAttribute('d',`M ${x1} ${y1} Q ${midX} ${cpY} ${x2} ${y2}`);
  temp.setAttribute('stroke', resolveColor(color));
}

export function removeTempThread(svg) {
  svg.querySelector('#temp-thread')?.remove();
}
