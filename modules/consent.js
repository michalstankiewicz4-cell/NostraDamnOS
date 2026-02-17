// =============================================================================
// 🍪 Consent Banner — GDPR / Consent Mode v2
// =============================================================================

const CONSENT_KEY = 'analytics_consent';

function getConsent() {
    return localStorage.getItem(CONSENT_KEY);
}

function setConsent(value) {
    localStorage.setItem(CONSENT_KEY, value);
    if (typeof gtag === 'function') {
        gtag('consent', 'update', { analytics_storage: value });
    }
}

function createBanner() {
    if (getConsent()) return; // decyzja już podjęta

    const banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.innerHTML = `
        <span class="consent-text">Ta strona używa Google Analytics do analizy ruchu. Czy wyrażasz zgodę na cookies analityczne?</span>
        <div class="consent-buttons">
            <button class="consent-btn consent-btn--accept">Akceptuję</button>
            <button class="consent-btn consent-btn--reject">Odrzucam</button>
        </div>
    `;

    banner.querySelector('.consent-btn--accept').addEventListener('click', () => {
        setConsent('granted');
        banner.classList.add('consent-banner--hidden');
        setTimeout(() => banner.remove(), 400);
    });

    banner.querySelector('.consent-btn--reject').addEventListener('click', () => {
        setConsent('denied');
        banner.classList.add('consent-banner--hidden');
        setTimeout(() => banner.remove(), 400);
    });

    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('consent-banner--visible'));
}

export function initConsent() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBanner);
    } else {
        createBanner();
    }
}
