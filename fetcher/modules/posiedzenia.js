// Module: posiedzenia.js
// Fetches list of parliamentary sittings

import { safeFetch } from '../fetcher.js';

export async function fetchPosiedzenia({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // API endpoint BEZ kadencji
    const url = `https://api.sejm.gov.pl/${base}/posiedzenia`;
    
    const allData = await safeFetch(url);
    
    // Filtruj po kadencji LOKALNIE
    if (!Array.isArray(allData)) return [];
    
    return allData.filter(pos => pos.kadencja === kadencja || pos.term === kadencja);
}
