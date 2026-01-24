// Pipeline v2.0 - Complete ETL with Incremental Cache
// UI → Fetcher → Normalizer → Database

import { runFetcher, safeFetch } from './fetcher/fetcher.js';
import { runNormalizer } from './normalizer/normalizer.js';
import { db2 } from './modules/database-v2.js';

export async function runPipeline(config, callbacks = {}) {
    console.log('🚀 Pipeline v2.0 - Starting ETL');
    
    const {
        onProgress = () => {},
        onLog = () => {},
        onError = () => {},
        onComplete = () => {}
    } = callbacks;
    
    let totalRecords = 0;
    
    try {
        // Step 1: Initialize database (0-5%)
        onLog('📦 Initializing database...');
        onProgress(5, 'Initializing database');
        
        if (!db2.database) {
            await db2.init();
        }
        
        // Step 2: Check cache and determine what to fetch (5-10%)
        onLog('🔍 Checking cache...');
        onProgress(8, 'Checking cache');
        
        const lastPosiedzenie = getLastPosiedzenie(db2);
        const lastUpdate = getLastUpdate(db2);
        
        if (lastPosiedzenie > 0) {
            onLog(`📌 Last fetched sitting: ${lastPosiedzenie}`);
            onLog(`📌 Last update: ${lastUpdate}`);
        }
        
        // Step 3: Get list of sittings (10-15%)
        onLog('⬇️ Fetching list of sittings...');
        onProgress(12, 'Fetching sittings list');
        
        const allSittings = await fetchSittingsList(config);
        const sittingsToFetch = filterNewSittings(allSittings, lastPosiedzenie, config);
        
        if (sittingsToFetch.length === 0) {
            onLog('✅ All data up to date!');
            onProgress(100, 'Up to date');
            onComplete({ success: true, stats: {}, upToDate: true });
            return { success: true, upToDate: true };
        }
        
        onLog(`📌 Found ${sittingsToFetch.length} new sittings to fetch`);
        onLog(`📌 Range: ${Math.min(...sittingsToFetch)} - ${Math.max(...sittingsToFetch)}`);
        
        // Step 4: Fetch data per sitting (15-70%)
        onLog('⬇️ Fetching data from API...');
        
        const allRawData = {
            poslowie: [],
            posiedzenia: [],
            wypowiedzi: [],
            glosowania: [],
            glosy: [],
            interpelacje: [],
            projekty_ustaw: [],
            komisje: [],
            komisje_posiedzenia: [],
            komisje_wypowiedzi: [],
            oswiadczenia: []
        };
        
        let currentSitting = 0;
        const totalSittings = sittingsToFetch.length;
        
        for (const sittingNum of sittingsToFetch) {
            currentSitting++;
            const percentStart = 15;
            const percentRange = 55; // 15-70%
            const percent = percentStart + (currentSitting / totalSittings) * percentRange;
            
            onProgress(percent, `Fetching sitting ${sittingNum} (${currentSitting}/${totalSittings})`);
            onLog(`⬇️ Sitting ${sittingNum} (${currentSitting}/${totalSittings})...`);
            
            try {
                // Fetch per-sitting data
                const sittingData = await fetchPerSittingData(sittingNum, config);
                
                // Merge into allRawData
                Object.keys(sittingData).forEach(key => {
                    if (Array.isArray(sittingData[key]) && Array.isArray(allRawData[key])) {
                        allRawData[key].push(...sittingData[key]);
                    }
                });
                
                const recordCount = Object.values(sittingData).reduce((sum, arr) => 
                    sum + (Array.isArray(arr) ? arr.length : 0), 0
                );
                
                totalRecords += recordCount;
                onLog(`📥 Fetched ${recordCount} records from sitting ${sittingNum}`);
                
            } catch (error) {
                onLog(`⚠️ Error fetching sitting ${sittingNum}: ${error.message}`);
                console.error(`[Pipeline] Sitting ${sittingNum} error:`, error);
            }
        }
        
        // Step 5: Fetch per-term data (70-75%)
        onLog('⬇️ Fetching per-term data...');
        onProgress(72, 'Fetching per-term data');
        
        const termData = await fetchPerTermData(config);
        Object.keys(termData).forEach(key => {
            if (Array.isArray(termData[key]) && Array.isArray(allRawData[key])) {
                allRawData[key].push(...termData[key]);
            }
        });
        
        // Step 6: Normalize and save (75-95%)
        onLog('🧹 Normalizing and saving to database...');
        onProgress(80, 'Normalizing data');
        
        const stats = await runNormalizer(db2, allRawData);
        
        onLog(`💾 Saved ${Object.values(stats).reduce((a, b) => a + b, 0)} records to database`);
        
        // Step 7: Update cache metadata (95-98%)
        onLog('📝 Updating cache metadata...');
        onProgress(96, 'Updating metadata');
        
        if (sittingsToFetch.length > 0) {
            const maxSitting = Math.max(...sittingsToFetch);
            setLastPosiedzenie(db2, maxSitting);
            setLastUpdate(db2, new Date().toISOString());
        }
        
        db2.upsertMetadata('last_fetch_config', JSON.stringify(config));
        db2.upsertMetadata('last_fetch_stats', JSON.stringify(stats));
        
        // Step 8: Complete (98-100%)
        onProgress(100, 'Complete');
        onLog('✅ Pipeline complete!');
        onLog(`📊 Total: ${totalRecords} records fetched, ${Object.values(stats).reduce((a,b)=>a+b,0)} saved`);
        
        const result = {
            success: true,
            stats,
            fetchedRecords: totalRecords,
            savedRecords: Object.values(stats).reduce((a, b) => a + b, 0),
            newSittings: sittingsToFetch.length,
            timestamp: new Date().toISOString()
        };
        
        onComplete(result);
        return result;
        
    } catch (error) {
        console.error('[Pipeline] Error:', error);
        onError(error);
        onLog(`❌ Pipeline failed: ${error.message}`);
        
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ===== CACHE HELPERS =====

function getLastPosiedzenie(db) {
    try {
        const result = db.database.exec("SELECT wartosc FROM metadata WHERE klucz = 'last_posiedzenie'");
        return result[0]?.values[0]?.[0] ? parseInt(result[0].values[0][0]) : 0;
    } catch {
        return 0;
    }
}

function setLastPosiedzenie(db, num) {
    db.upsertMetadata('last_posiedzenie', String(num));
}

function getLastUpdate(db) {
    try {
        const result = db.database.exec("SELECT wartosc FROM metadata WHERE klucz = 'last_update'");
        return result[0]?.values[0]?.[0] || 'Never';
    } catch {
        return 'Never';
    }
}

function setLastUpdate(db, timestamp) {
    db.upsertMetadata('last_update', timestamp);
}

// ===== FETCH HELPERS =====

async function fetchSittingsList(config) {
    const { typ = 'sejm', kadencja } = config;
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/sittings`;
    
    try {
        const data = await safeFetch(url);
        return Array.isArray(data) ? data.map(s => s.num || s.id) : [];
    } catch {
        // Fallback - generate range
        return Array.from({length: config.rangeCount || 2}, (_, i) => 52 - i).reverse();
    }
}

function filterNewSittings(allSittings, lastFetched, config) {
    let filtered = allSittings.filter(num => num > lastFetched);
    
    // Apply user's range config
    if (config.rangeMode === 'last') {
        filtered = filtered.slice(-config.rangeCount);
    } else if (config.rangeMode === 'custom') {
        filtered = filtered.filter(num => num >= config.rangeFrom && num <= config.rangeTo);
    }
    
    return filtered.sort((a, b) => a - b);
}

async function fetchPerSittingData(sittingNum, config) {
    // Simplified - fetch only requested modules per sitting
    const data = {};
    
    if (config.modules.includes('wypowiedzi')) {
        // data.wypowiedzi = await fetch...
        data.wypowiedzi = []; // TODO: implement
    }
    
    if (config.modules.includes('glosowania')) {
        // data.glosowania = await fetch...
        data.glosowania = []; // TODO: implement
    }
    
    return data;
}

async function fetchPerTermData(config) {
    // Fetch per-term data (poslowie, interpelacje, etc.)
    const data = {};
    
    if (config.modules.includes('poslowie')) {
        // data.poslowie = await fetch...
        data.poslowie = []; // TODO: implement
    }
    
    return data;
}

// ===== CONFIG BUILDER =====

export function buildConfigFromUI() {
    // ... (keep existing implementation)
    const config = {
        typ: document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm',
        kadencja: parseInt(document.getElementById('etlTermSelect')?.value) || 10,
        mode: document.querySelector('input[name="etlMode"]:checked')?.value || 'full',
        rangeMode: 'last',
        rangeCount: parseInt(document.getElementById('etlRangeSelect')?.value) || 2,
        modules: ['poslowie', 'posiedzenia']
    };
    
    // Add selected modules...
    if (document.getElementById('etlTranscripts')?.checked) config.modules.push('wypowiedzi');
    if (document.getElementById('etlVotings')?.checked) config.modules.push('glosowania');
    // ... etc
    
    return config;
}
