// cards.js – renderowanie kart

export const NOTE_COLORS = {
  r: { bg: '#ffcdd2', label: 'Czerwona' },
  g: { bg: '#c8e6c9', label: 'Zielona' },
  b: { bg: '#bbdefb', label: 'Niebieska' },
  y: { bg: '#fff9c4', label: 'Żółta' },
  c: { bg: '#b2ebf2', label: 'Cyjan' },
  m: { bg: '#f8bbd0', label: 'Różowa' },
  w: { bg: '#fafafa', label: 'Biała' },
};

export const PIN_COLORS = {
  red:     { head: '#e63946', shadow: '#8b0000' },
  blue:    { head: '#1565c0', shadow: '#0a2e6e' },
  green:   { head: '#2e7d32', shadow: '#1a4a1c' },
  yellow:  { head: '#f9c811', shadow: '#a07800' },
  orange:  { head: '#f4511e', shadow: '#8b2500' },
  purple:  { head: '#6a1b9a', shadow: '#3a0060' },
  white:   { head: '#f0f0f0', shadow: '#888' },
  black:   { head: '#222',    shadow: '#000' },
  darkred: { head: '#7b1fa2', shadow: '#4a0060' },
  gold:    { head: '#c8971c', shadow: '#7a5800' },
};

export const THREAD_COLORS = {
  r: '#e63946', g: '#2e7d32', b: '#1565c0',
  y: '#f9c811', m: '#c2185b', c: '#0097a7',
  w: '#e0e0e0', k: '#222222',
  red: '#e63946', green: '#2e7d32', blue: '#1565c0',
  yellow: '#f9c811', magenta: '#c2185b', cyan: '#0097a7',
  white: '#e0e0e0', black: '#222222',
  orange: '#f4511e', purple: '#6a1b9a', gold: '#c8971c',
  darkred: '#7b1fa2',
};

export function renderPinSvg(color) {
  const c = PIN_COLORS[color] || PIN_COLORS.red;
  return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="10" cy="7" rx="6" ry="6" fill="${c.head}"/>
    <ellipse cx="10" cy="6" rx="4" ry="3" fill="rgba(255,255,255,0.3)"/>
    <line x1="10" y1="13" x2="10" y2="20" stroke="${c.shadow}" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="10" cy="7" rx="6" ry="6" fill="none" stroke="${c.shadow}" stroke-width="0.5" opacity="0.4"/>
  </svg>`;
}

export function createCardElement(card) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.id = card.id;
  el.dataset.type = card.type;

  const angle = card.angle ?? (Math.random() * 10 - 5);
  card.angle = angle;

  // Skos + subtelne odchylenie 3D przez skew
  const skewX = angle * 0.1;
  el.style.transform = `rotate(${angle}deg) skewX(${skewX}deg)`;
  el.style.left = card.x + 'px';
  el.style.top = card.y + 'px';

  // Cień sugerujący odchylenie od tablicy
  const shadowDir = angle > 0 ? 1 : -1;
  el.style.boxShadow = `${shadowDir * 3}px 6px 18px rgba(0,0,0,0.38), ${shadowDir}px 2px 6px rgba(0,0,0,0.2)`;

  el.innerHTML = buildCardHTML(card);
  return el;
}

function buildCardHTML(card) {
  const d = card.data;
  switch (card.type) {
    case 'person': return buildPerson(d);
    case 'party':  return buildParty(d);
    case 'law':    return buildLaw(d);
    case 'news':   return buildNews(d);
    case 'note':   return buildNote(d);
    case 'date':   return buildDate(d);
    default: return '<div style="padding:10px;color:#333">?</div>';
  }
}

function buildPerson(d) {
  const photoHTML = d.photo
    ? `<img src="${d.photo}" style="width:100%;height:90px;object-fit:cover;" alt="${d.name}"/>`
    : `<div class="cp-photo">${d.emoji || '👤'}</div>`;
  return `
    <div class="card-person">
      ${photoHTML}
      <div class="cp-body">
        <div class="cp-name">${d.name}</div>
        <div class="cp-role">${d.role || ''}</div>
        ${d.party ? `<div class="cp-party" style="background:${d.partyColor||'#666'};color:#fff">${d.party}</div>` : ''}
      </div>
    </div>`;
}

function buildParty(d) {
  return `
    <div class="card-party" style="border-top-color:${d.color||'#ccc'}">
      <div class="cpa-logo">${d.logo||'🏛️'}</div>
      <div class="cpa-name">${d.name}</div>
      <div class="cpa-desc">${d.desc||''}</div>
    </div>`;
}

function buildLaw(d) {
  return `
    <div class="card-law">
      <div class="cl-date">📅 ${d.date||''}</div>
      <div class="cl-title">${d.title}</div>
      <div class="cl-desc">${d.desc||''}</div>
    </div>`;
}

function buildNews(d) {
  const accent = d.accentColor || '#e63946';
  return `
    <div class="card-news" style="border-top-color:${accent}">
      <div class="cn-src">${d.source||''}</div>
      <div class="cn-title">${d.title}</div>
      <div class="cn-body">${d.body||''}</div>
      ${d.url ? `<a class="cn-link" href="${d.url}" target="_blank">🔗 ${d.url}</a>` : ''}
    </div>`;
}

function buildNote(d) {
  const bg = NOTE_COLORS[d.color]?.bg || '#fff9c4';
  return `<div class="card-note" style="background:${bg}">${(d.text||'').replace(/\n/g,'<br>')}</div>`;
}

function buildDate(d) {
  const bg = NOTE_COLORS[d.color]?.bg || '#fff9c4';
  return `
    <div class="card-date" style="background:${bg}">
      <div class="cd-label">${d.label||'Data'}</div>
      <div class="cd-date">${d.date}</div>
    </div>`;
}

export function updateCardElement(el, card) {
  el.innerHTML = buildCardHTML(card);
  const angle = card.angle ?? 0;
  const skewX = angle * 0.1;
  el.style.transform = `rotate(${angle}deg) skewX(${skewX}deg)`;
  el.style.left = card.x + 'px';
  el.style.top = card.y + 'px';
}
