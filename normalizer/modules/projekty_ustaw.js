// Normalizer: projekty_ustaw

export function normalizeProjektyUstaw(raw) {
    return raw.map(p => ({
        id_projektu: `${p.term || 10}_${p.number}`,
        kadencja: p.term || null,
        data: p.documentDate || p.deliveryDate || null,
        tytul: p.title || null,
        status: 'w toku',
        opis: ''
    }));
}

export function saveProjektyUstaw(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO projekty_ustaw (id_projektu, kadencja, data, tytul, status, opis)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_projektu) DO UPDATE SET
            kadencja = excluded.kadencja,
            data = excluded.data,
            tytul = excluded.tytul,
            status = excluded.status,
            opis = excluded.opis
    `);
    
    for (const r of records) {
        stmt.run([
            r.id_projektu, r.kadencja, r.data,
            r.tytul, r.status, r.opis
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} projekty_ustaw`);
}
