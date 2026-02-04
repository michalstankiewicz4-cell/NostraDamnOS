// API Handler v2.0 - Uses Pipeline ETL
import { runPipeline, buildConfigFromUI } from './pipeline.js';
import { db2 } from './modules/database-v2.js';

let isFetching = false;

// Export db2 globally for debugging
window.db2 = db2;

// Initialize database on load
db2.init().then(() => {
    console.log('[API Handler] Database initialized');
}).catch(err => {
    console.error('[API Handler] Failed to initialize database:', err);
});

// Deduplication check to prevent duplicate event listeners
if (!window.__apiHandlerInitialized) {
    window.__apiHandlerInitialized = true;

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
            // Get stats from pipeline result or from database if result is empty
            let stats = result.stats || {};
            
            // If no new data (up to date), fetch all data from database
            if (result.upToDate || Object.values(stats).every(v => v === 0)) {
                console.log('[API Handler] No new data, fetching from database');
                stats = db2.getStats();
            }
            
            console.log('[API Handler] Config:', { typ: config.typ, kadencja: config.kadencja });
            console.log('[API Handler] Stats:', stats);
            
            // Format institution name
            const instytucja = config.typ === 'sejm' ? 'Sejm RP' : 'Senat RP';
            
            // Build message parts
            const parts = [];
            
            // Always show: instytucja, kadencja, posiedzenia
            parts.push(`instytucja: ${instytucja}`);
            parts.push(`kadencja: ${config.kadencja}`);
            if (stats.posiedzenia > 0) {
                parts.push(`posiedzenia: ${stats.posiedzenia}`);
            }
            
            // Add other selected data modules (excluding poslowie and posiedzenia)
            const otherEntries = Object.entries(stats)
                .filter(([name, count]) => count > 0 && name !== 'poslowie' && name !== 'posiedzenia')
                .map(([name, count]) => `${name}: ${count}`);
            
            parts.push(...otherEntries);
            
            console.log('[API Handler] Message parts:', parts);
            const details = parts.join(', ');
            console.log('[API Handler] Final message:', details);
            
            // Auto-save to localStorage
            db2.saveToLocalStorage();
            
            alert(`✅ Pobrano dane:\n\n${details || 'Brak danych w bazie'}`);
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

} // End of deduplication check
