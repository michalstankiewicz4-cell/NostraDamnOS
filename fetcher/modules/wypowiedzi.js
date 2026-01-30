// Module: wypowiedzi.js
// Fetches statements from parliamentary sittings

import { safeFetch } from '../fetcher.js';
import { getSittingNumbers } from '../fetcher.js';

export async function fetchWypowiedzi(config) {
    // ❌ TYMCZASOWO WYŁĄCZONE - endpoint nie istnieje w API
    console.warn('[wypowiedzi] Module disabled - endpoint /wypowiedzi does not exist');
    return [];
}
