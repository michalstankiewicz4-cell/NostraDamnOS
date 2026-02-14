// API Handler v2.0 - Uses Pipeline ETL
import { runPipeline, buildConfigFromUI, getCacheStatus, verifyDatabase, detectDataChanges } from './pipeline.js';
import { fetchCounter, setFetchAbortController } from './fetcher/fetcher.js';
import { db2 } from './modules/database-v2.js';
import ToastModule from './modules/toast.js';
import { startLivePolling, stopLivePolling } from './modules/sejm-live-checker.js';
import { refreshChartsManager } from './modules/charts-manager.js';
import { refreshPredictions } from './modules/predictions.js';
import { escapeHtml, isValidTableName } from './modules/security.js';

// === TASK QUEUE SYSTEM ===
// Zapobiega jednoczesnym operacjom: fetch, verify, checkNewRecords, checkDataChanges

class TaskQueue {
    constructor() {
        this.queue = [];
        this.running = false;
        this.currentTask = null;
        this.onStateChange = null; // Callback dla zmiany stanu
    }

    async add(taskName, taskFn) {
        // Jeśli to samo zadanie już jest w kolejce lub wykonywane, pomiń
        if (this.currentTask === taskName || this.queue.some(t => t.name === taskName)) {
            console.log(`[TaskQueue] Task "${taskName}" already queued/running, skipping`);
            return null;
        }

        return new Promise((resolve, reject) => {
            this.queue.push({ name: taskName, fn: taskFn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.running || this.queue.length === 0) return;
        
        this.running = true;
        const task = this.queue.shift();
        this.currentTask = task.name;
        
        console.log(`[TaskQueue] Starting task: ${task.name}`);
        this.notifyStateChange(); // Powiadom o zmianie stanu
        
        try {
            const result = await task.fn();
            task.resolve(result);
        } catch (error) {
            console.error(`[TaskQueue] Task "${task.name}" failed:`, error);
            task.reject(error);
        } finally {
            this.currentTask = null;
            this.running = false;
            console.log(`[TaskQueue] Finished task: ${task.name}`);
            this.notifyStateChange(); // Powiadom o zmianie stanu
            
            // Process next task
            if (this.queue.length > 0) {
                setTimeout(() => this.process(), 100);
            }
        }
    }

    isRunning(taskName) {
        if (taskName) {
            return this.currentTask === taskName || this.queue.some(t => t.name === taskName);
        }
        return this.running || this.queue.length > 0;
    }

    clear() {
        this.queue = [];
    }
    
    notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.isRunning(), this.currentTask);
        }
    }
}

const taskQueue = new TaskQueue();

// Export dla debugowania
window.taskQueue = taskQueue;

// === GLOBAL STATE VARIABLES ===
// Muszą być zdefiniowane przed updateButtonStates która ich używa

let isFetching = false;
let fetchBtnMode = 'fetch'; // 'fetch' | 'abort' | 'verify'
let currentAbortController = null;
let verifyAbortController = null;

// Globalna funkcja sprawdzająca czy coś się dzieje (kolejka lub pobieranie)
function isAnyOperationRunning() {
    return taskQueue.isRunning() || isFetching;
}

// Export dla innych modułów (np. db-buttons.js)
window.isAnyOperationRunning = isAnyOperationRunning;

// === BUTTON STATE MANAGEMENT ===
// Blokuje/odblokuje przyciski podczas operacji w kolejce

function updateButtonStates(isQueueRunning, currentTask) {
    const etlFetchBtn = document.getElementById('etlFetchBtn');
    const etlClearBtn = document.getElementById('etlClearBtn');
    const btnCheckNewRecords = document.getElementById('btnCheckNewRecords');
    const btnCheckDataChanges = document.getElementById('btnCheckDataChanges');
    const dbExportBtn = document.getElementById('exportDbBtn');
    const dbImportBtn = document.getElementById('importDbBtn');
    
    // Sprawdź czy jakakolwiek operacja jest w toku
    const anyOperationRunning = isAnyOperationRunning();
    
    // Jeśli cokolwiek działa, blokuj wszystkie przyciski oprócz abort
    if (anyOperationRunning) {
        // Pokaż info w konsoli dla user-a
        if (isQueueRunning) {
            console.log(`[TaskQueue] Running: ${currentTask} - przyciski zablokowane`);
        }
        
        // ETL Clear button
        if (etlClearBtn && !isFetching) {
            etlClearBtn.disabled = true;
            etlClearBtn.title = currentTask ? `Oczekuj - ${currentTask}...` : 'Trwa operacja...';
        }
        
        // Force check buttons (jeśli to nie one działają)
        if (btnCheckNewRecords && currentTask !== 'checkNewRecords') {
            btnCheckNewRecords.disabled = true;
        }
        if (btnCheckDataChanges && currentTask !== 'checkDataChanges') {
            btnCheckDataChanges.disabled = true;
        }
        
        // Import/Export buttons
        if (dbExportBtn) {
            dbExportBtn.disabled = true;
            dbExportBtn.title = currentTask ? `Oczekuj - ${currentTask}...` : 'Trwa operacja...';
        }
        if (dbImportBtn) {
            dbImportBtn.disabled = true;
            dbImportBtn.title = `Oczekuj - ${currentTask}...`;
        }
        
        // ETL Fetch button - blokuj tylko jeśli nie jest w trybie abort
        if (etlFetchBtn && fetchBtnMode !== 'abort' && !isFetching) {
            etlFetchBtn.disabled = true;
            etlFetchBtn.title = `Oczekuj - ${currentTask}...`;
        }
    } else {
        // Odblokuj wszystkie przyciski
        if (etlClearBtn && !isFetching) {
            etlClearBtn.disabled = false;
            etlClearBtn.title = 'Wyczyść wszystkie dane z bazy';
        }
        if (btnCheckNewRecords && !checkNewRecordsDebounce) {
            btnCheckNewRecords.disabled = false;
        }
        if (btnCheckDataChanges && !checkDataChangesDebounce) {
            btnCheckDataChanges.disabled = false;
        }
        if (dbExportBtn) {
            dbExportBtn.disabled = false;
            dbExportBtn.title = 'Eksportuj bazę do pliku JSON';
        }
        if (dbImportBtn) {
            dbImportBtn.disabled = false;
            dbImportBtn.title = 'Importuj bazę z pliku JSON';
        }
        if (etlFetchBtn && !isFetching) {
            etlFetchBtn.disabled = false;
            etlFetchBtn.title = '';
        }
    }
    
    // Aktualizuj lampki - pokaż status "checking" dla aktualnego zadania
    updateLampsForTask(currentTask);
    
    // Odśwież stan przycisków akcji na liście wykresów
    updateChartActionButtons(isQueueRunning);
}

function updateChartActionButtons(isBlocked) {
    // Znajdź wszystkie przyciski akcji z data-action w całej aplikacji
    const actionButtons = document.querySelectorAll('[data-action="goto-etl"], [data-action="import-db"]');
    actionButtons.forEach(btn => {
        btn.disabled = isBlocked;
    });
}

function updateLampsForTask(taskName) {
    const recordsLamp = document.getElementById('floatingStatusRecords');
    const validityLamp = document.getElementById('floatingStatusValidity');
    
    if (!taskName) return; // Brak aktywnego zadania
    
    // Pokaż lampki "checking" w zależności od zadania
    if (taskName === 'checkNewRecords' || taskName === 'runVerification') {
        if (recordsLamp && !recordsLamp.className.includes('checking')) {
            recordsLamp.className = 'floating-lamp floating-lamp-checking';
            recordsLamp.title = 'Sprawdzam nowe rekordy...';
        }
    }
    
    if (taskName === 'checkDataChanges') {
        if (validityLamp && !validityLamp.className.includes('checking')) {
            validityLamp.className = 'floating-lamp floating-lamp-checking';
            validityLamp.title = 'Sprawdzam zmiany danych...';
        }
    }
}

// Podpięcie callbacku do kolejki
taskQueue.onStateChange = updateButtonStates;

// Zmienne dla debounce (muszą być w tym scope dla updateButtonStates)
let checkNewRecordsDebounce = null;
let checkDataChangesDebounce = null;

// Funkcje z debounce dla force check buttons (exportowane globalnie)
window.forceCheckNewRecords = function() {
    if (checkNewRecordsDebounce) return; // Ignore if already pending
    
    const btn = document.getElementById('btnCheckNewRecords');
    if (btn) btn.disabled = true;
    
    checkNewRecords();
    
    checkNewRecordsDebounce = setTimeout(() => {
        checkNewRecordsDebounce = null;
        if (btn && !taskQueue.isRunning()) btn.disabled = false;
    }, 1000); // 1s debounce
};

window.forceCheckDataChanges = function() {
    if (checkDataChangesDebounce) return; // Ignore if already pending
    
    const btn = document.getElementById('btnCheckDataChanges');
    if (btn) btn.disabled = true;
    
    checkDataChanges();
    
    checkDataChangesDebounce = setTimeout(() => {
        checkDataChangesDebounce = null;
        if (btn && !taskQueue.isRunning()) btn.disabled = false;
    }, 1000); // 1s debounce
};

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
    const statusDbState = document.getElementById('floatingStatusDbState');
    const statusRecords = document.getElementById('floatingStatusRecords');
    const statusValidity = document.getElementById('floatingStatusValidity');
    
    if (!statusDbState || !statusRecords || !statusValidity) return;

    // Stan bazy: czerwony=pusty, zielony=ma dane
    if (dbEmpty) {
        statusDbState.className = 'floating-lamp floating-lamp-error';
        statusDbState.title = `Brak danych (0 rekordów)`;
    } else {
        const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
        statusDbState.className = 'floating-lamp floating-lamp-ok';
        statusDbState.title = `Baza zawiera dane (${totalRecords} rekordów)`;
    }

    // Stan rekordów i poprawności - domyślnie OK, zmienia się przy sprawdzeniu
    statusRecords.className = 'floating-lamp floating-lamp-ok';
    statusValidity.className = 'floating-lamp floating-lamp-ok';
    
    // Aktualizuj widoczność lampek
    updateLampsVisibility();
  } catch (error) {
    console.error('[updateStatusIndicators] Error:', error);
  }
}

/**
 * Ukrywa/pokazuje lampki na podstawie ustawień monitorowania
 */
function updateLampsVisibility() {
    const statusRecords = document.getElementById('floatingStatusRecords');
    const statusValidity = document.getElementById('floatingStatusValidity');
    
    if (!statusRecords || !statusValidity) return;
    
    try {
        const saved = JSON.parse(localStorage.getItem('uiVisibility') || '{}');
        
        // Domyślne wartości jeśli nie ma zapisanych
        const settings = {
            dbCheckNewRecords: saved.dbCheckNewRecords !== undefined ? saved.dbCheckNewRecords : true,
            dbCheckDataChanges: saved.dbCheckDataChanges !== undefined ? saved.dbCheckDataChanges : true
        };
        
        // Druga lampka - widoczna gdy monitorowanie nowych rekordów włączone
        statusRecords.style.display = settings.dbCheckNewRecords ? '' : 'none';
        
        // Trzecia lampka - widoczna gdy monitorowanie zmian włączone
        statusValidity.style.display = settings.dbCheckDataChanges ? '' : 'none';
    } catch (error) {
        console.error('[updateLampsVisibility] Error:', error);
    }
}

function setRecordsStatus(hasNewRecords) {
  const lamp = document.getElementById('floatingStatusRecords');
  if (!lamp) return;

  if (hasNewRecords) {
    lamp.className = 'floating-lamp floating-lamp-error';
    lamp.title = 'Znaleziono nowe rekordy';
  } else {
    lamp.className = 'floating-lamp floating-lamp-ok';
    lamp.title = 'Brak nowych rekordów';
  }
}

function setValidityStatus(hasErrors) {
  const lamp = document.getElementById('floatingStatusValidity');
  if (!lamp) return;

  if (hasErrors) {
    lamp.className = 'floating-lamp floating-lamp-error floating-lamp-blink';
    lamp.title = 'Znaleziono zmiany w danych API';
  } else {
    lamp.className = 'floating-lamp floating-lamp-ok';
    lamp.title = 'Dane są poprawne';
  }
}

// === SUMMARY TAB ===

const summaryLabels = {
    poslowie:              { icon: '👥', label: 'Posłowie' },
    posiedzenia:           { icon: '🏛️', label: 'Posiedzenia' },
    wypowiedzi:            { icon: '💬', label: 'Wypowiedzi' },
    glosowania:            { icon: '🗳️', label: 'Głosowania' },
    glosy:                 { icon: '📋', label: 'Głosy indywidualne' },
    interpelacje:          { icon: '📝', label: 'Interpelacje' },
    zapytania:             { icon: '❓', label: 'Zapytania pisemne' },
    projekty_ustaw:        { icon: '📜', label: 'Projekty ustaw' },
    komisje:               { icon: '🏢', label: 'Komisje' },
    komisje_posiedzenia:   { icon: '📅', label: 'Posiedzenia komisji' },
    komisje_wypowiedzi:    { icon: '🗣️', label: 'Wypowiedzi komisji' },
    oswiadczenia_majatkowe:{ icon: '💰', label: 'Oświadczenia majątkowe' },
    ustawy:                { icon: '⚖️', label: 'Ustawy (akty prawne)' },
    zapytania_odpowiedzi:  { icon: '💬', label: 'Odpowiedzi na zapytania' }
};

// Kolumny do wyświetlenia per tabela (nie pokazujemy długich tekstów)
const tableColumns = {
    poslowie:              ['id_osoby', 'imie', 'nazwisko', 'klub', 'okreg', 'rola', 'kadencja'],
    posiedzenia:           ['numer', 'data_start', 'data_koniec', 'kadencja', 'typ'],
    wypowiedzi:            ['id_wypowiedzi', 'id_posiedzenia', 'id_osoby', 'data', 'typ'],
    glosowania:            ['id_glosowania', 'id_posiedzenia', 'numer', 'data', 'tytul', 'wynik', 'za', 'przeciw', 'wstrzymalo'],
    glosy:                 ['id_glosowania', 'id_osoby', 'glos'],
    interpelacje:          ['id_interpelacji', 'id_osoby', 'data', 'tytul', 'status'],
    zapytania:             ['term', 'num', 'title', 'receiptDate', 'sentDate', 'answerDelayedDays'],
    projekty_ustaw:        ['id_projektu', 'kadencja', 'data', 'tytul', 'status'],
    komisje:               ['id_komisji', 'nazwa', 'skrot', 'typ', 'kadencja'],
    komisje_posiedzenia:   ['id_posiedzenia_komisji', 'id_komisji', 'numer', 'data', 'opis'],
    komisje_wypowiedzi:    ['id_posiedzenia_komisji', 'id_osoby', 'data', 'typ'],
    oswiadczenia_majatkowe:['id_oswiadczenia', 'id_osoby', 'rok', 'data_zlozenia'],
    ustawy:                ['id_ustawy', 'publisher', 'year', 'pos', 'title', 'type', 'status'],
    zapytania_odpowiedzi:  ['zapytanie_term', 'zapytanie_num', 'key', 'from_author', 'receiptDate', 'onlyAttachment', 'prolongation']
};

function showSummaryTable(tableName) {
    if (!db2.database) return;
    const section = document.getElementById('summaryTableSection');
    const titleEl = document.getElementById('summaryTableTitle');
    const wrap = document.getElementById('summaryTableWrap');
    if (!section || !wrap) return;

    const meta = summaryLabels[tableName] || { icon: '📊', label: tableName };
    const cols = tableColumns[tableName];
    if (!cols) return;

    // Walidacja nazwy tabeli
    if (!isValidTableName(tableName)) {
        console.warn('[API] Invalid table name:', tableName);
        return;
    }

    const colList = cols.join(', ');
    const result = db2.database.exec(`SELECT ${colList} FROM ${tableName} LIMIT 500`);

    if (!result.length || !result[0].values.length) {
        wrap.innerHTML = '<p style="padding:20px;color:#6c757d;">Brak danych</p>';
        titleEl.textContent = `${meta.icon} ${meta.label}`;
        section.style.display = '';
        return;
    }

    const rows = result[0].values;
    let html = '<table><thead><tr>';
    for (const col of cols) {
        html += `<th>${col}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (const row of rows) {
        html += '<tr>';
        for (const val of row) {
            const display = val === null ? '-' : String(val);
            html += `<td title="${escapeHtml(display)}">${escapeHtml(display)}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';

    titleEl.textContent = `${meta.icon} ${meta.label} (${rows.length}${rows.length === 500 ? '+' : ''})`;
    wrap.innerHTML = html;
    section.style.display = '';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideSummaryTable() {
    const section = document.getElementById('summaryTableSection');
    if (section) section.style.display = 'none';
    document.querySelectorAll('.summary-card.active').forEach(c => c.classList.remove('active'));
}

// Zamknij tabelę
document.getElementById('summaryTableClose')?.addEventListener('click', hideSummaryTable);

// Funkcja pomocnicza: pobierz rzeczywiste zliczenia z SQL
function getSqlCounts() {
    if (!db2.database) return {};

    const counts = {};
    const tables = [
        'poslowie', 'posiedzenia', 'wypowiedzi', 'glosowania', 'glosy',
        'interpelacje', 'zapytania', 'zapytania_odpowiedzi', 'projekty_ustaw', 'komisje',
        'komisje_posiedzenia', 'komisje_wypowiedzi', 'oswiadczenia_majatkowe', 'ustawy'
    ];

    for (const table of tables) {
        try {
            const result = db2.database.exec(`SELECT COUNT(*) FROM ${table}`);
            if (result.length > 0 && result[0].values.length > 0) {
                counts[table] = result[0].values[0][0];
            }
        } catch (e) {
            counts[table] = 0;
        }
    }

    // Dodatkowe: dni obrad (unikalne daty z posiedzeń)
    try {
        const result = db2.database.exec(`
            SELECT COUNT(DISTINCT data_start)
            FROM posiedzenia
            WHERE data_start IS NOT NULL
        `);
        if (result.length > 0 && result[0].values.length > 0) {
            counts.dni_obrad = result[0].values[0][0];
        }
    } catch (e) {
        counts.dni_obrad = 0;
    }

    // Głosy indywidualne: SUM(za + przeciw + wstrzymalo) z glosowania
    try {
        const result = db2.database.exec(`
            SELECT COALESCE(SUM(za), 0) + COALESCE(SUM(przeciw), 0) + COALESCE(SUM(wstrzymalo), 0)
            FROM glosowania
        `);
        if (result.length > 0 && result[0].values.length > 0) {
            counts.glosy_indywidualne = result[0].values[0][0];
        }
    } catch (e) {
        counts.glosy_indywidualne = 0;
    }

    return counts;
}

function updateSummaryTab() {
    try {
        const stats = db2.getStats();
        const sqlCounts = getSqlCounts();
        const cacheStatus = getCacheStatus(db2);
        const totalRecords = Object.values(stats).reduce((sum, c) => sum + c, 0);

        const container = document.getElementById('summaryContainer');
        const info = document.getElementById('summaryInfo');
        const placeholder = document.getElementById('summaryPlaceholder');

        if (!container) return;

        // Generuj karty dynamicznie — tylko typy z danymi
        container.innerHTML = '';
        hideSummaryTable();

        // Dodaj kartę dla dni obrad (jeśli są dane) — klik otwiera posiedzenia
        if (sqlCounts.dni_obrad > 0) {
            const card = document.createElement('div');
            card.className = 'summary-card';
            card.setAttribute('data-table', 'posiedzenia');
            card.innerHTML = `
                <div class="summary-icon">📆</div>
                <div class="summary-content">
                    <div class="summary-label">Dni obrad</div>
                    <div class="summary-value">
                        <span class="summary-value-main">${sqlCounts.dni_obrad.toLocaleString('pl-PL')}</span>
                        <span class="summary-value-sql">${sqlCounts.dni_obrad.toLocaleString('pl-PL')}</span>
                    </div>
                </div>`;
            card.addEventListener('click', () => {
                const isActive = card.classList.contains('active');
                document.querySelectorAll('.summary-card.active').forEach(c => c.classList.remove('active'));
                if (isActive) { hideSummaryTable(); } else { card.classList.add('active'); showSummaryTable('posiedzenia'); }
            });
            container.appendChild(card);
        }

        // Dodaj kartę dla głosów indywidualnych — tylko gdy są dane w DB
        const sqlGlosy = sqlCounts.glosy_indywidualne || 0;
        if (sqlGlosy > 0) {
            const card = document.createElement('div');
            card.className = 'summary-card';
            card.setAttribute('data-table', 'glosowania');
            card.innerHTML = `
                <div class="summary-icon">📋</div>
                <div class="summary-content">
                    <div class="summary-label">Głosy indywidualne</div>
                    <div class="summary-value">
                        <span class="summary-value-main">${sqlGlosy.toLocaleString('pl-PL')}</span>
                        <span class="summary-value-sql">${sqlGlosy.toLocaleString('pl-PL')}</span>
                    </div>
                </div>`;
            card.addEventListener('click', () => {
                const isActive = card.classList.contains('active');
                document.querySelectorAll('.summary-card.active').forEach(c => c.classList.remove('active'));
                if (isActive) { hideSummaryTable(); } else { card.classList.add('active'); showSummaryTable('glosowania'); }
            });
            container.appendChild(card);
        }

        // Generuj karty dla tabel z danymi
        for (const [table, count] of Object.entries(stats)) {
            if (count === 0) continue;
            const meta = summaryLabels[table] || { icon: '📊', label: table };
            const sqlCount = sqlCounts[table] || 0;
            const card = document.createElement('div');
            card.className = 'summary-card';
            card.setAttribute('data-table', table);
            card.innerHTML = `
                <div class="summary-icon">${meta.icon}</div>
                <div class="summary-content">
                    <div class="summary-label">${meta.label}</div>
                    <div class="summary-value">
                        <span class="summary-value-main">${count.toLocaleString('pl-PL')}</span>
                        <span class="summary-value-sql">${sqlCount.toLocaleString('pl-PL')}</span>
                    </div>
                </div>`;
            card.addEventListener('click', () => {
                const isActive = card.classList.contains('active');
                document.querySelectorAll('.summary-card.active').forEach(c => c.classList.remove('active'));
                if (isActive) {
                    hideSummaryTable();
                } else {
                    card.classList.add('active');
                    showSummaryTable(table);
                }
            });
            container.appendChild(card);
        }

        // Info section
        if (totalRecords > 0 && info) {
            info.style.display = '';
            const lastUpdateEl = document.getElementById('lastUpdate');
            const termEl = document.getElementById('summaryTerm');
            const instEl = document.getElementById('summaryInstitution');
            const totalEl = document.getElementById('summaryTotal');

            if (lastUpdateEl && cacheStatus.lastUpdate) {
                lastUpdateEl.textContent = new Date(cacheStatus.lastUpdate).toLocaleString('pl-PL');
            }

            // Kadencje i instytucje z rzeczywistych danych w bazie
            if (db2.database) {
                const typResult = db2.database.exec("SELECT DISTINCT typ FROM posiedzenia WHERE typ IS NOT NULL");
                if (typResult.length > 0 && instEl) {
                    const typy = typResult[0].values.map(r => r[0] === 'sejm' ? 'Sejm RP' : 'Senat RP');
                    instEl.textContent = typy.join(', ');
                }

                const kadResult = db2.database.exec("SELECT DISTINCT kadencja FROM posiedzenia WHERE kadencja IS NOT NULL ORDER BY kadencja");
                if (kadResult.length > 0 && termEl) {
                    const kadencje = kadResult[0].values.map(r => r[0]);
                    termEl.textContent = kadencje.join(', ');
                }
            }

            if (totalEl) totalEl.textContent = totalRecords.toLocaleString('pl-PL');

            // Info o ostatnim pobraniu
            const lastFetchRaw = localStorage.getItem('nostradamnos_lastFetch');
            const lastFetchInfoEl = document.getElementById('lastFetchInfo');
            const lastFetchDetailsEl = document.getElementById('lastFetchDetails');
            if (lastFetchRaw && lastFetchInfoEl && lastFetchDetailsEl) {
                try {
                    const lf = JSON.parse(lastFetchRaw);
                    const parts = [];
                    if (lf.newSittings > 0) parts.push(`${lf.newSittings} posiedzeń`);
                    // Pokaż zapisane rekordy per typ
                    const lfStats = lf.stats || {};
                    for (const [table, count] of Object.entries(lfStats)) {
                        if (count > 0) {
                            const meta = summaryLabels[table];
                            parts.push(`${count} ${meta ? meta.label.toLowerCase() : table}`);
                        }
                    }
                    if (parts.length > 0) {
                        lastFetchInfoEl.style.display = '';
                        lastFetchDetailsEl.textContent = parts.join(', ');
                    }

                    // Ostrzeżenia: zaznaczone moduły bez danych
                    // Mapowanie: nazwa modułu w config → klucz w stats
                    const moduleToStat = { oswiadczenia: 'oswiadczenia_majatkowe' };
                    const selectedModules = lf.modules || [];
                    const missing = selectedModules.filter(mod => {
                        if (mod === 'poslowie' || mod === 'posiedzenia') return false;
                        const statKey = moduleToStat[mod] || mod;
                        return !lfStats[statKey] || lfStats[statKey] === 0;
                    });

                    let warningsEl = document.getElementById('summaryWarnings');
                    if (missing.length > 0) {
                        if (!warningsEl) {
                            warningsEl = document.createElement('div');
                            warningsEl.id = 'summaryWarnings';
                            warningsEl.style.cssText = 'margin-top:8px;padding:8px 12px;background:rgba(255,193,7,0.15);border-left:3px solid #ffc107;border-radius:4px;font-size:0.85em;color:#ccc;';
                            info.appendChild(warningsEl);
                        }
                        const names = missing.map(m => {
                            const statKey = moduleToStat[m] || m;
                            const meta = summaryLabels[statKey] || summaryLabels[m];
                            return meta ? meta.label : m;
                        });
                        warningsEl.innerHTML = `⚠️ Zaznaczone, ale bez danych: <strong>${names.join(', ')}</strong>`;
                        warningsEl.style.display = '';
                    } else if (warningsEl) {
                        warningsEl.style.display = 'none';
                    }
                } catch (e) { /* ignore */ }
            }
        } else if (info) {
            info.style.display = 'none';
        }

        // Placeholder
        if (placeholder) {
            placeholder.style.display = totalRecords > 0 ? 'none' : '';
        }
        // Fetch Overview panel
        updateFetchOverview();

    } catch (e) {
        console.error('[updateSummaryTab] Error:', e);
    }
}

// === FETCH OVERVIEW: Zlecone vs Pobrane ===

function updateFetchOverview() {
    const panel = document.getElementById('fetchOverview');
    if (!panel) return;

    // Live SQL counts from database
    let sqlStats = {};
    try { sqlStats = getSqlCounts(); } catch { /* db not ready */ }
    const dbHasData = Object.values(sqlStats).some(v => v > 0);

    // Try to load fetch config (may not exist after import)
    const configRaw = localStorage.getItem('nostradamnos_lastFetchConfig');
    const fetchRaw = localStorage.getItem('nostradamnos_lastFetch');
    let config = null, fetched = null;
    try {
        if (configRaw) config = JSON.parse(configRaw);
        if (fetchRaw) fetched = JSON.parse(fetchRaw);
    } catch { /* parse error — treat as import mode */ }

    const hasFetchHistory = !!(config && fetched);

    // Jeśli nie ma danych w DB i nie ma historii fetcha — ukryj panel
    if (!dbHasData && !hasFetchHistory) {
        panel.style.display = 'none';
        return;
    }

    const modules = hasFetchHistory ? (config.modules || []) : [];
    const stats = hasFetchHistory ? (fetched.stats || {}) : {};
    const reqCounts = hasFetchHistory ? (fetched.requestedCounts || {}) : {};

    // Mapowanie moduł → klucz w stats
    const modToStat = {
        poslowie: 'poslowie',
        posiedzenia: 'posiedzenia',
        wypowiedzi: 'wypowiedzi',
        glosowania: 'glosowania',
        glosy: 'glosy',
        interpelacje: 'interpelacje',
        zapytania: 'zapytania',
        projekty_ustaw: 'projekty_ustaw',
        ustawy: 'ustawy',
        oswiadczenia: 'oswiadczenia_majatkowe',
        komisje: 'komisje',
        komisje_posiedzenia: 'komisje_posiedzenia'
    };

    const setText = (id, text, cls) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        if (cls) el.className = cls;
    };

    // Left column: show count if available, otherwise "tak/—"; hide values when DB empty
    const setReq = (id, mod, countValue) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!dbHasData || !hasFetchHistory) {
            el.textContent = '—';
            el.className = 'fov-unchecked';
            return;
        }
        const checked = modules.includes(mod);
        if (!checked) {
            el.textContent = '—';
            el.className = 'fov-unchecked';
        } else if (countValue !== undefined && countValue > 0) {
            el.textContent = countValue.toLocaleString('pl-PL');
            el.className = 'fov-value';
        } else {
            el.textContent = 'tak';
            el.className = 'fov-checked';
        }
    };

    // Right column: show fetched count + sql(x); in import mode show only sql(x)
    const setStat = (id, mod) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!dbHasData) {
            el.textContent = '—';
            el.className = 'fov-unchecked';
            return;
        }
        const statKey = modToStat[mod] || mod;
        const val = stats[statKey];
        const sqlVal = sqlStats[statKey] || 0;
        // Import mode (no fetch history): show only sql count
        if (!hasFetchHistory) {
            if (sqlVal > 0) {
                el.textContent = `${sqlVal.toLocaleString('pl-PL')} sql(${sqlVal.toLocaleString('pl-PL')})`;
                el.className = 'fov-value';
            } else {
                el.textContent = '—';
                el.className = 'fov-unchecked';
            }
            return;
        }
        const sqlSuffix = sqlVal > 0 ? ` sql(${sqlVal.toLocaleString('pl-PL')})` : '';
        if (val !== undefined && val > 0) {
            el.textContent = val.toLocaleString('pl-PL') + sqlSuffix;
            el.className = 'fov-value';
        } else if (modules.includes(mod)) {
            el.textContent = '0' + sqlSuffix;
            el.className = sqlVal > 0 ? 'fov-value' : 'fov-unchecked';
        } else {
            el.textContent = '—';
            el.className = 'fov-unchecked';
        }
    };

    // Lewa kolumna: Zlecone
    if (hasFetchHistory) {
        const inst = config.typ === 'senat' ? 'Senat' : 'Sejm';
        setText('fovInst', dbHasData ? inst : '—');
        setText('fovKadencja', dbHasData ? (config.kadencja ? `nr ${config.kadencja}` : 'wszystkie') : '—');
        setText('fovRange', dbHasData ? `${config.rangeFrom || '?'} — ${config.rangeTo || '?'}` : '—');
    } else {
        setText('fovInst', '—');
        setText('fovKadencja', '—');
        setText('fovRange', '—');
    }
    setReq('fovReqDeputies', 'poslowie');
    setReq('fovReqSittings', 'posiedzenia', reqCounts.sittings);
    setReq('fovReqSessionDays', 'wypowiedzi', reqCounts.sessionDays);
    setReq('fovReqTranscripts', 'wypowiedzi', reqCounts.transcripts);
    setReq('fovReqVotings', 'glosowania', reqCounts.votings);
    setReq('fovReqVotes', 'glosy', reqCounts.votes);
    setReq('fovReqInterpellations', 'interpelacje', reqCounts.interpelacje);
    setReq('fovReqQuestions', 'zapytania', reqCounts.zapytania);
    setReq('fovReqBills', 'projekty_ustaw', reqCounts.projekty_ustaw);
    setReq('fovReqActs', 'ustawy', reqCounts.ustawy);
    setReq('fovReqDisclosures', 'oswiadczenia');
    setReq('fovReqCommittees', 'komisje', reqCounts.komisje);
    setReq('fovReqCommitteeSittings', 'komisje_posiedzenia', reqCounts.komisje_posiedzenia);

    // Prawa kolumna: Pobrane / dane importowane
    if (hasFetchHistory) {
        const inst = config.typ === 'senat' ? 'Senat' : 'Sejm';
        setText('fovGotInst', dbHasData ? inst : '—');
        setText('fovGotKadencja', dbHasData ? (config.kadencja ? `nr ${config.kadencja}` : 'wszystkie') : '—');
        setText('fovGotRange', dbHasData && fetched.newSittings > 0 ? `${fetched.newSittings} posiedzeń` : '—');
    } else {
        // Import mode: try to detect from DB metadata
        setText('fovGotInst', dbHasData ? 'import' : '—');
        setText('fovGotKadencja', '—');
        setText('fovGotRange', '—');
    }
    setStat('fovGotDeputies', 'poslowie');
    setStat('fovGotSittings', 'posiedzenia');
    // Dni obrad
    const sessionDaysEl = document.getElementById('fovGotSessionDays');
    if (sessionDaysEl) {
        if (!dbHasData) {
            sessionDaysEl.textContent = '—';
            sessionDaysEl.className = 'fov-unchecked';
        } else {
            const gotSessionDays = hasFetchHistory ? (fetched.sessionDays || 0) : 0;
            const sqlSessionDays = sqlStats.dni_obrad || 0;
            const sessionDaysSql = sqlSessionDays > 0 ? ` sql(${sqlSessionDays.toLocaleString('pl-PL')})` : '';
            if (!hasFetchHistory && sqlSessionDays > 0) {
                sessionDaysEl.textContent = `${sqlSessionDays.toLocaleString('pl-PL')} sql(${sqlSessionDays.toLocaleString('pl-PL')})`;
                sessionDaysEl.className = 'fov-value';
            } else if (gotSessionDays > 0) {
                sessionDaysEl.textContent = gotSessionDays.toLocaleString('pl-PL') + sessionDaysSql;
                sessionDaysEl.className = 'fov-value';
            } else if (sqlSessionDays > 0) {
                sessionDaysEl.textContent = '0' + sessionDaysSql;
                sessionDaysEl.className = 'fov-value';
            } else {
                sessionDaysEl.textContent = '—';
                sessionDaysEl.className = 'fov-unchecked';
            }
        }
    }
    setStat('fovGotTranscripts', 'wypowiedzi');
    setStat('fovGotVotings', 'glosowania');
    // Głosy indywidualne
    const votesEl = document.getElementById('fovGotVotes');
    if (votesEl) {
        if (!dbHasData) {
            votesEl.textContent = '—';
            votesEl.className = 'fov-unchecked';
        } else {
            const indVotes = hasFetchHistory ? (fetched.individualVotes || 0) : 0;
            const fovSqlGlosy = sqlStats.glosy_indywidualne || 0;
            const glosySql = fovSqlGlosy > 0 ? ` sql(${fovSqlGlosy.toLocaleString('pl-PL')})` : '';
            if (!hasFetchHistory && fovSqlGlosy > 0) {
                votesEl.textContent = `${fovSqlGlosy.toLocaleString('pl-PL')} sql(${fovSqlGlosy.toLocaleString('pl-PL')})`;
                votesEl.className = 'fov-value';
            } else if (indVotes > 0 && modules.includes('glosy')) {
                votesEl.textContent = indVotes.toLocaleString('pl-PL') + glosySql;
                votesEl.className = 'fov-value';
            } else if (modules.includes('glosy')) {
                votesEl.textContent = '0' + glosySql;
                votesEl.className = fovSqlGlosy > 0 ? 'fov-value' : 'fov-unchecked';
            } else if (!hasFetchHistory && fovSqlGlosy > 0) {
                votesEl.textContent = `${fovSqlGlosy.toLocaleString('pl-PL')} sql(${fovSqlGlosy.toLocaleString('pl-PL')})`;
                votesEl.className = 'fov-value';
            } else {
                votesEl.textContent = '—';
                votesEl.className = 'fov-unchecked';
            }
        }
    }
    setStat('fovGotInterpellations', 'interpelacje');
    setStat('fovGotQuestions', 'zapytania');
    setStat('fovGotBills', 'projekty_ustaw');
    setStat('fovGotActs', 'ustawy');
    setStat('fovGotDisclosures', 'oswiadczenia');
    setStat('fovGotCommittees', 'komisje');
    setStat('fovGotCommitteeSittings', 'komisje_posiedzenia');

    panel.style.display = '';
}

// === ETL PROGRESS BAR ===

function setLoadLamp(state) {
    const lamp = document.getElementById('loadLamp');
    if (!lamp) return;
    lamp.className = 'floating-lamp';
    if (state === 'loading') {
        lamp.classList.add('floating-lamp-ok', 'floating-lamp-hdd');
    } else {
        lamp.classList.add('floating-lamp-idle');
    }
}

let _linksPollInterval = null;

function showEtlProgress() {
    const pctEl = document.getElementById('etlProgressPercent');
    const bar = document.getElementById('etlProgressBar');
    if (pctEl) pctEl.style.display = '';
    if (bar) bar.style.width = '0%';
    setLoadLamp('loading');
    // Start live link counter polling
    _linksPollInterval = setInterval(() => {
        const linksEl = document.getElementById('etlDetailLinks');
        if (linksEl && fetchCounter.count > 0) {
            const errInfo = fetchCounter.errors > 0 ? ` (${fetchCounter.errors} err)` : '';
            linksEl.textContent = `${fetchCounter.count} zapytań API${errInfo}`;
        }
    }, 300);
}

function hideEtlProgress() {
    const pctEl = document.getElementById('etlProgressPercent');
    const bar = document.getElementById('etlProgressBar');
    if (pctEl) pctEl.style.display = 'none';
    if (bar) bar.style.width = '0%';
    setLoadLamp('idle');
    // Stop link counter polling
    if (_linksPollInterval) { clearInterval(_linksPollInterval); _linksPollInterval = null; }
    // Ukryj sekcję fetch (ale nie cały panel - może być widoczna sekcja live)
    const fetchSection = document.getElementById('etlDetailFetchSection');
    if (fetchSection) fetchSection.style.display = 'none';
    // Zaktualizuj widoczność całego panelu
    updatePanelVisibility();
}

function updateEtlProgress(percent, stage, details) {
    const bar = document.getElementById('etlProgressBar');
    const pctEl = document.getElementById('etlProgressPercent');
    if (bar) bar.style.width = percent + '%';
    if (pctEl) pctEl.textContent = Math.round(percent) + '%';
    // Aktualizuj panel szczegółów ETL
    updateEtlDetailPanel(percent, stage, details);
}

function updateEtlDetailPanel(percent, stage, details = {}) {
    const panel = document.getElementById('etlDetailPanel');
    const fetchSection = document.getElementById('etlDetailFetchSection');
    if (!panel || !fetchSection) return;

    // Sprawdź ustawienia widoczności
    let showFetchSection = true;
    try {
        const vis = JSON.parse(localStorage.getItem('uiVisibility') || '{}');
        if (vis.infoFetch === false) {
            showFetchSection = false;
        }
    } catch { /* ignore */ }

    const stageEl = document.getElementById('etlDetailStage');
    const detailBar = document.getElementById('etlDetailBar');
    const pctEl = document.getElementById('etlDetailPercent');
    const statsEl = document.getElementById('etlDetailStats');
    const linksEl = document.getElementById('etlDetailLinks');

    // Aktualizuj zawartość sekcji fetch
    if (stageEl && stage) stageEl.textContent = stage;
    if (detailBar) detailBar.style.width = percent + '%';
    if (pctEl) pctEl.textContent = Math.round(percent) + '%';
    if (statsEl && details.module) statsEl.textContent = details.module;
    if (linksEl && details.linksLabel) linksEl.textContent = details.linksLabel;
    
    // Pokaż/ukryj sekcję fetch na podstawie ustawienia
    fetchSection.style.display = showFetchSection ? '' : 'none';
    
    // Pokazuj cały panel
    updatePanelVisibility();
}

/**
 * Aktualizuje lampkę statusu live Sejmu na pasku
 * @param {Object|boolean} liveData - dane live lub false
 */
function updateLiveSection(liveData) {
    window.clog('blue', '[Update Live Section] Called with:', liveData);
    
    const liveLamp = document.getElementById('liveLamp');
    if (!liveLamp) return;

    try {
        const isLive = !!liveData && liveData.isLive;
        
        if (isLive) {
            liveLamp.className = 'floating-lamp floating-lamp-live-blink';
            liveLamp.title = 'Trwa transmisja Sejmu';
        } else {
            liveLamp.className = 'floating-lamp floating-lamp-idle';
            liveLamp.title = 'Brak transmisji';
        }
    } catch (error) {
        console.error('[updateLiveSection] Error:', error);
    }
}

/**
 * Aktualizuje widoczność całego panelu na podstawie widoczności sekcji fetch
 */
function updatePanelVisibility() {
    const panel = document.getElementById('etlDetailPanel');
    const fetchSection = document.getElementById('etlDetailFetchSection');
    
    if (!panel) return;

    try {
        // Sprawdź czy sekcja fetch jest widoczna
        const fetchVisible = fetchSection && 
            getComputedStyle(fetchSection).display !== 'none';

        // Pokaż panel tylko jeśli sekcja fetch jest widoczna
        if (fetchVisible) {
            panel.style.display = '';
        } else {
            panel.style.display = 'none';
        }
    } catch (error) {
        console.error('[updatePanelVisibility] Error:', error);
    }
}

// Export db2 globally for debugging
window.db2 = db2;

// Export status functions globally for etl-bridge.js and db-buttons.js
/**
 * Odświeża widoczność sekcji info panelu na podstawie ustawień
 */
function refreshInfoPanelSections() {
    try {
        const vis = JSON.parse(localStorage.getItem('uiVisibility') || '{}');
        
        // Sekcja Fetch: sprawdź czy trwa pobieranie (pasek postępu > 0%)
        const fetchSection = document.getElementById('etlDetailFetchSection');
        const detailBar = document.getElementById('etlDetailBar');
        if (fetchSection && detailBar) {
            const progress = parseFloat(detailBar.style.width) || 0;
            const isDownloading = progress > 0 && progress < 100;
            
            if (isDownloading) {
                // Podczas pobierania: pokaż/ukryj zgodnie z ustawieniem
                fetchSection.style.display = (vis.infoFetch === false) ? 'none' : '';
            } else {
                // Nie ma pobierania: ukryj zawsze
                if (fetchSection.style.display !== 'none') {
                    fetchSection.style.display = 'none';
                }
            }
            updatePanelVisibility();
        }
        
    } catch (error) {
        console.error('[refreshInfoPanelSections] Error:', error);
    }
}

window.updateStatusIndicators = updateStatusIndicators;
window.updateLampsVisibility = updateLampsVisibility;
window.setRecordsStatus = setRecordsStatus;
window.setValidityStatus = setValidityStatus;
window.updateSummaryTab = updateSummaryTab;

// Export info panel functions globally
window.updateLiveSection = updateLiveSection;
window.updatePanelVisibility = updatePanelVisibility;
window.refreshInfoPanelSections = refreshInfoPanelSections;

// === DATABASE MONITORING ===

let newRecordsInterval = null;
let dataChangesInterval = null;

/**
 * Sprawdza nowe rekordy (druga lampka)
 * Używa tej samej logiki co przycisk "Sprawdź nowe dane" - verifyDatabase()
 * Używa kolejki zadań aby zapobiec jednoczesnym operacjom
 */
async function checkNewRecords() {
    if (!db2.database) return;
    
    // Dodaj do kolejki zadań
    return taskQueue.add('checkNewRecords', async () => {
        const lamp = document.getElementById('floatingStatusRecords');
        if (lamp) {
            lamp.className = 'floating-lamp floating-lamp-checking';
            lamp.title = 'Sprawdzam nowe rekordy...';
        }
        
        console.log('[DB Monitor] Checking for new records...');
        try {
            // Używamy dokładnie tej samej funkcji co przycisk sprawdzania
            const result = await verifyDatabase(db2, {});
            if (result && result.hasNewRecords) {
                setRecordsStatus(true);
                console.log('[DB Monitor] 🆕 New records detected');
            } else {
                setRecordsStatus(false);
            }
        } catch (error) {
            console.error('[DB Monitor] Error checking new records:', error);
            if (lamp) {
                lamp.className = 'floating-lamp floating-lamp-error';
                lamp.title = 'Błąd sprawdzania nowych rekordów';
            }
        }
    });
}

/**
 * Sprawdza zmiany danych (trzecia lampka)
 * Używa kolejki zadań aby zapobiec jednoczesnym operacjom
 */
async function checkDataChanges() {
    if (!db2.database) return;
    
    // Dodaj do kolejki zadań
    return taskQueue.add('checkDataChanges', async () => {
        const lamp = document.getElementById('floatingStatusValidity');
        if (lamp) {
            lamp.className = 'floating-lamp floating-lamp-checking';
            lamp.title = 'Sprawdzam zmiany danych...';
        }
        
        console.log('[DB Monitor] Checking for data changes...');
        try {
            const result = await detectDataChanges(db2);
            if (result && result.hasChanges) {
                setValidityStatus(true); // true = has errors/changes
                console.log('[DB Monitor] ⚠️ Data changes detected:', result.changes);
            } else {
                setValidityStatus(false);
            }
        } catch (error) {
            console.error('[DB Monitor] Error checking data changes:', error);
            if (lamp) {
                lamp.className = 'floating-lamp floating-lamp-error';
                lamp.title = 'Błąd sprawdzania zmian danych';
            }
        }
    });
}

/**
 * Uruchamia monitorowanie bazy według ustawień
 * @param {boolean} skipInitialCheck - Jeśli true, nie wykonuje pierwszego sprawdzenia od razu
 */
function startDbMonitoring(skipInitialCheck = false) {
    stopDbMonitoring(); // Clear existing intervals
    
    const saved = JSON.parse(localStorage.getItem('uiVisibility') || '{}');
    
    // Domyślne wartości jeśli nie ma zapisanych
    const settings = {
        dbCheckNewRecords: saved.dbCheckNewRecords !== undefined ? saved.dbCheckNewRecords : true,
        dbCheckNewRecordsInterval: saved.dbCheckNewRecordsInterval || 5,
        dbCheckDataChanges: saved.dbCheckDataChanges !== undefined ? saved.dbCheckDataChanges : true,
        dbCheckDataChangesInterval: saved.dbCheckDataChangesInterval || 11
    };
    
    // Monitoring nowych rekordów (druga lampka)
    if (settings.dbCheckNewRecords && db2.database) {
        const interval = settings.dbCheckNewRecordsInterval * 60 * 1000;
        console.log(`[DB Monitor] Starting new records check (every ${settings.dbCheckNewRecordsInterval} min)`);
        
        // Pierwsze sprawdzenie od razu (tylko jeśli nie skipujemy)
        if (!skipInitialCheck) {
            checkNewRecords();
        }
        
        // Póżniejsze co N minut
        newRecordsInterval = setInterval(checkNewRecords, interval);
    }
    
    // Monitoring zmian danych (trzecia lampka)
    if (settings.dbCheckDataChanges && db2.database) {
        const interval = settings.dbCheckDataChangesInterval * 60 * 1000;
        console.log(`[DB Monitor] Starting data changes check (every ${settings.dbCheckDataChangesInterval} min)`);
        
        // Pierwsze sprawdzenie - NIE od razu, nawet gdy skipInitialCheck=false
        // Zapobiega jednoczesnym operacjom które blokują UI
        // Pierwsze sprawdzenie odbędzie się po upływie interwału (11 min)
        
        // Póżniejsze co N minut
        dataChangesInterval = setInterval(checkDataChanges, interval);
    }
}

/**
 * Zatrzymuje monitorowanie bazy
 */
function stopDbMonitoring() {
    if (newRecordsInterval) {
        clearInterval(newRecordsInterval);
        newRecordsInterval = null;
        console.log('[DB Monitor] Stopped new records check');
    }
    if (dataChangesInterval) {
        clearInterval(dataChangesInterval);
        dataChangesInterval = null;
        console.log('[DB Monitor] Stopped data changes check');
    }
}

/**
 * Restartuje monitorowanie (gdy zmieniają się ustawienia)
 * Nie wykonuje natychmiastowego sprawdzenia - tylko restartuje timery
 */
function restartDbMonitoring() {
    console.log('[DB Monitor] Restarting monitoring...');
    startDbMonitoring(true); // Skip initial check
}

// Export monitoring functions globally
window.startDbMonitoring = startDbMonitoring;
window.stopDbMonitoring = stopDbMonitoring;
window.restartDbMonitoring = restartDbMonitoring;
window.checkNewRecords = checkNewRecords;
window.checkDataChanges = checkDataChanges;

// Initialize database on load
db2.init().then(() => {
    console.log('[API Handler] Database initialized');
    updateStatusIndicators();
    updateSummaryTab();
    if (window._updateCacheBar) window._updateCacheBar();
    
    // Uruchom monitorowanie statusu live Sejmu (co 5 minut)
    startLivePolling(updateLiveSection, 5);
    console.log('[API Handler] Live Sejm monitoring started');
    
    // Uruchom monitorowanie bazy (jeśli włączone w ustawieniach)
    // ZAWSZE skip initial check przy starcie - pierwsze sprawdzenie dopiero po upływie interwałów
    setTimeout(() => {
        startDbMonitoring(true); // Skip initial check - zapobiega zawieszeniu przy starcie
    }, 2000);
    
    // Ustaw widoczność lampek według ustawień
    updateLampsVisibility();
    
    // Ustaw tryb przycisku ETL na podstawie stanu bazy
    updateFetchButtonMode();
}).catch(err => {
    console.error('[API Handler] Failed to initialize database:', err);
});

// Deduplication check to prevent duplicate event listeners
if (!window.__apiHandlerInitialized) {
    window.__apiHandlerInitialized = true;

// Main ETL fetch button handler — fetch / abort / verify
// Zmienne globalne przeniesione na górę pliku przed updateButtonStates()

function setClearBtnEnabled(enabled) {
    const clearBtn = document.getElementById('etlClearBtn');
    if (clearBtn) clearBtn.disabled = !enabled;
}

/**
 * Ustawia tryb przycisku ETL na podstawie stanu bazy
 */
function updateFetchButtonMode() {
    const btn = document.getElementById('etlFetchBtn');
    if (!btn) return;
    
    const dbEmpty = isDatabaseEmpty();
    
    if (dbEmpty) {
        // Baza pusta - tryb fetch (pierwsze pobranie)
        fetchBtnMode = 'fetch';
        btn.textContent = '📥 Pobierz/Zaktualizuj dane';
        btn.classList.remove('etl-btn-verify-mode');
    } else {
        // Baza ma dane - tryb verify (sprawdzenie)
        fetchBtnMode = 'verify';
        btn.textContent = '🔍 Sprawdź poprawność';
        btn.classList.add('etl-btn-verify-mode');
    }
    
    console.log(`[updateFetchButtonMode] Mode set to: ${fetchBtnMode}`);
}

// Export globally for db-buttons.js
window.updateFetchButtonMode = updateFetchButtonMode;

document.getElementById('etlFetchBtn')?.addEventListener('click', async () => {
    // Jeśli kolejka zadań jest aktywna (monitoring sprawdza dane), nie pozwól kliknąć
    if (taskQueue.isRunning() && fetchBtnMode !== 'abort') {
        ToastModule.info('Poczekaj na zakończenie sprawdzania danych...', { duration: 2000 });
        return;
    }
    
    if (fetchBtnMode === 'abort') {
        if (currentAbortController) currentAbortController.abort();
        if (verifyAbortController) verifyAbortController.abort();
        return;
    }
    if (fetchBtnMode === 'verify') {
        await runVerification();
        return;
    }
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
    showEtlProgress();

    try {
        const report = await verifyDatabase(db2, {
            onProgress: (percent, stage, details) => {
                updateEtlProgress(percent, stage, details);
            }
        });

        hideEtlProgress();
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Pobierz/Zaktualizuj dane';
        }

        const newItems = report.results.filter(r => r.status === 'new');
        if (newItems.length > 0) {
            setRecordsStatus(true);
            const totalNew = newItems.reduce((s, r) => s + (r.diff || 0), 0);
            const msg = `🆕 Znaleziono ${totalNew} nowych rekordów w API (${newItems.map(r => r.label).join(', ')}).\n\nCzy pobrać?`;
            if (confirm(msg)) {
                await startPipelineETL();
            }
        } else {
            setRecordsStatus(false);
            ToastModule.success('Brak nowych danych w API. Baza jest aktualna.');
        }
    } catch (error) {
        console.error('[Smart Fetch] Verify error:', error);
        hideEtlProgress();
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Pobierz/Zaktualizuj dane';
        }
        ToastModule.error('Błąd sprawdzenia: ' + error.message);
    }
}

async function startPipelineETL() {
    console.log('🚀 [Zadanie] Pobierz/Zaktualizuj dane rozpoczęty');
    isFetching = true;
    updateChartActionButtons(true); // Zablokuj przyciski akcji podczas pobierania

    // Zatrzymaj monitorowanie bazy podczas fetcha
    stopDbMonitoring();

    // Create AbortController for this run
    currentAbortController = new AbortController();
    setFetchAbortController(currentAbortController);

    const btn = document.getElementById('etlFetchBtn');

    // UI setup — button becomes "Stop", disable clear
    fetchBtnMode = 'abort';
    setClearBtnEnabled(false);
    if (btn) {
        btn.textContent = '⏹️ Zatrzymaj pobieranie';
        btn.classList.add('etl-btn-abort');
    }
    showEtlProgress();

    try {
        // Build config from ETL Panel UI
        const config = buildConfigFromUI();

        // Run pipeline with callbacks
        const result = await runPipeline(config, {
            onProgress: (percent, stage, details) => {
                updateEtlProgress(percent, stage, details);
            },
            onLog: (message) => {},
            onError: (error) => {
                console.error('[Pipeline Error]', error);
            },
            onComplete: (result) => {
                // Odśwież panel zarządzania wykresami po zakończeniu pipeline
                try { refreshChartsManager(); } catch(e) {}
                // Odśwież predykcje
                try { refreshPredictions(); } catch(e) {}
            }
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

            // Capture requested counts from ETL form spans
            const requestedCounts = {};
            const sittingsSpanText = document.getElementById('etlSittingsCount')?.textContent || '';
            const transcriptsSpanText = document.getElementById('etlTranscriptsCount')?.textContent || '';
            const votingsSpanText = document.getElementById('etlVotingsCount')?.textContent || '';
            const votesSpanText = document.getElementById('etlVotesCount')?.textContent || '';

            const sMatch = sittingsSpanText.match(/(\d[\d\s]*)/);
            if (sMatch) requestedCounts.sittings = parseInt(sMatch[1].replace(/\s/g, ''));

            const dMatch = transcriptsSpanText.match(/(\d[\d\s]*)\s*dni/);
            if (dMatch) requestedCounts.sessionDays = parseInt(dMatch[1].replace(/\s/g, ''));

            const wMatch = transcriptsSpanText.match(/(\d[\d\s]*)\s*wyp/);
            if (wMatch) requestedCounts.transcripts = parseInt(wMatch[1].replace(/\s/g, ''));

            const vMatch = votingsSpanText.match(/(\d[\d\s]*)/);
            if (vMatch) requestedCounts.votings = parseInt(vMatch[1].replace(/\s/g, ''));

            const gMatch = votesSpanText.match(/(\d[\d\s]*)/);
            if (gMatch) requestedCounts.votes = parseInt(gMatch[1].replace(/\s/g, ''));

            // Per-kadencja module counts
            const perTermSpans = [
                { span: 'etlInterpellationsCount', key: 'interpelacje' },
                { span: 'etlWrittenQuestionsCount', key: 'zapytania' },
                { span: 'etlBillsCount', key: 'projekty_ustaw' },
                { span: 'etlLegalActsCount', key: 'ustawy' },
                { span: 'etlCommitteeSittingsCount', key: 'komisje_posiedzenia' }
            ];

            // Komisje count: parse from select "all" option text "Wszystkie komisje (30)"
            const committeeAllOpt = document.querySelector('#etlCommitteeSelect option[value="all"]');
            if (committeeAllOpt) {
                const cMatch = committeeAllOpt.textContent.match(/\((\d+)\)/);
                if (cMatch) requestedCounts.komisje = parseInt(cMatch[1]);
            }
            for (const { span, key } of perTermSpans) {
                const text = document.getElementById(span)?.textContent || '';
                const m = text.match(/(\d[\d\s]*)/);
                if (m) requestedCounts[key] = parseInt(m[1].replace(/\s/g, ''));
            }

            // Fallback: jeśli zliczanie z ETL spanów nie zdążyło, użyj danych z pipeline
            if (!requestedCounts.votings && stats.glosowania > 0) requestedCounts.votings = stats.glosowania;
            if (!requestedCounts.votes && result.individualVotes > 0) requestedCounts.votes = result.individualVotes;
            if (!requestedCounts.transcripts && stats.wypowiedzi > 0) requestedCounts.transcripts = stats.wypowiedzi;

            // Zapisz info o ostatnim pobraniu
            const lastFetch = {
                newSittings: result.newSittings || 0,
                sessionDays: result.sessionDays || 0,
                individualVotes: result.individualVotes || 0,
                savedRecords: result.savedRecords || 0,
                stats: stats,
                modules: config.modules || [],
                timestamp: result.timestamp,
                requestedCounts
            };
            localStorage.setItem('nostradamnos_lastFetch', JSON.stringify(lastFetch));

            // Update status indicators + summary tab + cache bar
            updateStatusIndicators();
            setRecordsStatus(false);
            updateSummaryTab();
            if (window._updateCacheBar) window._updateCacheBar();

            const persistWarning = db2._persistFailed
                ? '\n\n⚠️ Baza danych jest za duża na localStorage — dane są dostępne w pamięci, ale nie przetrwają odświeżenia strony.'
                : '';
            ToastModule.success(
                `${details || 'Brak danych w bazie'}${persistWarning}`,
                { title: 'Pobrano dane', duration: 8000 }
            );
            console.log('✅ [Zadanie] Pobierz/Zaktualizuj dane zakończony');

            // Switch button to verify mode
            fetchBtnMode = 'verify';
        }

    } catch (error) {
        fetchBtnMode = 'fetch';
        if (error.name === 'AbortError' || currentAbortController?.signal?.aborted) {
            // User aborted — clear database
            console.log('[API Handler] Fetch aborted by user — clearing database');
            try {
                await db2.init();
                db2.clearAll();
                updateStatusIndicators();
                setRecordsStatus(false);
                setValidityStatus(false);
                updateSummaryTab();
                if (window._updateCacheBar) window._updateCacheBar();
                updateFetchButtonMode(); // Reset to fetch mode (empty database)
                ToastModule.success('Pobieranie zatrzymane — baza wyczyszczona');
            } catch (clearErr) {
                console.error('[API Handler] Clear after abort error:', clearErr);
            }
        } else {
            console.error('[API Handler] Error:', error);
            ToastModule.error('Błąd ETL: ' + error.message);
        }
        console.log('❌ [Zadanie] Pobierz/Zaktualizuj dane zakończony z błędem');

    } finally {
        isFetching = false;
        updateChartActionButtons(false); // Odblokuj przyciski akcji
        currentAbortController = null;
        setFetchAbortController(null);
        hideEtlProgress();
        setClearBtnEnabled(true);
        // If still in abort mode (error/abort path), reset to fetch
        if (fetchBtnMode === 'abort') fetchBtnMode = 'fetch';
        if (btn) {
            btn.classList.remove('etl-btn-abort');
            if (fetchBtnMode === 'verify') {
                btn.textContent = '🔍 Sprawdź poprawność';
                btn.classList.add('etl-btn-verify-mode');
            } else {
                btn.textContent = '📥 Pobierz/Zaktualizuj dane';
            }
        }
        
        // Wznow monitorowanie bazy po zakończeniu fetcha
        // Skip initial check - dane świeżo pobrane/zaktualizowane, nie sprawdzaj od razu
        startDbMonitoring(true);
    }
}

// Verification — triggered by 2nd click after fetch
async function runVerification() {
    const btn = document.getElementById('etlFetchBtn');

    // Zatrzymaj monitoring bazy podczas weryfikacji
    stopDbMonitoring();

    // Użyj kolejki zadań aby zapobiec jednoczesnym operacjom
    return taskQueue.add('runVerification', async () => {
        let pipelineRanInside = false;
        // Switch to abort mode so user can cancel
        verifyAbortController = new AbortController();
        fetchBtnMode = 'abort';
        setClearBtnEnabled(false);
        if (btn) {
            btn.textContent = '⏹️ Zatrzymaj weryfikację';
            btn.classList.add('etl-btn-abort');
        }
        showEtlProgress();

        try {
            const report = await verifyDatabase(db2, { signal: verifyAbortController.signal });
            const newItems = report.results.filter(r => r.status === 'new');

        if (newItems.length > 0) {
            setRecordsStatus(true);
            setValidityStatus(true);
            const totalNew = newItems.reduce((s, r) => s + (r.diff || 0), 0);
            const msg = `Znaleziono ${totalNew} nowych rekordów w API (${newItems.map(r => r.label).join(', ')}).\n\nCzy pobrać poprawki?`;
            if (confirm(msg)) {
                hideEtlProgress();
                verifyAbortController = null;
                fetchBtnMode = 'fetch';
                if (btn) {
                    btn.classList.remove('etl-btn-abort', 'etl-btn-verify-mode');
                }
                // Nie wznawiamy monitoringu tutaj - startPipelineETL zrobi to sam
                pipelineRanInside = true;
                await startPipelineETL();
                return;
            }
        } else {
            setRecordsStatus(false);
            setValidityStatus(false);
            ToastModule.success('Baza jest aktualna — brak nowych danych w API.');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[Verification] Aborted by user');
        } else {
            console.error('[Verification] Error:', error);
            ToastModule.error('Błąd weryfikacji: ' + error.message);
        }
    } finally {
        // Return to verify mode
        verifyAbortController = null;
        fetchBtnMode = 'verify';
        hideEtlProgress();
        setClearBtnEnabled(true);
        if (btn) {
            btn.classList.remove('etl-btn-abort');
            btn.classList.add('etl-btn-verify-mode');
            btn.textContent = '🔍 Sprawdź poprawność';
        }
        
        // Wznów monitorowanie bazy po weryfikacji
        // Skip initial check - użytkownik właśnie zakończył weryfikację, nie sprawdzaj od razu ponownie
        // Nie wznawiaj jeśli startPipelineETL już to zrobił (unikamy podwójnego interwału)
        if (!pipelineRanInside) {
            startDbMonitoring(true);
        }
    }
    }); // Zamknięcie taskQueue.add
}

// Clear cache button
document.getElementById('etlClearBtn')?.addEventListener('click', async () => {
    // Sprawdź czy kolejka zadań nie działa
    if (taskQueue.isRunning()) {
        ToastModule.info('Poczekaj na zakończenie sprawdzania danych...', { duration: 2000 });
        return;
    }
    
    if (confirm('Wyczyścić wszystkie dane z bazy?')) {
        console.log('🚀 [Zadanie] Wyczyść bazę rozpoczęty');
        try {
            await db2.init();
            db2.clearAll();
            console.log('[API Handler] Database cleared');

            // Update status indicators + summary tab + cache bar after clearing
            updateStatusIndicators();
            setRecordsStatus(false);
            setValidityStatus(false);
            updateSummaryTab();
            if (window._updateCacheBar) window._updateCacheBar();

            // Reset fetch button to default state (empty database = fetch mode)
            updateFetchButtonMode();

            ToastModule.success('Baza wyczyszczona');
            console.log('✅ [Zadanie] Wyczyść bazę zakończony');
        } catch (error) {
            console.error('[API Handler] Clear error:', error);
            ToastModule.error('Błąd: ' + error.message);
        }
    }
});

// Live Stream Modal Handler
const liveLamp = document.getElementById('liveLamp');
const liveSection = document.getElementById('liveSection');
const liveStreamModal = document.getElementById('liveStreamModal');
const closeLiveStream = document.getElementById('closeLiveStream');
const liveStreamIframe = document.getElementById('liveStreamIframe');

if (liveSection && liveLamp && liveStreamModal) {
    liveSection.addEventListener('click', () => {
        // Sprawdź czy trwa transmisja (czy lampka miga)
        if (liveLamp.classList.contains('floating-lamp-live-blink')) {
            // Oficjalny kanał YouTube Sejmu RP - na żywo
            const streamUrl = 'https://www.youtube.com/@SejmRzeczypospolitejPolskiej/streams';
            window.open(streamUrl, 'SejmLiveStream', 'width=1280,height=720');
            console.log('[Live Stream] Opened YouTube channel in new window');
        }
    });
}

if (closeLiveStream && liveStreamModal) {
    const closeModal = () => {
        liveStreamModal.style.display = 'none';
        liveStreamIframe.src = ''; // Stop stream
        console.log('[Live Stream] Closed');
    };
    
    closeLiveStream.addEventListener('click', closeModal);
    
    // Zamknij po kliknięciu w overlay
    const overlay = liveStreamModal.querySelector('.live-stream-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeModal);
    }
    
    // Zamknij na ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && liveStreamModal.style.display === 'flex') {
            closeModal();
        }
    });
}

console.log('[API Handler v2] Loaded - using Pipeline ETL');

} // End of deduplication check
