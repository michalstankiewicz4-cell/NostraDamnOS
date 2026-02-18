// Normalizer: oswiadczenia_majatkowe

export function normalizeOswiadczeniaMajatkowe(raw) {
    return raw.map(o => ({
        id_oswiadczenia: o.id || o.id_oswiadczenia || null,
        id_osoby: o.id_osoby || o.posel || null,
        rok: o.rok || o.rokOswiadczenia || null,
        tresc: o.tresc || o.dane || JSON.stringify(o),
        data_zlozenia: o.data_zlozenia || o.dataZlozenia || null
    }));
}

export async function saveOswiadczeniaMajatkowe(db, records) {
    await db.upsertOswiadczeniaMajatkowe(records);
    console.log(`[Normalizer] Saved ${records.length} oswiadczenia_majatkowe`);
}
