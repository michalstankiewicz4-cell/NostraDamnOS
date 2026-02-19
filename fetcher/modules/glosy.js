// Module: glosy.js
// Pobiera indywidualne głosy posłów z endpointu szczegółów głosowań
// Endpoint: /sejm/term{N}/votings/{sitting}/{votingNumber}
import { safeFetch } from '../fetcher.js';

// Speed profiles: normal / fast / risky
function getSpeedConfig(speed) {
    switch (speed) {
        case 'fast':  return { batch: 10, delay: 50 };
        case 'risky': return { batch: 13, delay: 25 };
        default:      return { batch: 5, delay: 100 };
    }
}

export async function fetchGlosy({ glosowania, kadencja = 10, typ = 'sejm', fetchSpeed = 'normal', onItemProgress }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const results = [];
    const speedCfg = getSpeedConfig(fetchSpeed);
    const totalItems = glosowania.length;
    let doneItems = 0;

    console.log(`[Glosy] Fetching individual votes for ${glosowania.length} votings (speed: ${fetchSpeed})...`);

    for (let i = 0; i < glosowania.length; i += speedCfg.batch) {
        const batch = glosowania.slice(i, i + speedCfg.batch);
        const batchResults = await Promise.all(batch.map(async g => {
            const sitting = g.sitting;
            const votingNumber = g.votingNumber;
            if (!sitting || !votingNumber) return [];

            const id_glosowania = `${kadencja}_${sitting}_${votingNumber}`;
            const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/votings/${sitting}/${votingNumber}`;

            try {
                const data = await safeFetch(url);
                if (data && Array.isArray(data.votes)) {
                    return data.votes.map(v => ({
                        id_glosowania,
                        id_osoby: v.MP,
                        glos: v.vote
                    }));
                }
                return [];
            } catch (e) {
                console.warn(`[Glosy] Failed for ${sitting}/${votingNumber}:`, e.message);
                return [];
            }
        }));
        results.push(...batchResults.flat());
        doneItems = Math.min(i + speedCfg.batch, totalItems);
        if (onItemProgress) onItemProgress(doneItems, totalItems, 'głosy');
        if (speedCfg.delay > 0) await new Promise(r => setTimeout(r, speedCfg.delay));
    }

    console.log(`[Glosy] Total: ${results.length} individual votes`);
    return results;
}
