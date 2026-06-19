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
  white:   { head: '#f0f0f0', shadow: '#888'    },
  black:   { head: '#222',    shadow: '#000'    },
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
  or: '#f4511e', pu: '#6a1b9a', go: '#c8971c',
};

// ── DRY helpers ────────────────────────────────────────
// Escape HTML – używany wszędzie gdzie dane użytkownika idą do innerHTML
export function esc(s, fb = '') {
  if (s == null) return fb;
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Kolor tła karteczki notatki/daty
function noteColor(color) {
  return NOTE_COLORS[color]?.bg || '#fff9c4';
}

// Wspólne stylowanie elementu karty (DRY: createCardElement + updateCardElement)
function applyCardStyles(el, card) {
  const angle     = card.angle ?? 0;
  const skewX     = angle * 0.1;
  const shadowDir = angle > 0 ? 1 : -1;
  el.style.transform  = `rotate(${angle}deg) skewX(${skewX}deg)`;
  el.style.left       = card.x + 'px';
  el.style.top        = card.y + 'px';
  el.style.boxShadow  = `${shadowDir * 3}px 6px 18px rgba(0,0,0,0.38), ${shadowDir}px 2px 6px rgba(0,0,0,0.2)`;
  if (card.groupColor) {
    el.style.outline       = `3px solid ${card.groupColor}`;
    el.style.outlineOffset = '3px';
  } else {
    el.style.outline = '';
  }
}

// ── Pinezka ────────────────────────────────────────────
export function renderPinSvg(color) {
  const c = PIN_COLORS[color] || PIN_COLORS.red;
  return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="10" cy="7" rx="6" ry="6" fill="${c.head}"/>
    <ellipse cx="10" cy="6" rx="4" ry="3" fill="rgba(255,255,255,0.3)"/>
    <line x1="10" y1="13" x2="10" y2="20" stroke="${c.shadow}" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="10" cy="7" rx="6" ry="6" fill="none" stroke="${c.shadow}" stroke-width="0.5" opacity="0.4"/>
  </svg>`;
}

// ── Karta – tworzenie ──────────────────────────────────
export function createCardElement(card) {
  const el = document.createElement('div');
  el.className    = 'card';
  el.dataset.id   = card.id;
  el.dataset.type = card.type;
  // Ustal kąt przy pierwszym stworzeniu
  if (card.angle == null) card.angle = parseFloat((Math.random() * 10 - 5).toFixed(1));
  applyCardStyles(el, card);
  el.innerHTML = buildCardHTML(card);
  return el;
}

// ── Karta – aktualizacja (DRY: applyCardStyles) ────────
export function updateCardElement(el, card) {
  applyCardStyles(el, card);
  el.innerHTML = buildCardHTML(card);
}

// ── Budowanie HTML kart ────────────────────────────────
function buildCardHTML(card) {
  const d = card.data;
  switch (card.type) {
    case 'person':  return buildPerson(d);
    case 'unknown': return buildUnknown(d);
    case 'party':   return buildParty(d);
    case 'law':     return buildLaw(d);
    case 'news':    return buildNews(d);
    case 'note':    return buildNote(d);
    case 'date':    return buildDate(d);
    default:        return '<div style="padding:10px;color:#333">?</div>';
  }
}

function buildPerson(d) {
  const photoHTML = d.photo
    ? `<img src="${esc(d.photo)}" style="width:100%;height:90px;object-fit:cover;" alt="${esc(d.name)}"/>`
    : `<div class="cp-photo">${d.emoji || '👤'}</div>`;
  return `
    <div class="card-person">
      ${photoHTML}
      <div class="cp-body">
        <div class="cp-name">${esc(d.name)}</div>
        <div class="cp-role">${esc(d.role)}</div>
        ${d.party ? `<div class="cp-party" style="background:${esc(d.partyColor,'#666')};color:#fff">${esc(d.party)}</div>` : ''}
      </div>
    </div>`;
}

function buildUnknown(d) {
  return `
    <div class="card-person card-unknown">
      <div class="cp-photo" style="background:linear-gradient(135deg,#ccc,#999);font-size:3rem;color:#555">?</div>
      <div class="cp-body">
        <div class="cp-name" style="color:#888;font-style:italic">${esc(d.name, 'Nieznana osoba')}</div>
        <div class="cp-role">${esc(d.role)}</div>
      </div>
    </div>`;
}

function buildParty(d) {
  return `
    <div class="card-party" style="border-top-color:${esc(d.color,'#ccc')}">
      <div class="cpa-logo">${d.logo || '🏛️'}</div>
      <div class="cpa-name">${esc(d.name)}</div>
      <div class="cpa-desc">${esc(d.desc)}</div>
    </div>`;
}

function buildLaw(d) {
  return `
    <div class="card-law">
      <div class="cl-date">📅 ${esc(d.date)}</div>
      <div class="cl-title">${esc(d.title)}</div>
      <div class="cl-desc">${esc(d.desc)}</div>
    </div>`;
}

function buildNews(d) {
  const accent = esc(d.accentColor, '#e63946');
  return `
    <div class="card-news" style="border-top-color:${accent}">
      <div class="cn-src">${esc(d.source)}</div>
      <div class="cn-title">${esc(d.title)}</div>
      <div class="cn-body">${esc(d.body)}</div>
      ${d.url ? `<a class="cn-link" href="${esc(d.url)}" target="_blank" rel="noopener">🔗 ${esc(d.url)}</a>` : ''}
    </div>`;
}

function buildNote(d) {
  return `<div class="card-note" style="background:${noteColor(d.color)}">${esc(d.text).replace(/\n/g, '<br>')}</div>`;
}

function buildDate(d) {
  return `
    <div class="card-date" style="background:${noteColor(d.color)}">
      <div class="cd-label">${esc(d.label, 'Data')}</div>
      <div class="cd-date">${esc(d.date)}</div>
    </div>`;
}
