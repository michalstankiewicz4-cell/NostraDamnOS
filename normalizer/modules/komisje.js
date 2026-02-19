// Normalizer: komisje

export function normalizeKomisje(raw, config = {}) {
    const kadencja = config.kadencja || '';
    return raw.map(k => ({
        id_komisji: `${kadencja}_${k.code || ''}`,
        nazwa: k.name || null,
        skrot: k.code || null,
        typ: k.type === 'STANDING' ? 'stała' : k.type === 'EXTRAORDINARY' ? 'nadzwyczajna' : (k.type || 'stała'),
        kadencja: config.kadencja || null
    }));
}

export async function saveKomisje(db, records) {
    await db.upsertKomisje(records);
    console.log(`[Normalizer] Saved ${records.length} komisje`);
}
