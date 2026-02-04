// ETL Panel Bridge - obsługa nowego panelu ETL

function initETLPanel() {
    // Instytucja
    document.querySelectorAll('input[name="etlInst"]').forEach(radio => {
        radio.addEventListener('change', updateETLEstimate);
    });
    
    // Kadencja
    document.getElementById('etlTermSelect')?.addEventListener('change', (e) => {
        document.getElementById('etlTerm').textContent = e.target.value;
        updateETLEstimate();
    });
    
    // Zakres
    document.getElementById('etlRangeSelect')?.addEventListener('change', (e) => {
        const range = e.target.value;
        document.getElementById('etlRange').textContent = `${range} ${range == 1 ? 'posiedzenie' : range < 5 ? 'posiedzenia' : 'posiedzeń'}`;
        updateETLEstimate();
    });
    
    // Checkboxy - wywołaj zależności + updateETLEstimate przy zmianie
    const checkboxSelector = '#etlTranscripts, #etlVotings, #etlVotes, #etlInterpellations, #etlWrittenQuestions, #etlBills, #etlDisclosures, #etlCommitteeSittings, #etlCommitteeStatements';
    document.querySelectorAll(checkboxSelector).forEach(cb => {
        cb?.addEventListener('change', () => {
            applyDependencies();
            updateETLEstimate();
        });
    });

    // Range mode - wywołaj zależności + updateETLEstimate przy zmianie
    document.querySelectorAll('input[name="rangeMode"]').forEach(radio => {
        radio?.addEventListener('change', () => {
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

    // ===== DEPENDENCIES =====
    function applyDependencies() {
        const votings = document.getElementById('etlVotings');
        const votes = document.getElementById('etlVotes');
        const committeeSittings = document.getElementById('etlCommitteeSittings');
        const committeeStatements = document.getElementById('etlCommitteeStatements');
        const committeeSelect = document.getElementById('etlCommitteeSelect');
        const rangeMode = document.querySelector('input[name="rangeMode"]:checked')?.value || 'last';
        const rangeSelect = document.getElementById('etlRangeSelect');
        const rangeFrom = document.getElementById('etlRangeFrom');
        const rangeTo = document.getElementById('etlRangeTo');
        const rangeFromLabel = document.getElementById('etlRangeFromLabel');
        const rangeToLabel = document.getElementById('etlRangeToLabel');

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

        // Zakres posiedzeń: last -> blokuje od/do; custom -> blokuje select
        if (rangeSelect && rangeFrom && rangeTo) {
            const isLast = rangeMode === 'last';
            rangeSelect.disabled = !isLast;
            rangeFrom.disabled = isLast;
            rangeTo.disabled = isLast;

            const labelColor = isLast ? '#a0aec0' : '#000000';
            if (rangeFromLabel) rangeFromLabel.style.color = labelColor;
            if (rangeToLabel) rangeToLabel.style.color = labelColor;
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
        const range = parseInt(document.getElementById('etlRangeSelect').value);
        
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
            { id: 'etlDisclosures', name: 'oświadczenia majątkowe', size: 500, reqs: 5 }
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
                            setValidityStatus(true);
                            showVerificationResults(res.differences);
                        } else {
                            setValidityStatus(false);
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
        document.addEventListener('DOMContentLoaded', initETLPanel);
    } else {
        initETLPanel();
    }
}
