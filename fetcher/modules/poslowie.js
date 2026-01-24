// Module: poslowie.js
// Fetches deputies/senators list

import { safeFetch } from '../fetcher.js';

export async function fetchPoslowie({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/poslowie/${kadencja}`;
    return await safeFetch(url);
}
