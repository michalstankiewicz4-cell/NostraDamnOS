// Module: glosy.js
import { safeFetch } from '../fetcher.js';

export async function fetchGlosy({ glosowania, typ = 'sejm' }) {
    // ❌ TYMCZASOWO WYŁĄCZONE - głosy są w /votings/{sitting}/{num}, nie osobny endpoint
    console.warn('[glosy] Module disabled - votes are included in votings endpoint');
    return [];
}
