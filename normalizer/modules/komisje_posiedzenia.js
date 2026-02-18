// Normalizer: komisje_posiedzenia

export function normalizeKomisjePosiedzenia(raw) {
    return raw.map(p => {
        const code = p.code || p.id_komisji || p.komisja || '';
        const num = p.num || p.numer || 0;
        return {
            id_posiedzenia_komisji: p.id || p.id_posiedzenia || `${code}_${num}`,
            id_komisji: code || null,
            numer: num || null,
            data: p.date || p.data || null,
            opis: p.agenda || p.opis || p.temat || ''
        };
    });
}

export async function saveKomisjePosiedzenia(db, records) {
    await db.upsertKomisjePosiedzenia(records);
    console.log(`[Normalizer] Saved ${records.length} komisje_posiedzenia`);
}
