// Module: projekty_ustaw.js
// Fetches bills (druki)

import { safeFetch } from '../fetcher.js';

/**
 * Pobiera pojedynczy druk po numerze
 * @param {string|number} num - Numer druku
 * @param {Object} config - Konfiguracja (kadencja, typ)
 * @returns {Promise<Object|null>} Dane druku lub null
 */
export async function fetchProjektUstawy(num, { kadencja, typ = 'sejm' } = {}) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/prints/${num}`;
    
    try {
        const data = await safeFetch(url);
        return data || null;
    } catch (e) {
        console.warn(`[Projekty Ustaw] Failed to fetch print ${num}:`, e.message);
        return null;
    }
}

export async function fetchProjektyUstaw({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // API endpoint z term
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/prints`;
    
    try {
        const allData = await safeFetch(url);
        return Array.isArray(allData) ? allData : [];
    } catch (e) {
        console.warn(`[Projekty Ustaw] Failed:`, e.message);
        return [];
    }
}
