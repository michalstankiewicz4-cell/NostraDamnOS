// Module: interpelacje.js
// Fetches interpellations

import { safeFetch } from '../fetcher.js';

export async function fetchInterpelacje({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // API endpoint BEZ kadencji
    const url = `https://api.sejm.gov.pl/${base}/interpelacje`;
    
    const allData = await safeFetch(url);
    
    // Filtruj po kadencji LOKALNIE
    if (!Array.isArray(allData)) return [];
    
    return allData.filter(interp => interp.kadencja === kadencja || interp.term === kadencja);
}
