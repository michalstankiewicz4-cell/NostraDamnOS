// Minimal, defensywny toggle ikon import/export (Shift+P) — działa tylko gdy konsola jest widoczna.
(function () {
  'use strict';

  const CONSOLE_SELECTORS = [
    '#floatingConsolePanel',
    '#console',
    '.console',
    '.console-panel',
    '#console-panel',
    '.app-console',
    '.panel-console',
    '.console-area',
    '[data-console]'
  ];

  function isElementVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function findConsoleElement() {
    for (const sel of CONSOLE_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && isElementVisible(el)) return el;
      } catch (e) { /* ignore invalid selectors */ }
    }
    return null;
  }

  function findDbIconElements() {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], span, i, svg'));
    const matches = [];
    const pattern = /import|export|importuj|eksportuj/i;

    for (const el of candidates) {
      try {
        const title = (el.getAttribute && el.getAttribute('title')) || '';
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || '';
        const id = el.id || '';
        const cls = (el.className && typeof el.className === 'string') ? el.className : '';
        const text = (el.textContent || '').trim();
        const combined = `${title} ${aria} ${id} ${cls} ${text}`;
        if (pattern.test(combined)) {
          matches.push(el);
          continue;
        }
        const inner = el.querySelector && el.querySelector('*');
        if (inner) {
          const innerCombined = `${inner.getAttribute && (inner.getAttribute('title') || '')} ${inner.getAttribute && (inner.getAttribute('aria-label') || '')} ${inner.textContent || ''}`;
          if (pattern.test(innerCombined)) matches.push(el);
        }
      } catch (e) { /* ignore individual element errors */ }
    }

    return Array.from(new Set(matches));
  }

  function setIconsVisibility(elems, show) {
    elems.forEach(el => {
      try {
        if (!('_kbdOrigDisplay' in el.dataset)) {
          el.dataset._kbdOrigDisplay = el.style.display || '';
        }
        el.style.display = show ? (el.dataset._kbdOrigDisplay || '') : 'none';
      } catch (e) { /* ignore */ }
    });
  }

  let iconsVisible = true;

  window.addEventListener('keydown', function (ev) {
    const isP = ev.code === 'KeyP' || (ev.key && ev.key.toLowerCase() === 'p');
    if (!isP || !ev.shiftKey) return;

    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

    const consoleEl = findConsoleElement();
    if (!consoleEl || !isElementVisible(consoleEl)) return;

    ev.preventDefault();

    const icons = findDbIconElements();
    if (!icons || icons.length === 0) return;

    iconsVisible = !iconsVisible;
    setIconsVisibility(icons, iconsVisible);
  }, { passive: false });

})();
