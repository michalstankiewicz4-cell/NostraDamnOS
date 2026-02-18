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

export async function runNormalizer(db, raw, config = {}, onProgress = () => {}) {
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

    // Modules to process — each gets a progress step
    const modules = [
        { key: 'poslowie', label: 'Posłowie' },
        { key: 'posiedzenia', label: 'Posiedzenia' },
        { key: 'wypowiedzi', label: 'Wypowiedzi' },
        { key: 'glosowania', label: 'Głosowania' },
        { key: 'glosy', label: 'Głosy' },
        { key: 'interpelacje', label: 'Interpelacje' },
        { key: 'zapytania', label: 'Zapytania' },
        { key: 'projekty_ustaw', label: 'Projekty ustaw' },
        { key: 'komisje', label: 'Komisje' },
        { key: 'komisje_posiedzenia', label: 'Posiedzenia komisji' },
        { key: 'komisje_wypowiedzi', label: 'Wypowiedzi komisji' },
        { key: 'oswiadczenia', label: 'Oświadczenia' },
        { key: 'ustawy', label: 'Ustawy' }
    ];

    let step = 0;
    const totalSteps = modules.length;

    function reportProgress(label, count) {
        step++;
        const pct = Math.round((step / totalSteps) * 100);
        onProgress(pct, label, count);
    }

    // 1. Poslowie (foundation - always first)
    if (raw.poslowie && raw.poslowie.length > 0) {
        let normalized = normalizePoslowie(raw.poslowie, config);
        if (config.rodoFilter) {
            normalized = normalized.map(r => ({ ...r, email: null }));
        }
        await savePoslowie(db, normalized);
        stats.poslowie = normalized.length;
    }
    reportProgress('Posłowie', stats.poslowie);

    // 2. Posiedzenia (needed for per-sitting data)
    if (raw.posiedzenia && raw.posiedzenia.length > 0) {
        const normalized = normalizePosiedzenia(raw.posiedzenia, config);
        await savePosiedzenia(db, normalized);
        stats.posiedzenia = normalized.length;
    }
    reportProgress('Posiedzenia', stats.posiedzenia);

    // 3. Wypowiedzi (per sitting)
    if (raw.wypowiedzi && raw.wypowiedzi.length > 0) {
        const normalized = normalizeWypowiedzi(raw.wypowiedzi);
        await saveWypowiedzi(db, normalized);
        stats.wypowiedzi = normalized.length;
    }
    reportProgress('Wypowiedzi', stats.wypowiedzi);

    // 4. Glosowania (per sitting)
    if (raw.glosowania && raw.glosowania.length > 0) {
        const normalized = normalizeGlosowania(raw.glosowania);
        await saveGlosowania(db, normalized);
        stats.glosowania = normalized.length;
    }
    reportProgress('Głosowania', stats.glosowania);

    // 5. Glosy (individual votes)
    if (raw.glosy && raw.glosy.length > 0) {
        const normalized = normalizeGlosy(raw.glosy, raw.glosowania || []);
        await saveGlosy(db, normalized);
        stats.glosy = normalized.length;
    }
    reportProgress('Głosy', stats.glosy);

    // 6. Interpelacje (per term)
    if (raw.interpelacje && raw.interpelacje.length > 0) {
        const normalized = normalizeInterpelacje(raw.interpelacje);
        await saveInterpelacje(db, normalized);
        stats.interpelacje = normalized.length;
    }
    reportProgress('Interpelacje', stats.interpelacje);

    // 7. Zapytania pisemne (per term)
    if (raw.zapytania && raw.zapytania.length > 0) {
        const normalized = normalizeZapytania(raw.zapytania);
        await saveZapytania(db, normalized);
        stats.zapytania = normalized.zapytania.length;
    }
    reportProgress('Zapytania', stats.zapytania);

    // 8. Projekty ustaw (per term)
    if (raw.projekty_ustaw && raw.projekty_ustaw.length > 0) {
        const normalized = normalizeProjektyUstaw(raw.projekty_ustaw);
        await saveProjektyUstaw(db, normalized);
        stats.projekty_ustaw = normalized.length;
    }
    reportProgress('Projekty ustaw', stats.projekty_ustaw);

    // 9. Komisje
    if (raw.komisje && raw.komisje.length > 0) {
        const normalized = normalizeKomisje(raw.komisje, config);
        await saveKomisje(db, normalized);
        stats.komisje = normalized.length;
    }
    reportProgress('Komisje', stats.komisje);

    // 10. Komisje posiedzenia
    if (raw.komisje_posiedzenia && raw.komisje_posiedzenia.length > 0) {
        const normalized = normalizeKomisjePosiedzenia(raw.komisje_posiedzenia);
        await saveKomisjePosiedzenia(db, normalized);
        stats.komisje_posiedzenia = normalized.length;
    }
    reportProgress('Posiedzenia komisji', stats.komisje_posiedzenia);

    // 11. Komisje wypowiedzi
    if (raw.komisje_wypowiedzi && raw.komisje_wypowiedzi.length > 0) {
        const normalized = normalizeKomisjeWypowiedzi(raw.komisje_wypowiedzi);
        await saveKomisjeWypowiedzi(db, normalized);
        stats.komisje_wypowiedzi = normalized.length;
    }
    reportProgress('Wypowiedzi komisji', stats.komisje_wypowiedzi);

    // 12. Oświadczenia majątkowe
    if (raw.oswiadczenia && raw.oswiadczenia.length > 0) {
        const normalized = normalizeOswiadczeniaMajatkowe(raw.oswiadczenia);
        await saveOswiadczeniaMajatkowe(db, normalized);
        stats.oswiadczenia_majatkowe = normalized.length;
    }
    reportProgress('Oświadczenia', stats.oswiadczenia_majatkowe);

    // 13. Ustawy (akty prawne)
    if (raw.ustawy && raw.ustawy.length > 0) {
        const normalized = normalizeUstawy(raw.ustawy);
        await saveUstawy(db, normalized);
        stats.ustawy = normalized.length;
    }
    reportProgress('Ustawy', stats.ustawy);

    console.log('[Normalizer] ✅ Complete - Stats:', stats);
    return stats;
}

// Helper: Create ID hash for composite keys
export function createIdHash(...parts) {
    return parts.filter(Boolean).join('_');
}
