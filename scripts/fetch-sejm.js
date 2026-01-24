// scripts/fetch-sejm.js
// Użycie: node scripts/fetch-sejm.js [term] [maxProceedings]

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.sejm.gov.pl/sejm';
const TERM = process.argv[2] || '10';
const MAX_PROCEEDINGS = parseInt(process.argv[3]) || 5;
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'sejm');
const DELAY_MS = 400;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`GET ${url}`);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.warn(`  ⚠ ${e.message} (próba ${i+1}/${retries})`);
            if (i === retries - 1) throw e;
            await sleep(DELAY_MS * 2);
        }
    }
}

async function fetchTEXT(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`GET ${url}`);
            const res = await fetch(url);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (e) {
            console.warn(`  ⚠ ${e.message} (próba ${i+1}/${retries})`);
            if (i === retries - 1) throw e;
            await sleep(DELAY_MS * 2);
        }
    }
}

function saveJSONL(filepath, data) {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const lines = data.map(o => JSON.stringify(o)).join('\n');
    fs.writeFileSync(filepath, lines + '\n', 'utf8');
    console.log(`💾 ${filepath} (${data.length} rekordów)`);
}

// POSŁOWIE
async function fetchMPs() {
    const url = `${API_BASE}/term${TERM}/MP`;
    console.log('\n📥 Posłowie...');
    const mps = await fetchJSON(url);
    const mapped = mps.map(mp => ({
        id: mp.id,
        firstName: mp.firstName,
        secondName: mp.secondName || null,
        lastName: mp.lastName,
        club: mp.club,
        birthDate: mp.birthDate,
        districtNum: mp.districtNum,
        voivodeship: mp.voivodeship,
        active: mp.active
    }));
    saveJSONL(path.join(OUTPUT_DIR, 'poslowie.jsonl'), mapped);
    return mapped;
}

// POSIEDZENIA
async function fetchProceedings() {
    const url = `${API_BASE}/term${TERM}/proceedings`;
    console.log('\n📥 Posiedzenia...');
    const proceedings = await fetchJSON(url);
    
    // Filtruj tylko zakończone (number > 0)
    const completed = proceedings.filter(p => p.number > 0);
    
    // Sortuj malejąco (najnowsze pierwsze)
    const sorted = completed.sort((a, b) => b.number - a.number);
    
    // Weź ostatnie N
    const limited = sorted.slice(0, MAX_PROCEEDINGS);
    
    console.log(`  📊 Zakończonych posiedzeń: ${completed.length}`);
    console.log(`  📥 Pobieranie ostatnich ${limited.length}: ${limited.map(p => p.number).join(', ')}`);
    
    const mapped = limited.map((p, idx) => {
        const m = p.title.match(/^(\d+)\./);
        const num = m ? parseInt(m[1]) : p.number;
        return {
            num,
            term: p.term,
            title: p.title,
            dates: p.dates
        };
    });
    saveJSONL(path.join(OUTPUT_DIR, 'posiedzenia.jsonl'), mapped);
    return mapped;
}

// WYPOWIEDZI RAW (HTML → tekst, ale bez memberID/role/position)
function parseTranscriptHTMLRaw(html, sitting, date, transcriptNum) {
    const parts = html.split(/<h2 class="mowca">/);
    const out = [];

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const speakerMatch = part.match(/^(.*?):<\/h2>/);
        if (!speakerMatch) continue;
        const speakerRaw = speakerMatch[1].trim();

        const textMatch = part.match(/<\/h2>([\s\S]*?)(?=<h2 class="mowca">|$)/);
        if (!textMatch) continue;

        let text = textMatch[1]
            .replace(/<p class="punkt-tytul">[\s\S]*?<\/p>/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#\d+;/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (text.length < 50) continue;

        out.push({
            institution: 'sejm',
            sitting,
            date,
            transcriptNum,
            speakerRaw,
            text
        });
    }

    return out;
}

async function fetchStatementsForDay(sitting, date) {
    console.log(`\n📥 Wypowiedzi: posiedzenie ${sitting}, data ${date}`);
    const all = [];
    let num = 1;
    let notFound = 0;

    while (notFound < 3 && num < 300) {
        const url = `${API_BASE}/term${TERM}/proceedings/${sitting}/${date}/transcripts/${num}`;
        const html = await fetchTEXT(url);
        if (!html) {
            notFound++;
        } else {
            const parsed = parseTranscriptHTMLRaw(html, sitting, date, num);
            all.push(...parsed);
            console.log(`  ✅ transcript ${num} → ${parsed.length} wypowiedzi`);
            notFound = 0;
        }
        num++;
        await sleep(DELAY_MS);
    }

    console.log(`  📊 Razem: ${all.length} wypowiedzi`);
    return all;
}

async function fetchAllStatements(proceedings) {
    const all = [];
    for (const p of proceedings) {
        for (const date of p.dates) {
            const day = await fetchStatementsForDay(p.num, date);
            all.push(...day);
            await sleep(DELAY_MS);
        }
    }
    saveJSONL(path.join(OUTPUT_DIR, 'wypowiedzi.raw.jsonl'), all);
    return all;
}

// GŁOSOWANIA
async function fetchVotingsForSitting(sitting) {
    console.log(`\n📥 Głosowania: posiedzenie ${sitting}`);
    const url = `${API_BASE}/term${TERM}/votings/${sitting}`;
    let votings;
    try {
        votings = await fetchJSON(url);
    } catch {
        console.log(`  ⚠ Brak głosowań dla ${sitting}`);
        return { votings: [], votes: [] };
    }

    const votingsData = [];
    const votesData = [];

    for (const v of votings) {
        votingsData.push({
            institution: 'sejm',
            sitting: v.sitting,
            votingNumber: v.votingNumber,
            date: v.date,
            title: v.title,
            topic: v.topic || null,
            yes: v.yes,
            no: v.no,
            abstain: v.abstain,
            notParticipating: v.notParticipating
        });

        const detailUrl = `${API_BASE}/term${TERM}/votings/${sitting}/${v.votingNumber}`;
        await sleep(DELAY_MS);
        try {
            const detail = await fetchJSON(detailUrl);
            if (detail.votes) {
                detail.votes.forEach(vote => {
                    votesData.push({
                        institution: 'sejm',
                        sitting: v.sitting,
                        votingNumber: v.votingNumber,
                        MP: vote.MP,
                        club: vote.club,
                        vote: vote.vote
                    });
                });
            }
        } catch {
            console.log(`  ⚠ Nie udało się pobrać szczegółów ${v.votingNumber}`);
        }
    }

    return { votings: votingsData, votes: votesData };
}

async function fetchAllVotings(proceedings) {
    const allVotings = [];
    const allVotes = [];
    for (const p of proceedings) {
        const { votings, votes } = await fetchVotingsForSitting(p.num);
        allVotings.push(...votings);
        allVotes.push(...votes);
        await sleep(DELAY_MS);
    }
    saveJSONL(path.join(OUTPUT_DIR, 'glosowania.jsonl'), allVotings);
    saveJSONL(path.join(OUTPUT_DIR, 'glosy.jsonl'), allVotes);
    return { allVotings, allVotes };
}

async function main() {
    console.log('🚀 SEJM: pobieranie danych');
    console.log(`Kadencja: ${TERM}, max posiedzeń: ${MAX_PROCEEDINGS}\n`);

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const mps = await fetchMPs();
    await sleep(DELAY_MS);

    const proceedings = await fetchProceedings();
    await sleep(DELAY_MS);

    await fetchAllStatements(proceedings);
    await sleep(DELAY_MS);

    await fetchAllVotings(proceedings);

    console.log('\n✅ ZAKOŃCZONO (SEJM)');
}

main().catch(err => {
    console.error('❌ Błąd:', err);
    process.exit(1);
});
