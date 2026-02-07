// Normalizer: poslowie
// Maps raw API data to SQL-ready records + UPSERT

export function normalizePoslowie(raw, config = {}) {
    return raw.map(p => ({
        id_osoby: p.id || p.id_osoby || null,
        imie: p.firstName || p.imie || null,
        nazwisko: p.lastName || p.nazwisko || null,
        klub: p.club || p.klub || null,
        okreg: p.districtNum || p.okreg || null,
        rola: p.rola || (config.typ === 'senat' ? 'senator' : 'poseł'),
        kadencja: p.kadencja || config.kadencja || null,
        email: p.email || null,
        aktywny: p.active !== undefined ? (p.active ? 1 : 0) : (p.aktywny !== undefined ? (p.aktywny ? 1 : 0) : 1)
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
