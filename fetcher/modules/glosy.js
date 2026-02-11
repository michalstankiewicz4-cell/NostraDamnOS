// Module: glosy.js
// Pobiera indywidualne głosy posłów z endpointu szczegółów głosowań
// Endpoint: /sejm/term{N}/votings/{sitting}/{votingNumber}
import { safeFetch } from '../fetcher.js';

export async function fetchGlosy({ glosowania, kadencja = 10, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const results = [];

    console.log(`[Glosy] Fetching individual votes for ${glosowania.length} votings...`);

    for (const g of glosowania) {
        const sitting = g.sitting;
        const votingNumber = g.votingNumber;
        if (!sitting || !votingNumber) continue;

        const id_glosowania = `${sitting}_${votingNumber}`;
        const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/votings/${sitting}/${votingNumber}`;

        try {
            const data = await safeFetch(url);
            if (data && Array.isArray(data.votes)) {
                for (const v of data.votes) {
                    results.push({
                        id_glosowania,
                        id_osoby: v.MP,
                        glos: v.vote
                    });
                }
            }
        } catch (e) {
            console.warn(`[Glosy] Failed for ${sitting}/${votingNumber}:`, e.message);
        }
    }

    console.log(`[Glosy] Total: ${results.length} individual votes`);
    return results;
}
