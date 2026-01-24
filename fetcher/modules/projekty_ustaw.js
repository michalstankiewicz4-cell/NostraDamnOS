// Module: projekty_ustaw.js
import { safeFetch } from '../fetcher.js';

export async function fetchProjektyUstaw({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/druki/${kadencja}`;
    return await safeFetch(url);
}
