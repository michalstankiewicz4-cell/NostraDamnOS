// Help System v3.1
// Jeden tryb: MARKER — blokuje WSZYSTKO oprócz ESC
// Opisy elementów w osobnym pliku help-data.js

import { HELP_DATA } from './help-data.js';
import { showClippy, hideClippy } from './clippy.js';

let isActive = false;
let tooltip = null;
let shield = null;
let exitBtn = null;
let highlightedEl = null;
let highlightedRect = null; // cached bounding rect at highlight time
let rafPending = false;
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Wszystkie eventy do przechwycenia i zablokowania
const BLOCKED_EVENTS = [
    'mousedown', 'mouseup', 'click', 'dblclick',
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
    const helpId = el.getAttribute('data-help-id') || '';
    const entry = HELP_DATA[helpId];
    const title = entry ? entry.title : helpId;
    const desc = entry ? entry.desc : '';
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
    // Auto-show tooltip on hover
    showTooltip(el);
}

function clearHighlight() {
    if (highlightedEl) {
        highlightedEl.classList.remove('help-highlighted');
        highlightedEl = null;
        highlightedRect = null;
    }
    hideTooltip();
}

function findHelpTarget(el) {
    let cur = el;
    while (cur && cur !== document.body) {
        if (cur.hasAttribute && cur.hasAttribute('data-help-id')) return cur;
        cur = cur.parentElement;
    }
    return null;
}

// ================================
// Event blockers
// ================================

/** Block every event except help UI elements (shield, tooltip, exit button, clippy) */
function blockEvent(e) {
    if (!e.target || !e.target.closest) return;
    // Allow interactions on help UI elements
    if (e.target.closest('#helpTooltipClose')) return;
    if (e.target.closest('#helpShield')) return;
    if (e.target.closest('#helpTooltip')) return;
    if (e.target.closest('#helpExitBtn')) return;
    if (e.target.closest('#clippyContainer')) return;
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

        // Pass 1: find target WITH highlighted element visible (detects children with data-help-id)
        let elUnder = document.elementFromPoint(cx, cy);
        let target = elUnder ? findHelpTarget(elUnder) : null;

        // Pass 2: if target is same as current highlight, disable it to check if cursor truly left
        if (target && target === highlightedEl) {
            highlightedEl.style.pointerEvents = 'none';
            elUnder = document.elementFromPoint(cx, cy);
            highlightedEl.style.pointerEvents = '';
            const deeper = elUnder ? findHelpTarget(elUnder) : null;
            // Only clear if there's nothing beneath AND cursor left the zone
            if (!deeper && !isInsideCachedRect(cx, cy)) {
                target = null;
            }
            // If deeper found a different target, use it
            // (shouldn't happen since we already found the parent, but just in case)
        }

        if (shield) shield.style.pointerEvents = '';
        if (tooltip) tooltip.style.pointerEvents = '';

        if (target) {
            highlightElement(target); // no-op if same element (no flicker)
        } else if (!isInsideCachedRect(cx, cy)) {
            // Only clear if cursor is truly outside the highlighted element's zone
            clearHighlight();
        }
    });
}

/** Find help target under given coordinates and show tooltip */
function helpAtPoint(cx, cy) {
    shield.style.pointerEvents = 'none';
    if (tooltip) tooltip.style.pointerEvents = 'none';
    if (exitBtn) exitBtn.style.pointerEvents = 'none';
    const elUnder = document.elementFromPoint(cx, cy);
    shield.style.pointerEvents = '';
    if (tooltip) tooltip.style.pointerEvents = '';
    if (exitBtn) exitBtn.style.pointerEvents = '';

    // If user tapped the help button (❓) — toggle off
    if (elUnder && elUnder.closest && elUnder.closest('#helpBtn')) {
        stopHelp();
        return;
    }

    const target = elUnder ? findHelpTarget(elUnder) : null;
    if (target) {
        highlightElement(target);
        showTooltip(target);
    } else {
        hideTooltip();
        clearHighlight();
    }
}

/** Click on shield: find element underneath, show help */
function onShieldClick(e) {
    e.preventDefault();
    e.stopPropagation();
    helpAtPoint(e.clientX, e.clientY);
}

/** Touch on shield: find element underneath, show help */
function onShieldTouchEnd(e) {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    helpAtPoint(touch.clientX, touch.clientY);
}

/** Right-click anywhere — exit help mode */
function onContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    stopHelp();
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

    // Shield intercepts clicks, touch, and right-click
    shield.addEventListener('click', onShieldClick);
    shield.addEventListener('mousemove', onMouseMove);
    shield.addEventListener('contextmenu', onContextMenu);
    shield.addEventListener('touchend', onShieldTouchEnd, { passive: false });
    shield.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

    // Widoczny przycisk wyjścia (ważny na urządzeniach dotykowych bez ESC)
    createExitButton();

    // Block ALL events on document (capture phase = before anything else)
    for (const evt of BLOCKED_EVENTS) {
        document.addEventListener(evt, blockEvent, true);
    }
    document.addEventListener('keydown', onKeydown, true);

    // Prevent scroll on body
    document.body.style.overflow = 'hidden';
    document.body.classList.add('help-active');

    showClippy();
    console.log('[Help] Mode ON — everything blocked except ESC');
}

function stopHelp() {
    if (!isActive) return;
    isActive = false;

    // Remove shield events
    if (shield) {
        shield.removeEventListener('click', onShieldClick);
        shield.removeEventListener('mousemove', onMouseMove);
        shield.removeEventListener('contextmenu', onContextMenu);
        shield.style.display = 'none';
    }

    // Remove exit button
    removeExitButton();

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

    hideClippy();
    console.log('[Help] Mode OFF');
}

// ================================
// EXIT BUTTON (mobile / touch)
// ================================
function createExitButton() {
    if (exitBtn) return;
    exitBtn = document.createElement('button');
    exitBtn.id = 'helpExitBtn';
    exitBtn.className = 'help-exit-btn';
    exitBtn.innerHTML = '✕ Zamknij pomoc';
    exitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopHelp();
    });
    exitBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopHelp();
    }, { passive: false });
    document.body.appendChild(exitBtn);
}

function removeExitButton() {
    if (exitBtn) {
        exitBtn.remove();
        exitBtn = null;
    }
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
