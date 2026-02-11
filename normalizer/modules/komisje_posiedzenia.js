// Normalizer: komisje_posiedzenia

export function normalizeKomisjePosiedzenia(raw) {
    return raw.map(p => {
        const code = p.code || p.id_komisji || p.komisja || '';
        const num = p.num || p.numer || 0;
        return {
            id_posiedzenia_komisji: p.id || p.id_posiedzenia || `${code}_${num}`,
            id_komisji: code || null,
            numer: num || null,
            data: p.date || p.data || null,
            opis: p.agenda || p.opis || p.temat || ''
        };
    });
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
