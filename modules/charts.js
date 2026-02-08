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

// 4. Głosowania w czasie (line)
function renderGlosowaniaTime() {
    const data = query("SELECT id_posiedzenia as pos, COUNT(*) as cnt FROM glosowania GROUP BY id_posiedzenia ORDER BY id_posiedzenia");
    if (data.length < 2) { setCardState('chartGlosowaniaTime', false); return; }

    setCardState('chartGlosowaniaTime', true);
    destroyChart('glosowaniaTime');

    chartInstances['glosowaniaTime'] = new Chart(document.getElementById('canvasGlosowaniaTime'), {
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

// 5. Aktywność komisji (bar)
function renderKomisje() {
    const data = query(`
        SELECT k.skrot as nazwa, COUNT(kp.id_posiedzenia_komisji) as cnt
        FROM komisje_posiedzenia kp
        JOIN komisje k ON kp.id_komisji = k.id_komisji
        GROUP BY kp.id_komisji
        ORDER BY cnt DESC
        LIMIT 15
    `);
    if (!data.length) { setCardState('chartKomisje', false); return; }

    setCardState('chartKomisje', true);
    destroyChart('komisje');

    chartInstances['komisje'] = new Chart(document.getElementById('canvasKomisje'), {
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

const renderers = {
    kluby: renderKluby,
    topPoslowie: renderTopPoslowie,
    glosowania: renderGlosowania,
    glosowaniaTime: renderGlosowaniaTime,
    komisje: renderKomisje
};

// Główna funkcja — renderuje wszystkie wykresy
export function renderAllCharts() {
    if (!db2.database) return;
    renderKluby();
    renderTopPoslowie();
    renderGlosowania();
    renderGlosowaniaTime();
    renderKomisje();
}

// Pojedynczy wykres (dla przycisku aktualizuj)
export function renderSingleChart(name) {
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
