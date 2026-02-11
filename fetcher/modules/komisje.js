// Module: komisje.js
// Fetches committees

import { safeFetch } from '../fetcher.js';

export async function fetchKomisje({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // API endpoint z term
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/committees`;
    
    try {
        const allData = await safeFetch(url);
        return Array.isArray(allData) ? allData : [];
    } catch (e) {
        console.warn(`[Komisje] Failed:`, e.message);
        return [];
    }
}
