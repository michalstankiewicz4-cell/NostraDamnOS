// Normalizer: wypowiedzi

export function normalizeWypowiedzi(raw) {
    return raw.map(w => ({
        id_wypowiedzi: w.id || w.id_wypowiedzi || null,
        id_posiedzenia: w.id_posiedzenia || w.posiedzenie || null,
        id_osoby: w.id_osoby || w.posel || null,
        data: w.data || null,
        tekst: w.tekst || w.tresc || '',
        typ: w.typ || 'wystąpienie',
        mowca: w.mowca || null
    }));
}

export function saveWypowiedzi(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO wypowiedzi (id_wypowiedzi, id_posiedzenia, id_osoby, data, tekst, typ, mowca)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_wypowiedzi) DO UPDATE SET
            id_posiedzenia = excluded.id_posiedzenia,
            id_osoby = excluded.id_osoby,
            data = excluded.data,
            tekst = excluded.tekst,
            typ = excluded.typ,
            mowca = excluded.mowca
    `);

    for (const r of records) {
        stmt.run([
            r.id_wypowiedzi, r.id_posiedzenia, r.id_osoby,
            r.data, r.tekst, r.typ, r.mowca
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} wypowiedzi`);

    // Resolve mowca text → id_osoby using poslowie table
    if (typeof db.resolveWypowiedziSpeakers === 'function') {
        db.resolveWypowiedziSpeakers();
    }
}
