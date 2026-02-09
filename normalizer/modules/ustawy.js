// Normalizer: ustawy (akty prawne ELI)

export function normalizeUstawy(raw) {
    return raw.map(u => ({
        id_ustawy: `${u.publisher || 'DU'}_${u.year}_${u.pos}`,
        publisher: u.publisher || 'DU',
        year: u.year || null,
        pos: u.pos || null,
        title: u.title || null,
        type: u.type || null,
        status: u.status || null,
        promulgation: u.promulgation || null,
        entry_into_force: u.entryIntoForce || u.entry_into_force || null
    }));
}

export function saveUstawy(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO ustawy (id_ustawy, publisher, year, pos, title, type, status, promulgation, entry_into_force)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_ustawy) DO UPDATE SET
            title = excluded.title,
            type = excluded.type,
            status = excluded.status,
            promulgation = excluded.promulgation,
            entry_into_force = excluded.entry_into_force
    `);

    for (const r of records) {
        stmt.run([
            r.id_ustawy, r.publisher, r.year, r.pos,
            r.title, r.type, r.status, r.promulgation, r.entry_into_force
        ]);
    }

    stmt.free();
    console.log(`[Normalizer] Saved ${records.length} ustawy`);
}
