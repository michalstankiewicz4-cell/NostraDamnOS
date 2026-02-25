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

export function initDbButtons() {
    console.log('[DB Buttons] Initializing import/export buttons...');
    
    const importBtn = document.getElementById('importDbBtn');
    const exportBtn = document.getElementById('exportDbBtn');
    
    if (!importBtn || !exportBtn) {
        console.error('[DB Buttons] Buttons not found in DOM');
        return;
    }
    
    // Buttons stay hidden - visibility controlled by uiVisibility settings
    
    // Helper: save blob to file (File System Access API with fallback)
    async function saveBlob(blob, filename, fileTypes) {
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    startIn: 'desktop',
                    types: fileTypes
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return { saved: true, desktop: true };
            } catch (err) {
                if (err.name === 'AbortError') return { saved: false, cancelled: true };
                console.warn('[Export] File System Access API failed, falling back:', err);
            }
        }
        // Fallback: traditional download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        return { saved: true, desktop: false };
    }

    // Export: Sejm database (.db SQLite)
    async function exportSejmDb() {
        if (!db2.database) {
            ToastModule.error('Baza danych nie jest zainicjowana.\n\nPobierz najpierw dane z API.');
            return;
        }

        const data = exportFilteredDb(SEJM_TABLES);
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `nostradamnos-sejm-${timestamp}.db`;

        const result = await saveBlob(blob, filename, [{
            description: 'SQLite Database',
            accept: { 'application/x-sqlite3': ['.db'] }
        }]);

        if (result.cancelled) return;

        const sizeKB = (blob.size / 1024).toFixed(2);
        console.log(`[DB Export] ✅ Sejm database exported: ${filename} (${sizeKB} KB)`);

        if (result.desktop) {
            ToastModule.success(
                `📁 ${filename}\n📊 Rozmiar: ${sizeKB} KB`,
                { title: '🏛️ Baza Sejmu wyeksportowana na Pulpit', duration: 6000 }
            );
        } else {
            ToastModule.success(
                `📁 ${filename}\n📊 Rozmiar: ${sizeKB} KB\n\n💡 Plik zapisany w domyślnym folderze pobierania`,
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

        const data = exportFilteredDb(RSS_TABLES);
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `nostradamnos-rss-${timestamp}.db`;

        const result = await saveBlob(blob, filename, [{
            description: 'SQLite Database',
            accept: { 'application/x-sqlite3': ['.db'] }
        }]);

        if (result.cancelled) return;

        const sizeKB = (blob.size / 1024).toFixed(2);
        console.log(`[RSS Export] ✅ RSS database exported: ${filename} (${sizeKB} KB, ${count} articles)`);

        if (result.desktop) {
            ToastModule.success(
                `📁 ${filename}\n📰 Artykułów: ${count}\n📊 Rozmiar: ${sizeKB} KB`,
                { title: '📰 Baza RSS wyeksportowana na Pulpit', duration: 6000 }
            );
        } else {
            ToastModule.success(
                `📁 ${filename}\n📰 Artykułów: ${count}\n📊 Rozmiar: ${sizeKB} KB\n\n💡 Plik zapisany w domyślnym folderze pobierania`,
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
     * tablesToImport — list of table names to copy (SEJM_TABLES or RSS_TABLES).
     * Existing rows in the target tables are replaced (INSERT OR REPLACE).
     */
    function importTablesFromFile(srcDb, tablesToImport) {
        // Ensure the main database has the full schema
        if (!db2.database) {
            db2.database = new db2.sql.Database();
            db2.createSchema();
        }

        // Get tables that actually exist in the source file
        const srcTablesRes = srcDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
        const srcTableNames = srcTablesRes.length ? srcTablesRes[0].values.map(v => v[0]) : [];

        const imported = {};

        for (const table of tablesToImport) {
            if (!srcTableNames.includes(table)) continue;

            try {
                // Clear existing data in this table
                db2.database.run(`DELETE FROM "${table}"`);

                // Copy rows from source
                const rows = srcDb.exec(`SELECT * FROM "${table}"`);
                if (!rows.length || !rows[0].values.length) {
                    imported[table] = 0;
                    continue;
                }

                const cols = rows[0].columns;
                const placeholders = cols.map(() => '?').join(',');
                db2.database.run('BEGIN');
                const stmt = db2.database.prepare(
                    `INSERT OR REPLACE INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`
                );
                for (const row of rows[0].values) {
                    stmt.run(row);
                }
                stmt.free();
                db2.database.run('COMMIT');
                imported[table] = rows[0].values.length;
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

        try {
            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Initialize sql.js if needed
            if (!window.initSqlJs) {
                throw new Error('sql.js not loaded');
            }
            
            if (!db2.sql) {
                db2.sql = await window.initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
                });
            }

            // Open imported file as a temporary (source) database
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
                    // Wyczyść historię fetcha — importowana baza sejmowa nie ma związku z poprzednim ETL
                    localStorage.removeItem('nostradamnos_lastFetchConfig');
                    localStorage.removeItem('nostradamnos_lastFetch');
                    const sejmImported = importTablesFromFile(srcDb, SEJM_TABLES);
                    Object.assign(allImported, sejmImported);
                }

                if (hasRss) {
                    const rssImported = importTablesFromFile(srcDb, RSS_TABLES);
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
        }
    }
    
    console.log('[DB Buttons] ✅ Import/Export buttons initialized');
}
