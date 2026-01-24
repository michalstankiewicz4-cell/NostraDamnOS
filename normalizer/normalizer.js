// Normalizer v2.0 - Main orchestrator
// Transform raw JSON → SQL-ready + UPSERT to database

import { normalizePoslowie, savePoslowie } from './modules/poslowie.js';
import { normalizePosiedzenia, savePosiedzenia } from './modules/posiedzenia.js';
import { normalizeWypowiedzi, saveWypowiedzi } from './modules/wypowiedzi.js';
import { normalizeGlosowania, saveGlosowania } from './modules/glosowania.js';

export async function runNormalizer(db, raw) {
    console.log('[Normalizer] Starting...');
    
    // 1. Poslowie (foundation - always first)
    if (raw.poslowie && raw.poslowie.length > 0) {
        const normalized = normalizePoslowie(raw.poslowie);
        savePoslowie(db, normalized);
    }
    
    // 2. Posiedzenia (needed for per-sitting data)
    if (raw.posiedzenia && raw.posiedzenia.length > 0) {
        const normalized = normalizePosiedzenia(raw.posiedzenia);
        savePosiedzenia(db, normalized);
    }
    
    // 3. Wypowiedzi (per sitting)
    if (raw.wypowiedzi && raw.wypowiedzi.length > 0) {
        const normalized = normalizeWypowiedzi(raw.wypowiedzi);
        saveWypowiedzi(db, normalized);
    }
    
    // 4. Glosowania (per sitting)
    if (raw.glosowania && raw.glosowania.length > 0) {
        const normalized = normalizeGlosowania(raw.glosowania);
        saveGlosowania(db, normalized);
    }
    
    // 5. Glosy (individual votes)
    // TODO: implement when module ready
    
    // 6. Interpelacje
    // TODO: implement when module ready
    
    // 7. Projekty ustaw
    // TODO: implement when module ready
    
    // 8. Komisje
    // TODO: implement when module ready
    
    // 9-11. Committee data
    // TODO: implement when modules ready
    
    console.log('[Normalizer] ✅ Complete');
}

// Helper: Create ID hash for composite keys
export function createIdHash(...parts) {
    return parts.filter(Boolean).join('_');
}
