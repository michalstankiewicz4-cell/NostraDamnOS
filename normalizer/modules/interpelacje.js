// Normalizer: interpelacje

export function normalizeInterpelacje(raw) {
    return raw.map(i => ({
        id_interpelacji: `${i.term || 10}_${i.num}`,
        id_osoby: Array.isArray(i.from) ? String(i.from[0]) : null,
        data: i.receiptDate || i.sentDate || null,
        tytul: i.title || null,
        tresc: '',
        status: (i.replies && i.replies.length > 0) ? 'odpowiedziana' : 'złożona'
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
