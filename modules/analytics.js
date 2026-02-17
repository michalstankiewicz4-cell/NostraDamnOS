// =============================================================================
// 📊 Analytics — GA4 event tracking helper
// =============================================================================

export function trackEvent(name, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', name, params);
    }
}

// Udostępnij globalnie dla skryptów nie-modułowych (np. nawigacja w index.html)
window.trackEvent = trackEvent;

// Śledzenie błędów JS
window.addEventListener('error', (e) => {
    trackEvent('exception', {
        description: `${e.message} @ ${e.filename}:${e.lineno}`,
        fatal: false
    });
});

window.addEventListener('unhandledrejection', (e) => {
    trackEvent('exception', {
        description: `Unhandled Promise: ${e.reason}`,
        fatal: false
    });
});
