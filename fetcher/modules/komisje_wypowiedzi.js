// Module: komisje_wypowiedzi.js
import { safeFetch } from '../fetcher.js';

export async function fetchKomisjeWypowiedzi({ posiedzenia_komisji, mode, typ = 'sejm' }) {
    const results = [];
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    for (const pos of posiedzenia_komisji.slice(0, 50)) { // limit for safety
        let url = `https://api.sejm.gov.pl/${base}/komisje/posiedzenia/${pos.id}/wypowiedzi`;
        
        if (mode === 'meta') {
            url += '?fields=id,data,id_osoby,typ';
        }
        
        try {
            const data = await safeFetch(url);
            results.push(...(Array.isArray(data) ? data : []));
        } catch (e) {
            console.warn(`[Komisje Wypowiedzi] Failed for ${pos.id}:`, e.message);
        }
    }
    
    return results;
}
