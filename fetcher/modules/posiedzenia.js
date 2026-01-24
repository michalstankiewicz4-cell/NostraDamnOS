// Module: posiedzenia.js
// Fetches list of parliamentary sittings

import { safeFetch } from '../fetcher.js';

export async function fetchPosiedzenia({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/posiedzenia/${kadencja}`;
    return await safeFetch(url);
}
