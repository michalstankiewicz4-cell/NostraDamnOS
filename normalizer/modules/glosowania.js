// Normalizer: glosowania

export function normalizeGlosowania(raw) {
    return raw.map(g => ({
        id_glosowania: g.id_glosowania || g.id || `${g.sitting}_${g.votingNumber}` || null,
        id_posiedzenia: g.id_posiedzenia || g.sitting || null,
        numer: g.numer || g.votingNumber || null,
        data: g.data || g.date || null,
        wynik: g.wynik || (g.yes != null && g.no != null ? (g.yes > g.no ? 'przyjęto' : 'odrzucono') : null),
        tytul: g.tytul || g.topic || g.description || null,
        za: g.za ?? g.yes ?? 0,
        przeciw: g.przeciw ?? g.no ?? 0,
        wstrzymalo: g.wstrzymalo ?? g.abstain ?? 0
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
