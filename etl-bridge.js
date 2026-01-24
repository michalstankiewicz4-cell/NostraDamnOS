// ETL Panel Bridge - łączy ETL UI z istniejącym api-handler.js

function initETLPanel() {
    // Sync ETL → Old UI
    document.getElementById('etlRangeSelect')?.addEventListener('change', (e) => {
        const range = e.target.value;
        document.getElementById('apiRange').value = range;
        document.getElementById('etlRange').textContent = `${range} ${range == 1 ? 'posiedzenie' : 'posiedzeń'}`;
        updateETLEstimate();
    });
    
    document.getElementById('etlTranscripts')?.addEventListener('change', (e) => {
        document.getElementById('apiTranscripts').checked = e.target.checked;
        updateETLEstimate();
    });
    
    document.getElementById('etlVotings')?.addEventListener('change', (e) => {
        document.getElementById('apiVotings').checked = e.target.checked;
        updateETLEstimate();
    });
    
    // ETL Fetch btn → trigger old btn
    document.getElementById('etlFetchBtn')?.addEventListener('click', () => {
        document.getElementById('apiFetchBtn').click();
    });
    
    // ETL Clear btn → trigger old clear
    document.getElementById('etlClearBtn')?.addEventListener('click', () => {
        document.getElementById('clearCacheBtn').click();
    });
    
    function updateETLEstimate() {
        const range = parseInt(document.getElementById('etlRangeSelect').value);
        const hasTranscripts = document.getElementById('etlTranscripts').checked;
        const hasVotings = document.getElementById('etlVotings').checked;
        
        let size = 100; // base
        let data = [];
        
        if (hasTranscripts) {
            size += 300 * range;
            data.push('wypowiedzi');
        }
        if (hasVotings) {
            size += 80 * range;
            data.push('głosowania');
        }
        
        document.getElementById('etlSize').textContent = `~${size} KB`;
        document.getElementById('etlTime').textContent = `~${Math.round(size/50)}-${Math.round(size/40)}s`;
        document.getElementById('etlData').textContent = data.join(', ') || '—';
    }
    
    updateETLEstimate();
}

// Init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initETLPanel);
} else {
    initETLPanel();
}
