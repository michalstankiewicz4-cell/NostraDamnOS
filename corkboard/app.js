// app.js – główna logika aplikacji

import { createCardElement, updateCardElement, renderPinSvg, PIN_COLORS, NOTE_COLORS } from './cards.js';
import { renderAllThreads, drawTempThread, removeTempThread } from './threads.js';
import { computeViewPositions } from './views.js';
import { saveState, loadState } from './storage.js';
import { SAMPLE_DATA } from './data-sample.js';
import { Minimap } from './minimap.js';
import { exportJSON, importJSON, exportPNG, saveToHash, loadFromHash } from './export.js';

// ── Stan ────────────────────────────────────────────────
let state = {
  cards: [], pins: [], threads: [],
  nextId: 1, currentView: 'basic',
  selectedPinColor: 'red',
  selectedThreadColor: 'r', selectedThreadColor2: 'w',
  selectedThreadStriped: false, selectedThreadWidth: 1.8,
  selectedNoteColor: 'y',
  panelOpen: true, tool: 'select',
  filterCardId: null,   // filtrowanie powiązań
  groups: [],           // [{id, name, color, cardIds[]}]
};

// ── DOM ─────────────────────────────────────────────────
const boardWrap    = document.getElementById('board-wrap');
const canvas       = document.getElementById('canvas');
const threadSvg    = document.getElementById('thread-svg');
const ctxMenu      = document.getElementById('ctx-menu');
const modalOverlay = document.getElementById('modal-overlay');
const modal        = document.getElementById('modal');
const sidePanel    = document.getElementById('side-panel');
const toggleBtn    = document.getElementById('toggle-panel');

let dragging      = null;
let threadStart   = null;
let selectedCardId= null;
let contextTarget = null;
let selecting     = [];   // ID kart zaznaczonych do grupowania

// Pan + Zoom
let pan    = { x: 0, y: 0 };
let zoom   = 1.0;
const ZOOM_MIN = 0.25, ZOOM_MAX = 4.0, ZOOM_STEP = 0.1;
let panning = null;

// Minimap
let minimap = null;

// ── Init ────────────────────────────────────────────────
export function init() {
  // Próba wczytania: hash → localStorage → przykładowe dane
  const fromHash = loadFromHash();
  const saved    = loadState();
  if (fromHash && fromHash.cards.length) {
    state = { ...state, ...fromHash };
    state.nextId = 300;
  } else if (saved && saved.cards && saved.cards.length) {
    state = { ...state, ...saved };
  } else {
    state.cards   = SAMPLE_DATA.cards.map(c => ({...c, data:{...c.data}}));
    state.pins    = SAMPLE_DATA.pins.map(p => ({...p}));
    state.threads = SAMPLE_DATA.threads.map(t => ({...t}));
    state.nextId  = 300;
  }

  // Minimap
  const mmEl = document.getElementById('minimap-container');
  if (mmEl) minimap = new Minimap(mmEl);

  renderAll();
  bindEvents();
  updateViewBtns();
  updateToolBtns();
  scheduleMinimap();
}

// ── Render ──────────────────────────────────────────────
function renderAll() {
  canvas.querySelectorAll('.card, .pin').forEach(el => el.remove());
  [...threadSvg.querySelectorAll('.thread-group')].forEach(el => el.remove());

  const visible = getVisibleCards();
  visible.forEach(card => canvas.appendChild(createCardElement(card)));
  state.pins.forEach(pin => {
    const card = state.cards.find(c => c.id === pin.cardId);
    if (!card || visible.includes(card)) canvas.appendChild(makePinEl(pin));
  });
  renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
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

// Filtrowanie widoczności
function getVisibleCards() {
  if (!state.filterCardId) return state.cards;
  const connected = getConnectedCards(state.filterCardId);
  connected.add(state.filterCardId);
  return state.cards.filter(c => connected.has(c.id));
}

function getVisibleThreads() {
  if (!state.filterCardId) return state.threads;
  const connected = getConnectedCards(state.filterCardId);
  connected.add(state.filterCardId);
  const pinMap = {};
  state.pins.forEach(p => { pinMap[p.id] = p; });
  return state.threads.filter(t => {
    const a = pinMap[t.fromPin]?.cardId;
    const b = pinMap[t.toPin]?.cardId;
    return connected.has(a) || connected.has(b);
  });
}

function getConnectedCards(cardId, depth = 3) {
  const pinMap = {};
  state.pins.forEach(p => { pinMap[p.id] = p; });
  const cardPins = {};
  state.pins.forEach(p => {
    if (!cardPins[p.cardId]) cardPins[p.cardId] = [];
    cardPins[p.cardId].push(p.id);
  });
  const visited = new Set();
  const queue   = [cardId];
  for (let d = 0; d < depth && queue.length; d++) {
    const next = [];
    queue.forEach(cid => {
      if (visited.has(cid)) return;
      visited.add(cid);
      (cardPins[cid] || []).forEach(pid => {
        state.threads.forEach(t => {
          const other = t.fromPin === pid ? pinMap[t.toPin]?.cardId
                      : t.toPin   === pid ? pinMap[t.fromPin]?.cardId
                      : null;
          if (other && !visited.has(other)) next.push(other);
        });
      });
    });
    queue.length = 0;
    queue.push(...next);
  }
  return visited;
}

// ── Events ──────────────────────────────────────────────
function bindEvents() {
  canvas.addEventListener('mousedown', onMouseDown);
  boardWrap.addEventListener('mousedown', onMiddleDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup',   onMouseUp);
  boardWrap.addEventListener('auxclick', e => e.preventDefault());
  boardWrap.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('dblclick', onDblClick);
  document.addEventListener('click', e => {
    if (!ctxMenu.contains(e.target)) hideCtxMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideModal(); hideCtxMenu();
      clearFilter();
      clearSelection();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace')
        && selectedCardId
        && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      deleteCard(selectedCardId);
    }
    // Ctrl+Z – nie implementujemy pełnego undo, ale resetujemy zoom
    if ((e.ctrlKey || e.metaKey) && e.key === '0') resetView();
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
    e.preventDefault(); return;
  }
  if (state.tool === 'pin' && card) {
    addPinToCard(card.dataset.id);
    e.preventDefault(); return;
  }
  if (state.tool === 'delete') {
    if (pin)  { deletePin(pin.dataset.id);   return; }
    if (card) { deleteCard(card.dataset.id); return; }
    return;
  }
  if (state.tool === 'group' && card) {
    toggleGroupSelection(card.dataset.id);
    e.preventDefault(); return;
  }
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

function onMiddleDown(e) {
  if (e.button !== 1) return;
  e.preventDefault();
  panning = { startX: e.clientX, startY: e.clientY, panX0: pan.x, panY0: pan.y };
  boardWrap.style.cursor = 'grabbing';
}

function onMouseMove(e) {
  if (panning) {
    pan.x = panning.panX0 + (e.clientX - panning.startX);
    pan.y = panning.panY0 + (e.clientY - panning.startY);
    applyTransform();
    scheduleMinimap();
    return;
  }
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
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
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
  if (panning) { panning = null; boardWrap.style.cursor = ''; return; }
  if (dragging) {
    canvas.querySelector(`.card[data-id="${dragging.cardId}"]`)?.classList.remove('dragging');
    dragging = null;
    save();
    scheduleMinimap();
    return;
  }
  if (threadStart) {
    removeTempThread(threadSvg);
    const pin = e.target.closest('.pin');
    if (pin && pin.dataset.id !== threadStart.pinId) addThread(threadStart.pinId, pin.dataset.id);
    threadStart = null;
  }
}

function onDblClick(e) {
  // Podwójny klik na tablicy (nie na karcie) = szybka notatka
  const card = e.target.closest('.card');
  if (card) return;
  const canvasRect = canvas.getBoundingClientRect();
  const x = e.clientX - canvasRect.left;
  const y = e.clientY - canvasRect.top;
  const id = addCard('note', { text: '', color: state.selectedNoteColor }, x, y);
  // Otwórz od razu edytor
  setTimeout(() => openEditModal(id), 80);
}

function onWheel(e) {
  e.preventDefault();
  const rect = boardWrap.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const delta   = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(zoom + delta).toFixed(2)));
  if (newZoom === zoom) return;
  pan.x = mx - (mx - pan.x) * (newZoom / zoom);
  pan.y = my - (my - pan.y) * (newZoom / zoom);
  zoom  = newZoom;
  applyTransform();
  scheduleMinimap();
  document.getElementById('zoom-label').textContent = Math.round(zoom * 100) + '%';
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

function onThreadClick(threadId) {
  if (state.tool !== 'delete') {
    openThreadEditModal(threadId);
  } else {
    deleteThread(threadId);
  }
}

// ── Transform ────────────────────────────────────────────
function applyTransform() {
  const t = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  canvas.style.transform         = t;
  canvas.style.transformOrigin   = '0 0';
  threadSvg.style.transform      = t;
  threadSvg.style.transformOrigin= '0 0';
}

export function resetView() {
  pan = { x: 0, y: 0 }; zoom = 1;
  applyTransform();
  document.getElementById('zoom-label').textContent = '100%';
  scheduleMinimap();
}

// ── Helpers ──────────────────────────────────────────────
function pinCanvasPos(pinEl) {
  const cr = canvas.getBoundingClientRect();
  const pr = pinEl.getBoundingClientRect();
  return { x: pr.left + pr.width/2 - cr.left, y: pr.top + pr.height/2 - cr.top };
}

function syncPinsOfCard(cardId) {
  const el = canvas.querySelector(`.card[data-id="${cardId}"]`);
  if (!el) return;
  const cr   = canvas.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const cx   = rect.left + rect.width / 2 - cr.left;
  const cy   = rect.top  - cr.top + 4;
  state.pins.filter(p => p.cardId === cardId).forEach(pin => {
    pin.x = cx; pin.y = cy;
    const pel = canvas.querySelector(`.pin[data-id="${pin.id}"]`);
    if (pel) { pel.style.left = pin.x + 'px'; pel.style.top = pin.y + 'px'; }
  });
}

let minimapTimer = null;
function scheduleMinimap() {
  clearTimeout(minimapTimer);
  minimapTimer = setTimeout(() => {
    if (!minimap) return;
    const bw = boardWrap.clientWidth, bh = boardWrap.clientHeight;
    minimap.update(state.cards, state.pins, state.threads, pan, zoom, 1800, 900, bw, bh);
  }, 80);
}

// ── Karty ───────────────────────────────────────────────
export function addCard(type, data, x, y) {
  const id    = 'card-' + (state.nextId++);
  const angle = parseFloat((Math.random() * 12 - 6).toFixed(1));
  x = x ?? 150 + Math.random() * 500;
  y = y ?? 150 + Math.random() * 250;
  const card = { id, type, x, y, angle, data };
  state.cards.push(card);
  canvas.appendChild(createCardElement(card));
  save();
  scheduleMinimap();
  return id;
}

function deleteCard(id) {
  state.pins.filter(p => p.cardId === id).map(p => p.id)
    .forEach(pid => deletePin(pid, false));
  state.cards = state.cards.filter(c => c.id !== id);
  canvas.querySelector(`.card[data-id="${id}"]`)?.remove();
  if (selectedCardId === id) selectedCardId = null;
  if (state.filterCardId === id) state.filterCardId = null;
  renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
  save(); scheduleMinimap();
}

function selectCard(id) {
  if (selectedCardId) canvas.querySelector(`.card[data-id="${selectedCardId}"]`)?.classList.remove('selected');
  selectedCardId = id;
  canvas.querySelector(`.card[data-id="${id}"]`)?.classList.add('selected');
}

// ── Filtrowanie powiązań ─────────────────────────────────
export function filterByCard(cardId) {
  state.filterCardId = state.filterCardId === cardId ? null : cardId;
  const btn = document.getElementById('filter-btn');
  if (btn) btn.classList.toggle('active-tool', !!state.filterCardId);
  renderAll();
}

function clearFilter() {
  if (!state.filterCardId) return;
  state.filterCardId = null;
  renderAll();
}

// ── Grupowanie ───────────────────────────────────────────
function toggleGroupSelection(cardId) {
  const idx = selecting.indexOf(cardId);
  if (idx >= 0) selecting.splice(idx, 1);
  else selecting.push(cardId);
  canvas.querySelectorAll('.card').forEach(el => {
    el.classList.toggle('group-selecting', selecting.includes(el.dataset.id));
  });
  document.getElementById('group-count').textContent = selecting.length
    ? `${selecting.length} zaznaczonych – ` : '';
}

function clearSelection() {
  selecting = [];
  canvas.querySelectorAll('.card.group-selecting').forEach(el => el.classList.remove('group-selecting'));
  document.getElementById('group-count').textContent = '';
}

export function createGroup() {
  if (selecting.length < 2) { alert('Zaznacz co najmniej 2 karty (narzędzie Grupuj)'); return; }
  openGroupModal(selecting.slice());
}

function openGroupModal(cardIds) {
  modal.innerHTML = `
    <h3>🗂 Nowa grupa</h3>
    <div class="modal-field"><label>Nazwa grupy</label><input id="gf-name" value="Grupa"/></div>
    <div class="modal-field"><label>Kolor obramowania</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px" id="gf-colors">
        ${['#e63946','#2e7d32','#1565c0','#f9c811','#9b59b6','#f4511e','#0097a7'].map(
          c => `<div data-c="${c}" onclick="document.querySelectorAll('#gf-colors div').forEach(d=>d.classList.remove('active'));this.classList.add('active')"
            style="width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer;border:2px solid transparent;transition:all .15s"></div>`
        ).join('')}
      </div>
    </div>
    <div class="modal-btns">
      <button class="modal-btn cancel" onclick="hideModalUI()">Anuluj</button>
      <button class="modal-btn primary" id="gf-ok">Utwórz</button>
    </div>`;
  modalOverlay.classList.add('visible');
  // Zaznacz pierwszy kolor
  modal.querySelector('#gf-colors div').classList.add('active');
  modal.querySelector('#gf-ok').onclick = () => {
    const name  = modal.querySelector('#gf-name').value.trim() || 'Grupa';
    const color = modal.querySelector('#gf-colors div.active')?.dataset.c || '#e63946';
    const gid   = 'group-' + (state.nextId++);
    state.groups.push({ id: gid, name, color, cardIds });
    // Ustaw groupColor na kartach
    cardIds.forEach(cid => {
      const card = state.cards.find(c => c.id === cid);
      if (card) card.groupColor = color;
      const el = canvas.querySelector(`.card[data-id="${cid}"]`);
      if (el) updateCardElement(el, card);
    });
    clearSelection();
    hideModal();
    save();
  };
}

window.hideModalUI = hideModal;

// ── Pinezki ──────────────────────────────────────────────
function addPinToCard(cardId) {
  const el = canvas.querySelector(`.card[data-id="${cardId}"]`);
  if (!el) return;
  const cr   = canvas.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const pin = {
    id: 'pin-' + (state.nextId++), cardId,
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
  if (rerender) { renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick); save(); }
}

// ── Nitki ────────────────────────────────────────────────
function addThread(fromPinId, toPinId) {
  const dup = state.threads.find(t =>
    (t.fromPin===fromPinId && t.toPin===toPinId) ||
    (t.fromPin===toPinId   && t.toPin===fromPinId));
  if (dup) return;
  state.threads.push({
    id: 'thread-' + (state.nextId++),
    fromPin: fromPinId, toPin: toPinId,
    color: state.selectedThreadColor,
    striped: state.selectedThreadStriped,
    stripeColor2: state.selectedThreadColor2,
    width: state.selectedThreadWidth,
    label: '',
  });
  renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
  save();
}

function deleteThread(threadId) {
  state.threads = state.threads.filter(t => t.id !== threadId);
  renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
  save();
}

function openThreadEditModal(threadId) {
  const t = state.threads.find(th => th.id === threadId);
  if (!t) return;
  modal.innerHTML = `
    <h3>✏️ Edytuj nitkę</h3>
    <div class="modal-field"><label>Etykieta (opis połączenia)</label>
      <input id="tf-label" value="${esc(t.label)}" placeholder="np. finansuje, głosował za…"/></div>
    <div class="modal-field"><label>Grubość</label>
      <select id="tf-width">
        <option value="1" ${t.width==1?'selected':''}>Cienka</option>
        <option value="1.8" ${(t.width==1.8||!t.width)?'selected':''}>Normalna</option>
        <option value="3" ${t.width==3?'selected':''}>Gruba</option>
        <option value="5" ${t.width==5?'selected':''}>Bardzo gruba</option>
      </select></div>
    <div class="modal-btns">
      <button class="modal-btn cancel" style="background:rgba(230,57,70,.15);color:#e63946;border-color:rgba(230,57,70,.3)"
        onclick="deleteThreadUI('${threadId}')">🗑 Usuń nitkę</button>
      <button class="modal-btn cancel" onclick="hideModalUI()">Anuluj</button>
      <button class="modal-btn primary" id="tf-ok">Zapisz</button>
    </div>`;
  modalOverlay.classList.add('visible');
  modal.querySelector('#tf-ok').onclick = () => {
    t.label = modal.querySelector('#tf-label').value.trim();
    t.width = parseFloat(modal.querySelector('#tf-width').value);
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
    hideModal(); save();
  };
}

window.deleteThreadUI = (id) => { deleteThread(id); hideModal(); };

// ── Widoki ───────────────────────────────────────────────
export function switchView(view) {
  state.currentView = view;
  updateViewBtns();
  canvas.querySelectorAll('.card').forEach(el => el.classList.add('view-transition'));
  const positions = computeViewPositions(state.cards, view, state.threads, state.pins);
  state.cards.forEach(card => {
    const pos = positions[card.id];
    if (!pos) return;
    const el = canvas.querySelector(`.card[data-id="${card.id}"]`);
    if (el) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
  });
  setTimeout(() => {
    state.cards.forEach(c => syncPinsOfCard(c.id));
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
    canvas.querySelectorAll('.card').forEach(el => el.classList.remove('view-transition'));
    scheduleMinimap();
  }, 540);
}

function updateViewBtns() {
  document.querySelectorAll('.view-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === state.currentView));
}

// ── Narzędzia ─────────────────────────────────────────────
export function setTool(tool) {
  state.tool = tool;
  if (tool !== 'group') clearSelection();
  canvas.style.cursor = { select:'default', pin:'cell', thread:'crosshair', delete:'not-allowed', group:'copy', filter:'zoom-in' }[tool] || 'default';
  updateToolBtns();
  const hints = {
    select:  'Przeciągaj karty myszką',
    pin:     'Kliknij kartę aby wbić pinezkę',
    thread:  'Przeciągnij od pinezki do pinezki',
    delete:  'Kliknij kartę, pinezkę lub nitkę aby usunąć',
    group:   'Kliknij karty aby zaznaczyć, potem „Utwórz grupę"',
    filter:  'Kliknij kartę aby pokazać tylko powiązane',
  };
  document.getElementById('tool-hint').textContent = hints[tool] || '';
  document.getElementById('group-actions').style.display = tool === 'group' ? 'flex' : 'none';
}

function updateToolBtns() {
  document.querySelectorAll('.tb-btn[data-tool]').forEach(b =>
    b.classList.toggle('active-tool', b.dataset.tool === state.tool));
}

export function setPinColor(c)        { state.selectedPinColor = c; }
export function setThreadColor(c, w)  { if(w===1) state.selectedThreadColor=c; else state.selectedThreadColor2=c; }
export function setThreadStriped(v)   { state.selectedThreadStriped = v; }
export function setThreadWidth(v)     { state.selectedThreadWidth = parseFloat(v); }
export function setNoteColor(c)       { state.selectedNoteColor = c; }

// ── Panel ─────────────────────────────────────────────────
export function togglePanel() {
  state.panelOpen = !state.panelOpen;
  sidePanel.classList.toggle('hidden', !state.panelOpen);
  boardWrap.classList.toggle('panel-hidden', !state.panelOpen);
  toggleBtn.classList.toggle('hidden-mode', !state.panelOpen);
  toggleBtn.style.right = state.panelOpen ? '200px' : '0';
  toggleBtn.querySelector('span').textContent = state.panelOpen ? '›' : '‹';
  document.getElementById('board-frame')?.classList.toggle('panel-hidden', !state.panelOpen);
}

// ── Context menu ──────────────────────────────────────────
function showCtxMenu(x, y) {
  ctxMenu.innerHTML = '';
  if (contextTarget.type === 'card') {
    const card = state.cards.find(c => c.id === contextTarget.id);
    addCtxItem('✏️', 'Edytuj kartę',         () => openEditModal(contextTarget.id));
    addCtxItem('📌', 'Wbij pinezkę',          () => addPinToCard(contextTarget.id));
    addCtxItem('🔍', 'Filtruj powiązania',    () => { filterByCard(contextTarget.id); setTool('select'); });
    addCtxSep();
    addCtxItem('🗑️', 'Usuń kartę',            () => deleteCard(contextTarget.id));
  } else {
    addCtxItem('🗑️', 'Usuń pinezkę',         () => deletePin(contextTarget.id));
  }
  ctxMenu.style.left = x + 'px'; ctxMenu.style.top = y + 'px';
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
  const el = document.createElement('div'); el.className = 'ctx-sep'; ctxMenu.appendChild(el);
}
function hideCtxMenu() { ctxMenu.classList.remove('visible'); }

// ── Modal ─────────────────────────────────────────────────
let modalType = null, editingId = null;

export function openAddModal(type) { modalType=type; editingId=null; renderModal(type,null); }

function openEditModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  modalType=card.type; editingId=cardId; renderModal(card.type, card.data);
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
    if (card) { card.data = data; const el = canvas.querySelector(`.card[data-id="${editingId}"]`); if (el) updateCardElement(el, card); }
    save();
  } else { addCard(modalType, data); }
  hideModal();
}

function buildModalHTML(type, d) {
  const noteOpts = Object.entries(NOTE_COLORS)
    .map(([k,v]) => `<option value="${k}"${d?.color===k?' selected':''}>${v.label}</option>`).join('');
  const newsAccents = ['#e63946','#1565c0','#2e7d32','#9b59b6','#f4511e','#0097a7','#c8971c']
    .map(c=>`<option value="${c}"${d?.accentColor===c?' selected':''}>${c}</option>`).join('');
  let fields = '';
  if (type==='person'||type==='unknown') {
    fields=`
      <div class="modal-field"><label>Imię i nazwisko *</label><input id="mf-name" value="${esc(d?.name)}"/></div>
      <div class="modal-field"><label>Funkcja / rola</label><input id="mf-role" value="${esc(d?.role)}"/></div>
      <div class="modal-field"><label>Partia</label><input id="mf-party" value="${esc(d?.party)}"/></div>
      <div class="modal-field"><label>Kolor partii</label><input id="mf-partyColor" value="${esc(d?.partyColor,'#666666')}"/></div>
      <div class="modal-field"><label>Emoji (avatar)</label><input id="mf-emoji" value="${esc(d?.emoji,'👤')}"/></div>
      <div class="modal-field"><label>URL zdjęcia</label><input id="mf-photo" value="${esc(d?.photo)}"/></div>`;
  } else if (type==='party') {
    fields=`
      <div class="modal-field"><label>Nazwa partii *</label><input id="mf-name" value="${esc(d?.name)}"/></div>
      <div class="modal-field"><label>Logo (emoji)</label><input id="mf-logo" value="${esc(d?.logo,'🏛️')}"/></div>
      <div class="modal-field"><label>Kolor (hex)</label><input id="mf-color" value="${esc(d?.color,'#666666')}"/></div>
      <div class="modal-field"><label>Opis</label><textarea id="mf-desc">${esc(d?.desc)}</textarea></div>`;
  } else if (type==='law') {
    fields=`
      <div class="modal-field"><label>Tytuł ustawy *</label><input id="mf-title" value="${esc(d?.title)}"/></div>
      <div class="modal-field"><label>Data</label><input id="mf-date" value="${esc(d?.date)}"/></div>
      <div class="modal-field"><label>Opis</label><textarea id="mf-desc">${esc(d?.desc)}</textarea></div>`;
  } else if (type==='news') {
    fields=`
      <div class="modal-field"><label>Źródło</label><input id="mf-source" value="${esc(d?.source)}"/></div>
      <div class="modal-field"><label>Nagłówek *</label><input id="mf-title" value="${esc(d?.title)}"/></div>
      <div class="modal-field"><label>Treść</label><textarea id="mf-body">${esc(d?.body)}</textarea></div>
      <div class="modal-field"><label>Link URL</label><input id="mf-url" value="${esc(d?.url)}"/></div>
      <div class="modal-field"><label>Kolor akcentu</label><select id="mf-accent">${newsAccents}</select></div>`;
  } else if (type==='note') {
    fields=`
      <div class="modal-field"><label>Treść notatki</label><textarea id="mf-text">${esc(d?.text)}</textarea></div>
      <div class="modal-field"><label>Kolor</label><select id="mf-color">${noteOpts}</select></div>`;
  } else if (type==='date') {
    fields=`
      <div class="modal-field"><label>Etykieta</label><input id="mf-label" value="${esc(d?.label,'Data')}"/></div>
      <div class="modal-field"><label>Data *</label><input id="mf-date" value="${esc(d?.date)}"/></div>
      <div class="modal-field"><label>Kolor</label><select id="mf-color">${noteOpts}</select></div>`;
  }
  const titles={person:'Osoba',unknown:'Nieznana osoba',party:'Partia',law:'Ustawa',news:'News',note:'Notatka',date:'Data'};
  return `<h3>${titles[type]||type}</h3>${fields}
    <div class="modal-btns">
      <button class="modal-btn cancel">Anuluj</button>
      <button class="modal-btn primary">Zapisz</button>
    </div>`;
}

function readModalForm(type) {
  const v   = id => (document.getElementById(id)?.value??'').trim();
  const sel = id => document.getElementById(id)?.value||'y';
  if (type==='person'||type==='unknown') {
    const name=v('mf-name'); if(!name) return alert('Podaj imię'),null;
    return { name, role:v('mf-role'), party:v('mf-party'), partyColor:v('mf-partyColor')||'#666', emoji:v('mf-emoji')||'👤', photo:v('mf-photo') };
  }
  if (type==='party') {
    const name=v('mf-name'); if(!name) return alert('Podaj nazwę'),null;
    return { name, logo:v('mf-logo')||'🏛️', color:v('mf-color')||'#666', desc:v('mf-desc') };
  }
  if (type==='law') {
    const title=v('mf-title'); if(!title) return alert('Podaj tytuł'),null;
    return { title, date:v('mf-date'), desc:v('mf-desc') };
  }
  if (type==='news') {
    const title=v('mf-title'); if(!title) return alert('Podaj nagłówek'),null;
    return { source:v('mf-source'), title, body:v('mf-body'), url:v('mf-url'), accentColor:sel('mf-accent') };
  }
  if (type==='note') return { text:v('mf-text'), color:sel('mf-color') };
  if (type==='date') {
    const date=v('mf-date'); if(!date) return alert('Podaj datę'),null;
    return { label:v('mf-label')||'Data', date, color:sel('mf-color') };
  }
  return null;
}

function esc(s,fb='') {
  if(s==null) return fb;
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Eksport / Import ──────────────────────────────────────
export function doExportJSON() { exportJSON(state); }
export function doImportJSON() {
  importJSON(data => {
    state.cards=data.cards; state.pins=data.pins; state.threads=data.threads;
    state.nextId = Math.max(300, ...data.cards.map(c=>parseInt(c.id.split('-')[1]||0)+1));
    renderAll(); save(); scheduleMinimap();
  });
}
export function doExportPNG() { exportPNG(boardWrap, threadSvg); }
export function doShareURL()  {
  saveToHash(state);
  navigator.clipboard?.writeText(window.location.href)
    .then(() => showToast('📋 Link skopiowany do schowka!'))
    .catch(() => showToast('🔗 URL zaktualizowany w pasku adresu'));
}

function showToast(msg) {
  let t = document.getElementById('app-toast');
  if (!t) { t=document.createElement('div'); t.id='app-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'app-toast show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Reset / Clear ─────────────────────────────────────────
export function resetToSample() {
  if (!confirm('Przywrócić przykładowe dane?')) return;
  state.cards=SAMPLE_DATA.cards.map(c=>({...c,data:{...c.data}}));
  state.pins=SAMPLE_DATA.pins.map(p=>({...p}));
  state.threads=SAMPLE_DATA.threads.map(t=>({...t}));
  state.nextId=300; state.groups=[];
  renderAll(); save(); scheduleMinimap();
}
export function clearBoard() {
  if (!confirm('Wyczyścić całą tablicę?')) return;
  state.cards=[];state.pins=[];state.threads=[];state.groups=[];state.nextId=1;
  renderAll(); save(); scheduleMinimap();
}

// ── Zapis ─────────────────────────────────────────────────
function save() {
  saveState({ cards:state.cards, pins:state.pins, threads:state.threads, nextId:state.nextId, groups:state.groups });
}
