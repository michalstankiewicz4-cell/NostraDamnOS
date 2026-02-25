// Charts Manager - zarządzanie widocznością i kolejnością wykresów
import { db2 } from './database-v2.js';
import { trackEvent } from './analytics.js';

const CHARTS_CONFIG = [
    { id: 'chartKluby', name: 'Rozkład klubów parlamentarnych', icon: '🏛️', enabled: true },
    { id: 'chartTopPoslowie', name: 'Top 10 najaktywniejszych posłów', icon: '👥', enabled: true },
    { id: 'chartGlosowania', name: 'Wyniki głosowań', icon: '🗳️', enabled: true },
    { id: 'chartCustom', name: 'Wykres niestandardowy', icon: '📊', enabled: true },
    { id: 'chartNajmniejAktywni', name: 'Top 20 najmniej aktywnych posłów', icon: '😴', enabled: true },
    { id: 'chartNajmniejAktywneKluby', name: 'Najmniej aktywne kluby', icon: '🔻', enabled: true },
    { id: 'chartHeatmap', name: 'Heatmapa frekwencji', icon: '🔥', enabled: true },
    { id: 'chartSentimentDist', name: 'Rozkład sentymentu', icon: '📊', enabled: true },
    { id: 'chartSentimentTime', name: 'Sentyment w czasie', icon: '📈', enabled: true },
    { id: 'chartSentimentParty', name: 'Sentyment per klub', icon: '🎭', enabled: true },
    { id: 'chartTopSpeakers', name: 'Top mówcy - sentyment', icon: '🎤', enabled: true }
];

const STORAGE_KEY = 'nostradamnos_charts_config';

let chartsState = [];
let dataAvailabilityCache = null;

/**
 * Jeden batched SQL zamiast 11 oddzielnych — wynik cache'owany do następnego refresh
 */
function warmDataAvailabilityCache() {
    dataAvailabilityCache = null;
    if (!db2.database) return;
    try {
        const res = db2.database.exec(`SELECT
            (SELECT COUNT(*) FROM poslowie WHERE klub IS NOT NULL LIMIT 1) as has_klub,
            (SELECT COUNT(*) FROM wypowiedzi LIMIT 1)                      as has_wyp,
            (SELECT COUNT(*) FROM glosowania LIMIT 1)                      as has_glos,
            (SELECT COUNT(*) FROM poslowie LIMIT 1)                        as has_posl,
            (SELECT COUNT(*) FROM posiedzenia LIMIT 1)                     as has_posied`);
        if (res.length && res[0].values.length) {
            const [hasKlub, hasWyp, hasGlos, hasPosl, hasPosied] = res[0].values[0];
            dataAvailabilityCache = {
                chartKluby:               hasKlub  > 0,
                chartTopPoslowie:         hasWyp   > 0,
                chartGlosowania:          hasGlos  > 0,
                chartCustom:              hasPosl  > 0,
                chartNajmniejAktywni:     hasWyp   > 0,
                chartNajmniejAktywneKluby: hasWyp  > 0,
                chartHeatmap:             hasPosied > 0,
                chartSentimentDist:       hasWyp   > 0,
                chartSentimentTime:       hasWyp   > 0,
                chartSentimentParty:      hasWyp   > 0,
                chartTopSpeakers:         hasWyp   > 0
            };
        }
    } catch { /* db nie gotowa */ }
}

/**
 * Inicjalizacja zarządzania wykresami
 */
export function initChartsManager() {
    console.log('[Charts Manager] Initializing...');

    // Załaduj zapisaną konfigurację lub użyj domyślnej
    loadChartsState();

    // Wczytaj dostępność danych jednym zapytaniem
    warmDataAvailabilityCache();

    // Renderuj panel kontrolny
    renderControlPanel();
    
    // Zastosuj ustawienia do wykresów
    applyChartsVisibility();
    
    // Dodaj event listenery
    setupEventListeners();
    
    console.log('[Charts Manager] Ready');
}

/**
 * Odśwież panel kontrolny (np. po załadowaniu danych)
 */
export function refreshChartsManager() {
    console.log('[Charts Manager] Refreshing...');
    dataAvailabilityCache = null; // inwaliduj cache — dane mogły się zmienić
    warmDataAvailabilityCache();
    renderControlPanel();
}

/**
 * Załaduj stan wykresów z localStorage
 */
function loadChartsState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            
            // Zachowaj kolejność z zapisanego stanu, ale merge z domyślną konfiguracją
            chartsState = parsed.map(savedChart => {
                const defaultChart = CHARTS_CONFIG.find(c => c.id === savedChart.id);
                // Merge zapisany stan z domyślną konfiguracją (priorytet dla zapisanego)
                return defaultChart ? { ...defaultChart, ...savedChart } : savedChart;
            });
            
            // Dodaj nowe wykresy, których nie było w zapisanej konfiguracji (na końcu listy)
            const savedIds = new Set(parsed.map(s => s.id));
            CHARTS_CONFIG.forEach(chart => {
                if (!savedIds.has(chart.id)) {
                    chartsState.push({ ...chart });
                }
            });
            
            console.log('[Charts Manager] Loaded saved state:', chartsState);
        } else {
            chartsState = [...CHARTS_CONFIG];
        }
    } catch (error) {
        console.error('[Charts Manager] Error loading state:', error);
        chartsState = [...CHARTS_CONFIG];
    }
}

/**
 * Zapisz stan wykresów do localStorage
 */
function saveChartsState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chartsState));
        console.log('[Charts Manager] State saved');
    } catch (error) {
        console.error('[Charts Manager] Error saving state:', error);
    }
}

/**
 * Sprawdza czy dane dla wykresu są dostępne — używa cache (1 SQL zamiast 11)
 */
function checkDataAvailability(chartId) {
    if (!db2.database) return false;
    if (!dataAvailabilityCache) warmDataAvailabilityCache();
    return dataAvailabilityCache?.[chartId] ?? false;
}

/**
 * Renderuj panel kontrolny z listą wykresów
 */
function renderControlPanel() {
    const list = document.getElementById('chartsOrderList');
    if (!list) return;
    
    list.innerHTML = '';
    
    chartsState.forEach((chart, index) => {
        const item = document.createElement('li');
        item.className = 'charts-order-item';
        item.draggable = true;
        item.dataset.chartId = chart.id;
        item.dataset.index = index;
        
        const hasData = checkDataAvailability(chart.id);
        const lampClass = hasData ? 'floating-lamp floating-lamp-ok' : 'floating-lamp floating-lamp-error';
        const lampTitle = hasData ? 'Dane dostępne' : 'Brak danych';
        
        const actionButtons = !hasData ? `
            <div class="chart-item-actions">
                <button class="chart-item-btn" data-action="goto-etl" title="Przejdź do pobierania danych">📥</button>
                <button class="chart-item-btn" data-action="import-db" title="Importuj bazę danych">💾</button>
            </div>
        ` : '';
        
        item.innerHTML = `
            <span class="charts-order-drag-handle" title="Przeciągnij aby zmienić kolejność">⋮⋮</span>
            <div class="${lampClass}" title="${lampTitle}"></div>
            <input type="checkbox" 
                   id="chart-toggle-${chart.id}" 
                   class="charts-order-checkbox" 
                   ${chart.enabled ? 'checked' : ''}>
            <label for="chart-toggle-${chart.id}" class="charts-order-label">
                <span class="charts-order-icon">${chart.icon}</span>
                ${chart.name}
            </label>
            ${actionButtons}
        `;
        
        // Event listener dla checkboxa
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            handleVisibilityChange(chart.id, e.target.checked);
        });
        
        // Drag & drop event listeners
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragleave', handleDragLeave);
        
        list.appendChild(item);
    });
}

/**
 * Zastosuj widoczność wykresów
 */
function applyChartsVisibility() {
    const grid = document.getElementById('chartsGrid');
    if (!grid) return;
    
    // Pobierz wszystkie karty wykresów
    const allCards = Array.from(grid.querySelectorAll('.chart-card'));
    
    // Usuń wszystkie karty z grida
    allCards.forEach(card => card.remove());
    
    // Dodaj karty w nowej kolejności i widoczności
    chartsState.forEach(chart => {
        const card = allCards.find(c => c.id === chart.id);
        if (card) {
            // Zawsze dodaj kartę do grida, ale ustaw odpowiednią widoczność
            card.style.display = chart.enabled ? '' : 'none';
            grid.appendChild(card);
        }
    });
}

/**
 * Obsługa zmiany widoczności wykresu
 */
function handleVisibilityChange(chartId, enabled) {
    const chart = chartsState.find(c => c.id === chartId);
    if (chart) {
        chart.enabled = enabled;
        saveChartsState();
        applyChartsVisibility();
        console.log(`[Charts Manager] ${chartId} ${enabled ? 'enabled' : 'disabled'}`);
        if (enabled) trackEvent('chart_view', { chart_id: chartId });
    }
}

/**
 * Drag & drop handlers
 */
let draggedItem = null;
let draggedIndex = -1;

function handleDragStart(e) {
    draggedItem = e.currentTarget;
    draggedIndex = parseInt(draggedItem.dataset.index);
    draggedItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', draggedItem.innerHTML);
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    
    // Usuń wszystkie drag-over classes
    document.querySelectorAll('.charts-order-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const item = e.currentTarget;
    if (item !== draggedItem) {
        item.classList.add('drag-over');
    }
    
    return false;
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    const dropTarget = e.currentTarget;
    const dropIndex = parseInt(dropTarget.dataset.index);
    
    if (draggedItem !== dropTarget && draggedIndex !== dropIndex) {
        // Przenieś element w tablicy
        const draggedChart = chartsState[draggedIndex];
        chartsState.splice(draggedIndex, 1);
        chartsState.splice(dropIndex, 0, draggedChart);
        
        // Przerenderuj panel i zastosuj zmiany
        renderControlPanel();
        applyChartsVisibility();
        saveChartsState();
        
        console.log(`[Charts Manager] Moved chart from ${draggedIndex} to ${dropIndex}`);
    }
    
    dropTarget.classList.remove('drag-over');
    
    return false;
}

/**
 * Setup event listeners dla przycisków
 */
function setupEventListeners() {
    // Zaznacz wszystkie
    const selectAllBtn = document.getElementById('chartsSelectAll');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            chartsState.forEach(chart => chart.enabled = true);
            saveChartsState();
            renderControlPanel();
            applyChartsVisibility();
        });
    }
    
    // Odznacz wszystkie
    const deselectAllBtn = document.getElementById('chartsDeselectAll');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            chartsState.forEach(chart => chart.enabled = false);
            saveChartsState();
            renderControlPanel();
            applyChartsVisibility();
        });
    }
    
    // Resetuj kolejność
    const resetOrderBtn = document.getElementById('chartsResetOrder');
    if (resetOrderBtn) {
        resetOrderBtn.addEventListener('click', () => {
            if (confirm('Przywrócić domyślną kolejność i widoczność wykresów?')) {
                chartsState = [...CHARTS_CONFIG];
                saveChartsState();
                renderControlPanel();
                applyChartsVisibility();
            }
        });
    }
}

/**
 * Eksportuj funkcje do użycia globalnie
 */
window.initChartsManager = initChartsManager;
