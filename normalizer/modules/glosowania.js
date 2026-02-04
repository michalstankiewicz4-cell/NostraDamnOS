// Normalizer: glosowania

export function normalizeGlosowania(raw) {
    return raw.map(g => ({
        id_glosowania: g.id || g.id_glosowania,
        id_posiedzenia: g.id_posiedzenia,
        numer: g.numer,
        data: g.data,
        wynik: g.wynik,
        tytul: g.tytul,
        za: g.za || 0,
        przeciw: g.przeciw || 0,
        wstrzymalo: g.wstrzymalo || 0
    }));
}

export function saveGlosowania(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO glosowania (id_glosowania, id_posiedzenia, numer, data, wynik, tytul, za, przeciw, wstrzymalo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_glosowania) DO UPDATE SET
            id_posiedzenia = excluded.id_posiedzenia,
            numer = excluded.numer,
            data = excluded.data,
            wynik = excluded.wynik,
            tytul = excluded.tytul,
            za = excluded.za,
            przeciw = excluded.przeciw,
            wstrzymalo = excluded.wstrzymalo
    `);
    for (const r of records) {
        stmt.run([r.id_glosowania, r.id_posiedzenia, r.numer, r.data, r.wynik, r.tytul, r.za, r.przeciw, r.wstrzymalo]);
    }
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} glosowania`);
}
