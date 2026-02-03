/**
 * Fetcher dla zapytań pisemnych (writtenQuestions)
 * 
 * Endpoint: /sejm/term{N}/writtenQuestions
 * 
 * RÓŻNICA interpelacje vs zapytania:
 * - Interpelacje: odpowiedź ministra w 21 dni
 * - Zapytania pisemne: odpowiedź ministra w 7 dni, krótsze
 * 
 * Parametry:
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

export async function fetchWrittenQuestions(apiBase, term, options = {}) {
    const {
        limit = 500,
        offset = 0,
        modifiedSince = null,
        delayed = null,
        from = null,
        to = null,
        title = null,
        since = null,
        till = null,
        sort_by = '-lastModified'
    } = options;

    // Build query params
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);
    if (modifiedSince) params.append('modifiedSince', modifiedSince);
    if (delayed !== null) params.append('delayed', delayed);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (title) params.append('title', title);
    if (since) params.append('since', since);
    if (till) params.append('till', till);
    if (sort_by) params.append('sort_by', sort_by);

    const url = `${apiBase}/term${term}/writtenQuestions?${params.toString()}`;
    
    console.log(`[FETCHER] Pobieranie zapytań pisemnych: term=${term}, params=${params.toString()}`);
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[FETCHER] Pobrano ${data.length} zapytań pisemnych`);
    
    return data;
}

/**
 * Pobiera szczegóły pojedynczego zapytania
 */
export async function fetchWrittenQuestionDetails(apiBase, term, num) {
    const url = `${apiBase}/term${term}/writtenQuestions/${num}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
}

/**
 * INCREMENTAL CACHE
 * Pobiera tylko zapytania zmodyfikowane od ostatniego fetcha
 */
export async function fetchWrittenQuestionsIncremental(apiBase, term, lastModified) {
    console.log(`[FETCHER] Incremental fetch: zapytania od ${lastModified}`);
    
    return await fetchWrittenQuestions(apiBase, term, {
        modifiedSince: lastModified,
        sort_by: 'lastModified',
        limit: 500
    });
}
