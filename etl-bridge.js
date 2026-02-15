// ETL Panel Bridge - obsługa nowego panelu ETL
import {
    initFloatingButtonsDragDrop,
    initUIMode
} from './modules/floating-drag.js';
import ToastModule from './modules/toast.js';

// Cache dla pobranych kadencji (żeby nie odpytywać API przy każdym kliknięciu)
const termsCache = {};
// Cache dla liczby posiedzeń per kadencja
const sittingsCountCache = {};
// Cache dla pełnych danych posiedzeń (potrzebne do zliczania dni obrad / wypowiedzi)
const proceedingsDataCache = {};
// Cache dla dokładnej liczby wypowiedzi per dzień obrad (klucz: "inst_kadencja_sitting_date")
const transcriptsCountCache = {};
// Cache dla liczby głosowań/głosów per posiedzenie (klucz: "inst_kadencja_sitting")
const votingsCountCache = {};
// Tokeny anulowania
let transcriptsCountToken = 0;
let votingsCountToken = 0;

async function fetchAvailableTerms(institution) {
    const countSpanSejm = document.getElementById('etlTermCountSejm');
    const countSpanSenat = document.getElementById('etlTermCountSenat');
    const termSelect = document.getElementById('etlTermSelect');
    const activeSpan = institution === 'sejm' ? countSpanSejm : countSpanSenat;

    // Pokaż ładowanie
    if (activeSpan) activeSpan.textContent = '(...)';

    // Sprawdź cache
    if (termsCache[institution]) {
        populateTermSelect(termsCache[institution], termSelect);
        if (activeSpan) activeSpan.textContent = `(${termsCache[institution].length})`;
        if (termSelect?.value) fetchSittingsCount(institution, termSelect.value);
        return;
    }

    // Senat: brak REST API — hardcoded kadencje
    if (institution === 'senat') {
        const senatTerms = [
            { num: 11, from: '2023-11-13', to: null, current: true }
        ];
        termsCache['senat'] = senatTerms;
        populateTermSelect(senatTerms, termSelect);
        if (activeSpan) activeSpan.textContent = `(${senatTerms.length})`;
        fetchSittingsCount('senat', 11); // czyści span
        console.log('[ETL] Senat: hardcoded kadencje (brak REST API)');
        return;
    }

    try {
        const url = `https://api.sejm.gov.pl/${institution}/term`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const terms = await res.json();

        // Sortuj malejąco wg numeru kadencji
        terms.sort((a, b) => b.num - a.num);
        termsCache[institution] = terms;

        populateTermSelect(terms, termSelect);
        if (activeSpan) activeSpan.textContent = `(${terms.length})`;

        // Pobierz liczbę posiedzeń dla wybranej kadencji
        if (termSelect?.value) fetchSittingsCount(institution, termSelect.value);

        console.log(`[ETL] Pobrano ${terms.length} kadencji dla ${institution}`);
    } catch (err) {
        console.warn(`[ETL] Nie udało się pobrać kadencji dla ${institution}:`, err.message);
        if (activeSpan) activeSpan.textContent = '(?)';
    }
}

function populateTermSelect(terms, selectEl) {
    if (!selectEl) return;
    const prevValue = selectEl.value;
    selectEl.innerHTML = '';

    const MIN_KADENCJA = 7; // Kadencje <7 nie mają danych w API
    const validTerms = terms.filter(t => t.num >= MIN_KADENCJA);

    for (const t of validTerms) {
        const from = t.from ? t.from.slice(0, 4) : '?';
        const to = t.current ? 'obecnie' : (t.to ? t.to.slice(0, 4) : '?');
        const opt = document.createElement('option');
        opt.value = t.num;
        opt.textContent = `${t.num}. kadencja (${from}-${to})`;
        selectEl.appendChild(opt);
    }

    // "Wszystkie kadencje" — opcja na dole
    if (validTerms.length > 1) {
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'Wszystkie kadencje (...)';
        selectEl.appendChild(allOpt);
    }

    // Przywróć poprzednią wartość jeśli istnieje (pomijaj "all")
    if ([...selectEl.options].some(o => o.value === prevValue)) {
        selectEl.value = prevValue;
    }

    // Zaktualizuj wyświetlanie kadencji
    const termDisplay = document.getElementById('etlTerm');
    if (termDisplay) termDisplay.textContent = selectEl.value;
}

async function fetchSittingsCount(institution, kadencja) {
    const span = document.getElementById('etlSittingsCount');
    if (!span) return;

    // Senat: brak API posiedzeń
    if (institution === 'senat') {
        span.textContent = '';
        return;
    }

    // "Wszystkie" — zsumuj posiedzenia ze wszystkich kadencji
    if (kadencja === 'all') {
        const terms = termsCache[institution] || [];
        const MIN_KADENCJA = 7;
        const validTerms = terms.filter(t => t.num >= MIN_KADENCJA);
        span.textContent = '(...)';

        const counts = await Promise.all(validTerms.map(t =>
            fetchSingleTermSittingsCount(institution, t.num)
        ));
        const total = counts.reduce((sum, c) => sum + Math.max(0, c), 0);

        span.textContent = `(${total} posiedzeń łącznie)`;
        // Dla "all" max range = max z najnowszej kadencji
        const newest = validTerms[0]?.num;
        if (newest && sittingsCountCache[`${institution}_${newest}`] !== undefined) {
            updateRangeMax(sittingsCountCache[`${institution}_${newest}`]);
        }
        updateTranscriptsCount();
        updateVotingsCount();
        updatePerTermCounts();
        return;
    }

    const cacheKey = `${institution}_${kadencja}`;
    if (sittingsCountCache[cacheKey] !== undefined) {
        span.textContent = `(${sittingsCountCache[cacheKey]} posiedzeń)`;
        updateRangeMax(sittingsCountCache[cacheKey]);
        updateTranscriptsCount();
        updateVotingsCount();
        updatePerTermCounts();
        return;
    }

    span.textContent = '(...)';

    const count = await fetchSingleTermSittingsCount(institution, kadencja);
    if (count >= 0) {
        span.textContent = `(${count} posiedzeń)`;
        updateRangeMax(count);
    } else {
        span.textContent = '(?)';
    }
    updateTranscriptsCount();
    updateVotingsCount();
    updatePerTermCounts();
}

async function fetchSingleTermSittingsCount(institution, kadencja) {
    const cacheKey = `${institution}_${kadencja}`;
    if (sittingsCountCache[cacheKey] !== undefined) {
        return sittingsCountCache[cacheKey];
    }

    try {
        const url = `https://api.sejm.gov.pl/${institution}/term${kadencja}/proceedings`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const proceedings = Array.isArray(data) ? data.filter(p => p.number > 0) : [];
        sittingsCountCache[cacheKey] = proceedings.length;
        proceedingsDataCache[cacheKey] = proceedings;
        return proceedings.length;
    } catch {
        return -1;
    }
}

async function enrichTermOptions(institution) {
    const selectEl = document.getElementById('etlTermSelect');
    if (!selectEl) return;

    const terms = termsCache[institution] || [];
    const MIN_KADENCJA = 7;
    const validTerms = terms.filter(t => t.num >= MIN_KADENCJA);

    // Pobierz liczbę posiedzeń dla każdej kadencji równolegle
    const counts = await Promise.all(validTerms.map(async (t) => {
        const count = await fetchSingleTermSittingsCount(institution, t.num);
        return { num: t.num, count };
    }));

    // Zaktualizuj etykiety opcji
    let totalSittings = 0;
    for (const { num, count } of counts) {
        const opt = selectEl.querySelector(`option[value="${num}"]`);
        if (opt && count >= 0) {
            opt.textContent = opt.textContent.replace(/( — \d+ pos\.)?$/, '') + ` — ${count} pos.`;
            totalSittings += count;
        }
    }

    // Zaktualizuj opcję "Wszystkie"
    const allOpt = selectEl.querySelector('option[value="all"]');
    if (allOpt && totalSittings > 0) {
        allOpt.textContent = `Wszystkie kadencje — ${totalSittings} pos.`;
    }
}

async function fetchVotingsForSittings(inst, kadencja, sittings) {
    // sittings: [number, ...]
    // Zwraca { votings, votes } — dokładna liczba z API
    let totalVotings = 0;
    let totalVotes = 0;
    const toFetch = [];

    for (const sitting of sittings) {
        const key = `${inst}_${kadencja}_${sitting}`;
        if (votingsCountCache[key] !== undefined) {
            totalVotings += votingsCountCache[key].votings;
            totalVotes += votingsCountCache[key].votes;
        } else {
            toFetch.push({ sitting, key });
        }
    }

    const batchSize = 10;
    for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async ({ sitting, key }) => {
            try {
                const url = `https://api.sejm.gov.pl/${inst}/term${kadencja}/votings/${sitting}`;
                const res = await fetch(url);
                if (!res.ok) return { key, votings: 0, votes: 0 };
                const data = await res.json();
                const votings = Array.isArray(data) ? data.length : 0;
                const votes = Array.isArray(data)
                    ? data.reduce((sum, v) => sum + (v.totalVoted || 0), 0)
                    : 0;
                return { key, votings, votes };
            } catch {
                return { key, votings: 0, votes: 0 };
            }
        }));

        for (const { key, votings, votes } of results) {
            votingsCountCache[key] = { votings, votes };
            totalVotings += votings;
            totalVotes += votes;
        }
    }

    return { votings: totalVotings, votes: totalVotes };
}

async function updateVotingsCount() {
    const votingsSpan = document.getElementById('etlVotingsCount');
    const votesSpan = document.getElementById('etlVotesCount');

    // Nie odpytuj API jeśli oba checkboxy odznaczone
    const votingsChecked = document.getElementById('etlVotings')?.checked;
    const votesChecked = document.getElementById('etlVotes')?.checked;
    if (!votingsChecked && !votesChecked) {
        if (votingsSpan) votingsSpan.textContent = '';
        if (votesSpan) votesSpan.textContent = '';
        return;
    }

    const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
    const kadencja = document.getElementById('etlTermSelect')?.value;

    if (inst === 'senat') {
        if (votingsSpan) votingsSpan.textContent = '';
        if (votesSpan) votesSpan.textContent = '';
        return;
    }

    const myToken = ++votingsCountToken;

    if (kadencja === 'all') {
        const terms = termsCache[inst] || [];
        const MIN_KADENCJA = 7;
        let allSittings = [];

        for (const t of terms.filter(t => t.num >= MIN_KADENCJA)) {
            const proceedings = proceedingsDataCache[`${inst}_${t.num}`] || [];
            const nums = proceedings.map(p => p.number).filter(n => n > 0);
            allSittings.push({ kadencja: t.num, sittings: nums });
        }

        const totalSittings = allSittings.reduce((sum, s) => sum + s.sittings.length, 0);
        if (totalSittings === 0) {
            if (votingsSpan) votingsSpan.textContent = '';
            if (votesSpan) votesSpan.textContent = '';
            return;
        }

        if (votingsSpan) votingsSpan.textContent = '(...)';
        if (votesSpan) votesSpan.textContent = '(...)';

        let totalV = 0, totalG = 0;
        for (const { kadencja: k, sittings } of allSittings) {
            if (myToken !== votingsCountToken) return;
            const { votings, votes } = await fetchVotingsForSittings(inst, k, sittings);
            totalV += votings;
            totalG += votes;
        }

        if (myToken !== votingsCountToken) return;
        if (votingsSpan) votingsSpan.textContent = votingsChecked ? `(${totalV})` : '';
        if (votesSpan) votesSpan.textContent = votesChecked ? `(${totalG})` : '';
        window._updateETLEstimate?.();
        return;
    }

    const cacheKey = `${inst}_${kadencja}`;
    const proceedings = proceedingsDataCache[cacheKey];
    if (!proceedings) {
        if (votingsSpan) votingsSpan.textContent = '';
        if (votesSpan) votesSpan.textContent = '';
        return;
    }

    const from = parseInt(document.getElementById('etlRangeFrom')?.value) || 1;
    const to = parseInt(document.getElementById('etlRangeTo')?.value) || 999;
    const sittings = proceedings.filter(p => p.number >= from && p.number <= to).map(p => p.number);

    if (sittings.length === 0) {
        if (votingsSpan) votingsSpan.textContent = '';
        if (votesSpan) votesSpan.textContent = '';
        return;
    }

    if (votingsSpan) votingsSpan.textContent = '(...)';
    if (votesSpan) votesSpan.textContent = '(...)';

    const { votings, votes } = await fetchVotingsForSittings(inst, kadencja, sittings);

    if (myToken !== votingsCountToken) return;
    if (votingsSpan) votingsSpan.textContent = votingsChecked ? `(${votings})` : '';
    if (votesSpan) votesSpan.textContent = votesChecked ? `(${votes})` : '';
    window._updateETLEstimate?.();
}

async function fetchTranscriptsForSittingDays(inst, kadencja, sittingDays) {
    // sittingDays: [{ sitting, date }, ...]
    // Zwraca sumę wypowiedzi (dokładna liczba z API)
    let total = 0;
    const toFetch = [];

    for (const { sitting, date } of sittingDays) {
        const key = `${inst}_${kadencja}_${sitting}_${date}`;
        if (transcriptsCountCache[key] !== undefined) {
            total += transcriptsCountCache[key];
        } else {
            toFetch.push({ sitting, date, key });
        }
    }

    // Pobierz brakujące w batchach po 10
    const batchSize = 10;
    for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async ({ sitting, date, key }) => {
            try {
                const url = `https://api.sejm.gov.pl/${inst}/term${kadencja}/proceedings/${sitting}/${date}/transcripts`;
                const res = await fetch(url);
                if (!res.ok) return { key, count: 0 };
                const data = await res.json();
                const count = Array.isArray(data.statements) ? data.statements.length : 0;
                return { key, count };
            } catch {
                return { key, count: 0 };
            }
        }));

        for (const { key, count } of results) {
            transcriptsCountCache[key] = count;
            total += count;
        }
    }

    return total;
}

function collectSittingDays(proceedings, from, to) {
    const days = [];
    const inRange = proceedings.filter(p => p.number >= from && p.number <= to);
    for (const p of inRange) {
        if (Array.isArray(p.dates)) {
            for (const date of p.dates) {
                days.push({ sitting: p.number, date });
            }
        }
    }
    return days;
}

async function updateTranscriptsCount() {
    const span = document.getElementById('etlTranscriptsCount');
    if (!span) return;

    // Nie odpytuj API jeśli checkbox odznaczony
    if (!document.getElementById('etlTranscripts')?.checked) {
        span.textContent = '';
        return;
    }

    const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
    const kadencja = document.getElementById('etlTermSelect')?.value;

    if (inst === 'senat') {
        span.textContent = '';
        return;
    }

    const myToken = ++transcriptsCountToken;

    // Dla "all" — zsumuj ze wszystkich kadencji
    if (kadencja === 'all') {
        const terms = termsCache[inst] || [];
        const MIN_KADENCJA = 7;
        let allDays = [];
        const termNums = [];

        for (const t of terms.filter(t => t.num >= MIN_KADENCJA)) {
            const proceedings = proceedingsDataCache[`${inst}_${t.num}`] || [];
            const days = collectSittingDays(proceedings, 1, 999);
            allDays.push({ kadencja: t.num, days });
            termNums.push(t.num);
        }

        const totalSittingDays = allDays.reduce((sum, td) => sum + td.days.length, 0);
        if (totalSittingDays === 0) { span.textContent = ''; return; }

        span.textContent = `(${totalSittingDays} dni obrad, ...)`;

        let totalWyp = 0;
        for (const { kadencja: k, days } of allDays) {
            if (myToken !== transcriptsCountToken) return; // anulowano
            totalWyp += await fetchTranscriptsForSittingDays(inst, k, days);
        }

        if (myToken !== transcriptsCountToken) return;
        span.textContent = `(${totalSittingDays} dni obrad, ${totalWyp} wyp.)`;
        window._updateETLEstimate?.();
        return;
    }

    const cacheKey = `${inst}_${kadencja}`;
    const proceedings = proceedingsDataCache[cacheKey];
    if (!proceedings) {
        span.textContent = '';
        return;
    }

    const from = parseInt(document.getElementById('etlRangeFrom')?.value) || 1;
    const to = parseInt(document.getElementById('etlRangeTo')?.value) || 999;

    const days = collectSittingDays(proceedings, from, to);
    if (days.length === 0) { span.textContent = ''; return; }

    span.textContent = `(${days.length} dni obrad, ...)`;

    const totalWyp = await fetchTranscriptsForSittingDays(inst, kadencja, days);

    if (myToken !== transcriptsCountToken) return;
    span.textContent = `(${days.length} dni obrad, ${totalWyp} wyp.)`;
    window._updateETLEstimate?.();
}

// Cache dla per-kadencja counts (klucz: "inst_kadencja_module")
const perTermCountCache = {};

// Cache dla listy komisji i ich posiedzeń (klucz: "inst_kadencja")
const committeeListCache = {};
let committeeLoadToken = 0;

async function loadCommitteeOptions() {
    const select = document.getElementById('etlCommitteeSelect');
    const countSpan = document.getElementById('etlCommitteeSittingsCount');
    const statementsSpan = document.getElementById('etlCommitteeStatementsCount');
    if (!select) return;

    const committeeSittings = document.getElementById('etlCommitteeSittings');
    if (!committeeSittings?.checked) {
        if (countSpan) countSpan.textContent = '';
        if (statementsSpan) statementsSpan.textContent = '';
        return;
    }

    const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
    const kadencja = document.getElementById('etlTermSelect')?.value;
    if (!kadencja || kadencja === 'all') {
        // Dla "all" — wyczyść i zostaw domyślne
        select.innerHTML = '<option value="all" selected>✓ Wszystkie komisje</option>';
        return;
    }

    const cacheKey = `${inst}_${kadencja}`;
    const myToken = ++committeeLoadToken;
    if (countSpan) countSpan.textContent = '(...)';

    // 1. Fetch committee list
    let committees = committeeListCache[cacheKey];
    if (!committees) {
        select.innerHTML = '<option value="all" selected>✓ Wszystkie komisje (...)</option>';
        try {
            const res = await fetch(`https://api.sejm.gov.pl/${inst}/term${kadencja}/committees`);
            if (!res.ok) return;
            committees = await res.json();
            if (!Array.isArray(committees)) return;
            committeeListCache[cacheKey] = committees;
        } catch { return; }
    }

    if (myToken !== committeeLoadToken) return;

    // 2. Populate dropdown (without counts yet)
    select.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.selected = true;
    allOpt.textContent = `✓ Wszystkie komisje (${committees.length})`;
    select.appendChild(allOpt);

    for (const c of committees) {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = `${c.name}`;
        select.appendChild(opt);
    }

    // 3. Fetch sittings count per committee progressively
    let totalSittings = 0;
    const BATCH_SIZE = 6;
    for (let i = 0; i < committees.length; i += BATCH_SIZE) {
        if (myToken !== committeeLoadToken) return;
        const batch = committees.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (c) => {
            const sKey = `${cacheKey}_${c.code}_sittings`;
            if (perTermCountCache[sKey] !== undefined) return { code: c.code, count: perTermCountCache[sKey] };
            try {
                const res = await fetch(`https://api.sejm.gov.pl/${inst}/term${kadencja}/committees/${c.code}/sittings`);
                if (!res.ok) return { code: c.code, count: 0 };
                const data = await res.json();
                const count = Array.isArray(data) ? data.length : 0;
                perTermCountCache[sKey] = count;
                return { code: c.code, count };
            } catch { return { code: c.code, count: 0 }; }
        }));

        for (const { code, count } of results) {
            totalSittings += count;
            const opt = select.querySelector(`option[value="${code}"]`);
            if (opt) opt.textContent = `${opt.textContent} (${count} pos.)`;
        }

        if (myToken !== committeeLoadToken) return;
        const done = i + BATCH_SIZE >= committees.length;
        allOpt.textContent = done
            ? `✓ Wszystkie komisje (${committees.length}) — ${totalSittings} pos. łącznie`
            : `✓ Wszystkie komisje (${committees.length}) — ładowanie...`;
        if (done) {
            if (countSpan) countSpan.textContent = `(${totalSittings})`;
            const committeeStatementsChecked = document.getElementById('etlCommitteeStatements')?.checked;
            if (statementsSpan) statementsSpan.textContent = committeeStatementsChecked ? `(${totalSittings})` : '';
            window._updateETLEstimate?.();
        }
    }
}

async function updatePerTermCounts() {
    const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
    const kadencja = document.getElementById('etlTermSelect')?.value;

    // Per-kadencja module definitions
    const modules = [
        { checkbox: 'etlInterpellations', span: 'etlInterpellationsCount', key: 'interpelacje',
          url: (i, k) => `https://api.sejm.gov.pl/${i}/term${k}/interpellations`, countFn: data => Array.isArray(data) ? data.length : 0,
          paginatedCount: async (inst, kadencja) => {
              const base = `https://api.sejm.gov.pl/${inst}/term${kadencja}/interpellations`;
              let total = 0, offset = 0;
              while (true) {
                  const res = await fetch(`${base}?limit=500&offset=${offset}`);
                  if (!res.ok) break;
                  const data = await res.json();
                  if (!Array.isArray(data) || data.length === 0) break;
                  total += data.length;
                  if (data.length < 500) break;
                  offset += data.length;
              }
              return total;
          }},
        { checkbox: 'etlWrittenQuestions', span: 'etlWrittenQuestionsCount', key: 'zapytania',
          url: (i, k) => `https://api.sejm.gov.pl/${i}/term${k}/writtenQuestions`,
          countFn: data => Array.isArray(data) ? data.length : 0,
          paginatedCount: async (inst, kadencja) => {
              const base = `https://api.sejm.gov.pl/${inst}/term${kadencja}/writtenQuestions`;
              let total = 0, offset = 0;
              while (true) {
                  const res = await fetch(`${base}?limit=500&offset=${offset}`);
                  if (!res.ok) break;
                  const data = await res.json();
                  if (!Array.isArray(data) || data.length === 0) break;
                  total += data.length;
                  if (data.length < 500) break;
                  offset += data.length;
              }
              return total;
          }},
        { checkbox: 'etlBills', span: 'etlBillsCount', key: 'projekty_ustaw',
          url: (i, k) => `https://api.sejm.gov.pl/${i}/term${k}/prints`, countFn: data => Array.isArray(data) ? data.length : 0 },
        { checkbox: 'etlLegalActs', span: 'etlLegalActsCount', key: 'ustawy',
          url: () => `https://api.sejm.gov.pl/eli/acts/DU/${new Date().getFullYear()}?limit=1`, countFn: data => data?.count || (Array.isArray(data?.items) ? data.items.length : 0) }
    ];

    if (inst === 'senat') {
        for (const m of modules) {
            const span = document.getElementById(m.span);
            if (span) span.textContent = '';
        }
        return;
    }

    for (const m of modules) {
        const span = document.getElementById(m.span);
        if (!span) continue;

        const checked = document.getElementById(m.checkbox)?.checked;
        if (!checked) { span.textContent = ''; continue; }

        // Handle "all" kadencje
        if (kadencja === 'all') {
            const terms = termsCache[inst] || [];
            const MIN_KADENCJA = 7;
            const validTerms = terms.filter(t => t.num >= MIN_KADENCJA);

            // Ustawy nie zależą od kadencji — fetch raz
            if (m.key === 'ustawy') {
                const cacheKey = `${inst}_ustawy`;
                if (perTermCountCache[cacheKey] !== undefined) {
                    span.textContent = `(${perTermCountCache[cacheKey]})`;
                    continue;
                }
                span.textContent = '(...)';
                try {
                    const res = await fetch(m.url(inst, null));
                    if (!res.ok) { span.textContent = '(?)'; continue; }
                    const data = await res.json();
                    const count = m.countFn(data);
                    perTermCountCache[cacheKey] = count;
                    span.textContent = `(${count})`;
                } catch { span.textContent = '(?)'; }
                continue;
            }

            span.textContent = '(...)';
            let total = 0;
            for (const t of validTerms) {
                const cacheKey = `${inst}_${t.num}_${m.key}`;
                if (perTermCountCache[cacheKey] !== undefined) {
                    total += perTermCountCache[cacheKey];
                    continue;
                }
                try {
                    let count;
                    if (m.paginatedCount) {
                        count = await m.paginatedCount(inst, t.num);
                    } else {
                        const res = await fetch(m.url(inst, t.num));
                        if (!res.ok) continue;
                        const data = await res.json();
                        count = m.countFn(data);
                    }
                    perTermCountCache[cacheKey] = count;
                    total += count;
                } catch { /* skip */ }
            }
            span.textContent = `(${total})`;
            continue;
        }

        // Single kadencja
        const cacheKey = m.key === 'ustawy' ? `${inst}_ustawy` : `${inst}_${kadencja}_${m.key}`;
        if (perTermCountCache[cacheKey] !== undefined) {
            span.textContent = `(${perTermCountCache[cacheKey]})`;
            continue;
        }

        span.textContent = '(...)';
        try {
            let count;
            if (m.paginatedCount) {
                count = await m.paginatedCount(inst, kadencja);
            } else {
                const url = m.url(inst, kadencja);
                const res = await fetch(url);
                if (!res.ok) { span.textContent = '(?)'; continue; }
                const data = await res.json();
                count = m.countFn(data);
            }
            perTermCountCache[cacheKey] = count;
            span.textContent = `(${count})`;
        } catch { span.textContent = '(?)'; }
        window._updateETLEstimate?.();
    }
}

function updateRangeMax(maxSittings) {
    const fromEl = document.getElementById('etlRangeFrom');
    const toEl = document.getElementById('etlRangeTo');
    if (!fromEl || !toEl) return;

    fromEl.max = maxSittings;
    toEl.max = maxSittings;

    // Clamp current values
    if (parseInt(fromEl.value) > maxSittings) fromEl.value = maxSittings;
    if (parseInt(toEl.value) > maxSittings) toEl.value = maxSittings;
}

function initETLPanel() {
    // Flaga lazy-loading etykiet posiedzeń w dropdownie kadencji
    let termOptionsEnriched = false;

    // Instytucja — po zmianie pobierz kadencje z API + toggle modułów
    document.querySelectorAll('input[name="etlInst"]').forEach(radio => {
        radio.addEventListener('change', () => {
            termOptionsEnriched = false;
            fetchAvailableTerms(radio.value);
            updateModuleAvailability(radio.value);
            updateETLEstimate();
            const kadencja = document.getElementById('etlTermSelect')?.value;
            if (kadencja) fetchSittingsCount(radio.value, kadencja);
            loadCommitteeOptions();
        });
    });

    // Pobierz kadencje dla domyślnej instytucji na starcie
    // (fetchSittingsCount wywoła się automatycznie po załadowaniu kadencji)
    fetchAvailableTerms('sejm');

    // Kadencja — lazy enrich: pobierz "X pos." dla wszystkich kadencji dopiero po otwarciu dropdownu
    document.getElementById('etlTermSelect')?.addEventListener('focus', () => {
        if (!termOptionsEnriched) {
            termOptionsEnriched = true;
            const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
            enrichTermOptions(inst);
        }
    });

    document.getElementById('etlTermSelect')?.addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('etlTerm').textContent = val === 'all' ? 'wszystkie' : val;
        toggleRangeInputs(val === 'all');
        updateETLEstimate();
        const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
        fetchSittingsCount(inst, val);
        loadCommitteeOptions();
    });
    
    // Zakres posiedzeń (od/do) — walidacja + estimate
    const rangeFrom = document.getElementById('etlRangeFrom');
    const rangeTo = document.getElementById('etlRangeTo');

    [rangeFrom, rangeTo].forEach(input => {
        input?.addEventListener('change', () => {
            clampRangeInputs();
            updateRangeSummary();
            updateETLEstimate();
            updateTranscriptsCount();
            updateVotingsCount();
        });
    });

    // Checkboxy - wywołaj zależności + estimate + counting przy zmianie
    const checkboxSelector = '#etlTranscripts, #etlVotings, #etlVotes, #etlInterpellations, #etlWrittenQuestions, #etlBills, #etlDisclosures, #etlCommitteeSittings, #etlCommitteeStatements';
    document.querySelectorAll(checkboxSelector).forEach(cb => {
        cb?.addEventListener('change', () => {
            applyDependencies();
            updateETLEstimate();
            updateTranscriptsCount();
            updateVotingsCount();
            updatePerTermCounts();
            loadCommitteeOptions();
        });
    });

    // Szybkość pobierania przeniesiona do Ustawień

    // ===== MODULE AVAILABILITY (Sejm vs Senat) =====
    function updateModuleAvailability(institution) {
        // Nie uwzględniaj modułów na stałe wyłączonych (API niedostępne)
        const permanentlyDisabled = ['etlDisclosures', 'etlCommitteeStatements'];
        const sejmOnlyModules = [
            'etlTranscripts', 'etlInterpellations', 'etlWrittenQuestions',
            'etlBills', 'etlLegalActs',
            'etlCommitteeSittings'
        ];
        const isSenat = institution === 'senat';

        for (const id of sejmOnlyModules) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.disabled = isSenat;
            if (isSenat) el.checked = false;
            const label = el.closest('label') || el.parentElement;
            if (label) label.style.opacity = isSenat ? '0.4' : '1';
        }

        // Senat: auto-check głosowania (jedyne dostępne dane)
        if (isSenat) {
            const votings = document.getElementById('etlVotings');
            const votes = document.getElementById('etlVotes');
            if (votings) { votings.checked = true; votings.disabled = false; }
            if (votes) { votes.checked = true; votes.disabled = false; }
        }

        applyDependencies();
    }

    // Expose helpers for external use (ETL settings restore)
    window._applyEtlDependencies = applyDependencies;
    window._loadCommitteeOptions = loadCommitteeOptions;

    // Save ETL settings on any form change (delegated)
    const etlForm = document.querySelector('[data-section="1"]');
    if (etlForm) {
        etlForm.addEventListener('change', () => {
            if (typeof window._saveEtlSettings === 'function') window._saveEtlSettings();
        });
    }

    // Signal that etl-bridge is ready
    window.dispatchEvent(new Event('etl-bridge-ready'));

    // ===== DEPENDENCIES =====
    function applyDependencies() {
        const votings = document.getElementById('etlVotings');
        const votes = document.getElementById('etlVotes');
        const committeeSittings = document.getElementById('etlCommitteeSittings');
        const committeeStatements = document.getElementById('etlCommitteeStatements');
        const committeeSelect = document.getElementById('etlCommitteeSelect');

        // Głosy indywidualne wymagają głosowań
        if (votings && votes) {
            if (!votings.checked) {
                votes.checked = false;
                votes.disabled = true;
            } else {
                votes.disabled = false;
            }
        }

        // Wypowiedzi komisji — na stałe wyłączone (API niedostępne)
        if (committeeStatements) {
            committeeStatements.checked = false;
            committeeStatements.disabled = true;
        }

        // Wybór komisji tylko gdy wybrano dane komisji
        if (committeeSelect) {
            const committeesEnabled = !!(committeeSittings?.checked || committeeStatements?.checked);
            committeeSelect.disabled = !committeesEnabled;
        }
    }

    // ===== RANGE LOCK (Wszystkie kadencje) =====
    function toggleRangeInputs(disabled) {
        const fromEl = document.getElementById('etlRangeFrom');
        const toEl = document.getElementById('etlRangeTo');
        if (fromEl) fromEl.disabled = disabled;
        if (toEl) toEl.disabled = disabled;

        // Wyszarz etykiety
        [fromEl, toEl].forEach(el => {
            if (!el) return;
            const label = el.closest('label') || el.parentElement;
            if (label) label.style.opacity = disabled ? '0.4' : '1';
        });

        const rangeSpan = document.getElementById('etlRange');
        if (rangeSpan) {
            rangeSpan.textContent = disabled ? 'wszystkie posiedzenia (każda kadencja)' : undefined;
            if (!disabled) updateRangeSummary();
        }
    }

    // ===== RANGE VALIDATION =====
    function clampRangeInputs() {
        const fromEl = document.getElementById('etlRangeFrom');
        const toEl = document.getElementById('etlRangeTo');
        if (!fromEl || !toEl) return;

        const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
        const kadencja = document.getElementById('etlTermSelect')?.value;

        // Dla "all" — użyj max z najnowszej kadencji
        let maxSittings = 999;
        if (kadencja === 'all') {
            const terms = termsCache[inst] || [];
            const newest = terms[0]?.num;
            if (newest) maxSittings = sittingsCountCache[`${inst}_${newest}`] || 999;
        } else {
            maxSittings = sittingsCountCache[`${inst}_${kadencja}`] || 999;
        }

        // Clamp values
        let from = parseInt(fromEl.value) || 1;
        let to = parseInt(toEl.value) || 1;

        from = Math.max(1, Math.min(from, maxSittings));
        to = Math.max(from, Math.min(to, maxSittings));

        fromEl.value = from;
        toEl.value = to;
        fromEl.max = maxSittings;
        toEl.max = maxSittings;
    }

    function updateRangeSummary() {
        const kadencja = document.getElementById('etlTermSelect')?.value;
        const rangeSpan = document.getElementById('etlRange');
        if (!rangeSpan) return;

        if (kadencja === 'all') {
            rangeSpan.textContent = 'wszystkie posiedzenia (każda kadencja)';
            return;
        }

        const from = parseInt(document.getElementById('etlRangeFrom')?.value) || 1;
        const to = parseInt(document.getElementById('etlRangeTo')?.value) || 1;
        const count = to - from + 1;
        rangeSpan.textContent = `${count} ${count === 1 ? 'posiedzenie' : count < 5 ? 'posiedzenia' : 'posiedzeń'} (${from}-${to})`;
    }
    
    // ===== UPDATE ESTIMATE =====
    // Helper: wyciąga liczbę z tekstu spana, np. "(2330 wyp.)" → 2330, "(195)" → 195
    function getCountFromSpan(spanId) {
        const el = document.getElementById(spanId);
        if (!el) return 0;
        const text = el.textContent || '';
        if (text.includes('...') || text === '' || text === '(?)') return 0;
        // Dla wypowiedzi format: "(8 dni obrad, 2330 wyp.)" — bierz ostatnią liczbę
        const nums = text.match(/\d+/g);
        if (!nums || nums.length === 0) return 0;
        return parseInt(nums[nums.length - 1], 10) || 0;
    }

    function updateETLEstimate() {
        // Institution
        const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
        document.getElementById('etlInstitution').textContent = inst === 'sejm' ? 'Sejm' : 'Senat';

        // Term
        const term = document.getElementById('etlTermSelect').value;
        document.getElementById('etlTerm').textContent = term === 'all' ? 'wszystkie' : term;

        // Range
        const from = parseInt(document.getElementById('etlRangeFrom')?.value) || 1;
        const to = parseInt(document.getElementById('etlRangeTo')?.value) || 1;
        const range = Math.max(1, to - from + 1);

        // Senat: osobna estymata (XML + CSV)
        if (inst === 'senat') {
            const csvPerSitting = 20;
            const csvCount = range * csvPerSitting;
            const size = 50 + (csvCount * 5);
            const requests = 1 + csvCount;
            const estimatedTime = Math.max(5, Math.round(requests / 5));
            document.getElementById('etlSize').textContent = `~${size} KB`;
            document.getElementById('etlTime').textContent = `~${estimatedTime}s`;
            document.getElementById('etlRequests').textContent = `~${requests}`;
            document.getElementById('etlData').textContent = 'głosowania, głosy indywidualne';
            window._estimatedRequests = requests;
            return;
        }

        // Mnożnik kadencji (dla "Wszystkie")
        const selectEl = document.getElementById('etlTermSelect');
        const termCount = term === 'all'
            ? [...selectEl.options].filter(o => o.value !== 'all').length
            : 1;

        // Collect selected data
        let size = 70 * termCount; // base (deputies + proceedings) per kadencja
        let data = [];
        let totalItems = 2 * termCount; // base: posłowie + posiedzenia — zawsze 2 requesty
        
        // Definicje: checkbox → span z liczbą pozycji + rozmiar KB
        const countSources = [
            { id: 'etlTranscripts', spanId: 'etlTranscriptsCount', name: 'wypowiedzi', sizePerSitting: 400 },
            { id: 'etlVotings', spanId: 'etlVotingsCount', name: 'głosowania', sizePerSitting: 15 },
            { id: 'etlVotes', spanId: 'etlVotesCount', name: 'głosy indywidualne', sizePerSitting: 1200 },
            { id: 'etlInterpellations', spanId: 'etlInterpellationsCount', name: 'interpelacje', sizeTotal: 4000 },
            { id: 'etlWrittenQuestions', spanId: 'etlWrittenQuestionsCount', name: 'zapytania pisemne', sizeTotal: 800 },
            { id: 'etlBills', spanId: 'etlBillsCount', name: 'projekty ustaw', sizeTotal: 700 },
            { id: 'etlLegalActs', spanId: 'etlLegalActsCount', name: 'ustawy (akty prawne)', sizeTotal: 500 }
        ];

        countSources.forEach(item => {
            const checkbox = document.getElementById(item.id);
            if (checkbox && checkbox.checked) {
                const count = getCountFromSpan(item.spanId);
                totalItems += count;
                if (item.sizePerSitting) {
                    size += item.sizePerSitting * range * termCount;
                } else if (item.sizeTotal) {
                    size += item.sizeTotal * termCount;
                }
                data.push(item.name);
            }
        });
        
        // Committee data
        const committeeSittings = document.getElementById('etlCommitteeSittings');
        const committeeStatements = document.getElementById('etlCommitteeStatements');
        const committeeSelect = document.getElementById('etlCommitteeSelect');
        
        if (committeeSittings?.checked || committeeStatements?.checked) {
            const selectedCommittees = Array.from(committeeSelect?.selectedOptions || []);
            const isAllCommittees = selectedCommittees.some(opt => opt.value === 'all');
            const committeeCount = isAllCommittees ? 30 : Math.max(1, selectedCommittees.length);
            
            if (committeeSittings?.checked) {
                const csCount = getCountFromSpan('etlCommitteeSittingsCount');
                size += 80 * committeeCount * termCount;
                totalItems += csCount || (committeeCount * termCount);
                data.push('posiedzenia komisji');
            }

            if (committeeStatements?.checked) {
                size += 200 * committeeCount * termCount;
                totalItems += 5 * committeeCount * termCount;
                data.push('wypowiedzi komisji');
            }
        }
        
        // Calculate time (wąskie gardło = requesty; ~10 req/s z batchowaniem)
        const estimatedTime = Math.max(5, Math.round(totalItems / 10));

        // Update UI
        const sizeMB = size >= 1000 ? `~${(size / 1024).toFixed(1)} MB` : `~${size} KB`;
        document.getElementById('etlSize').textContent = sizeMB;
        document.getElementById('etlTime').textContent = `~${estimatedTime}-${estimatedTime + Math.round(estimatedTime * 0.3)}s`;
        document.getElementById('etlRequests').textContent = `~${totalItems}`;
        document.getElementById('etlData').textContent = data.length > 0 ? data.join(', ') : '—';
        // Expose for pipeline progress display
        window._estimatedRequests = totalItems;
    }
    
    // Expose for async count functions outside initETLPanel
    window._updateETLEstimate = updateETLEstimate;

    // Initial update
    applyDependencies();
    updateRangeSummary();
    updateETLEstimate();
    
    
}

// Init when DOM ready (with deduplication check)
if (!window.__etlBridgeInitialized) {
    window.__etlBridgeInitialized = true;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initETLPanel();
            initFloatingButtonsDragDrop();
            initUIMode();
        });
    } else {
        initETLPanel();
        initFloatingButtonsDragDrop();
        initUIMode();
    }
}
