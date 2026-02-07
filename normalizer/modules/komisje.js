// Normalizer: komisje

export function normalizeKomisje(raw) {
    return raw.map(k => ({
        id_komisji: k.id || k.kod || k.id_komisji || null,
        nazwa: k.nazwa || k.nazwaSkrocona || null,
        skrot: k.skrot || k.kod || null,
        typ: k.typ || 'stała',
        kadencja: k.kadencja || null
    }));
}

export function saveKomisje(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO komisje (id_komisji, nazwa, skrot, typ, kadencja)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id_komisji) DO UPDATE SET
            nazwa = excluded.nazwa,
            skrot = excluded.skrot,
            typ = excluded.typ,
            kadencja = excluded.kadencja
    `);
    
    for (const r of records) {
        stmt.run([
            r.id_komisji, r.nazwa, r.skrot,
            r.typ, r.kadencja
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} komisje`);
}
