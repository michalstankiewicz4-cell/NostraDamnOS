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

export async function saveProjektyUstaw(db, records) {
    await db.upsertProjektyUstaw(records);
    console.log(`[Normalizer] Saved ${records.length} projekty_ustaw`);
}
