// Pipeline v2.0 - Complete ETL orchestrator
// UI → Fetcher → Normalizer → Database

import { runFetcher } from './fetcher/fetcher.js';
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
    
    try {
        // Step 1: Initialize database
        onLog('📦 Initializing database...');
        onProgress(10, 'Initializing database');
        
        if (!db2.database) {
            await db2.init();
        }
        
        // Step 2: Fetch raw data from API
        onLog('⬇️ Fetching data from API...');
        onProgress(20, 'Fetching data');
        
        const raw = await runFetcher(config);
        
        // Count total records fetched
        const fetchedCount = Object.keys(raw).reduce((sum, key) => {
            return sum + (Array.isArray(raw[key]) ? raw[key].length : 0);
        }, 0);
        
        onLog(`✅ Fetched ${fetchedCount} records from ${Object.keys(raw).length} modules`);
        onProgress(60, 'Data fetched');
        
        // Step 3: Normalize and save to database
        onLog('🧹 Normalizing and saving to database...');
        onProgress(70, 'Normalizing data');
        
        const stats = await runNormalizer(db2, raw);
        
        // Step 4: Update metadata
        onLog('📝 Updating metadata...');
        onProgress(90, 'Updating metadata');
        
        db2.upsertMetadata('last_fetch_date', new Date().toISOString());
        db2.upsertMetadata('last_fetch_config', JSON.stringify(config));
        db2.upsertMetadata('last_fetch_stats', JSON.stringify(stats));
        
        // Step 5: Complete
        onProgress(100, 'Complete');
        onLog('✅ Pipeline complete');
        
        const result = {
            success: true,
            stats,
            fetchedCount,
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

// Helper: Build config from UI form
export function buildConfigFromUI() {
    const config = {
        // Institution & Term
        typ: document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm',
        kadencja: parseInt(document.getElementById('etlTermSelect')?.value) || 10,
        
        // Mode
        mode: document.querySelector('input[name="etlMode"]:checked')?.value || 'full',
        
        // Range
        rangeMode: 'last',
        rangeCount: parseInt(document.getElementById('etlRangeSelect')?.value) || 2,
        
        // Modules to fetch
        modules: []
    };
    
    // Always include poslowie & posiedzenia (foundation)
    config.modules.push('poslowie', 'posiedzenia');
    
    // Per-sitting data
    if (document.getElementById('etlTranscripts')?.checked) {
        config.modules.push('wypowiedzi');
    }
    if (document.getElementById('etlVotings')?.checked) {
        config.modules.push('glosowania');
    }
    if (document.getElementById('etlVotes')?.checked) {
        config.modules.push('glosy');
    }
    
    // Per-term data
    if (document.getElementById('etlInterpellations')?.checked) {
        config.modules.push('interpelacje');
    }
    if (document.getElementById('etlBills')?.checked) {
        config.modules.push('projekty_ustaw');
    }
    if (document.getElementById('etlDisclosures')?.checked) {
        config.modules.push('oswiadczenia');
    }
    
    // Committee data
    if (document.getElementById('etlCommitteeSittings')?.checked || 
        document.getElementById('etlCommitteeStatements')?.checked) {
        config.modules.push('komisje');
        
        if (document.getElementById('etlCommitteeSittings')?.checked) {
            config.modules.push('komisje_posiedzenia');
        }
        if (document.getElementById('etlCommitteeStatements')?.checked) {
            config.modules.push('komisje_wypowiedzi');
        }
        
        // Committee selection
        const committeeSelect = document.getElementById('etlCommitteeSelect');
        const selected = Array.from(committeeSelect?.selectedOptions || []).map(o => o.value);
        config.selectedCommittees = selected.includes('all') ? ['all'] : selected;
    }
    
    return config;
}

// Helper: Get posiedzenia for config
export async function getPosiedzenia(config) {
    // This will be populated by fetcher
    // For now, return mock range
    const range = [];
    for (let i = 0; i < config.rangeCount; i++) {
        range.push({ num: 52 - i });
    }
    return range;
}
