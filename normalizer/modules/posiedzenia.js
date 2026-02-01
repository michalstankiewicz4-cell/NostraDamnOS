// Normalizer: posiedzenia

export function normalizePosiedzenia(raw) {
    // Odfiltruj nieprawidłowe rekordy (number=0, brak dat, planowane posiedzenia)
    const valid = raw.filter(p => 
        (p.number > 0 || p.num > 0 || p.id > 0) &&
        Array.isArray(p.dates) && p.dates.length > 0
    );
    
    return valid.map(p => ({
        id_posiedzenia: p.number || p.num || p.id,
        numer: p.number || p.num || p.numer,
        data_start: p.dates[0] || null,
        data_koniec: p.dates[p.dates.length - 1] || null,
        kadencja: 10,
        typ: 'sejm'
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
