// Normalizer v2.0 - Main orchestrator
// Transform raw JSON → SQL-ready + UPSERT to database

import { normalizePoslowie, savePoslowie } from './modules/poslowie.js';
import { normalizePosiedzenia, savePosiedzenia } from './modules/posiedzenia.js';
import { normalizeWypowiedzi, saveWypowiedzi } from './modules/wypowiedzi.js';
import { normalizeGlosowania, saveGlosowania } from './modules/glosowania.js';
import { normalizeGlosy, saveGlosy } from './modules/glosy.js';
import { normalizeInterpelacje, saveInterpelacje } from './modules/interpelacje.js';
import { normalizeZapytania, saveZapytania } from './modules/zapytania.js';
import { normalizeProjektyUstaw, saveProjektyUstaw } from './modules/projekty_ustaw.js';
import { normalizeKomisje, saveKomisje } from './modules/komisje.js';
import { normalizeKomisjePosiedzenia, saveKomisjePosiedzenia } from './modules/komisje_posiedzenia.js';
import { normalizeKomisjeWypowiedzi, saveKomisjeWypowiedzi } from './modules/komisje_wypowiedzi.js';
import { normalizeOswiadczeniaMajatkowe, saveOswiadczeniaMajatkowe } from './modules/oswiadczenia_majatkowe.js';
import { normalizeUstawy, saveUstawy } from './modules/ustawy.js';

export async function runNormalizer(db, raw, config = {}) {
    console.log('[Normalizer] Starting...');
    
    let stats = {
        poslowie: 0,
        posiedzenia: 0,
        wypowiedzi: 0,
        glosowania: 0,
        glosy: 0,
        interpelacje: 0,
        zapytania: 0,
        projekty_ustaw: 0,
        komisje: 0,
        komisje_posiedzenia: 0,
        komisje_wypowiedzi: 0,
        oswiadczenia_majatkowe: 0,
        ustawy: 0
    };
    
    // 1. Poslowie (foundation - always first)
    if (raw.poslowie && raw.poslowie.length > 0) {
        let normalized = normalizePoslowie(raw.poslowie, config);
        if (config.rodoFilter) {
            normalized = normalized.map(r => ({ ...r, email: null }));
        }
        savePoslowie(db, normalized);
        stats.poslowie = normalized.length;
    }

    // 2. Posiedzenia (needed for per-sitting data)
    if (raw.posiedzenia && raw.posiedzenia.length > 0) {
        const normalized = normalizePosiedzenia(raw.posiedzenia, config);
        savePosiedzenia(db, normalized);
        stats.posiedzenia = normalized.length;
    }
    
    // 3. Wypowiedzi (per sitting)
    if (raw.wypowiedzi && raw.wypowiedzi.length > 0) {
        const normalized = normalizeWypowiedzi(raw.wypowiedzi);
        saveWypowiedzi(db, normalized);
        stats.wypowiedzi = normalized.length;
    }
    
    // 4. Glosowania (per sitting)
    if (raw.glosowania && raw.glosowania.length > 0) {
        const normalized = normalizeGlosowania(raw.glosowania);
        saveGlosowania(db, normalized);
        stats.glosowania = normalized.length;
    }
    
    // 5. Glosy (individual votes)
    if (raw.glosy && raw.glosy.length > 0) {
        const normalized = normalizeGlosy(raw.glosy, raw.glosowania || []);
        saveGlosy(db, normalized);
        stats.glosy = normalized.length;
    }
    
    // 6. Interpelacje (per term)
    if (raw.interpelacje && raw.interpelacje.length > 0) {
        const normalized = normalizeInterpelacje(raw.interpelacje);
        saveInterpelacje(db, normalized);
        stats.interpelacje = normalized.length;
    }
    
    // 7. Zapytania pisemne (per term)
    if (raw.zapytania && raw.zapytania.length > 0) {
        const normalized = normalizeZapytania(raw.zapytania);
        saveZapytania(db, normalized);
        stats.zapytania = normalized.zapytania.length;
    }
    
    // 8. Projekty ustaw (per term)
    if (raw.projekty_ustaw && raw.projekty_ustaw.length > 0) {
        const normalized = normalizeProjektyUstaw(raw.projekty_ustaw);
        saveProjektyUstaw(db, normalized);
        stats.projekty_ustaw = normalized.length;
    }
    
    // 8. Komisje
    if (raw.komisje && raw.komisje.length > 0) {
        const normalized = normalizeKomisje(raw.komisje, config);
        saveKomisje(db, normalized);
        stats.komisje = normalized.length;
    }
    
    // 9. Komisje posiedzenia
    if (raw.komisje_posiedzenia && raw.komisje_posiedzenia.length > 0) {
        const normalized = normalizeKomisjePosiedzenia(raw.komisje_posiedzenia);
        saveKomisjePosiedzenia(db, normalized);
        stats.komisje_posiedzenia = normalized.length;
    }
    
    // 10. Komisje wypowiedzi
    if (raw.komisje_wypowiedzi && raw.komisje_wypowiedzi.length > 0) {
        const normalized = normalizeKomisjeWypowiedzi(raw.komisje_wypowiedzi);
        saveKomisjeWypowiedzi(db, normalized);
        stats.komisje_wypowiedzi = normalized.length;
    }
    
    // 11. Oświadczenia majątkowe
    if (raw.oswiadczenia && raw.oswiadczenia.length > 0) {
        const normalized = normalizeOswiadczeniaMajatkowe(raw.oswiadczenia);
        saveOswiadczeniaMajatkowe(db, normalized);
        stats.oswiadczenia_majatkowe = normalized.length;
    }
    
    // 12. Ustawy (akty prawne)
    if (raw.ustawy && raw.ustawy.length > 0) {
        const normalized = normalizeUstawy(raw.ustawy);
        saveUstawy(db, normalized);
        stats.ustawy = normalized.length;
    }

    console.log('[Normalizer] ✅ Complete - Stats:', stats);
    return stats;
}

// Helper: Create ID hash for composite keys
export function createIdHash(...parts) {
    return parts.filter(Boolean).join('_');
}
