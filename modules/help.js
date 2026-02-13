// Help System v3.0
// Jeden tryb: MARKER — blokuje WSZYSTKO oprócz ESC
// Kliknięcie elementu z data-help pokazuje opis

let isActive = false;
let tooltip = null;
let shield = null;
let highlightedEl = null;
let highlightedRect = null; // cached bounding rect at highlight time
let rafPending = false;

// Wszystkie eventy do przechwycenia i zablokowania
const BLOCKED_EVENTS = [
    'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
    'wheel', 'scroll', 'touchstart', 'touchmove', 'touchend',
    'input', 'change', 'focus', 'focusin', 'blur',
    'dragstart', 'drop', 'selectstart'
];

// ================================
// DOM helpers
// ================================
function createShield() {
    if (shield) return;
    shield = document.createElement('div');
    shield.id = 'helpShield';
    shield.className = 'help-shield';
    document.body.appendChild(shield);
}

function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.id = 'helpTooltip';
    tooltip.className = 'help-tooltip';
    tooltip.innerHTML = `
        <button class="help-tooltip-close" id="helpTooltipClose">✕</button>
        <h3 class="help-tooltip-title"></h3>
        <p class="help-tooltip-desc"></p>
    `;
    document.body.appendChild(tooltip);
    tooltip.querySelector('#helpTooltipClose').addEventListener('click', (e) => {
        e.stopPropagation();
        hideTooltip();
        clearHighlight();
    });
}

function showTooltip(el) {
    if (!tooltip) createTooltip();
    const title = el.getAttribute('data-help-title') || '';
    const desc = el.getAttribute('data-help') || '';
    tooltip.querySelector('.help-tooltip-title').textContent = title;
    tooltip.querySelector('.help-tooltip-desc').textContent = desc;
    tooltip.style.display = 'block';

    const rect = el.getBoundingClientRect();
    const tw = 360, th = tooltip.offsetHeight || 120;
    let top = rect.bottom + 12;
    let left = rect.left;

    if (top + th > window.innerHeight - 20) top = rect.top - th - 12;
    if (left + tw > window.innerWidth - 20) left = window.innerWidth - tw - 20;
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
}

function hideTooltip() {
    if (tooltip) tooltip.style.display = 'none';
}

function highlightElement(el) {
    if (highlightedEl === el) return;
    clearHighlight();
    highlightedEl = el;
    // Cache rect BEFORE adding class (outline/box-shadow don't affect getBoundingClientRect)
    highlightedRect = el.getBoundingClientRect();
    el.classList.add('help-highlighted');
}

function clearHighlight() {
    if (highlightedEl) {
        highlightedEl.classList.remove('help-highlighted');
        highlightedEl = null;
        highlightedRect = null;
    }
}

function findHelpTarget(el) {
    let cur = el;
    while (cur && cur !== document.body) {
        if (cur.hasAttribute && cur.hasAttribute('data-help')) return cur;
        cur = cur.parentElement;
    }
    return null;
}

// ================================
// Event blockers
// ================================

/** Block every event except tooltip close button */
function blockEvent(e) {
    // Allow tooltip close button through
    if (e.target && e.target.closest && e.target.closest('#helpTooltipClose')) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
}

/** Keyboard: only ESC allowed, everything else blocked */
function onKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        stopHelp();
        return;
    }
    // Block all other keys
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
}

/** Check if point is within cached bounding rect (with generous margin for outline area) */
function isInsideCachedRect(x, y) {
    if (!highlightedRect) return false;
    const m = 24; // 6px outline + 6px offset + 10px box-shadow + 2px safety
    return x >= highlightedRect.left - m && x <= highlightedRect.right + m &&
           y >= highlightedRect.top - m && y <= highlightedRect.bottom + m;
}

/** Mouse move: highlight data-help elements through shield */
function onMouseMove(e) {
    const cx = e.clientX, cy = e.clientY;

    // Throttle via rAF to avoid excessive DOM queries
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
        rafPending = false;
        if (!isActive) return;

        // Temporarily hide shield & tooltip so elementFromPoint sees real DOM
        if (shield) shield.style.pointerEvents = 'none';
        if (tooltip) tooltip.style.pointerEvents = 'none';
        // Also temporarily disable pointer-events on highlighted el
        if (highlightedEl) highlightedEl.style.pointerEvents = 'none';

        const elUnder = document.elementFromPoint(cx, cy);

        if (highlightedEl) highlightedEl.style.pointerEvents = '';
        if (shield) shield.style.pointerEvents = '';
        if (tooltip) tooltip.style.pointerEvents = '';

        const target = elUnder ? findHelpTarget(elUnder) : null;
        if (target) {
            highlightElement(target); // no-op if same element (no flicker)
        } else if (!isInsideCachedRect(cx, cy)) {
            // Only clear if cursor is truly outside the highlighted element's zone
            clearHighlight();
        }
    });
}

/** Click on shield: find element underneath, show help */
function onShieldClick(e) {
    e.preventDefault();
    e.stopPropagation();

    // Find what's below
    shield.style.pointerEvents = 'none';
    if (tooltip) tooltip.style.pointerEvents = 'none';
    const elUnder = document.elementFromPoint(e.clientX, e.clientY);
    shield.style.pointerEvents = '';
    if (tooltip) tooltip.style.pointerEvents = '';

    const target = elUnder ? findHelpTarget(elUnder) : null;
    if (target) {
        highlightElement(target);
        showTooltip(target);
    } else {
        hideTooltip();
        clearHighlight();
    }
}

// ================================
// Start / Stop
// ================================
function startHelp() {
    if (isActive) { stopHelp(); return; } // Toggle

    isActive = true;

    // Create transparent shield over everything
    createShield();
    createTooltip();
    shield.style.display = 'block';

    // Shield intercepts clicks
    shield.addEventListener('click', onShieldClick);
    shield.addEventListener('mousemove', onMouseMove);

    // Block ALL events on document (capture phase = before anything else)
    for (const evt of BLOCKED_EVENTS) {
        document.addEventListener(evt, blockEvent, true);
    }
    document.addEventListener('keydown', onKeydown, true);

    // Prevent scroll on body
    document.body.style.overflow = 'hidden';
    document.body.classList.add('help-active');

    console.log('[Help] Mode ON — everything blocked except ESC');
}

function stopHelp() {
    if (!isActive) return;
    isActive = false;

    // Remove shield events
    if (shield) {
        shield.removeEventListener('click', onShieldClick);
        shield.removeEventListener('mousemove', onMouseMove);
        shield.style.display = 'none';
    }

    // Unblock all events
    for (const evt of BLOCKED_EVENTS) {
        document.removeEventListener(evt, blockEvent, true);
    }
    document.removeEventListener('keydown', onKeydown, true);

    // Restore
    document.body.style.overflow = '';
    document.body.classList.remove('help-active');
    clearHighlight();
    hideTooltip();

    console.log('[Help] Mode OFF');
}

// ================================
// PUBLIC API
// ================================
export function initHelp() {
    console.log('[Help] Initializing v3...');
    createTooltip();
    createShield();
}

export function startTour() {
    startHelp();
}

export function stopTour() {
    stopHelp();
}

export function setHelpMode() {
    // Only one mode now, no-op
}

window.startInteractiveTour = startTour;
window.stopInteractiveTour = stopTour;
window.setHelpMode = setHelpMode;
