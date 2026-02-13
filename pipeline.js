// Pipeline v2.0 - Complete ETL with Incremental Cache
// UI → Fetcher → Normalizer → Database

import { runFetcher, safeFetch, fetchCounter, fetchAbortController } from './fetcher/fetcher.js';
import { runNormalizer } from './normalizer/normalizer.js';
import { db2 } from './modules/database-v2.js';
import { applyRodo } from './modules/rodo.js';

function checkAbort() {
    if (fetchAbortController?.signal?.aborted) {
        throw new DOMException('Pipeline aborted', 'AbortError');
    }
}

// Skip per-term modules that already have data in DB for this kadencja
function filterCachedModules(db, config, onLog) {
    if (!db.database) return;

    const k = parseInt(config.kadencja);
    if (isNaN(k)) return;

    const year = config.ustawyYear || new Date().getFullYear();

    // Module → SQL cache check (per kadencja where possible)
    function countQuery(sql, params) {
        try {
            const stmt = db.database.prepare(sql);
            stmt.bind(params);
            let val = 0;
            if (stmt.step()) val = stmt.get()[0] || 0;
            stmt.free();
            return val;
        } catch { return 0; }
    }

    const checks = {
        interpelacje:        ['SELECT COUNT(*) FROM interpelacje WHERE id_interpelacji LIKE ?', [k + '_%']],
        zapytania:           ['SELECT COUNT(*) FROM zapytania WHERE term = ?', [k]],
        projekty_ustaw:      ['SELECT COUNT(*) FROM projekty_ustaw WHERE kadencja = ?', [k]],
        komisje:             ['SELECT COUNT(*) FROM komisje WHERE kadencja = ?', [k]],
        komisje_posiedzenia: ['SELECT COUNT(*) FROM komisje_posiedzenia kp JOIN komisje k ON kp.id_komisji = k.id_komisji WHERE k.kadencja = ?', [k]],
        komisje_wypowiedzi:  ['SELECT COUNT(*) FROM komisje_wypowiedzi kw JOIN komisje_posiedzenia kp ON kw.id_posiedzenia_komisji = kp.id_posiedzenia_komisji JOIN komisje k ON kp.id_komisji = k.id_komisji WHERE k.kadencja = ?', [k]],
        ustawy:              ['SELECT COUNT(*) FROM ustawy WHERE year = ?', [year]],
        oswiadczenia:        ['SELECT COUNT(*) FROM oswiadczenia_majatkowe om JOIN poslowie p ON om.id_osoby = p.id_osoby WHERE p.kadencja = ?', [k]]
    };

    // Run cache checks for modules in config
    const cached = {};
    for (const [mod, [sql, params]] of Object.entries(checks)) {
        if (!config.modules.includes(mod)) continue;
        cached[mod] = countQuery(sql, params);
    }

    const skipped = [];
    for (const [mod, count] of Object.entries(cached)) {
        if (count === 0) continue;

        // Respect dependency chains: don't skip if downstream module needs fresh data
        if (mod === 'komisje' && (
            (config.modules.includes('komisje_posiedzenia') && !cached.komisje_posiedzenia) ||
            (config.modules.includes('komisje_wypowiedzi') && !cached.komisje_wypowiedzi)
        )) continue;
        if (mod === 'komisje_posiedzenia' &&
            config.modules.includes('komisje_wypowiedzi') && !cached.komisje_wypowiedzi
        ) continue;

        config.modules = config.modules.filter(m => m !== mod);
        skipped.push(`${mod} (${count})`);
    }

    if (skipped.length > 0) {
        onLog(`📦 Cache: ${skipped.join(', ')} — pomijam pobieranie`);
    }
}

export async function runPipeline(config, callbacks = {}) {
    console.log('🚀 Pipeline v2.0 - Starting ETL');

    const {
        onProgress = () => {},
        onLog = () => {},
        onError = () => {},
        onComplete = () => {}
    } = callbacks;

    // Multi-kadencja: iteruj po kadencjach, merguj wyniki
    if (config.kadencje && config.kadencje.length > 1) {
        return runMultiTermPipeline(config, callbacks);
    }

    let totalRecords = 0;
    fetchCounter.count = 0;
    fetchCounter.errors = 0;

    try {
        // Step 1: Initialize database (0-5%)
        onLog('📦 Initializing database...');
        onProgress(5, 'Inicjalizacja bazy');

        if (!db2.database) {
            await db2.init();
        }

        // Log RODO filter status
        if (config.rodoFilter) {
            onLog('🔒 RODO Filter: ACTIVE (removing sensitive data)');
        } else {
            onLog('⚠️ RODO Filter: DISABLED (all data included)');
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

        // SMART AUTO MODE - determine best fetch strategy
        let fetchMode = config.fetchMode || 'auto';
        let sittingsToFetch = [];

        if (fetchMode === 'auto') {
            // Zawsze używaj zakresu wybranego przez użytkownika (rangeMode/rangeCount)
            // Ignorujemy lastPosiedzenie — użytkownik decyduje co chce pobrać
            onLog('📌 Fetching user-selected range');
            sittingsToFetch = filterNewSittings(allSittings, 0, config);
        } else if (fetchMode === 'full') {
            onLog('🔄 Force Full mode - ignoring cache, fetching all');
            sittingsToFetch = filterNewSittings(allSittings, 0, config);
        } else {
            // Manual range mode
            sittingsToFetch = filterNewSittings(allSittings, lastPosiedzenie, config);
        }

        if (sittingsToFetch.length === 0) {
            onLog('✅ All data up to date!');
            onProgress(100, 'Up to date');
            onComplete({ success: true, stats: {}, upToDate: true });
            return { success: true, upToDate: true };
        }

        onLog(`📌 Found ${sittingsToFetch.length} new sittings to fetch`);
        onLog(`📌 Range: ${Math.min(...sittingsToFetch)} - ${Math.max(...sittingsToFetch)}`);

        // Step 3.5: Skip per-term modules already cached in DB
        if (config.fetchMode !== 'full' && config.kadencja) {
            filterCachedModules(db2, config, onLog);
        }

        // Step 3.6: Load dependency data from DB if parent modules were skipped (cached)
        let cachedKomisje = null;
        let cachedKomisjePosiedzenia = null;
        const m = config.modules || [];
        if (!m.includes('komisje') && (m.includes('komisje_posiedzenia') || m.includes('komisje_wypowiedzi'))) {
            try {
                const rows = db2.database.exec('SELECT id_komisji AS code, nazwa AS name FROM komisje');
                if (rows.length > 0) {
                    cachedKomisje = rows[0].values.map(r => ({ code: r[0], name: r[1] }));
                    onLog(`📌 Loaded ${cachedKomisje.length} komisje from cache for dependency`);
                }
            } catch { /* ignore */ }
        }
        if (!m.includes('komisje_posiedzenia') && m.includes('komisje_wypowiedzi')) {
            try {
                const rows = db2.database.exec('SELECT id_posiedzenia_komisji, id_komisji, numer, data FROM komisje_posiedzenia');
                if (rows.length > 0) {
                    cachedKomisjePosiedzenia = rows[0].values.map(r => ({
                        id: r[0], committeeCode: r[1], num: r[2], date: r[3]
                    }));
                    onLog(`📌 Loaded ${cachedKomisjePosiedzenia.length} komisje_posiedzenia from cache for dependency`);
                }
            } catch { /* ignore */ }
        }

        // Step 4: Fetch all data using runFetcher (10-85%)
        onLog('⬇️ Fetching data from API...');
        onProgress(10, 'Fetching data from API');

        // Pass sittings range to config + cached dependencies
        const fetchConfig = {
            ...config,
            sittingsToFetch: sittingsToFetch,
            _cachedKomisje: cachedKomisje,
            _cachedKomisjePosiedzenia: cachedKomisjePosiedzenia
        };

        // Call fetcher with progress callback mapped to 10-85% range
        const raw = await runFetcher(fetchConfig, (fetchPct, label) => {
            const mapped = 10 + Math.round(fetchPct * 0.75); // 10% + (0-100% → 0-75%) = 10-85%
            const errInfo = fetchCounter.errors > 0 ? ` (${fetchCounter.errors} err)` : '';
            onProgress(Math.min(mapped, 85), `Pobieranie: ${label}`, {
                module: label,
                links: fetchCounter.count,
                linksLabel: `${fetchCounter.count} zapytań API${errInfo}`
            });
        });

        checkAbort();

        // Apply RODO filter if enabled
        let processedRaw = raw;

        if (config.rodoFilter) {
            onLog('🛡️ RODO: removing sensitive fields...');
            processedRaw = applyRodo(raw);
        } else {
            onLog('⚠️ RODO disabled — sensitive fields included');
        }

        // Count fetched records
        totalRecords = Object.values(processedRaw).reduce((sum, arr) =>
            sum + (Array.isArray(arr) ? arr.length : 0), 0
        );

        onLog(`📥 Fetched ${totalRecords} raw records from API (${fetchCounter.count} requests)`);
        onProgress(85, 'Pobieranie zakończone', { module: `${totalRecords} rekordów`, links: fetchCounter.count, linksLabel: `${fetchCounter.count} zapytań API` });

        checkAbort();

        // Step 5: Normalize and save (85-92%)
        onLog('🧹 Normalizing and saving to database...');
        onProgress(87, 'Normalizacja danych', { module: 'Zapis do bazy...' });

        const stats = await runNormalizer(db2, processedRaw, config);
        const savedTotal = Object.values(stats).reduce((a, b) => a + b, 0);

        onLog(`💾 Saved ${savedTotal} records to database`);
        onProgress(92, 'Normalizacja zakończona', { module: `Zapisano ${savedTotal} rekordów` });

        // Step 6: Update cache metadata (92-98%)
        onLog('📝 Updating cache metadata...');
        onProgress(95, 'Aktualizacja metadanych');

        // Update last_posiedzenie based on actual data
        if (processedRaw.posiedzenia && processedRaw.posiedzenia.length > 0) {
            const maxSitting = Math.max(...processedRaw.posiedzenia.map(p =>
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

        // Count session days from posiedzenia in range
        let sessionDays = 0;
        if (processedRaw.posiedzenia && Array.isArray(processedRaw.posiedzenia)) {
            for (const p of processedRaw.posiedzenia) {
                if (sittingsToFetch.includes(p.number) && Array.isArray(p.dates)) {
                    sessionDays += p.dates.length;
                }
            }
        }

        // Count individual votes from glosowania totalVoted field
        let individualVotes = 0;
        if (Array.isArray(processedRaw.glosowania)) {
            for (const g of processedRaw.glosowania) {
                individualVotes += g.totalVoted || 0;
            }
        }

        const result = {
            success: true,
            stats,
            fetchedRecords: totalRecords,
            savedRecords: Object.values(stats).reduce((a, b) => a + b, 0),
            newSittings: sittingsToFetch.length,
            sessionDays,
            individualVotes,
            timestamp: new Date().toISOString()
        };

        onComplete(result);
        return result;

    } catch (error) {
        // Re-throw AbortError so caller can handle cancellation
        if (error.name === 'AbortError') throw error;

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

// ===== MULTI-TERM PIPELINE =====

async function runMultiTermPipeline(config, callbacks) {
    const { onProgress = () => {}, onLog = () => {}, onError = () => {}, onComplete = () => {} } = callbacks;
    const kadencje = config.kadencje;

    onLog(`📦 Tryb "Wszystkie kadencje" — ${kadencje.length} kadencji: ${kadencje.join(', ')}`);

    const mergedStats = {};
    let totalFetched = 0;
    let totalSaved = 0;
    let totalSessionDays = 0;
    let totalIndividualVotes = 0;

    for (let i = 0; i < kadencje.length; i++) {
        const k = kadencje[i];
        const pctBase = Math.round((i / kadencje.length) * 100);
        const pctNext = Math.round(((i + 1) / kadencje.length) * 100);

        onLog(`\n━━━ Kadencja ${k} (${i + 1}/${kadencje.length}) ━━━`);

        const subConfig = { ...config, kadencja: k, kadencje: undefined };
        const subResult = await runPipeline(subConfig, {
            onProgress: (pct, label) => {
                const mapped = pctBase + Math.round((pct / 100) * (pctNext - pctBase));
                onProgress(mapped, `[${k}] ${label}`);
            },
            onLog: (msg) => onLog(`  [${k}] ${msg}`),
            onError,
            onComplete: () => {} // nie wywołuj onComplete dla pod-kadencji
        });

        if (subResult.success && subResult.stats) {
            for (const [key, val] of Object.entries(subResult.stats)) {
                mergedStats[key] = (mergedStats[key] || 0) + val;
            }
            totalFetched += subResult.fetchedRecords || 0;
            totalSaved += subResult.savedRecords || 0;
            totalSessionDays += subResult.sessionDays || 0;
            totalIndividualVotes += subResult.individualVotes || 0;
        } else if (!subResult.success) {
            onLog(`⚠️ Kadencja ${k} zakończona z błędem: ${subResult.error}`);
        }
    }

    onProgress(100, 'Complete');
    onLog(`\n✅ Wszystkie kadencje pobrane!`);
    onLog(`📊 Łącznie: ${totalFetched} pobranych, ${totalSaved} zapisanych`);

    const result = {
        success: true,
        stats: mergedStats,
        fetchedRecords: totalFetched,
        savedRecords: totalSaved,
        sessionDays: totalSessionDays,
        individualVotes: totalIndividualVotes,
        kadencje,
        timestamp: new Date().toISOString()
    };

    onComplete(result);
    return result;
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

    // Senat: brak REST API — zwróć syntetyczny zakres
    // Faktyczne filtrowanie odbywa się w senat fetcherze
    if (typ === 'senat') {
        return Array.from({ length: 100 }, (_, i) => i + 1);
    }

    const base = 'sejm';

    // API endpoint z term
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/proceedings`;
    
    try {
        const allData = await safeFetch(url);
        
        // Endpoint zwraca dane już przefiltrowane dla kadencji
        const sittings = Array.isArray(allData) ? allData : [];
        
        return sittings.map(s => s.num || s.id || s.number).filter(Boolean);
    } catch (error) {
        console.warn('[Pipeline] Failed to fetch sittings list:', error.message);
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
    const termValue = document.getElementById('etlTermSelect')?.value;
    const isAllTerms = termValue === 'all';

    const config = {
        typ: document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm',
        kadencja: isAllTerms ? null : (parseInt(termValue) || 10),
        rodoFilter: document.getElementById('etlRodoFilter')?.checked ?? true,
        fetchMode: 'auto',
        rangeMode: 'custom',
        rangeFrom: parseInt(document.getElementById('etlRangeFrom')?.value) || 1,
        rangeTo: parseInt(document.getElementById('etlRangeTo')?.value) || 3,
        modules: ['poslowie', 'posiedzenia']
    };

    // "Wszystkie kadencje" — lista kadencji do pobrania, pełny zakres
    if (isAllTerms) {
        const selectEl = document.getElementById('etlTermSelect');
        config.kadencje = [...selectEl.options]
            .map(o => parseInt(o.value))
            .filter(n => !isNaN(n));
        config.kadencja = config.kadencje[0] || 10;
        config.rangeFrom = 1;
        config.rangeTo = 999; // pełny zakres — pipeline sam ograniczy do istniejących
    }
    
    // Collect selected data modules
    if (document.getElementById('etlTranscripts')?.checked) config.modules.push('wypowiedzi');
    if (document.getElementById('etlVotings')?.checked) config.modules.push('glosowania');
    if (document.getElementById('etlVotes')?.checked) config.modules.push('glosy');
    if (document.getElementById('etlInterpellations')?.checked) config.modules.push('interpelacje');
    if (document.getElementById('etlWrittenQuestions')?.checked) config.modules.push('zapytania');
    if (document.getElementById('etlBills')?.checked) config.modules.push('projekty_ustaw');
    if (document.getElementById('etlLegalActs')?.checked) config.modules.push('ustawy');
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

// ===== VERIFY DATABASE VS API =====

async function fetchApiCount(url, signal) {
    try {
        const res = await fetch(url, { signal });
        if (!res.ok) return -1;
        const data = await res.json();
        return Array.isArray(data) ? data.length : -1;
    } catch (e) { if (e.name === 'AbortError') throw e; return -1; }
}

async function fetchApiCountInRange(url, from, to, signal) {
    try {
        const res = await fetch(url, { signal });
        if (!res.ok) return -1;
        const data = await res.json();
        if (!Array.isArray(data)) return -1;
        return data.filter(item => {
            const num = item.number || item.num || 0;
            return num >= from && num <= to;
        }).length;
    } catch (e) { if (e.name === 'AbortError') throw e; return -1; }
}

async function fetchPaginatedCount(baseUrl, signal) {
    let total = 0, offset = 0;
    try {
        while (true) {
            const res = await fetch(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}limit=500&offset=${offset}`, { signal });
            if (!res.ok) break;
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) break;
            total += data.length;
            if (data.length < 500) break;
            offset += data.length;
        }
    } catch (e) { if (e.name === 'AbortError') throw e; }
    return total;
}

export async function verifyDatabase(db, { signal, onProgress } = {}) {
    console.log('[Verify] Starting database verification...');

    if (onProgress) onProgress(5, 'Odczytywanie konfiguracji bazy');

    // Read config from DB metadata (independent of form)
    let kadencja = 10, typ = 'sejm';
    try {
        const raw = db.getMetadata('last_fetch_config');
        if (raw) {
            const cfg = JSON.parse(raw);
            kadencja = cfg.kadencja || 10;
            typ = cfg.typ || 'sejm';
        }
    } catch { /* defaults */ }

    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const apiBase = `https://api.sejm.gov.pl/${base}/term${kadencja}`;
    const dbStats = db.getStats();
    const results = [];

    // Read fetched modules and range from saved config
    let fetchedModules = ['poslowie', 'posiedzenia'];
    let rangeFrom = 1, rangeTo = 999;
    try {
        const raw = db.getMetadata('last_fetch_config');
        if (raw) {
            const cfg = JSON.parse(raw);
            if (Array.isArray(cfg.modules)) fetchedModules = cfg.modules;
            if (cfg.rangeFrom) rangeFrom = cfg.rangeFrom;
            if (cfg.rangeTo) rangeTo = cfg.rangeTo;
        }
    } catch { /* defaults */ }

    // Define checks — only verify modules that were actually fetched
    const checks = [
        { label: 'Posłowie', table: 'poslowie', url: `${apiBase}/MP`, module: 'poslowie' },
    ];

    // Posiedzenia: compare only within fetched range
    if (fetchedModules.includes('posiedzenia')) {
        checks.push({
            label: 'Posiedzenia', table: 'posiedzenia',
            url: `${apiBase}/proceedings`,
            module: 'posiedzenia',
            filterRange: { from: rangeFrom, to: rangeTo }
        });
    }

    if (fetchedModules.includes('komisje') || fetchedModules.includes('komisje_posiedzenia')) {
        checks.push({ label: 'Komisje', table: 'komisje', url: `${apiBase}/committees`, module: 'komisje' });
    }

    if (fetchedModules.includes('interpelacje')) {
        checks.push({ label: 'Interpelacje', table: 'interpelacje', url: `${apiBase}/interpellations`, paginated: true, module: 'interpelacje' });
    }

    if (fetchedModules.includes('zapytania')) {
        checks.push({ label: 'Zapytania', table: 'zapytania', url: `${apiBase}/writtenQuestions`, paginated: true, module: 'zapytania' });
    }

    if (onProgress) onProgress(15, 'Rozpoczynam sprawdzanie API Sejmu');

    // Run checks sequentially to provide accurate progress updates
    const checkResults = [];
    const total = checks.length;
    
    for (let i = 0; i < checks.length; i++) {
        const chk = checks[i];
        const progress = 15 + Math.floor(((i + 1) / total) * 50);
        
        if (onProgress) {
            onProgress(progress, `Sprawdzam: ${chk.label}`, { module: `${i + 1}/${total}` });
        }
        
        try {
            const dbCount = dbStats[chk.table] || 0;
            let apiCount;
            
            if (chk.paginated) {
                apiCount = await fetchPaginatedCount(chk.url, signal);
            } else {
                const fullCount = await fetchApiCount(chk.url, signal);
                // For posiedzenia: filter API results to fetched range
                if (chk.filterRange && fullCount >= 0) {
                    apiCount = await fetchApiCountInRange(chk.url, chk.filterRange.from, chk.filterRange.to, signal);
                } else {
                    apiCount = fullCount;
                }
            }
            
            checkResults.push({ ...chk, dbCount, apiCount });
        } catch (error) {
            console.warn(`[Verify] Error checking ${chk.label}:`, error);
            checkResults.push({ ...chk, dbCount: dbStats[chk.table] || 0, apiCount: -1 });
        }
    }

    if (onProgress) onProgress(70, 'Analizuję wyniki sprawdzenia');

    for (const chk of checkResults) {
        if (chk.apiCount < 0) {
            results.push({ label: chk.label, table: chk.table, dbCount: chk.dbCount, apiCount: '?', status: 'error' });
        } else if (chk.apiCount > chk.dbCount) {
            results.push({ label: chk.label, table: chk.table, dbCount: chk.dbCount, apiCount: chk.apiCount, status: 'new', diff: chk.apiCount - chk.dbCount });
        } else {
            results.push({ label: chk.label, table: chk.table, dbCount: chk.dbCount, apiCount: chk.apiCount, status: 'ok' });
        }
    }

    // Additional tables with data (show count but no API comparison)
    const extraTables = [
        { label: 'Głosowania', table: 'glosowania' },
        { label: 'Głosy', table: 'glosy' },
        { label: 'Wypowiedzi', table: 'wypowiedzi' },
        { label: 'Projekty ustaw', table: 'projekty_ustaw' },
        { label: 'Posiedzenia komisji', table: 'komisje_posiedzenia' },
    ];
    for (const ext of extraTables) {
        const dbCount = dbStats[ext.table] || 0;
        if (dbCount > 0) {
            results.push({ label: ext.label, table: ext.table, dbCount, apiCount: '-', status: 'info' });
        }
    }

    // Data freshness
    const lastUpdate = getLastUpdate(db);
    let freshness = null;
    if (lastUpdate && lastUpdate !== 'Never') {
        const days = Math.floor((Date.now() - new Date(lastUpdate)) / (1000 * 60 * 60 * 24));
        freshness = { lastUpdate, days };
    }

    if (onProgress) onProgress(100, 'Sprawdzanie zakończone');

    console.log('[Verify] Complete:', results);
    return { kadencja, typ, results, freshness, hasNewRecords: results.some(r => r.status === 'new') };
}

/**
 * Sprawdza czy zmieniły się wartości pól w API (trzecia lampka)
 * Porównuje losowe rekordy z bazy z aktualnymi danymi z API
 */
export async function detectDataChanges(db, { signal } = {}) {
    console.log('[Detect Changes] Starting data integrity check...');

    // Read config from DB
    let kadencja = 10, typ = 'sejm';
    try {
        const raw = db.getMetadata('last_fetch_config');
        if (raw) {
            const cfg = JSON.parse(raw);
            kadencja = cfg.kadencja || 10;
            typ = cfg.typ || 'sejm';
        }
    } catch { /* defaults */ }

    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const apiBase = `https://api.sejm.gov.pl/${base}/term${kadencja}`;
    const changes = [];

    try {
        // Check posłowie - porównaj losowych 3 posłów
        const poslowieInDb = db.database.exec('SELECT id_osoby, imie, nazwisko, klub FROM poslowie ORDER BY RANDOM() LIMIT 3');
        if (poslowieInDb.length > 0 && poslowieInDb[0].values.length > 0) {
            const apiPoslowie = await safeFetch(`${apiBase}/MP`);
            for (const [id, imie, nazwisko, klubDb] of poslowieInDb[0].values) {
                const apiPosel = apiPoslowie.find(p => p.id === id);
                if (apiPosel) {
                    const klubApi = apiPosel.club || '';
                    if (klubDb !== klubApi) {
                        changes.push({ table: 'poslowie', id, field: 'klub', oldValue: klubDb, newValue: klubApi });
                    }
                }
            }
        }

        // Check posiedzenia - sprawdź ostatnie 2
        const posiedzeniaInDb = db.database.exec('SELECT numer, data_start, data_koniec FROM posiedzenia ORDER BY numer DESC LIMIT 2');
        if (posiedzeniaInDb.length > 0 && posiedzeniaInDb[0].values.length > 0) {
            const apiProceedings = await safeFetch(`${apiBase}/proceedings`);
            for (const [numer, dataStartDb, dataKoniecDb] of posiedzeniaInDb[0].values) {
                const apiProc = apiProceedings.find(p => p.num === numer || p.number === numer);
                if (apiProc && apiProc.dates && apiProc.dates.length > 0) {
                    const dataStartApi = apiProc.dates[0];
                    const dataKoniecApi = apiProc.dates[apiProc.dates.length - 1];
                    if (dataStartDb !== dataStartApi) {
                        changes.push({ table: 'posiedzenia', id: numer, field: 'data_start', oldValue: dataStartDb, newValue: dataStartApi });
                    }
                    if (dataKoniecDb !== dataKoniecApi) {
                        changes.push({ table: 'posiedzenia', id: numer, field: 'data_koniec', oldValue: dataKoniecDb, newValue: dataKoniecApi });
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Detect Changes] Error:', error);
        return { hasChanges: false, changes: [], error: error.message };
    }

    console.log('[Detect Changes] Complete:', changes);
    return { hasChanges: changes.length > 0, changes };
}

/**
 * Uproszczona weryfikacja dla tła (bez progress callbacków)
 */
export async function backgroundVerify(db) {
    try {
        const result = await verifyDatabase(db, {});
        return result;
    } catch (error) {
        console.error('[Background Verify] Error:', error);
        return null;
    }
}

// ===== CACHE STATUS =====

export function getCacheStatus(db) {
    if (!db || !db.database) {
        return {
            initialized: false,
            message: 'Baza nie została zainicjalizowana'
        };
    }
    
    try {
        const stats = db.getStats();
        const lastPosiedzenie = getLastPosiedzenie(db);
        const lastUpdate = getLastUpdate(db);
        
        const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
        
        return {
            initialized: true,
            lastPosiedzenie,
            lastUpdate,
            totalRecords,
            stats
        };
    } catch (error) {
        return {
            initialized: true,
            error: error.message
        };
    }
}
