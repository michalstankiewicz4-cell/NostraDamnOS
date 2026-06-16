// app.js – główna logika aplikacji

import { createCardElement, updateCardElement, renderPinSvg, PIN_COLORS, NOTE_COLORS } from './cards.js';
import { renderAllThreads, drawTempThread, removeTempThread } from './threads.js';
import { computeViewPositions } from './views.js';
import { saveState, loadState } from './storage.js';
import { SAMPLE_DATA } from './data-sample.js';

// ── Stan ────────────────────────────────────────────────
let state = {
  cards: [],
  pins: [],
  threads: [],
  nextId: 1,
  currentView: 'basic',
  selectedPinColor: 'red',
  selectedThreadColor: 'r',
  selectedThreadColor2: 'w',
  selectedThreadStriped: false,
  selectedNoteColor: 'y',
  panelOpen: true,
  tool: 'select',
};

// ── DOM ─────────────────────────────────────────────────
const boardWrap   = document.getElementById('board-wrap');
const canvas      = document.getElementById('canvas');
const threadSvg   = document.getElementById('thread-svg');
const ctxMenu     = document.getElementById('ctx-menu');
const modalOverlay= document.getElementById('modal-overlay');
const modal       = document.getElementById('modal');
const sidePanel   = document.getElementById('side-panel');
const toggleBtn   = document.getElementById('toggle-panel');

let dragging     = null;   // { cardId, offsetX, offsetY }
let threadStart  = null;   // { pinId, x, y }
let selectedCardId = null;
let contextTarget  = null;

// ── Init ────────────────────────────────────────────────
export function init() {
  const saved = loadState();
  if (saved && saved.cards && saved.cards.length > 0) {
    state = { ...state, ...saved };
  } else {
    state.cards   = SAMPLE_DATA.cards;
    state.pins    = SAMPLE_DATA.pins;
    state.threads = SAMPLE_DATA.threads;
    state.nextId  = 300;
  }
  renderAll();
  bindEvents();
  updateViewBtns();
  updateToolBtns();
}

// ── Render ──────────────────────────────────────────────
function renderAll() {
  canvas.querySelectorAll('.card, .pin').forEach(el => el.remove());
  [...threadSvg.querySelectorAll('.thread-group')].forEach(el => el.remove());

  state.cards.forEach(card => canvas.appendChild(createCardElement(card)));
  state.pins.forEach(pin => canvas.appendChild(makePinEl(pin)));
  renderAllThreads(threadSvg, state.threads, state.pins);
}

function makePinEl(pin) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.dataset.id = pin.id;
  el.style.left = pin.x + 'px';
  el.style.top  = pin.y + 'px';
  el.innerHTML  = renderPinSvg(pin.color);
  return el;
}

// ── Events ──────────────────────────────────────────────
function bindEvents() {
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup',   onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('click', e => {
    if (!ctxMenu.contains(e.target)) hideCtxMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hideModal(); hideCtxMenu(); }
    if ((e.key === 'Delete' || e.key === 'Backspace')
        && selectedCardId
        && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      deleteCard(selectedCardId);
    }
  });
  toggleBtn.addEventListener('click', togglePanel);
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  const pin  = e.target.closest('.pin');
  const card = e.target.closest('.card');

  if (state.tool === 'thread' && pin) {
    const { x, y } = pinCanvasPos(pin);
    threadStart = { pinId: pin.dataset.id, x, y };
    e.preventDefault();
    return;
  }

  if (state.tool === 'pin' && card) {
    addPinToCard(card.dataset.id);
    e.preventDefault();
    return;
  }

  if (state.tool === 'delete') {
    if (pin)  { deletePin(pin.dataset.id);   return; }
    if (card) { deleteCard(card.dataset.id); return; }
    return;
  }

  // select / drag
  if (card) {
    const canvasRect = canvas.getBoundingClientRect();
    const cardRect   = card.getBoundingClientRect();
    dragging = {
      cardId:  card.dataset.id,
      offsetX: e.clientX - cardRect.left,
      offsetY: e.clientY - cardRect.top,
    };
    card.classList.add('dragging');
    selectCard(card.dataset.id);
    e.preventDefault();
  }
}

function onMouseMove(e) {
  if (dragging) {
    const canvasRect = canvas.getBoundingClientRect();
    const x = e.clientX - canvasRect.left - dragging.offsetX;
    const y = e.clientY - canvasRect.top  - dragging.offsetY;
    const card = state.cards.find(c => c.id === dragging.cardId);
    if (!card) return;
    card.x = x; card.y = y;
    const el = canvas.querySelector(`.card[data-id="${card.id}"]`);
    if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
    syncPinsOfCard(card.id);
    renderAllThreads(threadSvg, state.threads, state.pins);
    return;
  }

  if (threadStart) {
    const canvasRect = canvas.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    drawTempThread(threadSvg, threadStart.x, threadStart.y, x, y, state.selectedThreadColor);
  }
}

function onMouseUp(e) {
  if (dragging) {
    const el = canvas.querySelector(`.card[data-id="${dragging.cardId}"]`);
    if (el) el.classList.remove('dragging');
    dragging = null;
    save();
    return;
  }
  if (threadStart) {
    removeTempThread(threadSvg);
    const pin = e.target.closest('.pin');
    if (pin && pin.dataset.id !== threadStart.pinId) {
      addThread(threadStart.pinId, pin.dataset.id);
    }
    threadStart = null;
  }
}

function onContextMenu(e) {
  e.preventDefault();
  const pin  = e.target.closest('.pin');
  const card = e.target.closest('.card');
  if (!pin && !card) return;
  contextTarget = pin
    ? { type: 'pin',  id: pin.dataset.id }
    : { type: 'card', id: card.dataset.id };
  showCtxMenu(e.clientX, e.clientY);
}

// ── Helpers ─────────────────────────────────────────────
function pinCanvasPos(pinEl) {
  const cr = canvas.getBoundingClientRect();
  const pr = pinEl.getBoundingClientRect();
  return { x: pr.left + pr.width/2 - cr.left, y: pr.top + pr.height/2 - cr.top };
}

function syncPinsOfCard(cardId) {
  const cardEl = canvas.querySelector(`.card[data-id="${cardId}"]`);
  if (!cardEl) return;
  const cr  = canvas.getBoundingClientRect();
  const rect = cardEl.getBoundingClientRect();
  const cx  = rect.left + rect.width / 2 - cr.left;
  const cy  = rect.top  - cr.top + 4;
  state.pins.filter(p => p.cardId === cardId).forEach(pin => {
    pin.x = cx; pin.y = cy;
    const el = canvas.querySelector(`.pin[data-id="${pin.id}"]`);
    if (el) { el.style.left = pin.x + 'px'; el.style.top = pin.y + 'px'; }
  });
}

// ── Karty ───────────────────────────────────────────────
export function addCard(type, data) {
  const id    = 'card-' + (state.nextId++);
  const angle = parseFloat((Math.random() * 12 - 6).toFixed(1));
  const x     = 150 + Math.random() * 500;
  const y     = 150 + Math.random() * 250;
  const card  = { id, type, x, y, angle, data };
  state.cards.push(card);
  canvas.appendChild(createCardElement(card));
  save();
  return id;
}

function deleteCard(id) {
  state.pins.filter(p => p.cardId === id).map(p => p.id)
    .forEach(pid => deletePin(pid, false));
  state.cards = state.cards.filter(c => c.id !== id);
  canvas.querySelector(`.card[data-id="${id}"]`)?.remove();
  if (selectedCardId === id) selectedCardId = null;
  renderAllThreads(threadSvg, state.threads, state.pins);
  save();
}

function selectCard(id) {
  if (selectedCardId) {
    canvas.querySelector(`.card[data-id="${selectedCardId}"]`)?.classList.remove('selected');
  }
  selectedCardId = id;
  canvas.querySelector(`.card[data-id="${id}"]`)?.classList.add('selected');
}

// ── Pinezki ─────────────────────────────────────────────
function addPinToCard(cardId) {
  const el = canvas.querySelector(`.card[data-id="${cardId}"]`);
  if (!el) return;
  const cr   = canvas.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const pin = {
    id: 'pin-' + (state.nextId++),
    cardId,
    x: rect.left + rect.width / 2 - cr.left,
    y: rect.top - cr.top + 4,
    color: state.selectedPinColor,
  };
  state.pins.push(pin);
  canvas.appendChild(makePinEl(pin));
  save();
}

function deletePin(pinId, rerender = true) {
  state.threads = state.threads.filter(t => t.fromPin !== pinId && t.toPin !== pinId);
  state.pins    = state.pins.filter(p => p.id !== pinId);
  canvas.querySelector(`.pin[data-id="${pinId}"]`)?.remove();
  if (rerender) { renderAllThreads(threadSvg, state.threads, state.pins); save(); }
}

// ── Nitki ───────────────────────────────────────────────
function addThread(fromPinId, toPinId) {
  const dup = state.threads.find(t =>
    (t.fromPin === fromPinId && t.toPin === toPinId) ||
    (t.fromPin === toPinId   && t.toPin === fromPinId));
  if (dup) return;
  const thread = {
    id: 'thread-' + (state.nextId++),
    fromPin: fromPinId,
    toPin:   toPinId,
    color:   state.selectedThreadColor,
    striped: state.selectedThreadStriped,
    stripeColor2: state.selectedThreadColor2,
  };
  state.threads.push(thread);
  renderAllThreads(threadSvg, state.threads, state.pins);
  save();
}

// ── Widoki ──────────────────────────────────────────────
export function switchView(view) {
  state.currentView = view;
  updateViewBtns();

  // Włącz animację przejścia
  canvas.querySelectorAll('.card').forEach(el => el.classList.add('view-transition'));

  const positions = computeViewPositions(state.cards, view);
  state.cards.forEach(card => {
    const pos = positions[card.id];
    if (!pos) return;
    const el = canvas.querySelector(`.card[data-id="${card.id}"]`);
    if (!el) return;
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';
  });

  // Sync pinezek po animacji
  setTimeout(() => {
    state.cards.forEach(c => syncPinsOfCard(c.id));
    renderAllThreads(threadSvg, state.threads, state.pins);
    canvas.querySelectorAll('.card').forEach(el => el.classList.remove('view-transition'));
  }, 540);
}

function updateViewBtns() {
  document.querySelectorAll('.view-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === state.currentView));
}

// ── Narzędzia ────────────────────────────────────────────
export function setTool(tool) {
  state.tool = tool;
  canvas.style.cursor = { select:'default', pin:'cell', thread:'crosshair', delete:'not-allowed' }[tool] || 'default';
  updateToolBtns();
}

function updateToolBtns() {
  document.querySelectorAll('.tb-btn[data-tool]').forEach(b =>
    b.classList.toggle('active-tool', b.dataset.tool === state.tool));
}

export function setPinColor(c)    { state.selectedPinColor = c; }
export function setThreadColor(c, which) {
  if (which === 1) state.selectedThreadColor  = c;
  else             state.selectedThreadColor2 = c;
}
export function setThreadStriped(v) { state.selectedThreadStriped = v; }
export function setNoteColor(c)   { state.selectedNoteColor = c; }

// ── Panel ───────────────────────────────────────────────
export function togglePanel() {
  state.panelOpen = !state.panelOpen;
  sidePanel.classList.toggle('hidden', !state.panelOpen);
  boardWrap.classList.toggle('panel-hidden', !state.panelOpen);
  toggleBtn.classList.toggle('hidden-mode', !state.panelOpen);
  toggleBtn.style.right = state.panelOpen ? '200px' : '0';
  toggleBtn.querySelector('span').textContent = state.panelOpen ? '›' : '‹';
}

// ── Context menu ────────────────────────────────────────
function showCtxMenu(x, y) {
  ctxMenu.innerHTML = '';
  if (contextTarget.type === 'card') {
    addCtxItem('✏️', 'Edytuj kartę',    () => openEditModal(contextTarget.id));
    addCtxItem('📌', 'Wbij pinezkę',    () => addPinToCard(contextTarget.id));
    addCtxSep();
    addCtxItem('🗑️', 'Usuń kartę',      () => deleteCard(contextTarget.id));
  } else {
    addCtxItem('🗑️', 'Usuń pinezkę',   () => deletePin(contextTarget.id));
  }
  ctxMenu.style.left = x + 'px';
  ctxMenu.style.top  = y + 'px';
  ctxMenu.classList.add('visible');
}

function addCtxItem(icon, label, fn) {
  const el = document.createElement('div');
  el.className = 'ctx-item';
  el.innerHTML = `<span>${icon}</span>${label}`;
  el.onclick = () => { fn(); hideCtxMenu(); };
  ctxMenu.appendChild(el);
}
function addCtxSep() {
  const el = document.createElement('div');
  el.className = 'ctx-sep';
  ctxMenu.appendChild(el);
}
function hideCtxMenu() { ctxMenu.classList.remove('visible'); }

// ── Modal ───────────────────────────────────────────────
let modalType = null;
let editingId = null;

export function openAddModal(type) {
  modalType = type; editingId = null;
  renderModal(type, null);
}

function openEditModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  modalType = card.type; editingId = cardId;
  renderModal(card.type, card.data);
}

function renderModal(type, d) {
  modal.innerHTML = buildModalHTML(type, d);
  modalOverlay.classList.add('visible');
  modal.querySelector('.modal-btn.primary').onclick = submitModal;
  modal.querySelector('.modal-btn.cancel').onclick  = hideModal;
  modal.querySelector('input, textarea')?.focus();
}

function hideModal() { modalOverlay.classList.remove('visible'); }

function submitModal() {
  const data = readModalForm(modalType);
  if (!data) return;
  if (editingId) {
    const card = state.cards.find(c => c.id === editingId);
    if (card) {
      card.data = data;
      const el = canvas.querySelector(`.card[data-id="${editingId}"]`);
      if (el) updateCardElement(el, card);
    }
    save();
  } else {
    addCard(modalType, data);
  }
  hideModal();
}

function buildModalHTML(type, d) {
  const noteOpts = Object.entries(NOTE_COLORS)
    .map(([k,v]) => `<option value="${k}"${d?.color===k?' selected':''}>${v.label}</option>`).join('');

  let fields = '';
  if (type === 'person') {
    fields = `
      <div class="modal-field"><label>Imię i nazwisko *</label><input id="mf-name" value="${esc(d?.name)}"/></div>
      <div class="modal-field"><label>Funkcja / rola</label><input id="mf-role" value="${esc(d?.role)}"/></div>
      <div class="modal-field"><label>Partia</label><input id="mf-party" value="${esc(d?.party)}"/></div>
      <div class="modal-field"><label>Kolor partii (hex)</label><input id="mf-partyColor" value="${esc(d?.partyColor,'#666666')}"/></div>
      <div class="modal-field"><label>Emoji (avatar)</label><input id="mf-emoji" value="${esc(d?.emoji,'👤')}"/></div>
      <div class="modal-field"><label>URL zdjęcia</label><input id="mf-photo" value="${esc(d?.photo)}"/></div>`;
  } else if (type === 'party') {
    fields = `
      <div class="modal-field"><label>Nazwa partii *</label><input id="mf-name" value="${esc(d?.name)}"/></div>
      <div class="modal-field"><label>Logo (emoji)</label><input id="mf-logo" value="${esc(d?.logo,'🏛️')}"/></div>
      <div class="modal-field"><label>Kolor (hex)</label><input id="mf-color" value="${esc(d?.color,'#666666')}"/></div>
      <div class="modal-field"><label>Opis</label><textarea id="mf-desc">${esc(d?.desc)}</textarea></div>`;
  } else if (type === 'law') {
    fields = `
      <div class="modal-field"><label>Tytuł ustawy *</label><input id="mf-title" value="${esc(d?.title)}"/></div>
      <div class="modal-field"><label>Data (RRRR-MM-DD)</label><input id="mf-date" value="${esc(d?.date)}"/></div>
      <div class="modal-field"><label>Opis</label><textarea id="mf-desc">${esc(d?.desc)}</textarea></div>`;
  } else if (type === 'news') {
    fields = `
      <div class="modal-field"><label>Źródło</label><input id="mf-source" value="${esc(d?.source)}"/></div>
      <div class="modal-field"><label>Nagłówek *</label><input id="mf-title" value="${esc(d?.title)}"/></div>
      <div class="modal-field"><label>Treść</label><textarea id="mf-body">${esc(d?.body)}</textarea></div>
      <div class="modal-field"><label>Link URL</label><input id="mf-url" value="${esc(d?.url)}"/></div>`;
  } else if (type === 'note') {
    fields = `
      <div class="modal-field"><label>Treść notatki</label><textarea id="mf-text">${esc(d?.text)}</textarea></div>
      <div class="modal-field"><label>Kolor karteczki</label><select id="mf-color">${noteOpts}</select></div>`;
  } else if (type === 'date') {
    fields = `
      <div class="modal-field"><label>Etykieta</label><input id="mf-label" value="${esc(d?.label,'Data')}"/></div>
      <div class="modal-field"><label>Data *</label><input id="mf-date" value="${esc(d?.date)}"/></div>
      <div class="modal-field"><label>Kolor karteczki</label><select id="mf-color">${noteOpts}</select></div>`;
  }

  const titles = { person:'Osoba', party:'Partia', law:'Ustawa', news:'News', note:'Notatka', date:'Data' };
  return `<h3>${titles[type] || type}</h3>${fields}
    <div class="modal-btns">
      <button class="modal-btn cancel">Anuluj</button>
      <button class="modal-btn primary">Zapisz</button>
    </div>`;
}

function readModalForm(type) {
  const v = id => (document.getElementById(id)?.value ?? '').trim();
  const sel = id => document.getElementById(id)?.value || 'y';
  if (type === 'person') {
    const name = v('mf-name'); if (!name) return alert('Podaj imię i nazwisko'), null;
    return { name, role:v('mf-role'), party:v('mf-party'), partyColor:v('mf-partyColor')||'#666', emoji:v('mf-emoji')||'👤', photo:v('mf-photo') };
  }
  if (type === 'party') {
    const name = v('mf-name'); if (!name) return alert('Podaj nazwę partii'), null;
    return { name, logo:v('mf-logo')||'🏛️', color:v('mf-color')||'#666', desc:v('mf-desc') };
  }
  if (type === 'law') {
    const title = v('mf-title'); if (!title) return alert('Podaj tytuł ustawy'), null;
    return { title, date:v('mf-date'), desc:v('mf-desc') };
  }
  if (type === 'news') {
    const title = v('mf-title'); if (!title) return alert('Podaj nagłówek'), null;
    return { source:v('mf-source'), title, body:v('mf-body'), url:v('mf-url'), accentColor:'#e63946' };
  }
  if (type === 'note') { return { text:v('mf-text'), color:sel('mf-color') }; }
  if (type === 'date') {
    const date = v('mf-date'); if (!date) return alert('Podaj datę'), null;
    return { label:v('mf-label')||'Data', date, color:sel('mf-color') };
  }
  return null;
}

function esc(s, fallback = '') {
  if (s == null) return fallback;
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Reset / Clear ────────────────────────────────────────
export function resetToSample() {
  if (!confirm('Przywrócić przykładowe dane? Zmiany zostaną utracone.')) return;
  state.cards   = SAMPLE_DATA.cards.map(c => ({ ...c, data: { ...c.data } }));
  state.pins    = SAMPLE_DATA.pins.map(p => ({ ...p }));
  state.threads = SAMPLE_DATA.threads.map(t => ({ ...t }));
  state.nextId  = 300;
  renderAll();
  save();
}

export function clearBoard() {
  if (!confirm('Wyczyścić całą tablicę?')) return;
  state.cards = []; state.pins = []; state.threads = []; state.nextId = 1;
  renderAll();
  save();
}

// ── Zapis ────────────────────────────────────────────────
function save() {
  saveState({ cards: state.cards, pins: state.pins, threads: state.threads, nextId: state.nextId });
}
