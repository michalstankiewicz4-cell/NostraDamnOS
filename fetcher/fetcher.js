// Fetcher v2.0 - Main orchestrator
// Czysta rura: pobiera surowe dane z API, nie dotyka bazy

import { fetchPoslowie } from './modules/poslowie.js';
import { fetchPosiedzenia } from './modules/posiedzenia.js';
import { fetchWypowiedzi } from './modules/wypowiedzi.js';
import { fetchGlosowania } from './modules/glosowania.js';
import { fetchGlosy } from './modules/glosy.js';
import { fetchInterpelacje } from './modules/interpelacje.js';
import { fetchZapytania } from './modules/zapytania.js';
import { fetchProjektyUstaw } from './modules/projekty_ustaw.js';
import { fetchUstawy } from './modules/ustawy.js';
import { fetchKomisje } from './modules/komisje.js';
import { fetchKomisjePosiedzenia } from './modules/komisje_posiedzenia.js';
import { fetchKomisjeWypowiedzi } from './modules/komisje_wypowiedzi.js';
import { fetchOswiadczenia } from './modules/oswiadczenia.js';

// Safe fetch with retry + exponential backoff
export async function safeFetch(url) {
    for (let i = 0; i < 3; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            if (i === 2) throw new Error(`API unreachable: ${url} - ${e.message}`);
            await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
    }
}

// Safe fetch returning text/HTML (for transcripts)
export async function safeFetchText(url) {
    for (let i = 0; i < 3; i++) {
        try {
            const res = await fetch(url);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (e) {
            if (i === 2) return null;
            await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
    }
}

// Main fetcher orchestrator
export async function runFetcher(config) {
    console.log('[Fetcher] Starting with config:', config);
    const results = {};
    
    // Poslowie (always needed as foundation)
    if (config.modules.includes('poslowie')) {
        console.log('[Fetcher] Fetching poslowie...');
        results.poslowie = await fetchPoslowie(config);
    }
    
    // Posiedzenia (always needed for per-sitting data)
    if (config.modules.includes('posiedzenia')) {
        console.log('[Fetcher] Fetching posiedzenia...');
        results.posiedzenia = await fetchPosiedzenia(config);
    }
    
    // Wypowiedzi (per sitting)
    if (config.modules.includes('wypowiedzi')) {
        console.log('[Fetcher] Fetching wypowiedzi...');
        results.wypowiedzi = await fetchWypowiedzi(config);
    }
    
    // Glosowania (per sitting)
    if (config.modules.includes('glosowania')) {
        console.log('[Fetcher] Fetching glosowania...');
        results.glosowania = await fetchGlosowania(config);
    }
    
    // Glosy (individual votes - requires glosowania)
    if (config.modules.includes('glosy') && results.glosowania) {
        console.log('[Fetcher] Fetching glosy...');
        results.glosy = await fetchGlosy({ ...config, glosowania: results.glosowania });
    }
    
    // Interpelacje (per term)
    if (config.modules.includes('interpelacje')) {
        console.log('[Fetcher] Fetching interpelacje...');
        results.interpelacje = await fetchInterpelacje(config);
    }
    
    // Zapytania pisemne (per term)
    if (config.modules.includes('zapytania')) {
        console.log('[Fetcher] Fetching zapytania...');
        results.zapytania = await fetchZapytania(config);
    }
    
    // Projekty ustaw (per term)
    if (config.modules.includes('projekty_ustaw')) {
        console.log('[Fetcher] Fetching projekty_ustaw...');
        results.projekty_ustaw = await fetchProjektyUstaw(config);
    }
    
    // Ustawy (legal acts from ELI API)
    if (config.modules.includes('ustawy')) {
        console.log('[Fetcher] Fetching ustawy...');
        results.ustawy = await fetchUstawy({
            publisher: config.ustawyPublisher || 'DU',
            year: config.ustawyYear || new Date().getFullYear(),
            limit: config.ustawyLimit || 500
        });
    }
    
    // Komisje
    if (config.modules.includes('komisje')) {
        console.log('[Fetcher] Fetching komisje...');
        results.komisje = await fetchKomisje(config);
    }
    
    // Komisje posiedzenia
    if (config.modules.includes('komisje_posiedzenia') && results.komisje) {
        console.log('[Fetcher] Fetching komisje_posiedzenia...');
        results.komisje_posiedzenia = await fetchKomisjePosiedzenia({
            ...config,
            komisje: results.komisje
        });
    }
    
    // Komisje wypowiedzi
    if (config.modules.includes('komisje_wypowiedzi') && results.komisje_posiedzenia) {
        console.log('[Fetcher] Fetching komisje_wypowiedzi...');
        results.komisje_wypowiedzi = await fetchKomisjeWypowiedzi({
            ...config,
            posiedzenia_komisji: results.komisje_posiedzenia
        });
    }
    
    // Oświadczenia majątkowe
    if (config.modules.includes('oswiadczenia') && results.poslowie) {
        console.log('[Fetcher] Fetching oswiadczenia...');
        results.oswiadczenia = await fetchOswiadczenia({
            ...config,
            poslowie: results.poslowie
        });
    }
    
    console.log('[Fetcher] ✅ Complete');
    return results;
}

// Helper: Get sitting numbers from config
export function getSittingNumbers(posiedzenia, config) {
    // If pipeline already provided filtered sitting numbers (incremental cache)
    if (config.sittingsToFetch && Array.isArray(config.sittingsToFetch)) {
        return config.sittingsToFetch;
    }
    
    // Filter out planned sittings with number=0
    const validPosiedzenia = posiedzenia.filter(p => p.number > 0);
    
    // Otherwise filter from posiedzenia list
    if (config.rangeMode === 'last') {
        return validPosiedzenia.slice(-config.rangeCount).map(p => p.number);
    } else if (config.rangeMode === 'custom') {
        return validPosiedzenia
            .filter(p => p.number >= config.rangeFrom && p.number <= config.rangeTo)
            .map(p => p.number);
    }
    return [];
}
