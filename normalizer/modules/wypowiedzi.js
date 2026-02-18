// Normalizer: wypowiedzi

export function normalizeWypowiedzi(raw) {
    return raw.map(w => ({
        id_wypowiedzi: w.id || w.id_wypowiedzi || null,
        id_posiedzenia: w.id_posiedzenia || w.posiedzenie || null,
        id_osoby: w.id_osoby || w.posel || null,
        data: w.data || null,
        tekst: w.tekst || w.tresc || '',
        typ: w.typ || 'wystąpienie',
        mowca: w.mowca || null
    }));
}

export async function saveWypowiedzi(db, records) {
    await db.upsertWypowiedzi(records);
    console.log(`[Normalizer] Saved ${records.length} wypowiedzi`);

    // Resolve mowca text → id_osoby using poslowie table
    if (typeof db.resolveWypowiedziSpeakers === 'function') {
        db.resolveWypowiedziSpeakers();
    }
}
