// Module: komisje.js
// Fetches committees

import { safeFetch } from '../fetcher.js';

export async function fetchKomisje({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // API endpoint BEZ kadencji
    const url = `https://api.sejm.gov.pl/${base}/komisje`;
    
    const allData = await safeFetch(url);
    
    // Filtruj po kadencji LOKALNIE
    if (!Array.isArray(allData)) return [];
    
    return allData.filter(kom => kom.kadencja === kadencja || kom.term === kadencja);
}
