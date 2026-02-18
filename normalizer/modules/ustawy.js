// Normalizer: ustawy (akty prawne ELI)

export function normalizeUstawy(raw) {
    return raw.map(u => ({
        id_ustawy: `${u.publisher || 'DU'}_${u.year}_${u.pos}`,
        publisher: u.publisher || 'DU',
        year: u.year || null,
        pos: u.pos || null,
        title: u.title || null,
        type: u.type || null,
        status: u.status || null,
        promulgation: u.promulgation || null,
        entry_into_force: u.entryIntoForce || u.entry_into_force || null
    }));
}

export async function saveUstawy(db, records) {
    await db.upsertUstawy(records);
    console.log(`[Normalizer] Saved ${records.length} ustawy`);
}
