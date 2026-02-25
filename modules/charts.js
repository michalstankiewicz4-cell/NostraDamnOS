// Charts module — generuje wykresy Chart.js z danych w db2
import { db2 } from './database-v2.js';
import { 
    analyzeSpeechesSentiment, 
    aggregateByParty, 
    aggregateByTime, 
    getTopSpeakers,
    getSentimentDistribution 
} from './sentiment-analysis.js';

const chartInstances = {};

// Wspólne opcje Chart.js — wyłączamy animację (lazy-render z display:none)
const CHART_DEFAULTS = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false
};

const COLORS = [
    '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe',
    '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8edea',
    '#fbc2eb', '#8fd3f4', '#e0c3fc', '#ffecd2', '#fcb69f'
];

function query(sql) {
    if (!db2.database) return [];
    const result = db2.database.exec(sql);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        return obj;
    });
}

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

// Przełącza widoczność canvas vs "brak danych"
function setCardState(cardId, hasData) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const canvas = card.querySelector('canvas');
    const noData = card.querySelector('.chart-no-data');
    if (canvas) canvas.style.display = hasData ? '' : 'none';
    if (noData) noData.style.display = hasData ? 'none' : '';
}

// 1. Rozkład klubów parlamentarnych (doughnut)
function renderKluby() {
    const data = query("SELECT klub, COUNT(*) as cnt FROM poslowie WHERE klub IS NOT NULL GROUP BY klub ORDER BY cnt DESC");
    if (!data.length) { setCardState('chartKluby', false); return; }

    setCardState('chartKluby', true);
    destroyChart('kluby');

    chartInstances['kluby'] = new Chart(document.getElementById('canvasKluby'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.klub || 'Brak'),
            datasets: [{
                data: data.map(d => d.cnt),
                backgroundColor: COLORS.slice(0, data.length)
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            responsive: true,
            plugins: {
                legend: { position: 'right', labels: { color: '#ccc', font: { size: 11 } } }
            }
        }
    });
}

// 2. Top 10 najaktywniejszych posłów (bar)
function renderTopPoslowie() {
    const data = query("SELECT mowca, COUNT(*) as cnt FROM wypowiedzi WHERE mowca IS NOT NULL GROUP BY mowca ORDER BY cnt DESC LIMIT 10");
    if (!data.length) { setCardState('chartTopPoslowie', false); return; }

    setCardState('chartTopPoslowie', true);
    destroyChart('topPoslowie');

    chartInstances['topPoslowie'] = new Chart(document.getElementById('canvasTopPoslowie'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.mowca.length > 25 ? d.mowca.slice(0, 25) + '...' : d.mowca),
            datasets: [{
                label: 'Wypowiedzi',
                data: data.map(d => d.cnt),
                backgroundColor: '#667eea'
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#ccc', font: { size: 11 } }, grid: { display: false } }
            }
        }
    });
}

// 3. Wyniki głosowań (doughnut)
function renderGlosowania() {
    const data = query("SELECT SUM(za) as za, SUM(przeciw) as przeciw, SUM(wstrzymalo) as wstrzymalo FROM glosowania");
    if (!data.length || (!data[0].za && !data[0].przeciw)) { setCardState('chartGlosowania', false); return; }

    setCardState('chartGlosowania', true);
    destroyChart('glosowania');

    const d = data[0];
    chartInstances['glosowania'] = new Chart(document.getElementById('canvasGlosowania'), {
        type: 'doughnut',
        data: {
            labels: ['Za', 'Przeciw', 'Wstrzymało się'],
            datasets: [{
                data: [d.za || 0, d.przeciw || 0, d.wstrzymalo || 0],
                backgroundColor: ['#43e97b', '#fa709a', '#fee140']
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            responsive: true,
            plugins: {
                legend: { position: 'right', labels: { color: '#ccc', font: { size: 12 } } }
            }
        }
    });
}

// === CUSTOM CHART RENDERERS ===

const canvasId = 'canvasCustom';
const cardId = 'chartCustom';

function renderGlosowaniaTime() {
    const data = query("SELECT g.id_posiedzenia as pos, p.numer as numer, COUNT(*) as cnt FROM glosowania g LEFT JOIN posiedzenia p ON g.id_posiedzenia = p.id_posiedzenia GROUP BY g.id_posiedzenia ORDER BY p.numer");
    if (data.length < 2) { setCardState(cardId, false); return; }

    setCardState(cardId, true);
    destroyChart('custom');

    chartInstances['custom'] = new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: {
            labels: data.map(d => 'Pos. ' + (d.numer || d.pos)),
            datasets: [{
                label: 'Głosowania',
                data: data.map(d => d.cnt),
                borderColor: '#4facfe',
                backgroundColor: 'rgba(79,172,254,0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
            }
        }
    });
}

function renderKomisje() {
    const data = query(`
        SELECT k.skrot as nazwa, COUNT(kp.id_posiedzenia_komisji) as cnt
        FROM komisje_posiedzenia kp
        JOIN komisje k ON kp.id_komisji = k.id_komisji
        GROUP BY kp.id_komisji
        ORDER BY cnt DESC
        LIMIT 15
    `);
    if (!data.length) { setCardState(cardId, false); return; }

    setCardState(cardId, true);
    destroyChart('custom');

    chartInstances['custom'] = new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: {
            labels: data.map(d => d.nazwa || '?'),
            datasets: [{
                label: 'Posiedzenia',
                data: data.map(d => d.cnt),
                backgroundColor: '#764ba2'
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa', maxRotation: 60, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
            }
        }
    });
}

function renderInterpelacje() {
    const data = query(`
        SELECT p.nazwisko || ' ' || SUBSTR(p.imie, 1, 1) || '.' as nazwa, COUNT(*) as cnt
        FROM interpelacje i
        JOIN poslowie p ON i.id_osoby = p.id_osoby
        GROUP BY i.id_osoby
        ORDER BY cnt DESC
        LIMIT 10
    `);
    if (!data.length) { setCardState(cardId, false); return; }

    setCardState(cardId, true);
    destroyChart('custom');

    chartInstances['custom'] = new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: {
            labels: data.map(d => d.nazwa),
            datasets: [{
                label: 'Interpelacje',
                data: data.map(d => d.cnt),
                backgroundColor: '#f093fb'
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#ccc', font: { size: 11 } }, grid: { display: false } }
            }
        }
    });
}

function renderFrekwencja() {
    const TOTAL_POSLOW = 460; // Sejm X kadencja
    const data = query("SELECT g.id_posiedzenia as pos, p.numer as numer, AVG(g.za + g.przeciw + g.wstrzymalo) as avg_total FROM glosowania g LEFT JOIN posiedzenia p ON g.id_posiedzenia = p.id_posiedzenia GROUP BY g.id_posiedzenia ORDER BY p.numer");
    if (data.length < 2) { setCardState(cardId, false); return; }

    setCardState(cardId, true);
    destroyChart('custom');

    chartInstances['custom'] = new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: {
            labels: data.map(d => 'Pos. ' + (d.numer || d.pos)),
            datasets: [{
                label: 'Frekwencja %',
                data: data.map(d => Math.round(d.avg_total / TOTAL_POSLOW * 100)),
                borderColor: '#43e97b',
                backgroundColor: 'rgba(67,233,123,0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            responsive: true,
            plugins: { legend: { display: false },
                tooltip: { callbacks: { label: ctx => `Frekwencja: ${ctx.parsed.y}%` } }
            },
            scales: {
                x: { ticks: { color: '#aaa', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#aaa', callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' }, min: 0, max: 100 }
            }
        }
    });
}

// 5. Top 20 najmniej aktywnych posłów (bar)
// Wzorowane na renderTopPoslowie — używa mowca z wypowiedzi, nie id_osoby
function renderNajmniejAktywni() {
    // Wszyscy mówcy z liczbą wypowiedzi — rosnąco
    const allSpeakers = query(`
        SELECT mowca, COUNT(*) as cnt
        FROM wypowiedzi
        WHERE mowca IS NOT NULL
        GROUP BY mowca
        ORDER BY cnt ASC
        LIMIT 20
    `);
    if (!allSpeakers.length) { setCardState('chartNajmniejAktywni', false); return; }

    setCardState('chartNajmniejAktywni', true);
    destroyChart('najmniejAktywni');

    chartInstances['najmniejAktywni'] = new Chart(document.getElementById('canvasNajmniejAktywni'), {
        type: 'bar',
        data: {
            labels: allSpeakers.map(d => d.mowca.length > 30 ? d.mowca.slice(0, 30) + '...' : d.mowca),
            datasets: [{
                label: 'Wypowiedzi',
                data: allSpeakers.map(d => d.cnt),
                backgroundColor: '#f56565'
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
                y: { ticks: { color: '#ccc', font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}

// 6. Aktywność klubów per capita (bar)
// Matchuje mowca z wypowiedzi do posłów po nazwisku, zlicza per klub
function renderNajmniejAktywneKluby() {
    const data = query(`
        SELECT p.klub,
               ROUND(CAST(COUNT(w.id_wypowiedzi) AS REAL) / COUNT(DISTINCT p.id_osoby), 1) as cnt
        FROM poslowie p
        LEFT JOIN wypowiedzi w ON w.mowca LIKE '%' || p.nazwisko || '%'
        WHERE p.klub IS NOT NULL AND p.klub != ''
        GROUP BY p.klub
        ORDER BY cnt ASC
    `);
    if (!data.length) { setCardState('chartNajmniejAktywneKluby', false); return; }

    setCardState('chartNajmniejAktywneKluby', true);
    destroyChart('najmniejAktywneKluby');

    chartInstances['najmniejAktywneKluby'] = new Chart(document.getElementById('canvasNajmniejAktywneKluby'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.klub || 'Brak'),
            datasets: [{
                label: 'Śr. wypowiedzi/poseł',
                data: data.map(d => d.cnt),
                backgroundColor: '#f6ad55'
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
                y: { ticks: { color: '#ccc', font: { size: 11 } }, grid: { display: false } }
            }
        }
    });
}

// 7. Heatmapa frekwencji (matrix chart via scatter)
function renderHeatmap() {
    const xSel = document.getElementById('heatmapXAxis')?.value || 'posiedzenia';
    const ySel = document.getElementById('heatmapYAxis')?.value || 'poslowie';
    const colorSel = document.getElementById('heatmapColor')?.value || 'obecnosc';

    // Build query based on selections
    const xCol = xSel === 'glosowania' ? 'g.id_glosowania' : 'gl.id_posiedzenia';
    const xLabel = xSel === 'glosowania' ? "ps.numer || '/' || gl.numer" : 'ps.numer';
    const yCol = ySel === 'kluby' ? 'p.klub' : "p.nazwisko || ' ' || SUBSTR(p.imie,1,1) || '.'";

    let valueSql;
    if (colorSel === 'za') valueSql = "SUM(CASE WHEN g.glos = 'YES' THEN 1 ELSE 0 END)";
    else if (colorSel === 'przeciw') valueSql = "SUM(CASE WHEN g.glos = 'NO' THEN 1 ELSE 0 END)";
    else if (colorSel === 'wstrzymal') valueSql = "SUM(CASE WHEN g.glos = 'ABSTAIN' THEN 1 ELSE 0 END)";
    else valueSql = "COUNT(g.id_glosu)";

    let sql;
    if (xSel === 'glosowania') {
        sql = `
            SELECT ${xLabel} as x_label, ${yCol} as y_label, ${valueSql} as val
            FROM glosy g
            JOIN glosowania gl ON g.id_glosowania = gl.id_glosowania
            LEFT JOIN posiedzenia ps ON gl.id_posiedzenia = ps.id_posiedzenia
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            GROUP BY ${xLabel}, ${yCol}
            ORDER BY ps.numer, gl.numer, ${yCol}
            LIMIT 2000
        `;
    } else {
        sql = `
            SELECT ps.numer as x_label, ${yCol} as y_label, ${valueSql} as val
            FROM glosy g
            JOIN glosowania gl ON g.id_glosowania = gl.id_glosowania
            LEFT JOIN posiedzenia ps ON gl.id_posiedzenia = ps.id_posiedzenia
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            GROUP BY ps.numer, ${yCol}
            ORDER BY ps.numer, ${yCol}
            LIMIT 2000
        `;
    }

    const data = query(sql);
    if (!data.length) { setCardState('chartHeatmap', false); return; }

    setCardState('chartHeatmap', true);
    destroyChart('heatmap');

    // Build unique labels
    const xLabels = [...new Set(data.map(d => String(d.x_label)))];
    const yLabels = [...new Set(data.map(d => String(d.y_label)))];

    // Build matrix
    const points = data.map(d => ({
        x: xLabels.indexOf(String(d.x_label)),
        y: yLabels.indexOf(String(d.y_label)),
        v: d.val
    }));

    const maxVal = Math.max(...points.map(p => p.v), 1);

    chartInstances['heatmap'] = new Chart(document.getElementById('canvasHeatmap'), {
        type: 'scatter',
        data: {
            datasets: [{
                data: points.map(p => ({ x: p.x, y: p.y })),
                pointRadius: Math.max(4, Math.min(12, 300 / Math.max(xLabels.length, yLabels.length))),
                pointBackgroundColor: points.map(p => {
                    const intensity = Math.min(p.v / maxVal, 1);
                    const r = Math.round(30 + intensity * 195);
                    const g = Math.round(60 + (1 - intensity) * 180);
                    const b = Math.round(40);
                    return `rgba(${r},${g},${b},0.85)`;
                })
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const pt = points[ctx.dataIndex];
                            return `${yLabels[pt.y]} | ${xLabels[pt.x]}: ${pt.v}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: -0.5,
                    max: xLabels.length - 0.5,
                    ticks: {
                        color: '#aaa',
                        font: { size: 9 },
                        callback: (v) => xLabels[Math.round(v)] || '',
                        maxRotation: 60
                    },
                    grid: { color: 'rgba(255,255,255,0.03)' }
                },
                y: {
                    type: 'linear',
                    min: -0.5,
                    max: yLabels.length - 0.5,
                    ticks: {
                        color: '#ccc',
                        font: { size: 9 },
                        callback: (v) => {
                            const label = yLabels[Math.round(v)];
                            return label && label.length > 15 ? label.slice(0, 15) + '...' : label || '';
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.03)' }
                }
            }
        }
    });
}

const customRenderers = {
    glosowaniaTime: renderGlosowaniaTime,
    komisje: renderKomisje,
    interpelacje: renderInterpelacje,
    frekwencja: renderFrekwencja
};

function renderCustomChart() {
    const select = document.getElementById('customChartSelect');
    if (!select) return;
    const fn = customRenderers[select.value];
    if (fn) fn();
}

const renderers = {
    kluby: renderKluby,
    topPoslowie: renderTopPoslowie,
    glosowania: renderGlosowania,
    custom: renderCustomChart,
    najmniejAktywni: renderNajmniejAktywni,
    najmniejAktywneKluby: renderNajmniejAktywneKluby,
    heatmap: renderHeatmap,
    sentimentDist: renderSentimentDistribution,
    sentimentTime: renderSentimentOverTime,
    sentimentParty: renderSentimentByParty,
    topSpeakers: renderTopSpeakersSentiment
};

// =====================================================
// TILE → EXPAND / COLLAPSE
// =====================================================

/**
 * Inicjalizacja kart wykresów — kliknięcie = rozwiń
 */
export function initChartCards() {
    const grid = document.getElementById('chartsGrid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.chart-card');
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Nie rozwijaj jeśli kliknięto button, select, input
            if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
            expandChartCard(card);
        });
    });
}

// === SPINNER HELPERS ===

function showChartSpinner(card) {
    const body = card.querySelector('.chart-card-body');
    if (!body || body.querySelector('.chart-spinner')) return;
    const spinner = document.createElement('div');
    spinner.className = 'chart-spinner';
    spinner.innerHTML = '<div class="chart-spinner-ring"></div><div class="chart-spinner-label">Ładowanie…</div>';
    body.appendChild(spinner);
}

function hideChartSpinner(card) {
    card.querySelector('.chart-spinner')?.remove();
}

// === DEBOUNCE ===

function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/**
 * Rozwiń kartę wykresu — ukryj pozostałe, pokaż body, renderuj wykres lazy
 */
function expandChartCard(card) {
    const grid = card.closest('.charts-grid');
    if (!grid || card.classList.contains('chart-card--expanded')) return;

    grid.classList.add('charts-grid--has-expanded');

    const cards = grid.querySelectorAll('.chart-card');
    cards.forEach(c => {
        if (c !== card) c.classList.add('chart-card--hidden');
    });

    card.classList.add('chart-card--expanded');

    // Pokaż body
    const body = card.querySelector('.chart-card-body');
    if (body) body.style.display = '';

    // Lazy-render: oblicz wykres dopiero teraz
    const chartType = card.dataset.chartType;
    if (chartType && !card.hasAttribute('data-loaded')) {
        if (!db2.database) {
            // Pokaż "brak danych" — setCardState obsłuży
            const cardId = card.id;
            setCardState(cardId, false);
        } else {
            // Pokaż spinner od razu, żeby user wiedział że coś się dzieje
            showChartSpinner(card);
            // requestAnimationFrame — poczekaj aż DOM przelayoutuje elementy po display:none→block
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const fn = renderers[chartType];
                    if (fn) {
                        Promise.resolve(fn()).finally(() => {
                            hideChartSpinner(card);
                            card.setAttribute('data-loaded', '1');
                        });
                    } else {
                        hideChartSpinner(card);
                    }
                });
            });
        }
    }

    // Dodaj przycisk cofnij
    if (!card.querySelector('.chart-back-btn')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'chart-back-btn';
        backBtn.innerHTML = '← Cofnij';
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            collapseChartCards();
        });
        card.querySelector('.chart-card-header').prepend(backBtn);
    }

    // Scroll do karty
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Zwiń wszystkie karty — przywróć widok siatki kafelków
 */
function collapseChartCards() {
    const grid = document.getElementById('chartsGrid');
    if (!grid) return;

    grid.classList.remove('charts-grid--has-expanded');

    const cards = grid.querySelectorAll('.chart-card');
    cards.forEach(c => {
        c.classList.remove('chart-card--hidden', 'chart-card--expanded');
        const backBtn = c.querySelector('.chart-back-btn');
        if (backBtn) backBtn.remove();
        // Ukryj body z powrotem
        const body = c.querySelector('.chart-card-body');
        if (body) body.style.display = 'none';
    });
}

/**
 * Główna funkcja — renderuje wszystkie wykresy (używana przy ręcznym "renderuj wszystkie")
 * W nowym trybie lazy — nie renderuje z automatu, karty czekają na kliknięcie.
 * Wywoływana po imporcie bazy — resetuje flagi data-loaded żeby przeładować przy ponownym otwarciu.
 */
export function renderAllCharts() {
    if (!db2.database) return;
    // Resetuj flagi lazy-load, bo dane się mogły zmienić
    const grid = document.getElementById('chartsGrid');
    if (grid) {
        grid.querySelectorAll('.chart-card[data-loaded]').forEach(c => c.removeAttribute('data-loaded'));
    }
    // Jeśli jakaś karta jest rozwinięta — przerenderuj ją ze spinnerem
    const expanded = grid?.querySelector('.chart-card--expanded');
    if (expanded) {
        const chartType = expanded.dataset.chartType;
        const fn = renderers[chartType];
        if (fn) {
            showChartSpinner(expanded);
            Promise.resolve(fn()).finally(() => {
                hideChartSpinner(expanded);
                expanded.setAttribute('data-loaded', '1');
            });
        }
    }
}

// Pojedynczy wykres (dla przycisku aktualizuj) — ze spinnerem
export function renderSingleChart(name) {
    if (!db2.database) return;
    const fn = renderers[name];
    if (!fn) return;
    const card = document.querySelector(`.chart-card[data-chart-type="${name}"]`);
    if (card) showChartSpinner(card);
    Promise.resolve(fn()).finally(() => {
        if (card) hideChartSpinner(card);
    });
}

// Obsługa przycisków aktualizuj
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.chart-refresh-btn');
    if (!btn) return;
    const chartName = btn.dataset.chart;
    if (chartName) renderSingleChart(chartName);
});

// Obsługa zmiany wykresu w selekcie
document.getElementById('customChartSelect')?.addEventListener('change', () => {
    if (db2.database) renderCustomChart();
});

// Heatmap combobox handlers — debounce 300ms żeby nie strzelać przy każdej zmianie
const renderHeatmapDebounced = debounce(() => { if (db2.database) renderHeatmap(); }, 300);
['heatmapXAxis', 'heatmapYAxis', 'heatmapColor'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderHeatmapDebounced);
});

// === SENTIMENT ANALYSIS CHARTS ===

let sentimentCache = null;

/**
 * Analizuje sentyment (z cache dla wydajności)
 */
async function getSentimentData(forceRefresh = false) {
    if (sentimentCache && !forceRefresh) {
        return sentimentCache;
    }
    
    console.log('[Charts] Analyzing sentiment...');
    sentimentCache = await analyzeSpeechesSentiment({ limit: 1000 });
    console.log(`[Charts] Sentiment data ready: ${sentimentCache.length} speeches`);
    return sentimentCache;
}

/**
 * Rozkład sentymentu (doughnut)
 */
async function renderSentimentDistribution() {
    try {
        const sentimentData = await getSentimentData();
        if (!sentimentData.length) { setCardState('chartSentimentDist', false); return; }
        
        const dist = getSentimentDistribution(sentimentData);
        
        setCardState('chartSentimentDist', true);
        destroyChart('sentimentDist');
        
        chartInstances['sentimentDist'] = new Chart(document.getElementById('canvasSentimentDist'), {
            type: 'doughnut',
            data: {
                labels: ['Pozytywne', 'Neutralne', 'Negatywne'],
                datasets: [{
                    data: [dist.positive, dist.neutral, dist.negative],
                    backgroundColor: ['#10b981', '#94a3b8', '#ef4444']
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                responsive: true,
                plugins: {
                    legend: { position: 'right', labels: { color: '#ccc', font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((context.parsed / total) * 100);
                                return ` ${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('[Charts] Error rendering sentiment distribution:', error);
        setCardState('chartSentimentDist', false);
    }
}

/**
 * Sentyment w czasie (line chart)
 */
async function renderSentimentOverTime() {
    try {
        const sentimentData = await getSentimentData();
        if (!sentimentData.length) { setCardState('chartSentimentTime', false); return; }
        
        const timeData = aggregateByTime(sentimentData);
        if (!timeData.length) { setCardState('chartSentimentTime', false); return; }
        
        setCardState('chartSentimentTime', true);
        destroyChart('sentimentTime');
        
        chartInstances['sentimentTime'] = new Chart(document.getElementById('canvasSentimentTime'), {
            type: 'line',
            data: {
                labels: timeData.map(d => d.month),
                datasets: [
                    {
                        label: 'Średni sentyment',
                        data: timeData.map(d => d.avgScore),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                ...CHART_DEFAULTS,
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const data = timeData[context.dataIndex];
                                return [
                                    `Średni sentyment: ${context.parsed.y.toFixed(3)}`,
                                    `Pozytywne: ${data.positive}`,
                                    `Negatywne: ${data.negative}`,
                                    `Neutralne: ${data.neutral}`,
                                    `Wypowiedzi: ${data.count}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#aaa', maxRotation: 45 }, 
                        grid: { color: 'rgba(255,255,255,0.05)' } 
                    },
                    y: { 
                        ticks: { color: '#aaa' }, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        min: -1,
                        max: 1
                    }
                }
            }
        });
    } catch (error) {
        console.error('[Charts] Error rendering sentiment over time:', error);
        setCardState('chartSentimentTime', false);
    }
}

/**
 * Sentyment per klub (bar chart)
 */
async function renderSentimentByParty() {
    try {
        const sentimentData = await getSentimentData();
        if (!sentimentData.length) { setCardState('chartSentimentParty', false); return; }
        
        const partyData = aggregateByParty(sentimentData);
        if (!partyData.length) { setCardState('chartSentimentParty', false); return; }
        
        setCardState('chartSentimentParty', true);
        destroyChart('sentimentParty');
        
        chartInstances['sentimentParty'] = new Chart(document.getElementById('canvasSentimentParty'), {
            type: 'bar',
            data: {
                labels: partyData.map(d => d.party),
                datasets: [{
                    label: 'Średni sentyment',
                    data: partyData.map(d => d.avgScore),
                    backgroundColor: partyData.map(d => {
                        if (d.avgScore > 0.1) return '#10b981';
                        if (d.avgScore < -0.1) return '#ef4444';
                        return '#94a3b8';
                    })
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const data = partyData[context.dataIndex];
                                return [
                                    `Średni sentyment: ${context.parsed.y.toFixed(3)}`,
                                    `Pozytywne: ${data.positive}`,
                                    `Negatywne: ${data.negative}`,
                                    `Neutralne: ${data.neutral}`,
                                    `Wypowiedzi: ${data.count}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#ccc', font: { size: 10 }, maxRotation: 45 }, 
                        grid: { display: false } 
                    },
                    y: { 
                        ticks: { color: '#aaa' }, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        min: -1,
                        max: 1
                    }
                }
            }
        });
    } catch (error) {
        console.error('[Charts] Error rendering sentiment by party:', error);
        setCardState('chartSentimentParty', false);
    }
}

/**
 * Top mówcy - najbardziej pozytywni i negatywni (grouped bar)
 */
async function renderTopSpeakersSentiment() {
    try {
        const sentimentData = await getSentimentData();
        if (!sentimentData.length) { setCardState('chartTopSpeakers', false); return; }
        
        const topSpeakers = getTopSpeakers(sentimentData, 8);
        
        const positiveSpeakers = topSpeakers.positive.slice(0, 8);
        const negativeSpeakers = topSpeakers.negative.slice(0, 8);
        
        if (!positiveSpeakers.length && !negativeSpeakers.length) {
            setCardState('chartTopSpeakers', false);
            return;
        }
        
        setCardState('chartTopSpeakers', true);
        destroyChart('topSpeakers');
        
        // Formatuj nazwy (skróć długie)
        const formatName = name => name.length > 20 ? name.slice(0, 20) + '...' : name;
        
        chartInstances['topSpeakers'] = new Chart(document.getElementById('canvasTopSpeakers'), {
            type: 'bar',
            data: {
                labels: [
                    ...positiveSpeakers.map(s => '✅ ' + formatName(s.speaker)),
                    ...negativeSpeakers.map(s => '❌ ' + formatName(s.speaker))
                ],
                datasets: [{
                    label: 'Sentyment',
                    data: [
                        ...positiveSpeakers.map(s => s.avgScore),
                        ...negativeSpeakers.map(s => s.avgScore)
                    ],
                    backgroundColor: [
                        ...positiveSpeakers.map(() => '#10b981'),
                        ...negativeSpeakers.map(() => '#ef4444')
                    ]
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const isPositive = context.dataIndex < positiveSpeakers.length;
                                const data = isPositive 
                                    ? positiveSpeakers[context.dataIndex]
                                    : negativeSpeakers[context.dataIndex - positiveSpeakers.length];
                                return [
                                    `${data.speaker}`,
                                    `Sentyment: ${context.parsed.x.toFixed(3)}`,
                                    `Klub: ${data.party || 'Niez.'}`,
                                    `Wypowiedzi: ${data.count}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#aaa' }, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        min: -1,
                        max: 1
                    },
                    y: { 
                        ticks: { color: '#ccc', font: { size: 10 } }, 
                        grid: { display: false } 
                    }
                }
            }
        });
    } catch (error) {
        console.error('[Charts] Error rendering top speakers sentiment:', error);
        setCardState('chartTopSpeakers', false);
    }
}

/**
 * Odśwież cache sentymentu i przerenderuj wszystkie wykresy
 */
async function refreshSentimentCharts() {
    console.log('[Charts] Refreshing sentiment analysis...');
    // Pobierz dane raz — unikaj 4× równoległego zapytania do DB
    await getSentimentData(true);
    await Promise.all([
        renderSentimentDistribution(),
        renderSentimentOverTime(),
        renderSentimentByParty(),
        renderTopSpeakersSentiment()
    ]);
    console.log('[Charts] Sentiment charts refreshed');
}

// Export funkcji odświeżania sentymentu
window.refreshSentimentCharts = refreshSentimentCharts;

