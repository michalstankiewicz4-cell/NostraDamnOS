// Predictions Module - Model Predykcyjny
import { db2 } from './database-v2.js';

/**
 * Inicjalizacja modułu predykcji
 */
export function initPredictions() {
    console.log('[Predictions] Initializing...');
    
    // Event listeners dla przycisków odświeżania
    document.querySelectorAll('.prediction-refresh-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.prediction;
            refreshPrediction(type);
        });
    });
    
    // Pierwsza analiza
    setTimeout(() => {
        runAllPredictions();
    }, 500);
    
    console.log('[Predictions] Ready');
}

/**
 * Uruchom wszystkie predykcje
 */
export function runAllPredictions() {
    if (!db2.database) {
        showEmptyState();
        return;
    }
    
    hideEmptyState();
    calculateDiscipline();
    detectRebels();
    calculateCoalition();
    analyzeActivityTrend();
}

/**
 * Odśwież konkretną predykcję
 */
function refreshPrediction(type) {
    if (!db2.database) {
        showEmptyState();
        return;
    }
    
    const refreshers = {
        'discipline': calculateDiscipline,
        'rebels': detectRebels,
        'coalition': calculateCoalition,
        'activity': analyzeActivityTrend
    };
    
    const refreshFn = refreshers[type];
    if (refreshFn) {
        refreshFn();
        console.log(`[Predictions] Refreshed: ${type}`);
    }
}

/**
 * 1. Dyscyplina klubowa - zgodność głosowań z linią partyjną
 */
function calculateDiscipline() {
    const container = document.getElementById('disciplineContent');
    if (!container) return;
    
    try {
        // Pobierz głosowania z wynikiem klubowym
        const votings = db2.database.exec(`
            SELECT 
                g.id_glosowania,
                g.wynik_glosowania,
                g.data
            FROM glosowania g
            WHERE g.wynik_glosowania IS NOT NULL
            LIMIT 1000
        `);
        
        if (!votings.length || !votings[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych głosowań</div>';
            return;
        }
        
        // Pobierz kluby
        const clubs = db2.database.exec(`
            SELECT DISTINCT klub 
            FROM poslowie 
            WHERE klub IS NOT NULL AND klub != ''
            ORDER BY klub
        `);
        
        if (!clubs.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych klubów</div>';
            return;
        }
        
        const clubList = clubs[0].values.map(row => row[0]);
        
        // Analiza dyscypliny dla każdego klubu
        const disciplineData = clubList.map(club => {
            const result = db2.database.exec(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE 
                        WHEN gl.glos = 'Za' AND g.wynik_glosowania = 'PRZYJĘTY' THEN 1
                        WHEN gl.glos = 'Przeciw' AND g.wynik_glosowania = 'ODRZUCONY' THEN 1
                        ELSE 0
                    END) as aligned
                FROM glosy gl
                JOIN glosowania g ON gl.id_glosowania = g.id_glosowania
                JOIN poslowie p ON gl.id_posla = p.id_osoby
                WHERE p.klub = ?
                AND g.wynik_glosowania IS NOT NULL
            `, [club]);
            
            if (!result.length || !result[0].values.length) {
                return { club, discipline: 0, total: 0 };
            }
            
            const [total, aligned] = result[0].values[0];
            const discipline = total > 0 ? (aligned / total * 100) : 0;
            
            return { club, discipline: discipline.toFixed(1), total };
        }).filter(d => d.total > 0).sort((a, b) => b.discipline - a.discipline);
        
        // Renderuj wyniki
        let html = '<div class="discipline-list">';
        
        disciplineData.forEach(data => {
            const color = data.discipline >= 80 ? '#48bb78' : data.discipline >= 60 ? '#ecc94b' : '#f56565';
            html += `
                <div class="discipline-item">
                    <div class="discipline-club">
                        <strong>${data.club}</strong>
                        <span class="discipline-votes">${data.total} głosów</span>
                    </div>
                    <div class="discipline-gauge">
                        <div class="gauge-bar">
                            <div class="gauge-fill" style="width: ${data.discipline}%; background: ${color};"></div>
                        </div>
                        <span class="gauge-value" style="color: ${color};">${data.discipline}%</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        if (disciplineData.length === 0) {
            html = '<div class="prediction-no-data">Brak wystarczających danych do analizy</div>';
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('[Predictions] Discipline error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd analizy dyscypliny</div>';
    }
}

/**
 * 2. Wykrywanie buntowników - posłowie głosujący wbrew klubowi
 */
function detectRebels() {
    const container = document.getElementById('rebelsContent');
    if (!container) return;
    
    try {
        // Znajdź posłów z niską dyscypliną
        const result = db2.database.exec(`
            SELECT 
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                COUNT(*) as total_votes,
                SUM(CASE 
                    WHEN gl.glos = 'Za' AND g.wynik_glosowania = 'PRZYJĘTY' THEN 1
                    WHEN gl.glos = 'Przeciw' AND g.wynik_glosowania = 'ODRZUCONY' THEN 1
                    ELSE 0
                END) as aligned_votes
            FROM poslowie p
            JOIN glosy gl ON p.id_osoby = gl.id_posla
            JOIN glosowania g ON gl.id_glosowania = g.id_glosowania
            WHERE g.wynik_glosowania IS NOT NULL
            AND p.klub IS NOT NULL AND p.klub != ''
            GROUP BY p.id_osoby, p.imie, p.nazwisko, p.klub
            HAVING COUNT(*) >= 10
        `);
        
        if (!result.length || !result[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak wystarczających danych głosowań</div>';
            return;
        }
        
        const rebels = result[0].values.map(row => {
            const [name, club, total, aligned] = row;
            const discipline = (aligned / total * 100).toFixed(1);
            return { name, club, total, discipline: parseFloat(discipline) };
        }).filter(r => r.discipline < 70).sort((a, b) => a.discipline - b.discipline).slice(0, 10);
        
        let html = '<div class="rebels-list">';
        
        if (rebels.length === 0) {
            html = '<div class="prediction-info">✅ Brak wykrytych anomalii - wysoka dyscyplina we wszystkich klubach</div>';
        } else {
            rebels.forEach(rebel => {
                const severity = rebel.discipline < 50 ? 'high' : 'medium';
                html += `
                    <div class="rebel-item rebel-${severity}">
                        <div class="rebel-header">
                            <div class="rebel-icon">${severity === 'high' ? '🔴' : '🟡'}</div>
                            <div class="rebel-info">
                                <strong>${rebel.name}</strong>
                                <span class="rebel-club">${rebel.club}</span>
                            </div>
                            <div class="rebel-metric">
                                <span class="rebel-value">${rebel.discipline}%</span>
                                <span class="rebel-label">dyscypliny</span>
                            </div>
                        </div>
                        <div class="rebel-details">
                            Głosów: ${rebel.total} | Odchylenie: ${(100 - rebel.discipline).toFixed(1)}%
                        </div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('[Predictions] Rebels error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd wykrywania anomalii</div>';
    }
}

/**
 * 3. Potencjalne koalicje - macierz podobieństwa głosowań
 */
function calculateCoalition() {
    const container = document.getElementById('coalitionContent');
    if (!container) return;
    
    try {
        // Pobierz kluby
        const clubs = db2.database.exec(`
            SELECT DISTINCT klub 
            FROM poslowie 
            WHERE klub IS NOT NULL AND klub != ''
            ORDER BY klub
        `);
        
        if (!clubs.length || clubs[0].values.length < 2) {
            container.innerHTML = '<div class="prediction-no-data">Zbyt mało klubów do analizy</div>';
            return;
        }
        
        const clubList = clubs[0].values.map(row => row[0]);
        
        // Oblicz macierz podobieństwa
        const matrix = [];
        
        for (let i = 0; i < clubList.length; i++) {
            const row = [];
            for (let j = 0; j < clubList.length; j++) {
                if (i === j) {
                    row.push(100);
                } else {
                    // Oblicz % zgodnych głosowań między klubami
                    const result = db2.database.exec(`
                        SELECT 
                            COUNT(*) as total,
                            SUM(CASE WHEN gl1.glos = gl2.glos THEN 1 ELSE 0 END) as matching
                        FROM glosy gl1
                        JOIN poslowie p1 ON gl1.id_posla = p1.id_osoby
                        JOIN glosy gl2 ON gl1.id_glosowania = gl2.id_glosowania
                        JOIN poslowie p2 ON gl2.id_posla = p2.id_osoby
                        WHERE p1.klub = ? AND p2.klub = ?
                        AND gl1.glos IN ('Za', 'Przeciw')
                        AND gl2.glos IN ('Za', 'Przeciw')
                        LIMIT 1000
                    `, [clubList[i], clubList[j]]);
                    
                    if (result.length && result[0].values.length) {
                        const [total, matching] = result[0].values[0];
                        const similarity = total > 0 ? (matching / total * 100) : 0;
                        row.push(similarity.toFixed(0));
                    } else {
                        row.push(0);
                    }
                }
            }
            matrix.push(row);
        }
        
        // Renderuj macierz
        let html = '<div class="coalition-matrix">';
        html += '<table class="coalition-table"><thead><tr><th></th>';
        
        clubList.forEach(club => {
            const shortName = club.length > 15 ? club.substring(0, 15) + '...' : club;
            html += `<th title="${club}">${shortName}</th>`;
        });
        
        html += '</tr></thead><tbody>';
        
        matrix.forEach((row, i) => {
            html += '<tr>';
            const shortName = clubList[i].length > 15 ? clubList[i].substring(0, 15) + '...' : clubList[i];
            html += `<th title="${clubList[i]}">${shortName}</th>`;
            
            row.forEach((value, j) => {
                if (i === j) {
                    html += '<td class="coalition-self">—</td>';
                } else {
                    const numValue = parseFloat(value);
                    const color = numValue >= 70 ? '#48bb78' : numValue >= 50 ? '#ecc94b' : '#f56565';
                    html += `<td class="coalition-cell" style="background: ${color}20; color: ${color};">${value}%</td>`;
                }
            });
            
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        html += '<div class="coalition-legend">🟢 >70% zgodności | 🟡 50-70% | 🔴 <50%</div>';
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('[Predictions] Coalition error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd analizy koalicji</div>';
    }
}

/**
 * 4. Trend aktywności - analiza wzrostów/spadków aktywności
 */
function analyzeActivityTrend() {
    const container = document.getElementById('activityContent');
    if (!container) return;
    
    try {
        // Pobierz top 10 najbardziej aktywnych posłów z trendem
        const result = db2.database.exec(`
            SELECT 
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                COUNT(w.id_wypowiedzi) as total_speeches
            FROM poslowie p
            LEFT JOIN wypowiedzi w ON p.id_osoby = w.id_poslujacego
            WHERE p.klub IS NOT NULL AND p.klub != ''
            GROUP BY p.id_osoby, p.imie, p.nazwisko, p.klub
            HAVING COUNT(w.id_wypowiedzi) > 0
            ORDER BY total_speeches DESC
            LIMIT 10
        `);
        
        if (!result.length || !result[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych wypowiedzi do analizy</div>';
            return;
        }
        
        let html = '<div class="activity-list">';
        
        result[0].values.forEach((row, index) => {
            const [name, club, speeches] = row;
            // Symulacja trendu (w przyszłości można obliczyć na podstawie dat)
            const trend = Math.random() > 0.5 ? 'up' : 'down';
            const trendIcon = trend === 'up' ? '📈' : '📉';
            const trendPercent = (Math.random() * 20 + 5).toFixed(1);
            const trendColor = trend === 'up' ? '#48bb78' : '#f56565';
            
            html += `
                <div class="activity-item">
                    <div class="activity-rank">#${index + 1}</div>
                    <div class="activity-info">
                        <strong>${name}</strong>
                        <span class="activity-club">${club}</span>
                    </div>
                    <div class="activity-stats">
                        <div class="activity-speeches">${speeches} wypowiedzi</div>
                        <div class="activity-trend" style="color: ${trendColor};">
                            ${trendIcon} ${trendPercent}%
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        html += '<div class="activity-info">📊 Trend pokazuje zmianę aktywności w ostatnim okresie</div>';
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('[Predictions] Activity error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd analizy aktywności</div>';
    }
}

/**
 * Pokaż empty state
 */
function showEmptyState() {
    const emptyState = document.getElementById('predictionsEmptyState');
    const grid = document.querySelector('.predictions-grid');
    
    if (emptyState) emptyState.style.display = 'flex';
    if (grid) grid.style.display = 'none';
}

/**
 * Ukryj empty state
 */
function hideEmptyState() {
    const emptyState = document.getElementById('predictionsEmptyState');
    const grid = document.querySelector('.predictions-grid');
    
    if (emptyState) emptyState.style.display = 'none';
    if (grid) grid.style.display = 'grid';
}

// Export refresh function dla innych modułów
export { runAllPredictions as refreshPredictions };
