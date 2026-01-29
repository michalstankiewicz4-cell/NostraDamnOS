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
    
    // UI setup - tylko przycisk
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Pobieranie...';
    }
    
    try {
        // Build config from ETL Panel UI
        const config = buildConfigFromUI();
        
        console.log('[API Handler] Starting pipeline with config:', config);
        
        // Run pipeline with callbacks
        const result = await runPipeline(config, {
            onProgress: (percent, text) => {
                console.log(`[Progress] ${percent}%: ${text}`);
            },
            
            onLog: (message) => {
                console.log(`[Pipeline] ${message}`);
            },
            
            onError: (error) => {
                console.error('[Pipeline Error]', error);
            },
            
            onComplete: (result) => {
                console.log('[Pipeline] Complete:', result);
            }
        });
        
        console.log('[API Handler] Pipeline result:', result);
        
        // Show success or stats
        if (result.success) {
            const stats = result.stats || {};
            const details = Object.entries(stats)
                .filter(([_, count]) => count > 0)
                .map(([name, count]) => `${name}: ${count}`)
                .join(', ');
            
            alert(`✅ Pobrano dane:\n\n${details || 'Brak nowych danych'}`);
        }
        
    } catch (error) {
        console.error('[API Handler] Error:', error);
        alert(`❌ Błąd ETL: ${error.message}`);
        
    } finally {
        isFetching = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Pobierz dane z API';
        }
    }
}

// Clear cache button
document.getElementById('etlClearBtn')?.addEventListener('click', async () => {
    if (confirm('Wyczyścić wszystkie dane z bazy?')) {
        try {
            await db2.init();
            db2.clearAll();
            console.log('[API Handler] Database cleared');
            alert('✅ Baza wyczyszczona');
        } catch (error) {
            console.error('[API Handler] Clear error:', error);
            alert(`❌ Błąd: ${error.message}`);
        }
    }
});

console.log('[API Handler v2] Loaded - using Pipeline ETL');
