// Module: projekty_ustaw.js
// Fetches bills (druki)

import { safeFetch } from '../fetcher.js';

export async function fetchProjektyUstaw({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // API endpoint BEZ kadencji
    const url = `https://api.sejm.gov.pl/${base}/druki`;
    
    const allData = await safeFetch(url);
    
    // Filtruj po kadencji LOKALNIE
    if (!Array.isArray(allData)) return [];
    
    return allData.filter(druk => druk.kadencja === kadencja || druk.term === kadencja);
}
