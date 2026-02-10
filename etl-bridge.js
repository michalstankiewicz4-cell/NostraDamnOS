// ETL Panel Bridge - obsługa nowego panelu ETL
import {
    initFloatingButtonsDragDrop,
    initUIMode
} from './modules/floating-drag.js';

// Cache dla pobranych kadencji (żeby nie odpytywać API przy każdym kliknięciu)
const termsCache = {};
// Cache dla liczby posiedzeń per kadencja
const sittingsCountCache = {};

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

    for (const t of terms) {
        if (t.num < MIN_KADENCJA) continue;
        const from = t.from ? t.from.slice(0, 4) : '?';
        const to = t.current ? 'obecnie' : (t.to ? t.to.slice(0, 4) : '?');
        const opt = document.createElement('option');
        opt.value = t.num;
        opt.textContent = `${t.num}. kadencja (${from}-${to})`;
        selectEl.appendChild(opt);
    }

    // Przywróć poprzednią wartość jeśli istnieje
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

    const cacheKey = `${institution}_${kadencja}`;
    if (sittingsCountCache[cacheKey] !== undefined) {
        span.textContent = `(${sittingsCountCache[cacheKey]} posiedzeń)`;
        updateRangeMax(sittingsCountCache[cacheKey]);
        return;
    }

    span.textContent = '(...)';

    try {
        const url = `https://api.sejm.gov.pl/${institution}/term${kadencja}/proceedings`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const count = Array.isArray(data) ? data.filter(p => p.number > 0).length : 0;
        sittingsCountCache[cacheKey] = count;
        span.textContent = `(${count} posiedzeń)`;
        updateRangeMax(count);
    } catch {
        span.textContent = '(?)';
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
        document.getElementById('etlTerm').textContent = e.target.value;
        updateETLEstimate();
        const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
        fetchSittingsCount(inst, e.target.value);
    });
    
    // Zakres posiedzeń (od/do) — walidacja + estimate
    const rangeFrom = document.getElementById('etlRangeFrom');
    const rangeTo = document.getElementById('etlRangeTo');

    [rangeFrom, rangeTo].forEach(input => {
        input?.addEventListener('change', () => {
            clampRangeInputs();
            updateRangeSummary();
            updateETLEstimate();
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

    // ===== RANGE VALIDATION =====
    function clampRangeInputs() {
        const fromEl = document.getElementById('etlRangeFrom');
        const toEl = document.getElementById('etlRangeTo');
        if (!fromEl || !toEl) return;

        const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
        const kadencja = document.getElementById('etlTermSelect')?.value;
        const cacheKey = `${inst}_${kadencja}`;
        const maxSittings = sittingsCountCache[cacheKey] || 999;

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
        const from = parseInt(document.getElementById('etlRangeFrom')?.value) || 1;
        const to = parseInt(document.getElementById('etlRangeTo')?.value) || 1;
        const count = to - from + 1;
        const rangeSpan = document.getElementById('etlRange');
        if (rangeSpan) {
            rangeSpan.textContent = `${count} ${count === 1 ? 'posiedzenie' : count < 5 ? 'posiedzenia' : 'posiedzeń'} (${from}-${to})`;
        }
    }
    
    // ===== UPDATE ESTIMATE =====
    function updateETLEstimate() {
        // Institution
        const inst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';
        document.getElementById('etlInstitution').textContent = inst === 'sejm' ? 'Sejm' : 'Senat';

        // Term
        const term = document.getElementById('etlTermSelect').value;
        document.getElementById('etlTerm').textContent = term;

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

        // Collect selected data
        let size = 70; // base (deputies + proceedings)
        let data = [];
        let requests = 2; // base requests
        
        // Per sitting data
        const perSittingData = [
            { id: 'etlTranscripts', name: 'wypowiedzi', sizePerSitting: 300, reqsPerSitting: 10 },
            { id: 'etlVotings', name: 'głosowania', sizePerSitting: 80, reqsPerSitting: 2 },
            { id: 'etlVotes', name: 'głosy indywidualne', sizePerSitting: 400, reqsPerSitting: 5 }
        ];
        
        perSittingData.forEach(item => {
            const checkbox = document.getElementById(item.id);
            if (checkbox && checkbox.checked) {
                size += item.sizePerSitting * range;
                requests += item.reqsPerSitting * range;
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
                size += item.size;
                requests += item.reqs;
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
                size += 80 * committeeCount;
                requests += 2 * committeeCount;
                data.push('posiedzenia komisji');
            }
            
            if (committeeStatements?.checked) {
                size += 200 * committeeCount;
                requests += 5 * committeeCount;
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
