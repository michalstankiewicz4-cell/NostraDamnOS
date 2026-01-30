// Module: posiedzenia.js
// Fetches list of parliamentary sittings

import { safeFetch } from '../fetcher.js';

export async function fetchPosiedzenia({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // API endpoint z term
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/proceedings`;
    
    const allData = await safeFetch(url);
    
    // Endpoint zwraca dane już przefiltrowane dla kadencji
    return Array.isArray(allData) ? allData : [];
}
