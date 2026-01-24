// Normalizer: komisje_wypowiedzi

export function normalizeKomisjeWypowiedzi(raw) {
    return raw.map(w => ({
        id_wypowiedzi_komisji: w.id || w.id_wypowiedzi,
        id_posiedzenia_komisji: w.id_posiedzenia_komisji || w.id_posiedzenia,
        id_osoby: w.id_osoby || w.posel,
        tekst: w.tekst || w.tresc || '',
        data: w.data,
        typ: w.typ || 'wystąpienie'
    }));
}

export function saveKomisjeWypowiedzi(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO komisje_wypowiedzi (id_wypowiedzi_komisji, id_posiedzenia_komisji, id_osoby, tekst, data, typ)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_wypowiedzi_komisji) DO UPDATE SET
            id_posiedzenia_komisji = excluded.id_posiedzenia_komisji,
            id_osoby = excluded.id_osoby,
            tekst = excluded.tekst,
            data = excluded.data,
            typ = excluded.typ
    `);
    
    for (const r of records) {
        stmt.run([
            r.id_wypowiedzi_komisji, r.id_posiedzenia_komisji,
            r.id_osoby, r.tekst, r.data, r.typ
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} komisje_wypowiedzi`);
}
