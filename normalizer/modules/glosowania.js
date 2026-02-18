// Normalizer: glosowania

export function normalizeGlosowania(raw) {
    return raw.map(g => ({
        id_glosowania: g.id_glosowania || g.id || `${g.sitting}_${g.votingNumber}` || null,
        id_posiedzenia: g.id_posiedzenia || g.sitting || null,
        numer: g.numer || g.votingNumber || null,
        data: g.data || g.date || null,
        wynik: g.wynik || (g.yes != null && g.no != null ? (g.yes > g.no ? 'przyjęto' : 'odrzucono') : null),
        tytul: g.tytul || g.topic || g.description || null,
        za: g.za ?? g.yes ?? 0,
        przeciw: g.przeciw ?? g.no ?? 0,
        wstrzymalo: g.wstrzymalo ?? g.abstain ?? 0
    }));
}

export async function saveGlosowania(db, records) {
    await db.upsertGlosowania(records);
    console.log(`[Normalizer] Saved ${records.length} glosowania`);
}
