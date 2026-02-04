// API Handler v2.0 - Uses Pipeline ETL
import { runPipeline, buildConfigFromUI, getCacheStatus } from './pipeline.js';
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
    try {
        const cacheStatus = getCacheStatus(db2);
        return !cacheStatus.initialized || cacheStatus.totalRecords === 0;
    } catch (error) {
        console.error('[isDatabaseEmpty] Error:', error);
        return true;
    }
}

// === STATUS INDICATORS ===

function updateStatusIndicators() {
  try {
    const dbEmpty = isDatabaseEmpty();
    const stats = db2.getStats();
    const statusDbState = document.getElementById('statusDbState');
    const statusRecords = document.getElementById('statusRecords');
    const statusValidity = document.getElementById('statusValidity');
    
    if (!statusDbState || !statusRecords || !statusValidity) return;
    
    // Stan bazy: czerwony=pusty, zielony=ma dane
    const dbLamp = statusDbState.querySelector('.etl-lamp');
    if (dbEmpty) {
        dbLamp.className = 'etl-lamp status-error';
        statusDbState.title = `Brak danych (0 rekordów)`;
    } else {
        const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
        dbLamp.className = 'etl-lamp status-ok';
        statusDbState.title = `Baza zawiera dane (${totalRecords} rekordów)`;
    }
    
    // Stan rekordów i poprawności - domyślnie OK, zmienia się przy sprawdzeniu
    const recordsLamp = statusRecords.querySelector('.etl-lamp');
    const validityLamp = statusValidity.querySelector('.etl-lamp');
    
    recordsLamp.className = 'etl-lamp status-ok';
    validityLamp.className = 'etl-lamp status-ok';
  } catch (error) {
    console.error('[updateStatusIndicators] Error:', error);
  }
}

function setRecordsStatus(hasNewRecords) {
  const statusRecords = document.getElementById('statusRecords');
  if (!statusRecords) return;
  
  const lamp = statusRecords.querySelector('.etl-lamp');
  if (hasNewRecords) {
    lamp.className = 'etl-lamp status-error';
    statusRecords.title = 'Znaleziono nowe rekordy';
  } else {
    lamp.className = 'etl-lamp status-ok';
    statusRecords.title = 'Brak nowych rekordów';
  }
}

function setValidityStatus(hasErrors) {
  const statusValidity = document.getElementById('statusValidity');
  if (!statusValidity) return;
  
  const lamp = statusValidity.querySelector('.etl-lamp');
  if (hasErrors) {
    lamp.className = 'etl-lamp status-error';
    statusValidity.title = 'Znaleziono błędy';
  } else {
    lamp.className = 'etl-lamp status-ok';
    statusValidity.title = 'Dane są poprawne';
  }
}

// Export db2 globally for debugging
window.db2 = db2;

// Export status functions globally for etl-bridge.js
window.updateStatusIndicators = updateStatusIndicators;
window.setRecordsStatus = setRecordsStatus;
window.setValidityStatus = setValidityStatus;

// Initialize database on load
db2.init().then(() => {
    console.log('[API Handler] Database initialized');
    updateStatusIndicators();
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

    // Case 1: Empty database - just fetch without asking
    if (dbEmpty) {
        await startPipelineETL();
        return;
    }

    // Case 2: Form configuration changed - just fetch without asking
    if (configChanged) {
        await startPipelineETL();
        return;
    }

    // Case 3: Same configuration - check for new records first
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
            setRecordsStatus(true);
            const msg = `🆕 Znaleziono ${result.differences.length} nowych/zmienionych rekordów w API.\n\nCzy pobrać?`;
            if (confirm(msg)) {
                await startPipelineETL();
            }
        } else {
            setRecordsStatus(false);
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
        
        // Run pipeline with callbacks
        const result = await runPipeline(config, {
            onProgress: (percent, text) => {},
            onLog: (message) => {},
            onError: (error) => {
                console.error('[Pipeline Error]', error);
            },
            onComplete: (result) => {}
        });
        
        // Show success or stats
        if (result.success) {
            // Get stats from pipeline result or from database if result is empty
            let stats = result.stats || {};
            
            // If no new data (up to date), fetch all data from database
            if (result.upToDate || Object.values(stats).every(v => v === 0)) {
                stats = db2.getStats();
            }
            
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
            
            const details = parts.join(', ');
            
            // Auto-save to localStorage
            db2.saveToLocalStorage();
            saveLastFetchConfig(config);
            
            // Update status indicators
            updateStatusIndicators();
            setRecordsStatus(false);
            
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
            
            // Update status indicators after clearing
            updateStatusIndicators();
            setRecordsStatus(false);
            setValidityStatus(false);
            
            alert('✅ Baza wyczyszczona');
        } catch (error) {
            console.error('[API Handler] Clear error:', error);
            alert(`❌ Błąd: ${error.message}`);
        }
    }
});

console.log('[API Handler v2] Loaded - using Pipeline ETL');

} // End of deduplication check
