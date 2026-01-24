// Module: wypowiedzi.js
// Fetches statements from parliamentary sittings

import { safeFetch } from '../fetcher.js';
import { getSittingNumbers } from '../fetcher.js';

export async function fetchWypowiedzi(config) {
    const results = [];
    const { posiedzenia, mode, typ = 'sejm' } = config;
    
    // Get sitting numbers based on range config
    const sittingNumbers = getSittingNumbers(posiedzenia, config);
    
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    for (const num of sittingNumbers) {
        let url = `https://api.sejm.gov.pl/${base}/wypowiedzi/${num}`;
        
        // Metadata-only mode
        if (mode === 'meta') {
            url += '?fields=id,data,id_posiedzenia,id_osoby,typ';
        }
        
        const data = await safeFetch(url);
        results.push(...(Array.isArray(data) ? data : []));
    }
    
    return results;
}
