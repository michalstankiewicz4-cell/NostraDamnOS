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
    
    // Checkboxy - wywołaj updateETLEstimate przy zmianie
    document.querySelectorAll('#etlTranscripts, #etlVotings, #etlVotes, #etlInterpellations, #etlWrittenQuestions, #etlBills, #etlDisclosures, #etlCommitteeSittings, #etlCommitteeStatements').forEach(cb => {
        cb?.addEventListener('change', updateETLEstimate);
    });
    
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
    updateETLEstimate();
}

// Init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initETLPanel);
} else {
    initETLPanel();
}
