// Normalizer: komisje_posiedzenia

export function normalizeKomisjePosiedzenia(raw) {
    return raw.map(p => ({
        id_posiedzenia_komisji: p.id || p.id_posiedzenia || null,
        id_komisji: p.id_komisji || p.komisja || null,
        numer: p.numer || p.num || null,
        data: p.data || null,
        opis: p.opis || p.temat || ''
    }));
}

export function saveKomisjePosiedzenia(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO komisje_posiedzenia (id_posiedzenia_komisji, id_komisji, numer, data, opis)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id_posiedzenia_komisji) DO UPDATE SET
            id_komisji = excluded.id_komisji,
            numer = excluded.numer,
            data = excluded.data,
            opis = excluded.opis
    `);
    
    for (const r of records) {
        stmt.run([
            r.id_posiedzenia_komisji, r.id_komisji,
            r.numer, r.data, r.opis
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} komisje_posiedzenia`);
}
