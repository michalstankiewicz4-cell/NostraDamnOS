// Normalizer: poslowie
// Maps raw API data to SQL-ready records + UPSERT

export function normalizePoslowie(raw) {
    return raw.map(p => ({
        id_osoby: p.id || p.id_osoby,
        imie: p.firstName || p.imie,
        nazwisko: p.lastName || p.nazwisko,
        klub: p.club || p.klub,
        okreg: p.districtNum || p.okreg || null,
        rola: p.rola || 'poseł',
        kadencja: 10, // API term10 zawsze zwraca kadencję 10
        email: p.email || null,
        aktywny: p.active !== undefined ? (p.active ? 1 : 0) : (p.aktywny !== undefined ? p.aktywny : 1)
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
