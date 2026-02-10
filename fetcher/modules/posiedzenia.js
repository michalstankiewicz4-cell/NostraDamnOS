// Module: posiedzenia.js
// Fetches list of parliamentary sittings

import { safeFetch } from '../fetcher.js';

export async function fetchPosiedzenia({ kadencja, typ = 'sejm', sittingsToFetch }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';

    // API endpoint z term
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/proceedings`;

    const allData = await safeFetch(url);
    const result = Array.isArray(allData) ? allData : [];

    // Filtruj wg zakresu posiedzeń jeśli podano
    if (sittingsToFetch && sittingsToFetch.length > 0) {
        const set = new Set(sittingsToFetch);
        return result.filter(p => set.has(p.number));
    }

    return result;
}
