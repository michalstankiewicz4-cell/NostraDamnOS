// Normalizer: interpelacje

export function normalizeInterpelacje(raw) {
    return raw.map(i => ({
        id_interpelacji: `${i.term || 10}_${i.num}`,
        id_osoby: Array.isArray(i.from) ? String(i.from[0]) : null,
        data: i.receiptDate || i.sentDate || null,
        tytul: i.title || null,
        tresc: '',
        status: (i.replies && i.replies.length > 0) ? 'odpowiedziana' : 'złożona'
    }));
}

export async function saveInterpelacje(db, records) {
    await db.upsertInterpelacje(records);
    console.log(`[Normalizer] Saved ${records.length} interpelacje`);
}
