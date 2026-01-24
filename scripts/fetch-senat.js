// scripts/fetch-senat.js
// Użycie: node scripts/fetch-senat.js [term] [maxProceedings]
// STATUS: SZKIELET - TODO (brak dokumentacji API Senatu)

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.senat.gov.pl'; // TODO: zweryfikować URL
const TERM = process.argv[2] || '11';
const MAX_PROCEEDINGS = parseInt(process.argv[3]) || 5;
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'senat');
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

function saveJSONL(filepath, data) {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const lines = data.map(o => JSON.stringify(o)).join('\n');
    fs.writeFileSync(filepath, lines + '\n', 'utf8');
    console.log(`💾 ${filepath} (${data.length} rekordów)`);
}

// TODO: SENATOROWIE
async function fetchSenators() {
    console.log('\n📥 Senatorowie...');
    console.log('⚠️ TODO: Brak dokumentacji API Senatu');
    
    // const url = `${API_BASE}/term${TERM}/senators`; // TODO
    // const senators = await fetchJSON(url);
    // const mapped = senators.map(s => ({
    //     id: s.id,
    //     firstName: s.firstName,
    //     lastName: s.lastName,
    //     club: s.club || null,
    //     active: true
    // }));
    // saveJSONL(path.join(OUTPUT_DIR, 'senatorowie.jsonl'), mapped);
    // return mapped;
    
    return [];
}

// TODO: POSIEDZENIA
async function fetchProceedings() {
    console.log('\n📥 Posiedzenia Senatu...');
    console.log('⚠️ TODO: Brak dokumentacji API Senatu');
    
    // const url = `${API_BASE}/term${TERM}/proceedings`; // TODO
    // const proceedings = await fetchJSON(url);
    // const limited = proceedings.slice(0, MAX_PROCEEDINGS);
    // const mapped = limited.map((p, idx) => ({
    //     num: p.num || idx + 1,
    //     term: TERM,
    //     title: p.title,
    //     dates: p.dates
    // }));
    // saveJSONL(path.join(OUTPUT_DIR, 'posiedzenia.jsonl'), mapped);
    // return mapped;
    
    return [];
}

// TODO: WYPOWIEDZI RAW
async function fetchAllStatements(proceedings) {
    console.log('\n📥 Wypowiedzi Senatu (RAW)...');
    console.log('⚠️ TODO: Brak dokumentacji API Senatu');
    
    // Format taki sam jak w Sejmie: wypowiedzi.raw.jsonl
    // {
    //     institution: 'senat',
    //     sitting,
    //     date,
    //     transcriptNum,
    //     speakerRaw,
    //     text
    // }
    
    const all = [];
    // saveJSONL(path.join(OUTPUT_DIR, 'wypowiedzi.raw.jsonl'), all);
    return all;
}

// TODO: GŁOSOWANIA
async function fetchAllVotings(proceedings) {
    console.log('\n📥 Głosowania Senatu...');
    console.log('⚠️ TODO: Brak dokumentacji API Senatu');
    
    const allVotings = [];
    const allVotes = [];
    // saveJSONL(path.join(OUTPUT_DIR, 'glosowania.jsonl'), allVotings);
    // saveJSONL(path.join(OUTPUT_DIR, 'glosy.jsonl'), allVotes);
    return { allVotings, allVotes };
}

async function main() {
    console.log('🚀 SENAT: pobieranie danych');
    console.log(`Kadencja: ${TERM}, max posiedzeń: ${MAX_PROCEEDINGS}\n`);
    console.log('⚠️ UWAGA: Skrypt jest szkieletem - wymaga dokumentacji API Senatu\n');

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const senators = await fetchSenators();
    await sleep(DELAY_MS);

    const proceedings = await fetchProceedings();
    await sleep(DELAY_MS);

    await fetchAllStatements(proceedings);
    await sleep(DELAY_MS);

    await fetchAllVotings(proceedings);

    console.log('\n⚠️ ZAKOŃCZONO (SENAT) - BRAK DANYCH (TODO)');
}

main().catch(err => {
    console.error('❌ Błąd:', err);
    process.exit(1);
});
