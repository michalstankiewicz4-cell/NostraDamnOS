// Database Import/Export Buttons
// Handles saving and loading SQLite database

import { db2 } from './database-v2.js';
import ToastModule from './toast.js';
import { refreshChartsManager } from './charts-manager.js';
import { refreshPredictions } from './predictions.js';

// Tables belonging to each data source
const SEJM_TABLES = [
    'poslowie', 'posiedzenia', 'wypowiedzi', 'glosowania', 'glosy',
    'interpelacje', 'projekty_ustaw', 'komisje', 'komisje_posiedzenia',
    'komisje_wypowiedzi', 'oswiadczenia_majatkowe', 'zapytania',
    'zapytania_odpowiedzi', 'ustawy', 'metadata'
];
const RSS_TABLES = ['rss_news'];

/**
 * Export only selected tables into a standalone SQLite .db file.
 * Creates a temporary in-memory database, copies schema + data, exports it.
 */
function exportFilteredDb(tableList) {
    const tmpDb = new db2.sql.Database();

    try {
        for (const table of tableList) {
            try {
                // Copy CREATE TABLE
                const res = db2.database.exec(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", [table]
                );
                if (!res.length || !res[0].values[0][0]) continue;
                tmpDb.run(res[0].values[0][0]);

                // Copy CREATE INDEX
                const idxRes = db2.database.exec(
                    "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL", [table]
                );
                if (idxRes.length) {
                    for (const [sql] of idxRes[0].values) {
                        if (sql) tmpDb.run(sql);
                    }
                }

                // Copy data
                const rows = db2.database.exec(`SELECT * FROM "${table}"`);
                if (!rows.length || !rows[0].values.length) continue;

                const cols = rows[0].columns;
                const placeholders = cols.map(() => '?').join(',');
                tmpDb.run('BEGIN');
                const stmt = tmpDb.prepare(
                    `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`
                );
                for (const row of rows[0].values) {
                    stmt.run(row);
                }
                stmt.free();
                tmpDb.run('COMMIT');
            } catch (e) {
                console.warn(`[Export] Table ${table}:`, e.message);
                try { tmpDb.run('ROLLBACK'); } catch { /* ignore */ }
            }
        }

        return tmpDb.export();
    } finally {
        tmpDb.close();
    }
}

// === Import progress overlay ===

function showImportOverlay(msg) {
    let overlay = document.getElementById('importProgressOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'importProgressOverlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:9999',
            'background:rgba(0,0,0,0.65)',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'gap:18px', 'color:#fff', 'font-family:monospace'
        ].join(';');
        overlay.innerHTML = `
            <div class="chart-spinner-ring" style="width:52px;height:52px;border-width:4px;"></div>
            <div id="importProgressMsg" style="font-size:0.95rem;max-width:75%;text-align:center;line-height:1.5;"></div>
        `;
        document.body.appendChild(overlay);
    }
    const el = overlay.querySelector('#importProgressMsg');
    if (el) el.textContent = msg;
}

function updateImportOverlay(msg) {
    const el = document.getElementById('importProgressMsg');
    if (el) el.textContent = msg;
}

function hideImportOverlay() {
    document.getElementById('importProgressOverlay')?.remove();
}

export function initDbButtons() {
    console.log('[DB Buttons] Initializing import/export buttons...');

    let importInProgress = false;

    const importBtn = document.getElementById('importDbBtn');
    const exportBtn = document.getElementById('exportDbBtn');
    
    if (!importBtn || !exportBtn) {
        console.error('[DB Buttons] Buttons not found in DOM');
        return;
    }
    
    // Buttons stay hidden - visibility controlled by uiVisibility settings
    
    // Helper: save file — dialog otwierany NATYCHMIAST (user gesture świeże),
    // ciężka praca (dataFn) uruchamiana dopiero po otwarciu uchwytu pliku.
    // dataFn: () => Uint8Array  — generator danych wywoływany po dialogu
    // Zwraca: { saved, desktop, cancelled, sizeKB }
    async function saveBlob(filename, fileTypes, dataFn) {
        if (window.showSaveFilePicker) {
            try {
                // ★ Dialog PIERWSZY — user gesture nie wygasło
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    startIn: 'desktop',
                    types: fileTypes
                });
                // Dopiero teraz ciężka praca (baza już otwarta, nie potrzeba gesture)
                const data = dataFn();
                const sizeKB = (data.byteLength / 1024).toFixed(2);
                const writable = await handle.createWritable();
                await writable.write(data);
                await writable.close();
                return { saved: true, desktop: true, sizeKB };
            } catch (err) {
                if (err.name === 'AbortError') return { saved: false, cancelled: true };
                console.warn('[Export] File System Access API failed, falling back:', err);
            }
        }
        // Fallback (Firefox / brak API): generuj dane i pobierz tradycyjnie
        const data = dataFn();
        const sizeKB = (data.byteLength / 1024).toFixed(2);
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        return { saved: true, desktop: false, sizeKB };
    }

    // Export: Sejm database (.db SQLite)
    async function exportSejmDb() {
        if (!db2.database) {
            ToastModule.error('Baza danych nie jest zainicjowana.\n\nPobierz najpierw dane z API.');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `nostradamnos-sejm-${timestamp}.db`;

        const result = await saveBlob(filename, [{
            description: 'SQLite Database',
            accept: { 'application/x-sqlite3': ['.db'] }
        }], () => exportFilteredDb(SEJM_TABLES));

        if (result.cancelled) return;

        console.log(`[DB Export] ✅ Sejm database exported: ${filename} (${result.sizeKB} KB)`);

        if (result.desktop) {
            ToastModule.success(
                `📁 ${filename}\n📊 Rozmiar: ${result.sizeKB} KB`,
                { title: '🏛️ Baza Sejmu wyeksportowana na Pulpit', duration: 6000 }
            );
        } else {
            ToastModule.success(
                `📁 ${filename}\n📊 Rozmiar: ${result.sizeKB} KB\n\n💡 Plik zapisany w domyślnym folderze pobierania`,
                { title: '🏛️ Baza Sejmu wyeksportowana', duration: 6000 }
            );
        }
    }

    // Export: RSS news (.db SQLite)
    async function exportRssNews() {
        if (!db2.database) {
            ToastModule.error('Baza danych nie jest zainicjowana.\n\nPobierz najpierw dane RSS.');
            return;
        }

        // Check if there's any RSS data
        let count = 0;
        try {
            const res = db2.database.exec('SELECT COUNT(*) FROM rss_news');
            if (res.length && res[0].values.length > 0) count = res[0].values[0][0];
        } catch (e) {
            console.error('[RSS Export] Query error:', e);
        }

        if (count === 0) {
            ToastModule.warning('Brak newsów RSS w bazie.\n\nNajpierw pobierz dane RSS.', { title: '📰 RSS Export' });
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `nostradamnos-rss-${timestamp}.db`;

        const result = await saveBlob(filename, [{
            description: 'SQLite Database',
            accept: { 'application/x-sqlite3': ['.db'] }
        }], () => exportFilteredDb(RSS_TABLES));

        if (result.cancelled) return;

        console.log(`[RSS Export] ✅ RSS database exported: ${filename} (${result.sizeKB} KB, ${count} articles)`);

        if (result.desktop) {
            ToastModule.success(
                `📁 ${filename}\n📰 Artykułów: ${count}\n📊 Rozmiar: ${result.sizeKB} KB`,
                { title: '📰 Baza RSS wyeksportowana na Pulpit', duration: 6000 }
            );
        } else {
            ToastModule.success(
                `📁 ${filename}\n📰 Artykułów: ${count}\n📊 Rozmiar: ${result.sizeKB} KB\n\n💡 Plik zapisany w domyślnym folderze pobierania`,
                { title: '📰 Baza RSS wyeksportowana', duration: 6000 }
            );
        }
    }

    // Export button
    exportBtn.addEventListener('click', async () => {
        console.log('🚀 [Zadanie] Export bazy rozpoczęty');
        
        // Sprawdź czy jakakolwiek operacja jest w toku
        if (window.isAnyOperationRunning && window.isAnyOperationRunning()) {
            ToastModule.info('Poczekaj na zakończenie operacji...', { duration: 2000 });
            return;
        }
        
        try {
            exportBtn.style.transform = 'scale(0.9)';
            setTimeout(() => exportBtn.style.transform = 'scale(1)', 200);

            // Sprawdź przełącznik sejm/rss
            const selectedInst = document.querySelector('input[name="etlInst"]:checked')?.value || 'sejm';

            if (selectedInst === 'rss') {
                console.log('[Export] Mode: RSS news → SQLite .db');
                await exportRssNews();
            } else {
                console.log('[Export] Mode: Sejm database → SQLite .db');
                await exportSejmDb();
            }

            console.log('✅ [Zadanie] Export bazy zakończony');

        } catch (error) {
            console.error('[DB Export] Error:', error);
            ToastModule.error('Błąd podczas eksportu:\n\n' + error.message);
        }
    });
    
    // Import button
    importBtn.addEventListener('click', async () => {
        // Blokada wielokrotnego klikania
        if (importInProgress) {
            ToastModule.info('Import już trwa, poczekaj…', { duration: 2000 });
            return;
        }
        // Sprawdź czy jakakolwiek operacja jest w toku
        if (window.isAnyOperationRunning && window.isAnyOperationRunning()) {
            ToastModule.info('Poczekaj na zakończenie operacji...', { duration: 2000 });
            return;
        }
        
        try {
            importBtn.style.transform = 'scale(0.9)';
            setTimeout(() => importBtn.style.transform = 'scale(1)', 200);
            
            console.log('[DB Import] Opening file picker...');
            
            // Try to use File System Access API (modern browsers)
            if (window.showOpenFilePicker) {
                try {
                    const [handle] = await window.showOpenFilePicker({
                        startIn: 'desktop',
                        types: [{
                            description: 'SQLite Database',
                            accept: { 'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'] }
                        }],
                        multiple: false
                    });
                    
                    const file = await handle.getFile();
                    console.log(`[DB Import] Loading file from Desktop: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
                    
                    await loadDatabaseFromFile(file);
                    return;
                    
                } catch (err) {
                    if (err.name === 'AbortError') {
                        console.log('[DB Import] User cancelled file picker');
                        return;
                    }
                    console.warn('[DB Import] File System Access API failed, falling back to input:', err);
                }
            }
            
            // Fallback: traditional file input (older browsers)
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.db,.sqlite,.sqlite3';
            input.style.display = 'none';
            
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    console.log('[DB Import] No file selected');
                    return;
                }
                
                console.log(`[DB Import] Loading file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
                await loadDatabaseFromFile(file);
                
                // Cleanup
                document.body.removeChild(input);
            });
            
            document.body.appendChild(input);
            input.click();
            
        } catch (error) {
            console.error('[DB Import] Error:', error);
            ToastModule.error('Błąd podczas importu:\n\n' + error.message);
        }
    });
    
    /**
     * Merge selected tables from an imported file into the current database.
     * Async: czyta wiersze przez stmt.step() (bez ładowania wszystkiego naraz),
     * yields do event loop co 500 wierszy żeby przeglądarka nie zawieszała UI.
     */
    async function importTablesFromFile(srcDb, tablesToImport, onProgress) {
        // Ensure the main database has the full schema
        if (!db2.database) {
            db2.database = new db2.sql.Database();
            db2.createSchema();
        }

        // Get tables that actually exist in the source file
        const srcTablesRes = srcDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
        const srcTableNames = srcTablesRes.length ? srcTablesRes[0].values.map(v => v[0]) : [];

        const imported = {};
        const CHUNK = 500; // wierszy między yield

        for (const table of tablesToImport) {
            if (!srcTableNames.includes(table)) continue;
            if (onProgress) onProgress(table, 0);

            try {
                db2.database.run(`DELETE FROM "${table}"`);

                // Pobierz kolumny przez PRAGMA zamiast ładować cały zbiór
                const colsRes = srcDb.exec(`PRAGMA table_info("${table}")`);
                if (!colsRes.length) { imported[table] = 0; continue; }
                const cols = colsRes[0].values.map(c => c[1]);
                const placeholders = cols.map(() => '?').join(',');

                const srcStmt = srcDb.prepare(`SELECT * FROM "${table}"`);
                const insStmt = db2.database.prepare(
                    `INSERT OR REPLACE INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`
                );

                let count = 0;
                db2.database.run('BEGIN');
                while (srcStmt.step()) {
                    insStmt.run(srcStmt.get());
                    count++;
                    if (count % CHUNK === 0) {
                        db2.database.run('COMMIT');
                        await new Promise(r => setTimeout(r, 0)); // yield — przeglądarka oddycha
                        db2.database.run('BEGIN');
                        if (onProgress) onProgress(table, count);
                    }
                }
                db2.database.run('COMMIT');
                srcStmt.free();
                insStmt.free();
                imported[table] = count;
            } catch (e) {
                console.warn(`[Import] Table ${table}:`, e.message);
                try { db2.database.run('ROLLBACK'); } catch { /* ignore */ }
                imported[table] = 0;
            }
        }

        return imported;
    }

    // Helper function to load database from file
    async function loadDatabaseFromFile(file) {
        console.log('🚀 [Zadanie] Import bazy rozpoczęty');
        importInProgress = true;
        showImportOverlay('Wczytywanie pliku…');

        try {
            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Initialize sql.js if needed
            if (!window.initSqlJs) {
                throw new Error('sql.js not loaded');
            }

            updateImportOverlay('Inicjalizacja sql.js…');
            if (!db2.sql) {
                db2.sql = await window.initSqlJs({
                    locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
                });
            }

            // Open imported file as a temporary (source) database
            updateImportOverlay('Otwieranie pliku bazy…');
            const srcDb = new db2.sql.Database(uint8Array);

            try {
                // Ensure main database exists (create if first time)
                if (!db2.database) {
                    db2.database = new db2.sql.Database();
                    await db2.createSchema();
                }

                // Auto-detect which tables exist in the imported file
                const srcTablesRes = srcDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
                const srcTableNames = srcTablesRes.length ? srcTablesRes[0].values.map(v => v[0]) : [];

                const hasSejm = SEJM_TABLES.some(t => srcTableNames.includes(t));
                const hasRss  = RSS_TABLES.some(t => srcTableNames.includes(t));

                if (!hasSejm && !hasRss) {
                    ToastModule.warning(
                        `Plik "${file.name}" nie zawiera rozpoznanych tabel Sejmu ani RSS.\n\nUpewnij się, że importujesz plik wyeksportowany z NostraDamnOS.`,
                        { title: '⚠️ Nieznany format bazy', duration: 8000 }
                    );
                    return;
                }

                // Import all recognized table groups found in the file
                const allImported = {};

                if (hasSejm) {
                    localStorage.removeItem('nostradamnos_lastFetchConfig');
                    localStorage.removeItem('nostradamnos_lastFetch');
                    const sejmImported = await importTablesFromFile(srcDb, SEJM_TABLES, (table, count) => {
                        updateImportOverlay(`Sejm › ${table}${count ? `  (${count.toLocaleString('pl-PL')} wierszy…)` : ''}`);
                    });
                    Object.assign(allImported, sejmImported);
                }

                if (hasRss) {
                    const rssImported = await importTablesFromFile(srcDb, RSS_TABLES, (table, count) => {
                        updateImportOverlay(`RSS › ${table}${count ? `  (${count.toLocaleString('pl-PL')} wierszy…)` : ''}`);
                    });
                    Object.assign(allImported, rssImported);
                }

                // Determine label for toast
                const modeLabel = (hasSejm && hasRss) ? 'Sejm + RSS'
                                : hasSejm             ? 'Sejm'
                                :                       'RSS';
                const icon = (hasSejm && hasRss) ? '🏛️📰'
                           : hasSejm             ? '🏛️'
                           :                       '📰';

                console.log(`[DB Import] ✅ ${modeLabel} tables imported successfully`);
                console.log(`[DB Import] Tables:`, allImported);

                // Build summary
                const summary = Object.entries(allImported)
                    .map(([table, count]) => `${table}: ${count}`)
                    .join('\n');

                ToastModule.success(
                    `📁 ${file.name}\n📊 Rozmiar: ${(file.size / 1024).toFixed(2)} KB\n\n📋 Zaimportowane tabele:\n${summary}`,
                    { title: `${icon} Baza ${modeLabel} zaimportowana`, duration: 8000 }
                );
            } finally {
                srcDb.close();
            }

            // Persist to localStorage so it survives page refresh
            updateImportOverlay('Zapisywanie do pamięci lokalnej…');
            db2.saveToLocalStorage();

            console.log('✅ [Zadanie] Import bazy zakończony');

            // Odśwież panel podsumowania po imporcie
            if (typeof window.updateSummaryTab === 'function') {
                window.updateSummaryTab();
            }

            // Odśwież status lampek
            if (typeof window.updateStatusIndicators === 'function') {
                window.updateStatusIndicators();
            }

            // Ustaw przycisk ETL w tryb verify (baza ma już dane)
            if (typeof window.updateFetchButtonMode === 'function') {
                window.updateFetchButtonMode();
            }

            // Odśwież cache bar
            if (window._updateCacheBar) window._updateCacheBar();

            // Uruchom monitorowanie bazy
            if (typeof window.startDbMonitoring === 'function') {
                window.startDbMonitoring();
            }

            // Odśwież panel zarządzania wykresami (lampki statusu)
            refreshChartsManager();

            // Odśwież predykcje
            try {
                refreshPredictions();
            } catch (e) {
                console.warn('[DB Import] Could not refresh predictions:', e);
            }

        } catch (error) {
            console.error('[DB Import] Error loading database:', error);
            ToastModule.error(
                `Błąd podczas importu:\n\n${error.message}\n\nUpewnij się, że plik jest poprawną bazą SQLite.`
            );
        } finally {
            hideImportOverlay();
            importInProgress = false;
        }
    }
    
    console.log('[DB Buttons] ✅ Import/Export buttons initialized');
}
