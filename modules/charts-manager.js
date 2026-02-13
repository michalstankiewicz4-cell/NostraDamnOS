// Charts Manager - zarządzanie widocznością i kolejnością wykresów
import { db2 } from './database-v2.js';

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

/**
 * Inicjalizacja zarządzania wykresami
 */
export function initChartsManager() {
    console.log('[Charts Manager] Initializing...');
    
    // Załaduj zapisaną konfigurację lub użyj domyślnej
    loadChartsState();
    
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
            // Merge z domyślną konfiguracją (na wypadek dodania nowych wykresów)
            chartsState = CHARTS_CONFIG.map(chart => {
                const savedChart = parsed.find(s => s.id === chart.id);
                return savedChart || chart;
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
 * Sprawdza czy dane dla wykresu są dostępne
 */
function checkDataAvailability(chartId) {
    if (!db2.database) return false;
    
    try {
        const dataChecks = {
            'chartKluby': () => db2.database.exec("SELECT COUNT(*) as cnt FROM poslowie WHERE klub IS NOT NULL")[0]?.values[0][0] > 0,
            'chartTopPoslowie': () => db2.database.exec("SELECT COUNT(*) as cnt FROM wypowiedzi")[0]?.values[0][0] > 0,
            'chartGlosowania': () => db2.database.exec("SELECT COUNT(*) as cnt FROM glosowania")[0]?.values[0][0] > 0,
            'chartCustom': () => db2.database.exec("SELECT COUNT(*) as cnt FROM poslowie")[0]?.values[0][0] > 0,
            'chartNajmniejAktywni': () => db2.database.exec("SELECT COUNT(*) as cnt FROM wypowiedzi")[0]?.values[0][0] > 0,
            'chartNajmniejAktywneKluby': () => db2.database.exec("SELECT COUNT(*) as cnt FROM wypowiedzi")[0]?.values[0][0] > 0,
            'chartHeatmap': () => db2.database.exec("SELECT COUNT(*) as cnt FROM posiedzenia")[0]?.values[0][0] > 0,
            'chartSentimentDist': () => db2.database.exec("SELECT COUNT(*) as cnt FROM wypowiedzi")[0]?.values[0][0] > 0,
            'chartSentimentTime': () => db2.database.exec("SELECT COUNT(*) as cnt FROM wypowiedzi")[0]?.values[0][0] > 0,
            'chartSentimentParty': () => db2.database.exec("SELECT COUNT(*) as cnt FROM wypowiedzi")[0]?.values[0][0] > 0,
            'chartTopSpeakers': () => db2.database.exec("SELECT COUNT(*) as cnt FROM wypowiedzi")[0]?.values[0][0] > 0
        };
        
        const checkFn = dataChecks[chartId];
        return checkFn ? checkFn() : false;
    } catch (error) {
        return false;
    }
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
        const lampClass = hasData ? 'chart-data-lamp-ok' : 'chart-data-lamp-error';
        const lampTitle = hasData ? 'Dane dostępne' : 'Brak danych';
        
        item.innerHTML = `
            <span class="charts-order-drag-handle" title="Przeciągnij aby zmienić kolejność">⋮⋮</span>
            <span class="${lampClass}" title="${lampTitle}">●</span>
            <input type="checkbox" 
                   id="chart-toggle-${chart.id}" 
                   class="charts-order-checkbox" 
                   ${chart.enabled ? 'checked' : ''}>
            <label for="chart-toggle-${chart.id}" class="charts-order-label">
                <span class="charts-order-icon">${chart.icon}</span>
                ${chart.name}
            </label>
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
            if (chart.enabled) {
                card.style.display = '';
                grid.appendChild(card);
            } else {
                card.style.display = 'none';
            }
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
