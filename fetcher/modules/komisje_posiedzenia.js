// Module: komisje_posiedzenia.js
import { safeFetch } from '../fetcher.js';

export async function fetchKomisjePosiedzenia({ komisje, selectedCommittees, kadencja = 10, typ = 'sejm' }) {
    const results = [];
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // Filter committees
    const toFetch = selectedCommittees?.includes('all') 
        ? komisje 
        : komisje.filter(k => selectedCommittees?.includes(k.code));
    
    for (const kom of toFetch) {
        const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/committees/${kom.code}/sittings`;
        try {
            const data = await safeFetch(url);
            results.push(...(Array.isArray(data) ? data : []));
        } catch (e) {
            console.warn(`[Komisje Posiedzenia] Failed for ${kom.code}:`, e.message);
        }
    }
    
    return results;
}
