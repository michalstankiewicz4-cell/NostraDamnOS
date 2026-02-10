// ETL Panel Bridge - obsługa nowego panelu ETL
import {
    initFloatingButtonsDragDrop,
    initUIMode
} from './modules/floating-drag.js';

// Cache dla pobranych kadencji (żeby nie odpytywać API przy każdym kliknięciu)
const termsCache = {};
// Cache dla liczby posiedzeń per kadencja
const sittingsCountCache = {};
// Cache dla pełnych danych posiedzeń (potrzebne do zliczania dni obrad / wypowiedzi)
const proceedingsDataCache = {};
// Cache dla dokładnej liczby wypowiedzi per dzień obrad (klucz: "inst_kadencja_sitting_date")
const transcriptsCountCache = {};
// Token anulowania: inkrementowany przy każdym wywołaniu updateTranscriptsCount
let transcriptsCountToken = 0;

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
        enrichTermOptions(institution);
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

        // Wzbogać etykiety opcji o liczbę posiedzeń
        enrichTermOptions(institution);

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

    // "Wszystkie" jako ostatnia opcja
    if (validTerms.length > 1) {
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'Wszystkie kadencje';
        selectEl.appendChild(allOpt);
    }

    // Przywróć poprzednią wartość jeśli istnieje
    if ([...selectEl.options].some(o => o.value === prevValue)) {
        selectEl.value = prevValue;
    }

    // Zaktualizuj wyświetlanie kadencji
    const termDisplay = document.getElementById('etlTerm');
    if (termDisplay) termDisplay.textContent = selectEl.value === 'all' ? 'wszystkie' : selectEl.value;
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
        return;
    }

    const cacheKey = `${institution}_${kadencja}`;
    if (sittingsCountCache[cacheKey] !== undefined) {
        span.textContent = `(${sittingsCountCache[cacheKey]} posiedzeń)`;
        updateRangeMax(sittingsCountCache[cacheKey]);
        updateTranscriptsCount();
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
    // Instytucja — po zmianie pobierz kadencje z API + toggle modułów
    document.querySelectorAll('input[name="etlInst"]').forEach(radio => {
        radio.addEventListener('change', () => {
            fetchAvailableTerms(radio.value);
            updateModuleAvailability(radio.value);
            updateETLEstimate();
            const kadencja = document.getElementById('etlTermSelect')?.value;
            if (kadencja) fetchSittingsCount(radio.value, kadencja);
        });
    });

    // Pobierz kadencje dla domyślnej instytucji na starcie
    // (fetchSittingsCount wywoła się automatycznie po załadowaniu kadencji)
    fetchAvailableTerms('sejm');

    // Kadencja
    document.getElementById('etlTermSelect')?.addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('etlTerm').textContent = val === 'all' ? 'wszystkie' : val;
        toggleRangeInputs(val === 'all');
        updateETLEstimate();
        const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
        fetchSittingsCount(inst, val);
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
        });
    });

    // Checkboxy - wywołaj zależności + updateETLEstimate przy zmianie
    const checkboxSelector = '#etlTranscripts, #etlVotings, #etlVotes, #etlInterpellations, #etlWrittenQuestions, #etlBills, #etlDisclosures, #etlCommitteeSittings, #etlCommitteeStatements';
    document.querySelectorAll(checkboxSelector).forEach(cb => {
        cb?.addEventListener('change', () => {
            applyDependencies();
            updateETLEstimate();
        });
    });

    // Full database checkbox - przełączanie bez funkcjonalności na razie
    const fullDatabaseCheckbox = document.getElementById('fullDatabaseCheckbox');
    if (fullDatabaseCheckbox) {
        // Prevent button click when clicking checkbox
        fullDatabaseCheckbox.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        fullDatabaseCheckbox.addEventListener('change', (e) => {
            console.log('Full database mode:', e.target.checked ? 'enabled' : 'disabled');
        });
    }

    // ===== MODULE AVAILABILITY (Sejm vs Senat) =====
    function updateModuleAvailability(institution) {
        const sejmOnlyModules = [
            'etlTranscripts', 'etlInterpellations', 'etlWrittenQuestions',
            'etlBills', 'etlLegalActs', 'etlDisclosures',
            'etlCommitteeSittings', 'etlCommitteeStatements'
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

        // Wypowiedzi komisji wymagają posiedzeń komisji
        if (committeeSittings && committeeStatements) {
            if (!committeeSittings.checked) {
                committeeStatements.checked = false;
                committeeStatements.disabled = true;
            } else {
                committeeStatements.disabled = false;
            }
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
        let requests = 2 * termCount; // base requests per kadencja
        
        // Per sitting data
        const perSittingData = [
            { id: 'etlTranscripts', name: 'wypowiedzi', sizePerSitting: 300, reqsPerSitting: 10 },
            { id: 'etlVotings', name: 'głosowania', sizePerSitting: 80, reqsPerSitting: 2 },
            { id: 'etlVotes', name: 'głosy indywidualne', sizePerSitting: 400, reqsPerSitting: 5 }
        ];
        
        perSittingData.forEach(item => {
            const checkbox = document.getElementById(item.id);
            if (checkbox && checkbox.checked) {
                size += item.sizePerSitting * range * termCount;
                requests += item.reqsPerSitting * range * termCount;
                data.push(item.name);
            }
        });
        
        // Per term data
        const perTermData = [
            { id: 'etlInterpellations', name: 'interpelacje', size: 200, reqs: 10 },
            { id: 'etlWrittenQuestions', name: 'zapytania pisemne', size: 150, reqs: 8 },
            { id: 'etlBills', name: 'projekty ustaw', size: 250, reqs: 15 },
            { id: 'etlDisclosures', name: 'oświadczenia majątkowe', size: 500, reqs: 5 },
            { id: 'etlLegalActs', name: 'ustawy (akty prawne)', size: 200, reqs: 5 }
        ];
        
        perTermData.forEach(item => {
            const checkbox = document.getElementById(item.id);
            if (checkbox && checkbox.checked) {
                size += item.size * termCount;
                requests += item.reqs * termCount;
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
                size += 80 * committeeCount * termCount;
                requests += 2 * committeeCount * termCount;
                data.push('posiedzenia komisji');
            }

            if (committeeStatements?.checked) {
                size += 200 * committeeCount * termCount;
                requests += 5 * committeeCount * termCount;
                data.push('wypowiedzi komisji');
            }
        }
        
        // Calculate time
        const estimatedTime = Math.max(5, Math.round(size / 50));
        
        // Update UI
        document.getElementById('etlSize').textContent = `~${size} KB`;
        document.getElementById('etlTime').textContent = `~${estimatedTime-2}-${estimatedTime+3}s`;
        document.getElementById('etlRequests').textContent = `~${requests}`;
        document.getElementById('etlData').textContent = data.length > 0 ? data.join(', ') : '—';
    }
    
    // Initial update
    applyDependencies();
    updateRangeSummary();
    updateETLEstimate();
    
    
    // Verify button - check for differences/discrepancies
    const verifyBtn = document.getElementById('etlVerifyBtn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            verifyBtn.disabled = true;
            verifyBtn.textContent = '⏳ Sprawdzanie...';
            
            try {
                const { runPipeline, buildConfigFromUI } = await import('./pipeline.js');
                const config = buildConfigFromUI();
                config.fetchMode = 'verify'; // Verify mode - check differences
                
                const result = await runPipeline(config, {
                    onLog: (msg) => console.log(msg),
                    onProgress: () => {},
                    onComplete: (res) => {
                        if (res.differences && res.differences.length > 0) {
                            window.setValidityStatus(true);
                            showVerificationResults(res.differences);
                        } else {
                            window.setValidityStatus(false);
                            alert('✅ Niema żadnych zmian - baza i API się zgadzają!');
                        }
                    }
                });
            } catch (error) {
                alert('❌ Błąd weryfikacji: ' + error.message);
            } finally {
                verifyBtn.disabled = false;
                verifyBtn.textContent = '🔍 Sprawdź niezgodności';
            }
        });
    }
}

function showVerificationResults(differences) {
    let message = '🔍 Raport niezgodności:\n\n';
    message += `Znaleziono ${differences.length} różnic(y):\n\n`;
    
    differences.forEach((diff, i) => {
        message += `${i + 1}. ${diff.message}\n`;
    });
    
    const shouldUpdate = confirm(message + '\nCzy chcesz poprawić bazę danych?');
    
    if (shouldUpdate) {
        // Trigger full fetch
        document.getElementById('etlFetchBtn').click();
    }
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
