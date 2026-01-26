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
        
        // Step 4: Fetch all data using runFetcher (15-70%)
        onLog('⬇️ Fetching data from API...');
        onProgress(20, 'Fetching data from API');
        
        // Pass sittings range to config
        const fetchConfig = {
            ...config,
            sittingsToFetch: sittingsToFetch
        };
        
        // Call real fetcher - returns all raw data
        const raw = await runFetcher(fetchConfig);
        
        // Count fetched records
        totalRecords = Object.values(raw).reduce((sum, arr) => 
            sum + (Array.isArray(arr) ? arr.length : 0), 0
        );
        
        onLog(`📥 Fetched ${totalRecords} raw records from API`);
        onProgress(70, 'Fetching complete');
        
        // Step 5: Normalize and save (70-90%)
        onLog('🧹 Normalizing and saving to database...');
        onProgress(75, 'Normalizing data');
        
        const stats = await runNormalizer(db2, raw);
        
        onLog(`💾 Saved ${Object.values(stats).reduce((a, b) => a + b, 0)} records to database`);
        onProgress(90, 'Normalization complete');
        
        // Step 6: Update cache metadata (90-98%)
        onLog('📝 Updating cache metadata...');
        onProgress(95, 'Updating metadata');
        
        // Update last_posiedzenie based on actual data
        if (raw.posiedzenia && raw.posiedzenia.length > 0) {
            const maxSitting = Math.max(...raw.posiedzenia.map(p => 
                p.num ?? p.id ?? p.posiedzenie ?? p.number ?? 0
            ));
            if (maxSitting > 0) {
                setLastPosiedzenie(db2, maxSitting);
                onLog(`📌 Updated cache: last_posiedzenie = ${maxSitting}`);
            }
        }
        
        setLastUpdate(db2, new Date().toISOString());
        
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

// ===== CONFIG BUILDER =====

export function buildConfigFromUI() {
    // Get range mode
    const rangeMode = document.querySelector('input[name="rangeMode"]:checked')?.value || 'last';
    
    const config = {
        typ: document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm',
        kadencja: parseInt(document.getElementById('etlTermSelect')?.value) || 10,
        mode: document.querySelector('input[name="etlMode"]:checked')?.value || 'full',
        rangeMode: rangeMode,
        rangeCount: parseInt(document.getElementById('etlRangeSelect')?.value) || 2,
        rangeFrom: parseInt(document.getElementById('etlRangeFrom')?.value) || 1,
        rangeTo: parseInt(document.getElementById('etlRangeTo')?.value) || 3,
        modules: ['poslowie', 'posiedzenia'] // Always include base modules
    };
    
    // Collect selected data modules
    if (document.getElementById('etlTranscripts')?.checked) config.modules.push('wypowiedzi');
    if (document.getElementById('etlVotings')?.checked) config.modules.push('glosowania');
    if (document.getElementById('etlVotes')?.checked) config.modules.push('glosy');
    if (document.getElementById('etlInterpellations')?.checked) config.modules.push('interpelacje');
    if (document.getElementById('etlBills')?.checked) config.modules.push('projekty_ustaw');
    if (document.getElementById('etlDisclosures')?.checked) config.modules.push('oswiadczenia');
    
    // Committee modules
    if (document.getElementById('etlCommitteeSittings')?.checked) {
        config.modules.push('komisje');
        config.modules.push('komisje_posiedzenia');
    }
    if (document.getElementById('etlCommitteeStatements')?.checked) {
        config.modules.push('komisje');
        config.modules.push('komisje_wypowiedzi');
    }
    
    // Get selected committees
    const committeeSelect = document.getElementById('etlCommitteeSelect');
    const selectedCommittees = Array.from(committeeSelect?.selectedOptions || []).map(opt => opt.value);
    config.committees = selectedCommittees.includes('all') ? ['all'] : selectedCommittees;
    
    return config;
}
