// Module: komisje_wypowiedzi.js
import { safeFetch } from '../fetcher.js';

export async function fetchKomisjeWypowiedzi({ posiedzenia_komisji, mode, typ = 'sejm' }) {
    // ❌ TYMCZASOWO WYŁĄCZONE - endpoint nie istnieje w API
    console.warn('[komisje_wypowiedzi] Module disabled - endpoint does not exist');
    return [];
}
