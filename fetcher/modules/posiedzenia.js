// Module: posiedzenia.js
// Fetches list of parliamentary sittings

import { safeFetch } from '../fetcher.js';

/**
 * Pobiera pojedyncze posiedzenie po numerze
 * @param {number} num - Numer posiedzenia
 * @param {Object} config - Konfiguracja (kadencja, typ)
 * @returns {Promise<Object|null>} Dane posiedzenia lub null
 */
export async function fetchPosiedzenie(num, { kadencja, typ = 'sejm' } = {}) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/proceedings/${num}`;

    try {
        const data = await safeFetch(url);
        return data || null;
    } catch (e) {
        console.warn(`[Posiedzenia] Failed to fetch proceeding ${num}:`, e.message);
        return null;
    }
}

export async function fetchPosiedzenia({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';

    // API endpoint z term — zwraca pełną listę posiedzeń jako metadane referencyjne
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/proceedings`;

    try {
        const allData = await safeFetch(url);
        return Array.isArray(allData) ? allData : [];
    } catch (e) {
        console.warn(`[Posiedzenia] Failed:`, e.message);
        return [];
    }
}
