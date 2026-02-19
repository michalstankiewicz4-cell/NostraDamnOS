// Normalizer: komisje_wypowiedzi

export function normalizeKomisjeWypowiedzi(raw, config = {}) {
    const k = config.kadencja || '';
    return raw.map(w => ({
        id_wypowiedzi_komisji: `${k}_${w.id || w.id_wypowiedzi || ''}`,
        id_posiedzenia_komisji: `${k}_${w.id_posiedzenia_komisji || w.id_posiedzenia || ''}`,
        id_osoby: w.id_osoby || w.posel || null,
        tekst: w.tekst || w.tresc || '',
        data: w.data || null,
        typ: w.typ || 'wystąpienie'
    }));
}

export async function saveKomisjeWypowiedzi(db, records) {
    await db.upsertKomisjeWypowiedzi(records);
    console.log(`[Normalizer] Saved ${records.length} komisje_wypowiedzi`);
}
