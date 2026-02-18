// Normalizer: posiedzenia

export function normalizePosiedzenia(raw, config = {}) {
    const isSenat = config.typ === 'senat';

    // Odfiltruj nieprawidłowe rekordy (number=0, brak dat, planowane posiedzenia)
    // Senat: CSV nie zawiera dat — dopuszczamy puste dates
    const valid = raw.filter(p =>
        (p.number > 0 || p.num > 0 || p.id > 0) &&
        (isSenat || (Array.isArray(p.dates) && p.dates.length > 0))
    );

    return valid.map(p => ({
        id_posiedzenia: p.number || p.num || p.id,
        numer: p.number || p.num || p.numer || null,
        data_start: Array.isArray(p.dates) && p.dates[0] ? p.dates[0] : null,
        data_koniec: Array.isArray(p.dates) && p.dates.length > 0 ? p.dates[p.dates.length - 1] : null,
        kadencja: p.kadencja || config.kadencja || null,
        typ: p.typ || config.typ || null
    }));
}

export async function savePosiedzenia(db, records) {
    await db.upsertPosiedzenia(records);
    console.log(`[Normalizer] Saved ${records.length} posiedzenia`);
}
