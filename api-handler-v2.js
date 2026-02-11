// API Handler v2.0 - Uses Pipeline ETL
import { runPipeline, buildConfigFromUI, getCacheStatus } from './pipeline.js';
import { db2 } from './modules/database-v2.js';
import ToastModule from './modules/toast.js';

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
  } catch (error) {
    console.error('[updateStatusIndicators] Error:', error);
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
    lamp.className = 'floating-lamp floating-lamp-error';
    lamp.title = 'Znaleziono błędy';
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
    ustawy:                { icon: '⚖️', label: 'Ustawy (akty prawne)' }
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
    ustawy:                ['id_ustawy', 'publisher', 'year', 'pos', 'title', 'type', 'status']
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
            html += `<td title="${display.replace(/"/g, '&quot;')}">${display}</td>`;
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
        'interpelacje', 'zapytania', 'projekty_ustaw', 'komisje',
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

        // Dodaj kartę dla głosów indywidualnych (zliczane z totalVoted, nie pobierane do DB)
        let indVotes = 0;
        try {
            const lf = JSON.parse(localStorage.getItem('nostradamnos_lastFetch') || '{}');
            indVotes = lf.individualVotes || 0;
        } catch { /* ignore */ }
        if (indVotes > 0 || sqlCounts.glosy_indywidualne > 0) {
            const sqlGlosy = sqlCounts.glosy_indywidualne || 0;
            const card = document.createElement('div');
            card.className = 'summary-card';
            card.setAttribute('data-table', 'glosowania');
            card.innerHTML = `
                <div class="summary-icon">📋</div>
                <div class="summary-content">
                    <div class="summary-label">Głosy indywidualne</div>
                    <div class="summary-value">
                        <span class="summary-value-main">${indVotes.toLocaleString('pl-PL')}</span>
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

    const configRaw = localStorage.getItem('nostradamnos_lastFetchConfig');
    const fetchRaw = localStorage.getItem('nostradamnos_lastFetch');

    if (!configRaw || !fetchRaw) {
        panel.style.display = 'none';
        return;
    }

    let config, fetched;
    try {
        config = JSON.parse(configRaw);
        fetched = JSON.parse(fetchRaw);
    } catch { panel.style.display = 'none'; return; }

    const modules = config.modules || [];
    const stats = fetched.stats || {};
    const reqCounts = fetched.requestedCounts || {};

    // Live SQL counts from database (includes dni_obrad)
    let sqlStats = {};
    try { sqlStats = getSqlCounts(); } catch { /* db not ready */ }

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
        oswiadczenia: 'oswiadczenia_majatkowe'
    };

    const setText = (id, text, cls) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        if (cls) el.className = cls;
    };

    // Left column: show count if available, otherwise "tak/—"
    const setReq = (id, mod, countValue) => {
        const el = document.getElementById(id);
        if (!el) return;
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

    // Right column: show fetched stat count + sql(x) from live DB
    const setStat = (id, mod) => {
        const el = document.getElementById(id);
        if (!el) return;
        const statKey = modToStat[mod] || mod;
        const val = stats[statKey];
        const sqlVal = sqlStats[statKey] || 0;
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
    const inst = config.typ === 'senat' ? 'Senat' : 'Sejm';
    setText('fovInst', inst);
    setText('fovKadencja', config.kadencja ? `nr ${config.kadencja}` : 'wszystkie');
    setText('fovRange', `${config.rangeFrom || '?'} — ${config.rangeTo || '?'}`);
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

    // Prawa kolumna: Pobrane
    setText('fovGotInst', inst);
    setText('fovGotKadencja', config.kadencja ? `nr ${config.kadencja}` : 'wszystkie');
    setText('fovGotRange', fetched.newSittings > 0 ? `${fetched.newSittings} posiedzeń` : '—');
    setStat('fovGotDeputies', 'poslowie');
    setStat('fovGotSittings', 'posiedzenia');
    // Dni obrad: from pipeline's sessionDays count + sql
    const gotSessionDays = fetched.sessionDays || 0;
    const sqlSessionDays = sqlStats.dni_obrad || 0;
    const sessionDaysSql = sqlSessionDays > 0 ? ` sql(${sqlSessionDays.toLocaleString('pl-PL')})` : '';
    const sessionDaysEl = document.getElementById('fovGotSessionDays');
    if (sessionDaysEl) {
        if (gotSessionDays > 0) {
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
    setStat('fovGotTranscripts', 'wypowiedzi');
    setStat('fovGotVotings', 'glosowania');
    // Głosy indywidualne: użyj individualVotes (z totalVoted) + sql SUM(za+przeciw+wstrzymalo)
    const indVotes = fetched.individualVotes || 0;
    const sqlGlosy = sqlStats.glosy_indywidualne || 0;
    const glosySql = sqlGlosy > 0 ? ` sql(${sqlGlosy.toLocaleString('pl-PL')})` : '';
    const votesEl = document.getElementById('fovGotVotes');
    if (votesEl) {
        if (indVotes > 0 && modules.includes('glosy')) {
            votesEl.textContent = indVotes.toLocaleString('pl-PL') + glosySql;
            votesEl.className = 'fov-value';
        } else if (modules.includes('glosy')) {
            votesEl.textContent = '0' + glosySql;
            votesEl.className = sqlGlosy > 0 ? 'fov-value' : 'fov-unchecked';
        } else {
            votesEl.textContent = '—';
            votesEl.className = 'fov-unchecked';
        }
    }
    setStat('fovGotInterpellations', 'interpelacje');
    setStat('fovGotQuestions', 'zapytania');
    setStat('fovGotBills', 'projekty_ustaw');
    setStat('fovGotActs', 'ustawy');
    setStat('fovGotDisclosures', 'oswiadczenia');

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

function showEtlProgress() {
    const pctEl = document.getElementById('etlProgressPercent');
    const bar = document.getElementById('etlProgressBar');
    if (pctEl) pctEl.style.display = '';
    if (bar) bar.style.width = '0%';
    setLoadLamp('loading');
}

function hideEtlProgress() {
    const pctEl = document.getElementById('etlProgressPercent');
    const bar = document.getElementById('etlProgressBar');
    if (pctEl) pctEl.style.display = 'none';
    if (bar) bar.style.width = '0%';
    setLoadLamp('idle');
}

function updateEtlProgress(percent) {
    const bar = document.getElementById('etlProgressBar');
    const pctEl = document.getElementById('etlProgressPercent');
    if (bar) bar.style.width = percent + '%';
    if (pctEl) pctEl.textContent = Math.round(percent) + '%';
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
    updateSummaryTab();
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
    showEtlProgress();

    try {
        const verifyConfig = { ...currentConfig, fetchMode: 'verify' };
        const result = await runPipeline(verifyConfig, {
            onLog: (msg) => console.log('[Verify]', msg),
            onProgress: (percent) => {
                updateEtlProgress(percent);
            },
            onComplete: () => {}
        });

        hideEtlProgress();
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
    
    const btn = document.getElementById('etlFetchBtn');
    
    // UI setup
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Pobieranie...';
    }
    showEtlProgress();

    try {
        // Build config from ETL Panel UI
        const config = buildConfigFromUI();

        // Run pipeline with callbacks
        const result = await runPipeline(config, {
            onProgress: (percent) => {
                updateEtlProgress(percent);
            },
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
                { span: 'etlLegalActsCount', key: 'ustawy' }
            ];
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

            // Update status indicators + summary tab
            updateStatusIndicators();
            setRecordsStatus(false);
            updateSummaryTab();

            const persistWarning = db2._persistFailed
                ? '\n\n⚠️ Baza danych jest za duża na localStorage — dane są dostępne w pamięci, ale nie przetrwają odświeżenia strony.'
                : '';
            ToastModule.success(
                `${details || 'Brak danych w bazie'}${persistWarning}`,
                { title: 'Pobrano dane', duration: 8000 }
            );
            console.log('✅ [Zadanie] Pobierz/Zaktualizuj dane zakończony');
        }
        
    } catch (error) {
        console.error('[API Handler] Error:', error);
        ToastModule.error('Błąd ETL: ' + error.message);
        console.log('❌ [Zadanie] Pobierz/Zaktualizuj dane zakończony z błędem');
        
    } finally {
        isFetching = false;
        hideEtlProgress();
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Pobierz/Zaktualizuj dane';
        }
    }
}

// Clear cache button
document.getElementById('etlClearBtn')?.addEventListener('click', async () => {
    if (confirm('Wyczyścić wszystkie dane z bazy?')) {
        console.log('🚀 [Zadanie] Wyczyść bazę rozpoczęty');
        try {
            await db2.init();
            db2.clearAll();
            console.log('[API Handler] Database cleared');
            
            // Update status indicators + summary tab after clearing
            updateStatusIndicators();
            setRecordsStatus(false);
            setValidityStatus(false);
            updateSummaryTab();

            ToastModule.success('Baza wyczyszczona');
            console.log('✅ [Zadanie] Wyczyść bazę zakończony');
        } catch (error) {
            console.error('[API Handler] Clear error:', error);
            ToastModule.error('Błąd: ' + error.message);
        }
    }
});

console.log('[API Handler v2] Loaded - using Pipeline ETL');

} // End of deduplication check
