// Normalizer: glosy (individual votes)

export function normalizeGlosy(raw, glosowania) {
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
    for (const g of glosowania) {
        const votes = raw[g.id] || [];
        for (const v of votes) {
            results.push({
                id_glosu: `${g.id}_${v.id_osoby}`,
                id_glosowania: g.id || null,
                id_osoby: v.id_osoby || null,
                glos: v.glos || null
            });
        }
    }

    return results;
}

export function saveGlosy(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO glosy (id_glosu, id_glosowania, id_osoby, glos)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id_glosu) DO UPDATE SET glos = excluded.glos
    `);
    for (const r of records) {
        stmt.run([r.id_glosu, r.id_glosowania, r.id_osoby, r.glos]);
    }
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} glosy`);
}
