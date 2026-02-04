// Module: glosowania.js
import { safeFetch } from '../fetcher.js';
import { getSittingNumbers } from '../fetcher.js';

export async function fetchGlosowania(config) {
    const results = [];
    const { posiedzenia, kadencja = 10, typ = 'sejm' } = config;
    const sittingNumbers = getSittingNumbers(posiedzenia, config);
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    
    for (const num of sittingNumbers) {
        const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/votings/${num}`;
        const data = await safeFetch(url);
        results.push(...(Array.isArray(data) ? data : []));
    }
    
    return results;
}
