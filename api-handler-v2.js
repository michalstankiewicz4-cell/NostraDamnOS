// API Handler v2.0 - Uses Pipeline ETL
import { runPipeline, buildConfigFromUI } from './pipeline.js';
import { db2 } from './modules/database-v2.js';

let isFetching = false;

// === CONFIG COMPARISON HELPERS ===

function normalizeConfigForCompare(config) {
    if (!config) return null;
    return {
        typ: config.typ,
        kadencja: config.kadencja,
        rangeMode: config.rangeMode,
        rangeCount: config.rangeCount,
        rangeFrom: config.rangeFrom,
        rangeTo: config.rangeTo,
        modules: Array.isArray(config.modules) ? [...config.modules].sort() : [],
        committees: Array.isArray(config.committees) ? [...config.committees].sort() : []
    };
}

function saveLastFetchConfig(config) {
    const configToSave = normalizeConfigForCompare(config);
    localStorage.setItem('nostradamnos_lastFetchConfig', JSON.stringify(configToSave));
}

function getLastFetchConfig() {
    const saved = localStorage.getItem('nostradamnos_lastFetchConfig');
    if (!saved) return null;
    try {
        const parsed = JSON.parse(saved);
        if (parsed && !parsed.modules && Array.isArray(parsed.moduly)) {
            parsed.modules = parsed.moduly;
            delete parsed.moduly;
        }
        return parsed;
    } catch (error) {
        console.warn('[Smart Fetch] Invalid saved config, resetting.', error);
        localStorage.removeItem('nostradamnos_lastFetchConfig');
        return null;
    }
}

function configsAreEqual(config1, config2) {
    try {
        const norm1 = normalizeConfigForCompare(config1);
        const norm2 = normalizeConfigForCompare(config2);
        if (!norm1 || !norm2) return false;
        return JSON.stringify(norm1) === JSON.stringify(norm2);
    } catch (error) {
        console.warn('[Smart Fetch] Config compare failed, treating as changed.', error);
        return false;
    }
}

function isDatabaseEmpty() {
  if (!db2.database) return true;
  
  try {
    // Check if poslowie table has any records
    const result = db2.database.exec('SELECT COUNT(*) as count FROM poslowie');
    if (result.length > 0 && result[0].values.length > 0) {
      const count = result[0].values[0][0];
      return count === 0;
    }
    return true;
  } catch (error) {
    console.error('[isDatabaseEmpty] Error:', error);
    return true;
  }
}

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

// Main ETL fetch button handler with intelligent checking
document.getElementById('etlFetchBtn')?.addEventListener('click', async () => {
    if (isFetching) return;
    await smartFetch();
});

// Smart fetch - checks if we should ask user first
async function smartFetch() {
    const currentConfig = buildConfigFromUI();
    const lastConfig = getLastFetchConfig();
    const dbEmpty = isDatabaseEmpty();
    const configChanged = !configsAreEqual(currentConfig, lastConfig);

    console.log('[Smart Fetch] DB empty:', dbEmpty);
    console.log('[Smart Fetch] Config changed:', configChanged);
    console.log('[Smart Fetch] Current config:', currentConfig);
    console.log('[Smart Fetch] Last config:', lastConfig);

    // Case 1: Empty database - just fetch without asking
    if (dbEmpty) {
        console.log('[Smart Fetch] Empty database - fetching without confirmation');
        await startPipelineETL();
        return;
    }

    // Case 2: Form configuration changed - just fetch without asking
    if (configChanged) {
        console.log('[Smart Fetch] Configuration changed - fetching without confirmation');
        await startPipelineETL();
        return;
    }

    // Case 3: Same configuration - check for new records first
    console.log('[Smart Fetch] Same configuration - checking for new records first');
    const btn = document.getElementById('etlFetchBtn');
    
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Sprawdzam nowe dane...';
    }

    try {
        const verifyConfig = { ...currentConfig, fetchMode: 'verify' };
        const result = await runPipeline(verifyConfig, {
            onLog: (msg) => console.log('[Verify]', msg),
            onProgress: () => {},
            onComplete: () => {}
        });

        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Pobierz/Zaktualizuj dane';
        }

        // Check if there are differences
        if (result.differences && result.differences.length > 0) {
            const msg = `🆕 Znaleziono ${result.differences.length} nowych/zmienionych rekordów w API.\n\nCzy pobrać?`;
            if (confirm(msg)) {
                await startPipelineETL();
            }
        } else {
            alert('✅ Brak nowych danych w API. Baza jest aktualna.');
        }
    } catch (error) {
        console.error('[Smart Fetch] Verify error:', error);
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Pobierz/Zaktualizuj dane';
        }
        alert('❌ Błąd sprawdzenia: ' + error.message);
    }
}

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
            saveLastFetchConfig(config);
            
            alert(`✅ Pobrano dane:\n\n${details || 'Brak danych w bazie'}`);
        }
        
    } catch (error) {
        console.error('[API Handler] Error:', error);
        alert(`❌ Błąd ETL: ${error.message}`);
        
    } finally {
        isFetching = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Pobierz/Zaktualizuj dane';
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
