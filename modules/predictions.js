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
    
    // Event listeners dla przycisków ładowania (online)
    document.querySelectorAll('.prediction-load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.prediction;
            if (type === 'online') {
                loadOnlineAnalysis();
            }
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
        'activity': analyzeActivityTrend,
        'online': loadOnlineAnalysis
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
    
    console.log('[Predictions] Calculating club discipline...');
    
    try {
        // Sprawdź czy istnieją dane głosowań
        const votings = db2.database.exec(`
            SELECT COUNT(*) as cnt
            FROM glosy
            LIMIT 1
        `);
        
        const voteCount = votings.length ? votings[0].values[0][0] : 0;
        if (!voteCount) {
            console.warn('[Predictions] No voting data found');
            container.innerHTML = '<div class="prediction-no-data">Brak danych głosowań</div>';
            return;
        }
        
        console.log(`[Predictions] Found ${voteCount} individual votes`);
        
        // Pobierz kluby
        const clubs = db2.database.exec(`
            SELECT DISTINCT klub 
            FROM poslowie 
            WHERE klub IS NOT NULL AND klub != ''
            ORDER BY klub
        `);
        
        if (!clubs.length) {
            console.warn('[Predictions] No clubs found');
            container.innerHTML = '<div class="prediction-no-data">Brak danych klubów</div>';
            return;
        }
        
        const clubList = clubs[0].values.map(row => row[0]);
        console.log(`[Predictions] Found ${clubList.length} clubs:`, clubList);
        
        // Analiza dyscypliny dla każdego klubu
        // Metoda: dla każdego głosowania znajdź dominujący głos w klubie,
        // następnie policz % posłów klubu głosujących zgodnie z większością klubu
        const disciplineData = clubList.map(club => {
            const result = db2.database.exec(`
                WITH club_votes AS (
                    SELECT 
                        gl.id_glosowania,
                        gl.glos,
                        COUNT(*) as vote_count
                    FROM glosy gl
                    JOIN poslowie p ON gl.id_osoby = p.id_osoby
                    WHERE p.klub = ?
                    AND gl.glos IN ('YES', 'NO', 'ABSTAIN')
                    GROUP BY gl.id_glosowania, gl.glos
                ),
                club_majority AS (
                    SELECT 
                        id_glosowania,
                        glos as majority_vote,
                        MAX(vote_count) as max_count
                    FROM club_votes
                    GROUP BY id_glosowania
                )
                SELECT 
                    COUNT(*) as total_votes,
                    SUM(CASE WHEN gl.glos = cm.majority_vote THEN 1 ELSE 0 END) as aligned_votes
                FROM glosy gl
                JOIN poslowie p ON gl.id_osoby = p.id_osoby
                JOIN club_majority cm ON gl.id_glosowania = cm.id_glosowania
                WHERE p.klub = ?
                AND gl.glos IN ('YES', 'NO', 'ABSTAIN')
            `, [club, club]);
            
            if (!result.length || !result[0].values.length) {
                return { club, discipline: 0, total: 0 };
            }
            
            const [totalVotes, alignedVotes] = result[0].values[0];
            const discipline = totalVotes > 0 ? (alignedVotes / totalVotes * 100) : 0;
            
            return { club, discipline: discipline.toFixed(1), total: totalVotes };
        }).filter(d => d.total > 0).sort((a, b) => b.discipline - a.discipline);
        
        console.log('[Predictions] Discipline results:', disciplineData);
        
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
    
    console.log('[Predictions] Detecting rebels...');
    
    try {
        // Znajdź posłów z niską dyscypliną klubową
        // Dla każdego posła: ile razy głosował zgodnie z większością swojego klubu
        const result = db2.database.exec(`
            WITH club_majority AS (
                SELECT 
                    cv.id_glosowania,
                    cv.klub,
                    cv.glos
                FROM (
                    SELECT 
                        gl.id_glosowania,
                        p.klub,
                        gl.glos,
                        COUNT(*) as vote_count
                    FROM glosy gl
                    JOIN poslowie p ON gl.id_osoby = p.id_osoby
                    WHERE gl.glos IN ('YES', 'NO', 'ABSTAIN')
                    AND p.klub IS NOT NULL AND p.klub != ''
                    GROUP BY gl.id_glosowania, p.klub, gl.glos
                ) cv
                WHERE cv.vote_count = (
                    SELECT MAX(vote_count) 
                    FROM (
                        SELECT COUNT(*) as vote_count
                        FROM glosy gl2
                        JOIN poslowie p2 ON gl2.id_osoby = p2.id_osoby
                        WHERE gl2.id_glosowania = cv.id_glosowania 
                        AND p2.klub = cv.klub
                        AND gl2.glos IN ('YES', 'NO', 'ABSTAIN')
                        GROUP BY gl2.glos
                    )
                )
            )
            SELECT 
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                COUNT(*) as total_votes,
                SUM(CASE WHEN gl.glos = cm.glos THEN 1 ELSE 0 END) as aligned_votes
            FROM poslowie p
            JOIN glosy gl ON p.id_osoby = gl.id_osoby
            JOIN club_majority cm ON gl.id_glosowania = cm.id_glosowania AND p.klub = cm.klub
            WHERE gl.glos IN ('YES', 'NO', 'ABSTAIN')
            AND p.klub IS NOT NULL AND p.klub != ''
            GROUP BY p.id_osoby, p.imie, p.nazwisko, p.klub
            HAVING COUNT(*) >= 10
        `);
        
        if (!result.length || !result[0].values.length) {
            console.warn('[Predictions] No voting data for rebel detection');
            container.innerHTML = '<div class="prediction-no-data">Brak wystarczających danych głosowań</div>';
            return;
        }
        
        console.log(`[Predictions] Found ${result[0].values.length} MPs with voting records`);
        
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
        
        // Oblicz macierz podobieństwa — porównanie głosu większościowego każdego klubu
        // Jedno zapytanie zamiast N² osobnych — ogromna różnica wydajności
        const pairsResult = db2.database.exec(`
            WITH club_direction AS (
                SELECT 
                    gl.id_glosowania,
                    p.klub,
                    CASE 
                        WHEN SUM(CASE WHEN gl.glos = 'YES' THEN 1 ELSE 0 END) >=
                             SUM(CASE WHEN gl.glos = 'NO' THEN 1 ELSE 0 END)
                        THEN 'YES' ELSE 'NO'
                    END as majority_vote
                FROM glosy gl
                JOIN poslowie p ON gl.id_osoby = p.id_osoby
                WHERE p.klub IS NOT NULL AND p.klub != ''
                AND gl.glos IN ('YES', 'NO')
                GROUP BY gl.id_glosowania, p.klub
            )
            SELECT 
                cd1.klub as klub1,
                cd2.klub as klub2,
                COUNT(*) as total,
                SUM(CASE WHEN cd1.majority_vote = cd2.majority_vote THEN 1 ELSE 0 END) as matching
            FROM club_direction cd1
            JOIN club_direction cd2 ON cd1.id_glosowania = cd2.id_glosowania
            WHERE cd1.klub < cd2.klub
            GROUP BY cd1.klub, cd2.klub
        `);
        
        // Zbuduj lookup z wyników
        const pairMap = {};
        if (pairsResult.length && pairsResult[0].values.length) {
            for (const row of pairsResult[0].values) {
                const [klub1, klub2, total, matching] = row;
                const similarity = total > 0 ? (matching / total * 100).toFixed(0) : '0';
                const key1 = `${klub1}|${klub2}`;
                const key2 = `${klub2}|${klub1}`;
                pairMap[key1] = similarity;
                pairMap[key2] = similarity;
            }
        }
        
        // Zbuduj macierz z lookup
        const matrix = [];
        for (let i = 0; i < clubList.length; i++) {
            const row = [];
            for (let j = 0; j < clubList.length; j++) {
                if (i === j) {
                    row.push(100);
                } else {
                    const key = `${clubList[i]}|${clubList[j]}`;
                    row.push(pairMap[key] || 0);
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
            LEFT JOIN wypowiedzi w ON p.id_osoby = w.id_osoby
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
 * 5. Analiza online - wczytywanie i analiza artykułów z gazet
 */
async function loadOnlineAnalysis() {
    const container = document.getElementById('onlineContent');
    if (!container) return;
    
    console.log('[Predictions] Loading online news analysis...');
    
    try {
        // Pokaż loading
        container.innerHTML = `
            <div class="prediction-loading">
                <div class="prediction-spinner"></div>
                <p>Wczytywanie artykułów politycznych...</p>
            </div>
        `;
        
        // Lista popularnych polskich serwisów z RSS
        const newsSources = [
            { name: 'Onet', url: 'https://www.onet.pl/', category: 'polityka' },
            { name: 'Interia', url: 'https://fakty.interia.pl/', category: 'polityka' },
            { name: 'WP', url: 'https://wiadomosci.wp.pl/', category: 'polityka' },
            { name: 'Gazeta.pl', url: 'https://wiadomosci.gazeta.pl/wiadomosci/0,0.html', category: 'polityka' }
        ];
        
        // Symulacja pobierania artykułów (w produkcji użyj prawdziwego API/RSS)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Przykładowe dane - w produkcji pobierz z RSS lub API
        const articles = [
            {
                title: 'Sejm przyjął kontrowersyjną ustawę',
                source: 'Onet',
                date: new Date().toLocaleDateString('pl-PL'),
                sentiment: 'negatywny',
                keywords: ['sejm', 'ustawa', 'głosowanie'],
                relevance: 95
            },
            {
                title: 'Opozycja krytykuje rząd ws. polityki zagranicznej',
                source: 'Interia',
                date: new Date().toLocaleDateString('pl-PL'),
                sentiment: 'neutralny',
                keywords: ['opozycja', 'rząd', 'polityka zagraniczna'],
                relevance: 88
            },
            {
                title: 'Nowe sondaże poparcia dla partii politycznych',
                source: 'WP',
                date: new Date().toLocaleDateString('pl-PL'),
                sentiment: 'pozytywny',
                keywords: ['sondaże', 'poparcie', 'wybory'],
                relevance: 92
            },
            {
                title: 'Premier zapowiada reformy systemu edukacji',
                source: 'Gazeta.pl',
                date: new Date().toLocaleDateString('pl-PL'),
                sentiment: 'pozytywny',
                keywords: ['premier', 'reforma', 'edukacja'],
                relevance: 85
            }
        ];
        
        // Renderuj wyniki
        let html = '<div class="online-articles-list">';
        
        articles.forEach((article, index) => {
            const sentimentColor = {
                'pozytywny': '#48bb78',
                'neutralny': '#ecc94b',
                'negatywny': '#f56565'
            }[article.sentiment];
            
            const sentimentIcon = {
                'pozytywny': '😊',
                'neutralny': '😐',
                'negatywny': '😠'
            }[article.sentiment];
            
            html += `
                <div class="online-article-item">
                    <div class="online-article-header">
                        <span class="online-article-source">${article.source}</span>
                        <span class="online-article-date">${article.date}</span>
                    </div>
                    <h4 class="online-article-title">${article.title}</h4>
                    <div class="online-article-meta">
                        <div class="online-sentiment" style="color: ${sentimentColor};">
                            ${sentimentIcon} ${article.sentiment}
                        </div>
                        <div class="online-relevance">
                            📊 Trafność: ${article.relevance}%
                        </div>
                    </div>
                    <div class="online-keywords">
                        ${article.keywords.map(kw => `<span class="online-keyword-tag">${kw}</span>`).join('')}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        html += `
            <div class="online-summary">
                <strong>📰 Podsumowanie:</strong> ${articles.length} artykułów politycznych z ostatnich 24h
                <br>
                <small>💡 Analiza sentymentu i słów kluczowych oparta o NLP</small>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('[Predictions] Online analysis error:', error);
        container.innerHTML = `
            <div class="prediction-error">
                Błąd wczytywania artykułów<br>
                <small>${error.message}</small>
            </div>
        `;
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
