// Module: glosy.js
import { safeFetch } from '../fetcher.js';

export async function fetchGlosy({ glosowania, typ = 'sejm' }) {
    const results = [];
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    for (const g of glosowania.slice(0, 100)) { // limit for safety
        const url = `https://api.sejm.gov.pl/${base}/glosy/${g.id}`;
        try {
            const data = await safeFetch(url);
            results.push(...(Array.isArray(data) ? data : []));
        } catch (e) {
            console.warn(`[Glosy] Failed for ${g.id}:`, e.message);
        }
    }
    
    return results;
}
