// Database Import/Export Buttons
// Handles saving and loading SQLite database

import { db2 } from './database-v2.js';
import ToastModule from './toast.js';
import { refreshChartsManager } from './charts-manager.js';

export function initDbButtons() {
    console.log('[DB Buttons] Initializing import/export buttons...');
    
    const importBtn = document.getElementById('importDbBtn');
    const exportBtn = document.getElementById('exportDbBtn');
    
    if (!importBtn || !exportBtn) {
        console.error('[DB Buttons] Buttons not found in DOM');
        return;
    }
    
    // Buttons stay hidden - visibility controlled by uiVisibility settings
    
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
            
            console.log('[DB Export] Starting database export...');
            
            // Check if database is initialized
            if (!db2.database) {
                ToastModule.error('Baza danych nie jest zainicjowana.\n\nPobierz najpierw dane z API.');
                console.error('[DB Export] Database not initialized');
                return;
            }
            
            // Export database to binary
            const data = db2.database.export();
            const blob = new Blob([data], { type: 'application/x-sqlite3' });
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `nostradamnos-${timestamp}.db`;
            
            // Try to use File System Access API (modern browsers)
            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        startIn: 'desktop',
                        types: [{
                            description: 'SQLite Database',
                            accept: { 'application/x-sqlite3': ['.db'] }
                        }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    
                    console.log(`[DB Export] ✅ Database exported to Desktop: ${filename} (${(blob.size / 1024).toFixed(2)} KB)`);
                    ToastModule.success(
                        `📁 ${filename}\n📊 Rozmiar: ${(blob.size / 1024).toFixed(2)} KB`,
                        { title: 'Baza wyeksportowana na Pulpit', duration: 6000 }
                    );
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') {
                        console.log('[DB Export] User cancelled save dialog');
                        return;
                    }
                    console.warn('[DB Export] File System Access API failed, falling back to download:', err);
                }
            }
            
            // Fallback: traditional download (older browsers)
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log(`[DB Export] ✅ Database exported: ${filename} (${(blob.size / 1024).toFixed(2)} KB)`);
            ToastModule.success(
                `📁 ${filename}\n📊 Rozmiar: ${(blob.size / 1024).toFixed(2)} KB\n\n💡 Plik zapisany w domyślnym folderze pobierania`,
                { title: 'Baza wyeksportowana', duration: 6000 }
            );

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
            
            // Close existing database
            if (db2.database) {
                db2.database.close();
            }

            // Wyczyść historię fetcha — importowana baza nie ma związku z poprzednim ETL
            localStorage.removeItem('nostradamnos_lastFetchConfig');
            localStorage.removeItem('nostradamnos_lastFetch');

            // Load new database
            db2.database = new db2.sql.Database(uint8Array);
            
            // Verify database structure
            const tables = db2.database.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
            const tableNames = tables[0] ? tables[0].values.map(v => v[0]) : [];
            
            console.log(`[DB Import] ✅ Database loaded successfully`);
            console.log(`[DB Import] Tables found: ${tableNames.join(', ')}`);
            
            // Count records in main tables
            let recordCounts = {};
            for (const table of ['poslowie', 'posiedzenia', 'wypowiedzi', 'glosowania']) {
                try {
                    const result = db2.database.exec(`SELECT COUNT(*) FROM ${table};`);
                    recordCounts[table] = result[0]?.values[0][0] || 0;
                } catch (e) {
                    recordCounts[table] = 0;
                }
            }
            
            const summary = Object.entries(recordCounts)
                .map(([table, count]) => `${table}: ${count}`)
                .join('\n');

            ToastModule.success(
                `📁 ${file.name}\n📊 Rozmiar: ${(file.size / 1024).toFixed(2)} KB\n\n📋 Rekordy:\n${summary}`,
                { title: 'Baza zaimportowana z Pulpitu', duration: 8000 }
            );

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
            
            // Uruchom monitorowanie bazy
            if (typeof window.startDbMonitoring === 'function') {
                window.startDbMonitoring();
            }
            
            // Odśwież panel zarządzania wykresami (lampki statusu)
            refreshChartsManager();

        } catch (error) {
            console.error('[DB Import] Error loading database:', error);
            ToastModule.error(
                `Błąd podczas importu:\n\n${error.message}\n\nUpewnij się, że plik jest poprawną bazą SQLite.`
            );
        }
    }
    
    console.log('[DB Buttons] ✅ Import/Export buttons initialized');
}
