// Normalizer: interpelacje

export function normalizeInterpelacje(raw) {
    return raw.map(i => ({
        id_interpelacji: i.id || i.id_interpelacji,
        id_osoby: i.id_osoby || i.posel,
        data: i.data,
        tytul: i.tytul,
        tresc: i.tresc || i.tekst || '',
        status: i.status || 'złożona'
    }));
}

export function saveInterpelacje(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO interpelacje (id_interpelacji, id_osoby, data, tytul, tresc, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_interpelacji) DO UPDATE SET
            id_osoby = excluded.id_osoby,
            data = excluded.data,
            tytul = excluded.tytul,
            tresc = excluded.tresc,
            status = excluded.status
    `);
    
    for (const r of records) {
        stmt.run([
            r.id_interpelacji, r.id_osoby, r.data,
            r.tytul, r.tresc, r.status
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} interpelacje`);
}
