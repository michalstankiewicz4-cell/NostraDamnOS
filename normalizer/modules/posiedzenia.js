// Normalizer: posiedzenia

export function normalizePosiedzenia(raw) {
    return raw.map(p => ({
        id_posiedzenia: p.num || p.id || p.id_posiedzenia,
        numer: p.num || p.numer,
        data_start: p.dataOd || p.data_start,
        data_koniec: p.dataDo || p.data_koniec,
        kadencja: p.kadencja,
        typ: p.typ || 'sejm'
    }));
}

export function savePosiedzenia(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO posiedzenia (id_posiedzenia, numer, data_start, data_koniec, kadencja, typ)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_posiedzenia) DO UPDATE SET
            numer = excluded.numer,
            data_start = excluded.data_start,
            data_koniec = excluded.data_koniec,
            kadencja = excluded.kadencja,
            typ = excluded.typ
    `);

    for (const r of records) {
        stmt.run([
            r.id_posiedzenia, r.numer, r.data_start,
            r.data_koniec, r.kadencja, r.typ
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} posiedzenia`);
}
