// Normalizer: poslowie
// Maps raw API data to SQL-ready records + UPSERT

export function normalizePoslowie(raw) {
    return raw.map(p => ({
        id_osoby: p.id || p.id_osoby,
        imie: p.imie,
        nazwisko: p.nazwisko,
        klub: p.klub,
        okreg: p.okreg || null,
        rola: p.rola || 'poseł',
        kadencja: p.kadencja,
        email: p.email || null,
        aktywny: p.aktywny !== undefined ? p.aktywny : 1
    }));
}

export function savePoslowie(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO poslowie (id_osoby, imie, nazwisko, klub, okreg, rola, kadencja, email, aktywny)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_osoby) DO UPDATE SET
            imie = excluded.imie,
            nazwisko = excluded.nazwisko,
            klub = excluded.klub,
            okreg = excluded.okreg,
            rola = excluded.rola,
            kadencja = excluded.kadencja,
            email = excluded.email,
            aktywny = excluded.aktywny
    `);

    for (const r of records) {
        stmt.run([
            r.id_osoby, r.imie, r.nazwisko, r.klub, r.okreg,
            r.rola, r.kadencja, r.email, r.aktywny
        ]);
    }
    
    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} poslowie`);
}
