/**
 * Module: zapytania.js
 * Fetcher dla zapytań pisemnych (writtenQuestions)
 * 
 * Endpoint: /sejm/term{N}/writtenQuestions
 * 
 * RÓŻNICA interpelacje vs zapytania:
 * - Interpelacje: odpowiedź ministra w 21 dni
 * - Zapytania pisemne: odpowiedź ministra w 7 dni, krótsze
 * 
 * Parametry API:
 * - limit: max liczba wyników (default 50)
 * - offset: offset (paginacja)
 * - modifiedSince: tylko zmodyfikowane od daty
 * - delayed: tylko z opóźnieniem odpowiedzi
 * - from: filtruj po ID posła
 * - to: filtruj po odbiorcy (minister)
 * - title: wyszukaj w tytule
 * - since: data od
 * - till: data do
 * - sort_by: sortowanie (np. -lastModified)
 */

import { safeFetch } from '../fetcher.js';

export async function fetchZapytania({ kadencja = 10, typ = 'sejm', ...options }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const pageSize = 500; // API supports up to 500 per request
    let allResults = [];
    let offset = 0;

    try {
        while (true) {
            const params = new URLSearchParams();
            params.append('limit', pageSize);
            params.append('offset', offset);

            // Optional filters
            if (options.modifiedSince) params.append('modifiedSince', options.modifiedSince);
            if (options.delayed !== null && options.delayed !== undefined) params.append('delayed', options.delayed);
            if (options.from) params.append('from', options.from);
            if (options.to) params.append('to', options.to);
            if (options.title) params.append('title', options.title);
            if (options.since) params.append('since', options.since);
            if (options.till) params.append('till', options.till);
            if (options.sort_by) params.append('sort_by', options.sort_by);

            const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/writtenQuestions?${params.toString()}`;
            const data = await safeFetch(url);
            const batch = Array.isArray(data) ? data : [];

            if (batch.length === 0) break;

            allResults = allResults.concat(batch);
            console.log(`[Zapytania] Fetched ${allResults.length} (offset=${offset})`);

            if (batch.length < pageSize) break; // last page
            offset += batch.length;
        }

        console.log(`[Zapytania] Total: ${allResults.length}`);
        return allResults;
    } catch (e) {
        console.error(`[Zapytania] Error at offset ${offset}:`, e.message);
        return allResults; // return what we got so far
    }
}

/**
 * Pobiera szczegóły pojedynczego zapytania
 */
export async function fetchZapytanieDetails({ kadencja = 10, typ = 'sejm', num }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/writtenQuestions/${num}`;
    
    try {
        return await safeFetch(url);
    } catch (e) {
        console.error(`[Zapytania] Error fetching details for ${num}:`, e.message);
        return null;
    }
}

/**
 * Alias dla spójności z innymi modułami
 */
export async function fetchZapytanie(num, { kadencja = 10, typ = 'sejm' } = {}) {
    return fetchZapytanieDetails({ kadencja, typ, num });
}
