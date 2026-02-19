// Normalizer: glosy (individual votes)

export function normalizeGlosy(raw, glosowania, config = {}) {
    const results = [];

    // Płaska tablica z gotowymi polami (Sejm + Senat)
    if (Array.isArray(raw)) {
        for (const v of raw) {
            results.push({
                id_glosu: v.id_glosu || `${v.id_glosowania}_${v.id_osoby}`,
                id_glosowania: v.id_glosowania || null,
                id_osoby: v.id_osoby || null,
                glos: v.glos || null
            });
        }
        return results;
    }

    // Sejm: raw to dict {glosowanieId: [votes]}
    const k = config.kadencja || '';
    for (const g of glosowania) {
        const votes = raw[g.id] || [];
        for (const v of votes) {
            results.push({
                id_glosu: `${k}_${g.id}_${v.id_osoby}`,
                id_glosowania: `${k}_${g.id}`,
                id_osoby: v.id_osoby || null,
                glos: v.glos || null
            });
        }
    }

    return results;
}

export async function saveGlosy(db, records) {
    await db.upsertGlosy(records);
    console.log(`[Normalizer] Saved ${records.length} glosy`);
}
