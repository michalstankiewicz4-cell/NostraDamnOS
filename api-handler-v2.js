// API Handler v2.0 - Uses Pipeline ETL
import { runPipeline, buildConfigFromUI } from './pipeline.js';
import { db2 } from './modules/database-v2.js';

let isFetching = false;

// Main ETL fetch button handler
document.getElementById('etlFetchBtn')?.addEventListener('click', async () => {
    if (isFetching) return;
    await startPipelineETL();
});

async function startPipelineETL() {
    isFetching = true;
    
    const btn = document.getElementById('etlFetchBtn');
    const oldBtn = document.getElementById('apiFetchBtn');
    const progress = document.getElementById('apiProgress');
    const progressBar = document.getElementById('apiProgressBar');
    const progressText = document.getElementById('apiProgressText');
    const logs = document.getElementById('apiLogs');
    const status = document.getElementById('apiStatus');
    const statusDetails = document.getElementById('apiStatusDetails');
    
    // UI setup
    btn.disabled = true;
    oldBtn.disabled = true;
    btn.textContent = '⏳ Pobieranie...';
    progress.style.display = 'block';
    status.style.display = 'none';
    logs.innerHTML = '';
    
    try {
        // Build config from ETL Panel UI
        const config = buildConfigFromUI();
        
        console.log('[API Handler] Config:', config);
        
        // Run pipeline with callbacks
        const result = await runPipeline(config, {
            onProgress: (percent, text) => {
                progressBar.style.width = `${percent}%`;
                progressText.textContent = `${text} (${percent}%)`;
            },
            
            onLog: (message) => {
                const line = document.createElement('div');
                line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                logs.appendChild(line);
                logs.scrollTop = logs.scrollHeight;
            },
            
            onError: (error) => {
                console.error('[Pipeline Error]', error);
                alert(`Błąd: ${error.message}`);
            },
            
            onComplete: (result) => {
                console.log('[Pipeline] Complete:', result);
                
                // Show success status
                if (result.success) {
                    status.style.display = 'block';
                    
                    const stats = result.stats || {};
                    const details = Object.entries(stats)
                        .filter(([_, count]) => count > 0)
                        .map(([name, count]) => `${name}: ${count}`)
                        .join(', ');
                    
                    statusDetails.textContent = details || 'Brak danych do pobrania';
                }
            }
        });
        
        console.log('[API Handler] Pipeline result:', result);
        
    } catch (error) {
        console.error('[API Handler] Error:', error);
        alert(`Błąd ETL: ${error.message}`);
        
    } finally {
        isFetching = false;
        btn.disabled = false;
        oldBtn.disabled = false;
        btn.textContent = '📥 Pobierz dane z API';
        
        setTimeout(() => {
            progress.style.display = 'none';
        }, 3000);
    }
}

// Clear cache button
document.getElementById('etlClearBtn')?.addEventListener('click', async () => {
    if (confirm('Wyczyścić wszystkie dane z bazy?')) {
        try {
            await db2.init();
            db2.clearAll();
            alert('✅ Baza wyczyszczona');
        } catch (error) {
            alert(`Błąd: ${error.message}`);
        }
    }
});

// Stats button (optional - show current DB stats)
document.getElementById('etlStatsBtn')?.addEventListener('click', async () => {
    try {
        await db2.init();
        const stats = db2.getStats();
        
        const text = Object.entries(stats)
            .map(([table, count]) => `${table}: ${count}`)
            .join('\n');
        
        alert(`📊 Statystyki bazy:\n\n${text}`);
    } catch (error) {
        alert(`Błąd: ${error.message}`);
    }
});

console.log('[API Handler v2] Loaded - using Pipeline ETL');
