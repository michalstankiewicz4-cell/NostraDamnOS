// Module: komisje_posiedzenia.js
import { safeFetch } from '../fetcher.js';

export async function fetchKomisjePosiedzenia({ komisje, selectedCommittees, committees, kadencja = 10, typ = 'sejm', onItemProgress }) {
    const results = [];
    const base = typ === 'sejm' ? 'sejm' : 'senat';

    // Filter committees (config uses 'committees', fallback to 'selectedCommittees')
    const selected = (Array.isArray(committees) && committees.length > 0) ? committees
        : (Array.isArray(selectedCommittees) && selectedCommittees.length > 0) ? selectedCommittees
        : ['all'];
    const toFetch = selected.includes('all')
        ? komisje
        : komisje.filter(k => selected.includes(k.code));
    const totalItems = toFetch.length;
    let doneItems = 0;
    
    for (const kom of toFetch) {
        const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/committees/${kom.code}/sittings`;
        try {
            const data = await safeFetch(url);
            results.push(...(Array.isArray(data) ? data : []));
        } catch (e) {
            console.warn(`[Komisje Posiedzenia] Failed for ${kom.code}:`, e.message);
        }
        doneItems++;
        if (onItemProgress) onItemProgress(doneItems, totalItems, 'komisje');
    }
    
    return results;
}
