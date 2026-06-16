// threads.js – rysowanie nitek SVG między pinezkami

import { THREAD_COLORS } from './cards.js';

export function renderAllThreads(svg, threads, pins) {
  // Wyczyść poprzednie nitki (nie dotykaj defs)
  [...svg.querySelectorAll('.thread-group')].forEach(el => el.remove());

  const pinMap = {};
  pins.forEach(p => { pinMap[p.id] = p; });

  threads.forEach(t => {
    const from = pinMap[t.fromPin];
    const to   = pinMap[t.toPin];
    if (!from || !to) return;
    renderThread(svg, t, from, to);
  });
}

export function renderThread(svg, thread, fromPin, toPin) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.classList.add('thread-group');
  g.dataset.id = thread.id;

  const x1 = fromPin.x, y1 = fromPin.y;
  const x2 = toPin.x,   y2 = toPin.y;

  // Zwis nitki – punkt kontrolny poniżej linii prostej
  const midX = (x1 + x2) / 2;
  const dist  = Math.hypot(x2 - x1, y2 - y1);
  const sag   = Math.min(60, dist * 0.18);
  const cpY   = Math.max(y1, y2) + sag;
  const cpX   = midX;

  const color = resolveColor(thread.color);

  if (thread.striped && thread.stripeColor2) {
    // Paskowana nitka: dwie linie przesunięte, tworzące efekt naprzemiennego koloru
    const color2 = resolveColor(thread.stripeColor2);
    const patId = `stripe-${thread.id}`;

    // Wzór paskowany jako pattern w defs
    ensureDefs(svg);
    const defs = svg.querySelector('defs');

    // Usuń stary pattern jeśli istnieje
    const oldPat = defs.querySelector(`#${patId}`);
    if (oldPat) oldPat.remove();

    const pat = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pat.setAttribute('id', patId);
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('width', '10');
    pat.setAttribute('height', '4');
    pat.setAttribute('patternTransform', `rotate(${angleDeg(x1,y1,x2,y2)})`);
    pat.innerHTML = `
      <rect width="10" height="2" y="0" fill="${color}"/>
      <rect width="10" height="2" y="2" fill="${color2}"/>
    `;
    defs.appendChild(pat);

    // Nitka używająca patternu jako stroke nie działa – rysujemy dwie linie
    const path1 = makePath(x1,y1,cpX,cpY,x2,y2);
    path1.setAttribute('stroke', color);
    path1.setAttribute('stroke-width', '1.5');
    path1.setAttribute('stroke-dasharray', '8,8');

    const path2 = makePath(x1,y1,cpX,cpY,x2,y2);
    path2.setAttribute('stroke', color2);
    path2.setAttribute('stroke-width', '1.5');
    path2.setAttribute('stroke-dasharray', '8,8');
    path2.setAttribute('stroke-dashoffset', '8');

    g.appendChild(path1);
    g.appendChild(path2);
  } else {
    const path = makePath(x1,y1,cpX,cpY,x2,y2);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.8');
    g.appendChild(path);
  }

  svg.appendChild(g);
}

function makePath(x1,y1,cpX,cpY,x2,y2) {
  const p = document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d', `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`);
  p.setAttribute('fill','none');
  p.setAttribute('stroke-linecap','round');
  p.style.pointerEvents = 'none';
  return p;
}

function angleDeg(x1,y1,x2,y2) {
  return Math.atan2(y2-y1, x2-x1) * 180 / Math.PI;
}

function resolveColor(c) {
  return THREAD_COLORS[c] || c || '#cc3333';
}

function ensureDefs(svg) {
  if (!svg.querySelector('defs')) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    svg.prepend(defs);
  }
}

// Narysuj nitkę w trakcie przeciągania (tymczasowa)
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
  const sag = Math.min(40, Math.hypot(x2-x1,y2-y1)*0.15);
  const cpY = Math.max(y1,y2)+sag;
  temp.setAttribute('d',`M ${x1} ${y1} Q ${midX} ${cpY} ${x2} ${y2}`);
  temp.setAttribute('stroke', resolveColor(color));
}

export function removeTempThread(svg) {
  const temp = svg.querySelector('#temp-thread');
  if (temp) temp.remove();
}
