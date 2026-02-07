// Normalizer: oswiadczenia_majatkowe

export function normalizeOswiadczeniaMajatkowe(raw) {
    return raw.map(o => ({
        id_oswiadczenia: o.id || o.id_oswiadczenia || null,
        id_osoby: o.id_osoby || o.posel || null,
        rok: o.rok || o.rokOswiadczenia || null,
        tresc: o.tresc || o.dane || JSON.stringify(o),
        data_zlozenia: o.data_zlozenia || o.dataZlozenia || null
    }));
}

export function saveOswiadczeniaMajatkowe(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO oswiadczenia_majatkowe (id_oswiadczenia, id_osoby, rok, tresc, data_zlozenia)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id_oswiadczenia) DO UPDATE SET
            id_osoby = excluded.id_osoby,
            rok = excluded.rok,
            tresc = excluded.tresc,
            data_zlozenia = excluded.data_zlozenia
    `);
    
    for (const r of records) {
        stmt.run([
            r.id_oswiadczenia, r.id_osoby, r.rok,
            r.tresc, r.data_zlozenia
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} oswiadczenia_majatkowe`);
}
