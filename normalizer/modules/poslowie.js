// Normalizer: poslowie
// Maps raw API data to SQL-ready records + UPSERT

export function normalizePoslowie(raw, config = {}) {
    return raw.map(p => ({
        id_osoby: p.id || p.id_osoby || null,
        imie: p.firstName || p.imie || null,
        nazwisko: p.lastName || p.nazwisko || null,
        klub: p.club || p.klub || null,
        okreg: p.districtNum || p.okreg || null,
        rola: p.rola || (config.typ === 'senat' ? 'senator' : 'poseł'),
        kadencja: p.kadencja || config.kadencja || null,
        email: p.email || null,
        aktywny: p.active !== undefined ? (p.active ? 1 : 0) : (p.aktywny !== undefined ? (p.aktywny ? 1 : 0) : 1)
    }));
}

export async function savePoslowie(db, records) {
    await db.upsertPoslowie(records);
    console.log(`[Normalizer] Saved ${records.length} poslowie`);
}
