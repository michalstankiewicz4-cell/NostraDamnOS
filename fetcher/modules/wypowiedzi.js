// Module: wypowiedzi.js
// Fetches transcript statements from parliamentary sittings
// Endpoint: /sejm/term{X}/proceedings/{sitting}/{date}/transcripts/{num}

import { safeFetch, safeFetchText } from '../fetcher.js';

// Speed profiles: normal / fast / risky
function getSpeedConfig(speed) {
    switch (speed) {
        case 'fast':  return { batch: 10, delay: 50 };
        case 'risky': return { batch: 13, delay: 25 };
        default:      return { batch: 5, delay: 100 };
    }
}

export async function fetchWypowiedzi(config) {
    const { kadencja, typ = 'sejm', sittingsToFetch = [], fetchSpeed = 'normal', onItemProgress } = config;
    const base = typ === 'sejm' ? 'sejm' : 'senat';

    if (sittingsToFetch.length === 0) {
        console.warn('[wypowiedzi] No sittings to fetch');
        return [];
    }

    // Pobierz listę posiedzeń żeby mieć daty
    const procUrl = `https://api.sejm.gov.pl/${base}/term${kadencja}/proceedings`;
    const proceedings = await safeFetch(procUrl);
    if (!Array.isArray(proceedings)) return [];

    const allStatements = [];
    const totalItems = sittingsToFetch.length;
    let doneItems = 0;

    for (const sittingNum of sittingsToFetch) {
        const proc = proceedings.find(p => p.number === sittingNum);
        if (!proc || !Array.isArray(proc.dates) || proc.dates.length === 0) {
            doneItems++;
            if (onItemProgress) onItemProgress(doneItems, totalItems, 'wypowiedzi');
            continue;
        }

        for (const date of proc.dates) {
            const statements = await fetchTranscriptsForDay(base, kadencja, sittingNum, date, fetchSpeed);
            allStatements.push(...statements);
        }
        doneItems++;
        if (onItemProgress) onItemProgress(doneItems, totalItems, 'wypowiedzi');
    }

    console.log(`[wypowiedzi] Fetched ${allStatements.length} statements from ${sittingsToFetch.length} sittings`);
    return allStatements;
}

async function fetchTranscriptsForDay(base, kadencja, sitting, date, speed = 'normal') {
    const statements = [];
    const apiBase = `https://api.sejm.gov.pl/${base}/term${kadencja}/proceedings/${sitting}/${date}/transcripts`;

    // Sprawdź czy transcript #1 istnieje — jeśli nie, ten dzień nie ma stenogramów
    const first = await safeFetchText(`${apiBase}/1`);
    if (!first) {
        console.log(`[wypowiedzi] No transcripts for sitting ${sitting}, date ${date} — skipping`);
        return statements;
    }

    // Mamy #1, sparsuj od razu
    statements.push(...parseTranscriptHTML(first, kadencja, sitting, date, 1));

    // Probe — szukaj końca numeracji (co 10)
    let maxNum = 10;
    for (let probe = 10; probe < 300; probe += 10) {
        const html = await safeFetchText(`${apiBase}/${probe}`);
        if (!html) break;
        maxNum = probe + 10;
    }

    // Pobierz od #2 w batchach — rozmiar zależy od fetchSpeed
    const nums = Array.from({ length: maxNum - 1 }, (_, i) => i + 2);
    const speedCfg = getSpeedConfig(speed);

    for (let i = 0; i < nums.length; i += speedCfg.batch) {
        const batch = nums.slice(i, i + speedCfg.batch);

        const results = await Promise.all(batch.map(async num => {
            const html = await safeFetchText(`${apiBase}/${num}`);
            if (!html) return [];
            return parseTranscriptHTML(html, kadencja, sitting, date, num);
        }));

        const valid = results.flat();
        statements.push(...valid);

        // Jeśli batch pusty i jesteśmy za probe — koniec
        if (valid.length === 0 && i > 20) break;
        if (speedCfg.delay > 0) await new Promise(r => setTimeout(r, speedCfg.delay));
    }

    return statements;
}

function parseTranscriptHTML(html, kadencja, sitting, date, transcriptNum) {
    const statements = [];
    if (!html) return statements;

    const parts = html.split(/<h2 class="mowca">/);
    for (let i = 1; i < parts.length; i++) {
        const speakerMatch = parts[i].match(/^(.*?):<\/h2>/);
        if (!speakerMatch) continue;

        const textMatch = parts[i].match(/<\/h2>([\s\S]*?)$/);
        if (!textMatch) continue;

        const text = textMatch[1].trim().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

        if (text && text.length > 10) {
            statements.push({
                id: `${kadencja}_${sitting}_${date}_${transcriptNum}_${i}`,
                id_posiedzenia: `${kadencja}_${sitting}`,
                id_osoby: null,
                data: date,
                tekst: text,
                typ: 'wystąpienie',
                mowca: speakerMatch[1].trim()
            });
        }
    }
    return statements;
}
