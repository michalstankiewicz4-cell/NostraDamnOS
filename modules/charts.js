// Charts module — generuje wykresy Chart.js z danych w db2
import { db2 } from './database-v2.js';

const chartInstances = {};
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
    const data = query("SELECT id_posiedzenia as pos, COUNT(*) as cnt FROM glosowania GROUP BY id_posiedzenia ORDER BY id_posiedzenia");
    if (data.length < 2) { setCardState(cardId, false); return; }

    setCardState(cardId, true);
    destroyChart('custom');

    chartInstances['custom'] = new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: {
            labels: data.map(d => 'Pos. ' + d.pos),
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
    const data = query("SELECT id_posiedzenia as pos, AVG(za + przeciw + wstrzymalo) as avg_total FROM glosowania GROUP BY id_posiedzenia ORDER BY id_posiedzenia");
    if (data.length < 2) { setCardState(cardId, false); return; }

    setCardState(cardId, true);
    destroyChart('custom');

    chartInstances['custom'] = new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: {
            labels: data.map(d => 'Pos. ' + d.pos),
            datasets: [{
                label: 'Śr. głosujących',
                data: data.map(d => Math.round(d.avg_total)),
                borderColor: '#43e97b',
                backgroundColor: 'rgba(67,233,123,0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
            }
        }
    });
}

// 5. Top 20 najmniej aktywnych posłów (bar)
function renderNajmniejAktywni() {
    const data = query(`
        SELECT p.nazwisko || ' ' || SUBSTR(p.imie, 1, 1) || '.' as nazwa, COUNT(w.id_wypowiedzi) as cnt
        FROM poslowie p
        LEFT JOIN wypowiedzi w ON p.id_osoby = w.id_osoby
        WHERE p.aktywny = 1 OR p.aktywny IS NULL
        GROUP BY p.id_osoby
        ORDER BY cnt ASC
        LIMIT 20
    `);
    if (!data.length) { setCardState('chartNajmniejAktywni', false); return; }

    setCardState('chartNajmniejAktywni', true);
    destroyChart('najmniejAktywni');

    chartInstances['najmniejAktywni'] = new Chart(document.getElementById('canvasNajmniejAktywni'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.nazwa),
            datasets: [{
                label: 'Wypowiedzi',
                data: data.map(d => d.cnt),
                backgroundColor: '#f56565'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#ccc', font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}

// 6. Top 20 najmniej aktywnych klubów (bar)
function renderNajmniejAktywneKluby() {
    const data = query(`
        SELECT p.klub, COUNT(w.id_wypowiedzi) as cnt
        FROM poslowie p
        LEFT JOIN wypowiedzi w ON p.id_osoby = w.id_osoby
        WHERE p.klub IS NOT NULL
        GROUP BY p.klub
        ORDER BY cnt ASC
        LIMIT 20
    `);
    if (!data.length) { setCardState('chartNajmniejAktywneKluby', false); return; }

    setCardState('chartNajmniejAktywneKluby', true);
    destroyChart('najmniejAktywneKluby');

    chartInstances['najmniejAktywneKluby'] = new Chart(document.getElementById('canvasNajmniejAktywneKluby'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.klub || 'Brak'),
            datasets: [{
                label: 'Wypowiedzi',
                data: data.map(d => d.cnt),
                backgroundColor: '#f6ad55'
            }]
        },
        options: {
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

// 7. Heatmapa frekwencji (matrix chart via scatter)
function renderHeatmap() {
    const xSel = document.getElementById('heatmapXAxis')?.value || 'posiedzenia';
    const ySel = document.getElementById('heatmapYAxis')?.value || 'poslowie';
    const colorSel = document.getElementById('heatmapColor')?.value || 'obecnosc';

    // Build query based on selections
    const yCol = ySel === 'kluby' ? 'p.klub' : "p.nazwisko || ' ' || SUBSTR(p.imie,1,1) || '.'";

    let valueSql;
    if (colorSel === 'za') valueSql = "SUM(CASE WHEN g.glos = 'Za' THEN 1 ELSE 0 END)";
    else if (colorSel === 'przeciw') valueSql = "SUM(CASE WHEN g.glos = 'Przeciw' THEN 1 ELSE 0 END)";
    else if (colorSel === 'wstrzymal') valueSql = "SUM(CASE WHEN g.glos LIKE 'Wstrzyma%' THEN 1 ELSE 0 END)";
    else valueSql = "COUNT(g.id_glosu)";

    let sql;
    if (xSel === 'glosowania') {
        sql = `
            SELECT gl.numer as x_label, ${yCol} as y_label, ${valueSql} as val
            FROM glosy g
            JOIN glosowania gl ON g.id_glosowania = gl.id_glosowania
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            GROUP BY gl.numer, ${yCol}
            ORDER BY gl.numer, ${yCol}
            LIMIT 2000
        `;
    } else {
        sql = `
            SELECT g.id_posiedzenia as x_label, ${yCol} as y_label, ${valueSql} as val
            FROM glosy g
            JOIN glosowania gl ON g.id_glosowania = gl.id_glosowania
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            GROUP BY g.id_posiedzenia, ${yCol}
            ORDER BY g.id_posiedzenia, ${yCol}
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
    heatmap: renderHeatmap
};

// Główna funkcja — renderuje wszystkie wykresy
export function renderAllCharts() {
    if (!db2.database) return;
    renderKluby();
    renderTopPoslowie();
    renderGlosowania();
    renderCustomChart();
    renderNajmniejAktywni();
    renderNajmniejAktywneKluby();
    renderHeatmap();
    sortChartsByData();
}

// Sortuj karty — te bez danych na koniec
function sortChartsByData() {
    const grid = document.getElementById('chartsGrid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.chart-card'));
    const withData = [];
    const noData = [];
    cards.forEach(card => {
        const nd = card.querySelector('.chart-no-data');
        if (nd && nd.style.display !== 'none') {
            noData.push(card);
        } else {
            withData.push(card);
        }
    });
    withData.concat(noData).forEach(card => grid.appendChild(card));
}

// Pojedynczy wykres (dla przycisku aktualizuj)
function renderSingleChart(name) {
    if (!db2.database) return;
    const fn = renderers[name];
    if (fn) fn();
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

// Heatmap combobox handlers
['heatmapXAxis', 'heatmapYAxis', 'heatmapColor'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
        if (db2.database) renderHeatmap();
    });
});
