// =============================================================================
// 📎 Clippy v1.0 — Pomocny spinacz z oczami
// Pokazuje się w trybie pomocy, daje kontekstowe wskazówki per sekcja
// Treść wskazówek pochodzi z help-data.js (możliwość tłumaczenia)
// =============================================================================

import { CLIPPY_TIPS as SECTION_TIPS } from './help-data.js';

const CLIPPY_ENABLED_KEY = 'clippy_enabled';

let container = null;
let tipIndex = 0;

function getCurrentSection() {
    const active = document.querySelector('.app-section.active');
    return active?.dataset?.section || '1';
}

function injectStyles() {
    if (document.getElementById('clippy-styles')) return;
    const style = document.createElement('style');
    style.id = 'clippy-styles';
    style.textContent = `
        #clippyContainer {
            position: fixed;
            bottom: 72px;
            right: 12px;
            z-index: 1000025;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
            animation: clippyEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            pointer-events: all;
        }
        @keyframes clippyEnter {
            from { transform: translateY(50px) scale(0.3); opacity: 0; }
            to   { transform: translateY(0)    scale(1);   opacity: 1; }
        }
        .clippy-speech {
            background: #fffde7;
            border: 2px solid #f9c700;
            border-radius: 14px 14px 4px 14px;
            padding: 10px 14px;
            max-width: 230px;
            min-width: 190px;
            box-shadow: 0 4px 18px rgba(0,0,0,0.28);
            font-size: 12.5px;
            line-height: 1.45;
            color: #2a2a2a;
        }
        .clippy-speech-header {
            font-weight: 700;
            font-size: 10.5px;
            color: #999;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .clippy-speech-text {
            margin-bottom: 8px;
            min-height: 48px;
        }
        .clippy-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
        }
        .clippy-nav-btn {
            background: #f9c700;
            border: none;
            border-radius: 6px;
            width: 26px;
            height: 26px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.1s;
            flex-shrink: 0;
        }
        .clippy-nav-btn:active { transform: scale(0.88); }
        .clippy-counter {
            font-size: 11px;
            color: #bbb;
            flex: 1;
            text-align: center;
        }
        .clippy-char {
            position: relative;
            width: 56px;
            height: 66px;
            cursor: pointer;
            align-self: flex-end;
            transition: transform 0.2s;
        }
        .clippy-char:hover { transform: scale(1.12) rotate(-6deg); }
        .clippy-char:active { transform: scale(0.96); }
        .clippy-emoji {
            font-size: 52px;
            line-height: 1;
            display: block;
            filter: drop-shadow(0 3px 7px rgba(0,0,0,0.35));
            user-select: none;
            position: relative;
            z-index: 1;
        }
        .clippy-eyes {
            position: absolute;
            top: 16px;
            left: 50%;
            transform: translateX(-44%);
            display: flex;
            gap: 7px;
            pointer-events: none;
            z-index: 2;
        }
        .clippy-eye {
            width: 11px;
            height: 11px;
            background: white;
            border-radius: 50%;
            border: 1.5px solid #444;
            position: relative;
            overflow: hidden;
            animation: clippyBlink 3.8s infinite;
        }
        .clippy-eye:nth-child(2) {
            animation-delay: 0.12s;
        }
        .clippy-pupil {
            width: 5px;
            height: 5px;
            background: #1a1a2e;
            border-radius: 50%;
            position: absolute;
            top: 2.5px;
            left: 2.5px;
        }
        @keyframes clippyBlink {
            0%, 88%, 100% { transform: scaleY(1); }
            92%           { transform: scaleY(0.05); }
        }
        @keyframes clippyWiggle {
            0%, 100% { transform: scale(1.12) rotate(-6deg); }
            50%       { transform: scale(1.12) rotate(6deg); }
        }
        .clippy-char.wiggle {
            animation: clippyWiggle 0.4s ease;
        }
    `;
    document.head.appendChild(style);
}

function buildHTML(sectionData) {
    return `
        <div class="clippy-speech">
            <div class="clippy-speech-header">${sectionData.icon} ${sectionData.name}</div>
            <div class="clippy-speech-text">${sectionData.tips[0]}</div>
            <div class="clippy-nav">
                <button class="clippy-nav-btn" id="clippyPrev" title="Poprzednia wskazówka">◀</button>
                <span class="clippy-counter">1 / ${sectionData.tips.length}</span>
                <button class="clippy-nav-btn" id="clippyNext" title="Następna wskazówka">▶</button>
            </div>
        </div>
        <div class="clippy-char" id="clippyChar" title="Kliknij aby zobaczyć następną wskazówkę">
            <span class="clippy-emoji">📎</span>
            <div class="clippy-eyes">
                <div class="clippy-eye"><div class="clippy-pupil"></div></div>
                <div class="clippy-eye"><div class="clippy-pupil"></div></div>
            </div>
        </div>
    `;
}

function wiggle() {
    const char = container?.querySelector('#clippyChar');
    if (!char) return;
    char.classList.remove('wiggle');
    void char.offsetWidth; // reflow
    char.classList.add('wiggle');
    setTimeout(() => char.classList.remove('wiggle'), 450);
}

function updateTip(sectionData) {
    if (!container || !sectionData) return;
    container.querySelector('.clippy-speech-text').textContent = sectionData.tips[tipIndex];
    container.querySelector('.clippy-counter').textContent = `${tipIndex + 1} / ${sectionData.tips.length}`;
    wiggle();
}

function nextTip() {
    const section = getCurrentSection();
    const sectionData = SECTION_TIPS[section];
    if (!sectionData) return;
    tipIndex = (tipIndex + 1) % sectionData.tips.length;
    updateTip(sectionData);
}

function prevTip() {
    const section = getCurrentSection();
    const sectionData = SECTION_TIPS[section];
    if (!sectionData) return;
    tipIndex = (tipIndex - 1 + sectionData.tips.length) % sectionData.tips.length;
    updateTip(sectionData);
}

export function showClippy() {
    // Sprawdź czy spinacz jest włączony w ustawieniach (domyślnie: tak)
    if (localStorage.getItem(CLIPPY_ENABLED_KEY) === 'false') return;

    const section = getCurrentSection();
    const sectionData = SECTION_TIPS[section];
    if (!sectionData) return; // brak danych dla tej sekcji — nie pokazuj

    if (container) return; // już widoczny

    injectStyles();
    tipIndex = 0;

    container = document.createElement('div');
    container.id = 'clippyContainer';
    container.innerHTML = buildHTML(sectionData);
    document.body.appendChild(container);

    container.querySelector('#clippyNext').addEventListener('click', (e) => {
        e.stopPropagation();
        nextTip();
    });
    container.querySelector('#clippyPrev').addEventListener('click', (e) => {
        e.stopPropagation();
        prevTip();
    });
    container.querySelector('#clippyChar').addEventListener('click', (e) => {
        e.stopPropagation();
        nextTip();
    });

    console.log('[Clippy] Cześć! Jestem Spinacz 📎');
}

export function hideClippy() {
    if (container) {
        container.remove();
        container = null;
    }
    console.log('[Clippy] Do widzenia!');
}
