// Module: poslowie.js
// Fetches deputies list (Sejm)

import { safeFetch } from '../fetcher.js';

export async function fetchPoslowie({ kadencja = 10, typ = 'sejm' }) {
    if (typ !== 'sejm') {
        console.warn('[poslowie] Senators list not implemented yet');
        return [];
    }

    const url = `https://api.sejm.gov.pl/sejm/term${kadencja}/MP`;

    return await safeFetch(url);
}
