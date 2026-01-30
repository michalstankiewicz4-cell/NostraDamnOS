// Module: oswiadczenia.js (Financial disclosures)
import { safeFetch } from '../fetcher.js';

export async function fetchOswiadczenia({ poslowie, typ = 'sejm' }) {
    // ❌ TYMCZASOWO WYŁĄCZONE - endpoint nie istnieje w API
    console.warn('[oswiadczenia] Module disabled - endpoint does not exist');
    return [];
}
