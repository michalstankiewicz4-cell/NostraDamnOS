// scripts/normalize.js
// Użycie: node scripts/normalize.js
// 
// Ten skrypt:
// 1. Wczytuje RAW wypowiedzi z /data/sejm/ i /data/senat/
// 2. Dopasowuje memberID do posłów/senatorów
// 3. Wykrywa role (poseł, minister, marszałek, etc.)
// 4. Zapisuje znormalizowane dane do /data/final/

const fs = require('fs');
const path = require('path');

const SEJM_DIR = path.join(__dirname, '..', 'data', 'sejm');
const SENAT_DIR = path.join(__dirname, '..', 'data', 'senat');
const FINAL_DIR = path.join(__dirname, '..', 'data', 'final');

function loadJSONL(filepath) {
    if (!fs.existsSync(filepath)) {
        console.log(`⚠️ Plik nie istnieje: ${filepath}`);
        return [];
    }
    const content = fs.readFileSync(filepath, 'utf8').trim();
    if (!content) return [];
    return content.split('\n').map(l => JSON.parse(l));
}

function saveJSONL(filepath, data) {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const lines = data.map(o => JSON.stringify(o)).join('\n');
    fs.writeFileSync(filepath, lines + '\n', 'utf8');
    console.log(`💾 ${filepath} (${data.length} rekordów)`);
}

// Normalizacja imienia/nazwiska + roli/stanowiska
function normalizeNameForMatching(name) {
    if (!name) return '';
    let n = name;

    n = n.replace(/^(Poseł|Posłanka|Senator|Senatorka|Minister|Sekretarz|Marszałek|Wicemarszałek|Prezes|Prezydent|Przedstawiciel|Zastępca|Ekspert|Gość|Sprawozdawca)\s+/gi, '');
    n = n.replace(/^(Pani|Pan|Dr|Prof\.?)\s+/gi, '');
    n = n.replace(/\s+(PhD|Dr|Prof\.?|hab\.?)$/gi, '');
    n = n.replace(/\s+Stanu\s+w\s+Ministerstwie.*$/gi, '');
    n = n.replace(/\s+do\s+spraw.*$/gi, '');
    n = n.replace(/-/g, ' ');
    return n.trim().toLowerCase();
}

function extractLastName(fullName) {
    const normalized = normalizeNameForMatching(fullName);
    const parts = normalized.split(/\s+/);
    return parts[parts.length - 1] || '';
}

function detectRoleAndPosition(speakerRaw) {
    if (!speakerRaw) return { role: 'nieznane', position: null };

    const s = speakerRaw.trim();

    // Głos z sali / anonimowe
    if (/głos z sali/i.test(s)) {
        return { role: 'gość', position: 'Głos z sali' };
    }

    // POPRAWKA: Sekretarz Poseł / Poseł Sprawozdawca - to są POSŁOWIE!
    if (/Sekretarz\s+(Poseł|Posłanka)|Poseł\s+Sprawozdawca|Posłanka\s+Sprawozdawca/i.test(s)) {
        return { role: 'poseł', position: s };
    }

    // Prezydent / Premier
    if (/Prezydent/i.test(s)) {
        return { role: 'prezydent', position: s };
    }
    if (/Prezes Rady Ministrów|Wiceprezes Rady Ministrów|Premier/i.test(s)) {
        return { role: 'premier', position: s };
    }

    // Marszałek / Wicemarszałek
    if (/Wicemarszałek/i.test(s)) {
        return { role: 'wicemarszałek', position: s };
    }
    if (/Marszałek/i.test(s)) {
        return { role: 'marszałek', position: s };
    }

    // Minister / Sekretarz Stanu (PRZED sprawdzeniem posłów!)
    if (/Podsekretarz Stanu|Sekretarz Stanu/i.test(s)) {
        return { role: 'wiceminister', position: s };
    }
    if (/Minister/i.test(s)) {
        return { role: 'minister', position: s };
    }

    // Poseł / Posłanka (zwykli posłowie)
    if (/^Poseł\s|^Posłanka\s/i.test(s)) {
        return { role: 'poseł', position: null };
    }

    // Senator
    if (/^Senator|^Senatorka/i.test(s)) {
        return { role: 'senator', position: null };
    }

    // Prokurator
    if (/Prokurator/i.test(s)) {
        return { role: 'prokurator', position: s };
    }

    // Przewodniczący (KRS, komisji, etc.)
    if (/Przewodniczący|Przewodnicząca/i.test(s)) {
        return { role: 'przewodniczący', position: s };
    }

    // Ekspert / gość
    if (/Ekspert|Przedstawiciel|Delegacja|Gość/i.test(s)) {
        return { role: 'ekspert', position: s };
    }

    return { role: 'nieznane', position: null };
}

function matchSpeakerToMember(speakerRaw, members) {
    if (!speakerRaw) return null;
    const lastName = extractLastName(speakerRaw);
    if (!lastName) return null;

    const candidates = members.filter(m => m.lastName.toLowerCase() === lastName);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].id;

    const normalized = normalizeNameForMatching(speakerRaw);
    const parts = normalized.split(/\s+/);
    const firstName = parts[0];

    const exact = candidates.find(m => m.firstName.toLowerCase() === firstName);
    if (exact) return exact.id;

    return candidates[0].id;
}

function normalizeStatements(rawStatements, members, institution) {
    let matched = 0;
    let unmatched = 0;

    const out = rawStatements.map((w, idx) => {
        const { role, position } = detectRoleAndPosition(w.speakerRaw);
        const memberID = (role === 'poseł' || role === 'senator')
            ? matchSpeakerToMember(w.speakerRaw, members)
            : null;

        if (memberID) matched++; else unmatched++;

        return {
            institution,
            sitting: w.sitting,
            date: w.date,
            transcriptNum: w.transcriptNum,
            speaker: w.speakerRaw,
            memberID,
            role,
            position,
            text: w.text
        };
    });

    console.log(`  📊 Dopasowanie (${institution}): matched=${matched}, unmatched=${unmatched}, rate=${(matched/(matched+unmatched)*100).toFixed(1)}%`);
    return out;
}

async function main() {
    console.log('🚀 NORMALIZACJA DANYCH (Sejm + Senat)\n');

    // SEJM
    const sejmMPsPath = path.join(SEJM_DIR, 'poslowie.jsonl');
    const sejmRawPath = path.join(SEJM_DIR, 'wypowiedzi.raw.jsonl');
    const sejmVotingsPath = path.join(SEJM_DIR, 'glosowania.jsonl');
    const sejmVotesPath = path.join(SEJM_DIR, 'glosy.jsonl');

    const sejmMPs = loadJSONL(sejmMPsPath);
    const sejmRaw = loadJSONL(sejmRawPath);
    const sejmVotings = loadJSONL(sejmVotingsPath);
    const sejmVotes = loadJSONL(sejmVotesPath);

    console.log(`SEJM: posłowie=${sejmMPs.length}, wypowiedzi RAW=${sejmRaw.length}`);

    const sejmStatements = sejmRaw.length > 0 
        ? normalizeStatements(sejmRaw, sejmMPs, 'sejm')
        : [];

    // SENAT
    const senatMembersPath = path.join(SENAT_DIR, 'senatorowie.jsonl');
    const senatRawPath = path.join(SENAT_DIR, 'wypowiedzi.raw.jsonl');
    const senatVotingsPath = path.join(SENAT_DIR, 'glosowania.jsonl');
    const senatVotesPath = path.join(SENAT_DIR, 'glosy.jsonl');

    const senatMembers = loadJSONL(senatMembersPath);
    const senatRaw = loadJSONL(senatRawPath);
    const senatVotings = loadJSONL(senatVotingsPath);
    const senatVotes = loadJSONL(senatVotesPath);

    console.log(`SENAT: senatorowie=${senatMembers.length}, wypowiedzi RAW=${senatRaw.length}`);

    const senatStatements = senatRaw.length > 0
        ? normalizeStatements(senatRaw, senatMembers, 'senat')
        : [];

    // ŁĄCZENIE
    const allStatements = [...sejmStatements, ...senatStatements];
    const allVotings = [...sejmVotings, ...senatVotings];
    const allVotes = [...sejmVotes, ...senatVotes];

    console.log('\n💾 Zapis finalnych danych...');
    saveJSONL(path.join(FINAL_DIR, 'wypowiedzi.jsonl'), allStatements);
    saveJSONL(path.join(FINAL_DIR, 'glosowania.jsonl'), allVotings);
    saveJSONL(path.join(FINAL_DIR, 'glosy.jsonl'), allVotes);
    
    if (sejmMPs.length > 0) {
        saveJSONL(path.join(FINAL_DIR, 'poslowie.jsonl'), sejmMPs);
    }
    if (senatMembers.length > 0) {
        saveJSONL(path.join(FINAL_DIR, 'senatorowie.jsonl'), senatMembers);
    }

    console.log('\n✅ ZAKOŃCZONO NORMALIZACJĘ');
    console.log(`   📊 Łącznie wypowiedzi: ${allStatements.length}`);
    console.log(`   📊 Łącznie głosowania: ${allVotings.length}`);
    console.log(`   📊 Łącznie głosy: ${allVotes.length}`);
}

main().catch(err => {
    console.error('❌ Błąd:', err);
    process.exit(1);
});
