// Module: projekty_ustaw.js
// Fetches bills (druki)

import { safeFetch } from '../fetcher.js';

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
