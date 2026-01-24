// Module: oswiadczenia.js (Financial disclosures)
import { safeFetch } from '../fetcher.js';

export async function fetchOswiadczenia({ poslowie, typ = 'sejm' }) {
    const results = [];
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    // Limit to first 100 deputies for safety
    for (const posel of poslowie.slice(0, 100)) {
        const url = `https://api.sejm.gov.pl/${base}/oswiadczenia/${posel.id}`;
        try {
            const data = await safeFetch(url);
            if (data) results.push(data);
        } catch (e) {
            console.warn(`[Oswiadczenia] Failed for ${posel.id}:`, e.message);
        }
    }
    
    return results;
}
