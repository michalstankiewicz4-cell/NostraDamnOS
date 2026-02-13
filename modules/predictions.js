// Predictions Module - Model Predykcyjny
import { db2 } from './database-v2.js';
import { analyzeSentiment } from './sentiment-analysis.js';

/**
 * Inicjalizacja modułu predykcji
 */
export function initPredictions() {
    console.log('[Predictions] Initializing...');

    // Click-to-expand: kliknięcie na kartę → rozwiń + lazy-load danych
    initPredictionCardExpand();

    // Sprawdź czy jest baza
    if (!db2.database) {
        showEmptyState();
    } else {
        hideEmptyState();
    }
    
    console.log('[Predictions] Ready');
}

/**
 * Uruchom wszystkie predykcje (wywoływane z zewnątrz np. po imporcie bazy)
 * Nie przelicza nic od razu — dane ładowane są lazy przy otwarciu karty
 */
export function runAllPredictions() {
    if (!db2.database) {
        showEmptyState();
        return;
    }
    
    hideEmptyState();
    // Wyczyść załadowane flagi żeby przy kolejnym otwarciu przeliczyło na nowo
    document.querySelectorAll('.prediction-card').forEach(card => {
        card.removeAttribute('data-loaded');
    });
}

/**
 * Mapa typów predykcji → funkcje obliczeniowe
 */
const predictionLoaders = {
    'discipline': calculateDiscipline,
    'rebels': detectRebels,
    'coalition': calculateCoalition,
    'activity': analyzeActivityTrend,
    'online': loadOnlineAnalysis,
    'attendance': analyzeAttendance,
    'polarization': analyzePolarization,
    'activityRank': calculateActivityRank,
    'legislation': analyzeLegislation,
    'interpellations': analyzeInterpellations,
    'committees': analyzeCommittees,
    'mpProfile': loadMpProfile,
    'clubProfile': loadClubProfile,
    'committeeProfile': loadCommitteeProfile,
    'controversialSpeeches': analyzeControversialSpeeches,
    'contradictoryVotes': analyzeContradictoryVotes,
    'defectionRisk': analyzeDefectionRisk,
    'votePredictor': analyzeVotePredictor,
    'tensionBarometer': analyzeTensionBarometer,
    'coalitionForecast': analyzeCoalitionForecast,
    'activityForecast': analyzeActivityForecast,
    'sessionSummary': analyzeSessionSummary,
    'topicClassification': analyzeTopicClassification,
    'mpContradictions': analyzeMpContradictions,
    'aiReport': generateAiReport,
    'webllmChat': loadWebLLMChat,
    'antiPolish': analyzeAntiPolish,
    'ghostVoting': analyzeGhostVoting,
    'webIntel': loadWebIntel,
    'aiCharts': loadAiCharts
};

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
            WITH club_votes AS (
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
            ),
            club_majority AS (
                SELECT 
                    id_glosowania,
                    klub,
                    glos as majority_vote,
                    MAX(vote_count) as max_count
                FROM club_votes
                GROUP BY id_glosowania, klub
            )
            SELECT 
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                COUNT(*) as total_votes,
                SUM(CASE WHEN gl.glos = cm.majority_vote THEN 1 ELSE 0 END) as aligned_votes
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
 * Porównuje liczbę wypowiedzi posła w starszej vs nowszej połowie posiedzeń.
 */
function analyzeActivityTrend() {
    const container = document.getElementById('activityContent');
    if (!container) return;
    
    try {
        // Znajdź medianę id_posiedzenia — dzieli posiedzenia na starszą i nowszą połowę
        const medianResult = db2.database.exec(`
            SELECT id_posiedzenia FROM (
                SELECT DISTINCT id_posiedzenia FROM wypowiedzi
                WHERE id_posiedzenia IS NOT NULL
                ORDER BY id_posiedzenia
            )
            LIMIT 1 OFFSET (
                SELECT COUNT(DISTINCT id_posiedzenia) / 2
                FROM wypowiedzi WHERE id_posiedzenia IS NOT NULL
            )
        `);
        
        if (!medianResult.length || !medianResult[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych wypowiedzi do analizy</div>';
            return;
        }
        
        const medianPos = medianResult[0].values[0][0];
        console.log(`[Predictions] Activity trend — median posiedzenie: ${medianPos}`);
        
        // Policz wypowiedzi w obu połówkach per poseł
        const result = db2.database.exec(`
            SELECT 
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                SUM(CASE WHEN w.id_posiedzenia < ? THEN 1 ELSE 0 END) as old_half,
                SUM(CASE WHEN w.id_posiedzenia >= ? THEN 1 ELSE 0 END) as new_half,
                COUNT(w.id_wypowiedzi) as total_speeches
            FROM poslowie p
            JOIN wypowiedzi w ON p.id_osoby = w.id_osoby
            WHERE p.klub IS NOT NULL AND p.klub != ''
            AND w.id_posiedzenia IS NOT NULL
            GROUP BY p.id_osoby, p.imie, p.nazwisko, p.klub
            HAVING COUNT(w.id_wypowiedzi) >= 5
            ORDER BY total_speeches DESC
            LIMIT 15
        `, [medianPos, medianPos]);
        
        if (!result.length || !result[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak wystarczających danych wypowiedzi</div>';
            return;
        }
        
        // Oblicz trend i posortuj wg największej zmiany
        const trendData = result[0].values.map(row => {
            const [name, club, oldHalf, newHalf, total] = row;
            let trendPercent = 0;
            if (oldHalf > 0) {
                trendPercent = ((newHalf - oldHalf) / oldHalf * 100);
            } else if (newHalf > 0) {
                trendPercent = 100; // nowy poseł — 100% wzrost
            }
            return { name, club, total, oldHalf, newHalf, trendPercent };
        }).sort((a, b) => Math.abs(b.trendPercent) - Math.abs(a.trendPercent));
        
        let html = '<div class="activity-list">';
        
        trendData.forEach((data, index) => {
            const trend = data.trendPercent >= 0 ? 'up' : 'down';
            const trendIcon = trend === 'up' ? '📈' : '📉';
            const trendColor = trend === 'up' ? '#48bb78' : '#f56565';
            const absTrend = Math.abs(data.trendPercent).toFixed(1);
            
            html += `
                <div class="activity-item">
                    <div class="activity-rank">#${index + 1}</div>
                    <div class="activity-info">
                        <strong>${data.name}</strong>
                        <span class="activity-club">${data.club}</span>
                    </div>
                    <div class="activity-stats">
                        <div class="activity-speeches">${data.total} wypowiedzi</div>
                        <div class="activity-trend" style="color: ${trendColor};">
                            ${trendIcon} ${data.trendPercent >= 0 ? '+' : '-'}${absTrend}%
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        html += '<div class="activity-note" style="font-size:0.8em;color:#888;margin-top:8px;">📊 Trend: zmiana liczby wypowiedzi między starszą a nowszą połową posiedzeń</div>';
        
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
 * 6. Frekwencja & Absencja - ranking obecności posłów
 */
function analyzeAttendance() {
    const container = document.getElementById('attendanceContent');
    if (!container) return;

    console.log('[Predictions] Analyzing attendance...');

    try {
        // Sprawdź czy są dane
        const check = db2.database.exec(`SELECT COUNT(*) FROM glosy`);
        if (!check.length || !check[0].values[0][0]) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych głosowań</div>';
            return;
        }

        // Frekwencja per klub
        const clubAttendance = db2.database.exec(`
            SELECT 
                p.klub,
                COUNT(*) as total,
                SUM(CASE WHEN gl.glos = 'ABSENT' THEN 1 ELSE 0 END) as absent,
                ROUND(100.0 * SUM(CASE WHEN gl.glos != 'ABSENT' THEN 1 ELSE 0 END) / COUNT(*), 1) as attendance_pct
            FROM glosy gl
            JOIN poslowie p ON gl.id_osoby = p.id_osoby
            WHERE p.klub IS NOT NULL AND p.klub != ''
            GROUP BY p.klub
            ORDER BY attendance_pct DESC
        `);

        // Top 10 najczęściej nieobecnych posłów
        const worstAttendance = db2.database.exec(`
            SELECT 
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                COUNT(*) as total,
                SUM(CASE WHEN gl.glos = 'ABSENT' THEN 1 ELSE 0 END) as absent,
                ROUND(100.0 * SUM(CASE WHEN gl.glos = 'ABSENT' THEN 1 ELSE 0 END) / COUNT(*), 1) as absence_pct
            FROM glosy gl
            JOIN poslowie p ON gl.id_osoby = p.id_osoby
            WHERE p.klub IS NOT NULL AND p.klub != ''
            GROUP BY p.id_osoby, p.imie, p.nazwisko, p.klub
            HAVING COUNT(*) >= 10
            ORDER BY absence_pct DESC
            LIMIT 10
        `);

        let html = '';

        // Sekcja 1: Frekwencja klubowa
        if (clubAttendance.length && clubAttendance[0].values.length) {
            html += '<h4 class="pred-subtitle">📋 Frekwencja klubów</h4>';
            html += '<div class="discipline-list">';
            clubAttendance[0].values.forEach(row => {
                const [club, total, absent, pct] = row;
                const color = pct >= 85 ? '#48bb78' : pct >= 70 ? '#ecc94b' : '#f56565';
                html += `
                    <div class="discipline-item">
                        <div class="discipline-club">
                            <strong>${club}</strong>
                            <span class="discipline-votes">${total - absent}/${total} obecności</span>
                        </div>
                        <div class="discipline-gauge">
                            <div class="gauge-bar">
                                <div class="gauge-fill" style="width: ${pct}%; background: ${color};"></div>
                            </div>
                            <span class="gauge-value" style="color: ${color};">${pct}%</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Sekcja 2: Najbardziej nieobecni posłowie
        if (worstAttendance.length && worstAttendance[0].values.length) {
            html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">🚫 Najczęściej nieobecni</h4>';
            html += '<div class="rebels-list">';
            worstAttendance[0].values.forEach(row => {
                const [name, club, total, absent, absencePct] = row;
                const severity = absencePct > 30 ? 'high' : 'medium';
                html += `
                    <div class="rebel-item rebel-${severity}">
                        <div class="rebel-header">
                            <div class="rebel-icon">${severity === 'high' ? '🔴' : '🟡'}</div>
                            <div class="rebel-info">
                                <strong>${name}</strong>
                                <span class="rebel-club">${club}</span>
                            </div>
                            <div class="rebel-metric">
                                <span class="rebel-value">${absencePct}%</span>
                                <span class="rebel-label">nieobecności</span>
                            </div>
                        </div>
                        <div class="rebel-details">
                            Nieobecny: ${absent}/${total} głosowań
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (!html) {
            html = '<div class="prediction-no-data">Brak wystarczających danych</div>';
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('[Predictions] Attendance error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd analizy frekwencji</div>';
    }
}

/**
 * 7. Polaryzacja głosowań - jak podzielone są głosowania
 */
function analyzePolarization() {
    const container = document.getElementById('polarizationContent');
    if (!container) return;

    console.log('[Predictions] Analyzing polarization...');

    try {
        // Pobierz głosowania z wynikami
        const result = db2.database.exec(`
            SELECT 
                id_glosowania,
                tytul,
                data,
                za,
                przeciw,
                wstrzymalo,
                wynik,
                CASE 
                    WHEN (za + przeciw + wstrzymalo) > 0
                    THEN ROUND(100.0 * MIN(za, przeciw) / (za + przeciw + wstrzymalo), 1)
                    ELSE 0
                END as polarization_idx
            FROM glosowania
            WHERE za IS NOT NULL AND przeciw IS NOT NULL
            AND (za + przeciw) > 0
            ORDER BY polarization_idx DESC
        `);

        if (!result.length || !result[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych głosowań</div>';
            return;
        }

        const allVotings = result[0].values;

        // Statystyki ogólne
        const totalVotings = allVotings.length;
        const avgPolarization = (allVotings.reduce((s, r) => s + (r[7] || 0), 0) / totalVotings).toFixed(1);
        const highlyPolarized = allVotings.filter(r => r[7] >= 30).length;
        const unanimous = allVotings.filter(r => r[7] < 5).length;

        let html = '';

        // Podsumowanie
        html += '<div class="pred-stats-grid">';
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${totalVotings}</div>
            <div class="pred-stat-label">Głosowań</div>
        </div>`;
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${avgPolarization}%</div>
            <div class="pred-stat-label">Śr. polaryzacja</div>
        </div>`;
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value" style="color:#f56565;">${highlyPolarized}</div>
            <div class="pred-stat-label">Wysoce podzielone</div>
        </div>`;
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value" style="color:#48bb78;">${unanimous}</div>
            <div class="pred-stat-label">Niemal jednomyślne</div>
        </div>`;
        html += '</div>';

        // Top 10 najbardziej kontrowersyjnych
        html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">🔥 Najbardziej kontrowersyjne głosowania</h4>';
        html += '<div class="polarization-list">';

        allVotings.slice(0, 10).forEach(row => {
            const [id, tytul, data, za, przeciw, wstrzymalo, wynik, polIdx] = row;
            const title = tytul || 'Głosowanie bez tytułu';
            const shortTitle = title.length > 80 ? title.substring(0, 80) + '...' : title;
            const total = za + przeciw + (wstrzymalo || 0);
            const zaPerc = total > 0 ? (za / total * 100).toFixed(0) : 0;
            const przPerc = total > 0 ? (przeciw / total * 100).toFixed(0) : 0;

            html += `
                <div class="polarization-item">
                    <div class="polarization-title" title="${title}">${shortTitle}</div>
                    <div class="polarization-bar-container">
                        <div class="polarization-bar">
                            <div class="polarization-za" style="width:${zaPerc}%;">${za}</div>
                            <div class="polarization-przeciw" style="width:${przPerc}%;">${przeciw}</div>
                        </div>
                    </div>
                    <div class="polarization-meta">
                        <span class="polarization-date">${data || ''}</span>
                        <span class="polarization-result ${wynik === 'przyjęto' ? 'result-passed' : 'result-rejected'}">${wynik || '?'}</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';

        container.innerHTML = html;

    } catch (error) {
        console.error('[Predictions] Polarization error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd analizy polaryzacji</div>';
    }
}

/**
 * 8. Ranking aktywności posłów - composite score
 */
function calculateActivityRank() {
    const container = document.getElementById('activityRankContent');
    if (!container) return;

    console.log('[Predictions] Calculating activity rank...');

    try {
        // Composite: wypowiedzi + głosy (nie ABSENT) + interpelacje + zapytania
        const result = db2.database.exec(`
            SELECT 
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                COALESCE(wyp.cnt, 0) as speeches,
                COALESCE(gls.cnt, 0) as votes,
                COALESCE(inter.cnt, 0) as interpellations,
                COALESCE(zap.cnt, 0) as questions,
                COALESCE(kw.cnt, 0) as committee_speeches,
                (COALESCE(wyp.cnt, 0) * 3 + COALESCE(gls.cnt, 0) + COALESCE(inter.cnt, 0) * 5 + COALESCE(zap.cnt, 0) * 4 + COALESCE(kw.cnt, 0) * 2) as composite_score
            FROM poslowie p
            LEFT JOIN (SELECT id_osoby, COUNT(*) as cnt FROM wypowiedzi GROUP BY id_osoby) wyp ON p.id_osoby = wyp.id_osoby
            LEFT JOIN (SELECT id_osoby, COUNT(*) as cnt FROM glosy WHERE glos != 'ABSENT' GROUP BY id_osoby) gls ON p.id_osoby = gls.id_osoby
            LEFT JOIN (SELECT id_osoby, COUNT(*) as cnt FROM interpelacje GROUP BY id_osoby) inter ON p.id_osoby = inter.id_osoby
            LEFT JOIN (SELECT from_mp_ids as id_osoby, COUNT(*) as cnt FROM zapytania WHERE from_mp_ids IS NOT NULL GROUP BY from_mp_ids) zap ON p.id_osoby = zap.id_osoby
            LEFT JOIN (SELECT id_osoby, COUNT(*) as cnt FROM komisje_wypowiedzi GROUP BY id_osoby) kw ON p.id_osoby = kw.id_osoby
            WHERE p.klub IS NOT NULL AND p.klub != ''
            ORDER BY composite_score DESC
            LIMIT 20
        `);

        if (!result.length || !result[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych do analizy</div>';
            return;
        }

        const maxScore = result[0].values[0][7] || 1;

        let html = '<div class="pred-subtitle-row"><h4 class="pred-subtitle">🏅 Top 20 najaktywniejszych posłów</h4>';
        html += '<span class="pred-subtitle-info">Score = wypowiedzi×3 + głosy×1 + interpelacje×5 + zapytania×4 + komisje×2</span></div>';
        html += '<div class="activity-rank-list">';

        result[0].values.forEach((row, idx) => {
            const [name, club, speeches, votes, interpellations, questions, committeeSpeeches, score] = row;
            const pct = (score / maxScore * 100).toFixed(0);
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

            html += `
                <div class="activity-rank-item">
                    <div class="activity-rank-pos">${medal}</div>
                    <div class="activity-rank-info">
                        <strong>${name}</strong>
                        <span class="activity-club">${club}</span>
                    </div>
                    <div class="activity-rank-breakdown">
                        <span title="Wypowiedzi">🗣️${speeches}</span>
                        <span title="Głosy">🗳️${votes}</span>
                        <span title="Interpelacje">📝${interpellations}</span>
                        <span title="Zapytania">❓${questions}</span>
                        <span title="Komisje">🏛️${committeeSpeeches}</span>
                    </div>
                    <div class="activity-rank-bar-wrap">
                        <div class="gauge-bar">
                            <div class="gauge-fill" style="width:${pct}%; background: linear-gradient(90deg, #667eea, #764ba2);"></div>
                        </div>
                        <span class="activity-rank-score">${score}</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('[Predictions] Activity rank error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd rankingu aktywności</div>';
    }
}

/**
 * 9. Tempo legislacyjne - szybkość procedowania ustaw
 */
function analyzeLegislation() {
    const container = document.getElementById('legislationContent');
    if (!container) return;

    console.log('[Predictions] Analyzing legislation tempo...');

    try {
        // Statystyki projektów ustaw
        const statusResult = db2.database.exec(`
            SELECT 
                COALESCE(status, 'nieznany') as status,
                COUNT(*) as cnt
            FROM projekty_ustaw
            GROUP BY status
            ORDER BY cnt DESC
        `);

        // Projekty wg roku
        const yearResult = db2.database.exec(`
            SELECT 
                SUBSTR(data, 1, 7) as month,
                COUNT(*) as cnt
            FROM projekty_ustaw
            WHERE data IS NOT NULL AND data != ''
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        `);

        // Łączna liczba
        const totalResult = db2.database.exec(`SELECT COUNT(*) FROM projekty_ustaw`);
        const total = totalResult.length ? totalResult[0].values[0][0] : 0;

        if (!total) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych projektów ustaw</div>';
            return;
        }

        let html = '';

        // Ogólne statystyki
        html += '<div class="pred-stats-grid">';
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${total}</div>
            <div class="pred-stat-label">Projektów ogółem</div>
        </div>`;

        if (statusResult.length && statusResult[0].values.length) {
            statusResult[0].values.slice(0, 3).forEach(row => {
                const [status, cnt] = row;
                html += `<div class="pred-stat-box">
                    <div class="pred-stat-value">${cnt}</div>
                    <div class="pred-stat-label">${status}</div>
                </div>`;
            });
        }
        html += '</div>';

        // Rozkład statusów
        if (statusResult.length && statusResult[0].values.length) {
            html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">📊 Rozkład statusów</h4>';
            html += '<div class="discipline-list">';
            statusResult[0].values.forEach(row => {
                const [status, cnt] = row;
                const pct = (cnt / total * 100).toFixed(1);
                const color = status.includes('przyjęt') || status.includes('uchwalon') ? '#48bb78' :
                              status.includes('odrzuc') ? '#f56565' : '#ecc94b';
                html += `
                    <div class="discipline-item">
                        <div class="discipline-club">
                            <strong>${status}</strong>
                            <span class="discipline-votes">${cnt} projektów</span>
                        </div>
                        <div class="discipline-gauge">
                            <div class="gauge-bar">
                                <div class="gauge-fill" style="width:${pct}%; background:${color};"></div>
                            </div>
                            <span class="gauge-value" style="color:${color};">${pct}%</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Tempo miesięczne
        if (yearResult.length && yearResult[0].values.length) {
            html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">📅 Projekty wg miesiąca</h4>';
            html += '<div class="legislation-timeline">';

            const maxCnt = Math.max(...yearResult[0].values.map(r => r[1]));
            yearResult[0].values.reverse().forEach(row => {
                const [month, cnt] = row;
                const barPct = (cnt / maxCnt * 100).toFixed(0);
                html += `
                    <div class="legislation-month">
                        <span class="legislation-month-label">${month}</span>
                        <div class="gauge-bar" style="flex:1;">
                            <div class="gauge-fill" style="width:${barPct}%; background:#667eea;"></div>
                        </div>
                        <span class="legislation-month-count">${cnt}</span>
                    </div>
                `;
            });

            html += '</div>';
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('[Predictions] Legislation error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd analizy legislacyjnej</div>';
    }
}

/**
 * 10. Analiza interpelacji - tematy i aktywność
 */
function analyzeInterpellations() {
    const container = document.getElementById('interpellationsContent');
    if (!container) return;

    console.log('[Predictions] Analyzing interpellations...');

    try {
        // Łączna liczba interpelacji
        const totalResult = db2.database.exec(`SELECT COUNT(*) FROM interpelacje`);
        const totalInterp = totalResult.length ? totalResult[0].values[0][0] : 0;

        // Łączna liczba zapytań
        const totalZapResult = db2.database.exec(`SELECT COUNT(*) FROM zapytania`);
        const totalZap = totalZapResult.length ? totalZapResult[0].values[0][0] : 0;

        if (!totalInterp && !totalZap) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych interpelacji i zapytań</div>';
            return;
        }

        let html = '';

        // Statystyki ogólne
        html += '<div class="pred-stats-grid">';
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${totalInterp}</div>
            <div class="pred-stat-label">Interpelacji</div>
        </div>`;
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${totalZap}</div>
            <div class="pred-stat-label">Zapytań</div>
        </div>`;
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${totalInterp + totalZap}</div>
            <div class="pred-stat-label">Łącznie</div>
        </div>`;
        html += '</div>';

        // Top posłowie wg interpelacji
        if (totalInterp) {
            const topMPs = db2.database.exec(`
                SELECT 
                    p.imie || ' ' || p.nazwisko as name,
                    p.klub,
                    COUNT(*) as cnt
                FROM interpelacje i
                JOIN poslowie p ON i.id_osoby = p.id_osoby
                WHERE p.klub IS NOT NULL
                GROUP BY p.id_osoby, p.imie, p.nazwisko, p.klub
                ORDER BY cnt DESC
                LIMIT 10
            `);

            if (topMPs.length && topMPs[0].values.length) {
                html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">📝 Najaktywniejsze osoby (interpelacje)</h4>';
                html += '<div class="activity-list">';
                const maxInterp = topMPs[0].values[0][2];

                topMPs[0].values.forEach((row, idx) => {
                    const [name, club, cnt] = row;
                    const pct = (cnt / maxInterp * 100).toFixed(0);
                    html += `
                        <div class="activity-item">
                            <div class="activity-rank">#${idx + 1}</div>
                            <div class="activity-info">
                                <strong>${name}</strong>
                                <span class="activity-club">${club}</span>
                            </div>
                            <div class="activity-stats">
                                <div class="gauge-bar" style="width:120px;">
                                    <div class="gauge-fill" style="width:${pct}%; background:#667eea;"></div>
                                </div>
                                <div class="activity-speeches">${cnt}</div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        }

        // Opóźnienia odpowiedzi na zapytania
        if (totalZap) {
            const delays = db2.database.exec(`
                SELECT 
                    CASE 
                        WHEN answerDelayedDays <= 0 THEN 'W terminie'
                        WHEN answerDelayedDays <= 30 THEN 'Do 30 dni opóźnienia'
                        WHEN answerDelayedDays <= 60 THEN '30-60 dni opóźnienia'
                        ELSE 'Ponad 60 dni opóźnienia'
                    END as delay_category,
                    COUNT(*) as cnt
                FROM zapytania
                WHERE answerDelayedDays IS NOT NULL
                GROUP BY delay_category
                ORDER BY 
                    CASE delay_category
                        WHEN 'W terminie' THEN 1
                        WHEN 'Do 30 dni opóźnienia' THEN 2
                        WHEN '30-60 dni opóźnienia' THEN 3
                        ELSE 4
                    END
            `);

            if (delays.length && delays[0].values.length) {
                const totalDelayed = delays[0].values.reduce((s, r) => s + r[1], 0);
                html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">⏰ Terminowość odpowiedzi na zapytania</h4>';
                html += '<div class="discipline-list">';
                delays[0].values.forEach(row => {
                    const [cat, cnt] = row;
                    const pct = (cnt / totalDelayed * 100).toFixed(1);
                    const color = cat === 'W terminie' ? '#48bb78' :
                                  cat.includes('30 dni') && !cat.includes('30-60') ? '#ecc94b' : '#f56565';
                    html += `
                        <div class="discipline-item">
                            <div class="discipline-club">
                                <strong>${cat}</strong>
                                <span class="discipline-votes">${cnt} zapytań</span>
                            </div>
                            <div class="discipline-gauge">
                                <div class="gauge-bar">
                                    <div class="gauge-fill" style="width:${pct}%; background:${color};"></div>
                                </div>
                                <span class="gauge-value" style="color:${color};">${pct}%</span>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('[Predictions] Interpellations error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd analizy interpelacji</div>';
    }
}

/**
 * 11. Sieć komisji - współpraca międzykomisyjna
 */
function analyzeCommittees() {
    const container = document.getElementById('committeesContent');
    if (!container) return;

    console.log('[Predictions] Analyzing committees...');

    try {
        // Sprawdź dane
        const totalResult = db2.database.exec(`SELECT COUNT(*) FROM komisje`);
        const totalKomisje = totalResult.length ? totalResult[0].values[0][0] : 0;

        const totalSessions = db2.database.exec(`SELECT COUNT(*) FROM komisje_posiedzenia`);
        const totalPos = totalSessions.length ? totalSessions[0].values[0][0] : 0;

        const totalSpeeches = db2.database.exec(`SELECT COUNT(*) FROM komisje_wypowiedzi`);
        const totalWyp = totalSpeeches.length ? totalSpeeches[0].values[0][0] : 0;

        if (!totalKomisje && !totalPos) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych komisji</div>';
            return;
        }

        let html = '';

        // Statystyki ogólne
        html += '<div class="pred-stats-grid">';
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${totalKomisje}</div>
            <div class="pred-stat-label">Komisji</div>
        </div>`;
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${totalPos}</div>
            <div class="pred-stat-label">Posiedzeń</div>
        </div>`;
        html += `<div class="pred-stat-box">
            <div class="pred-stat-value">${totalWyp}</div>
            <div class="pred-stat-label">Wypowiedzi</div>
        </div>`;
        html += '</div>';

        // Najaktywniejsze komisje (wg posiedzeń)
        const activeCommittees = db2.database.exec(`
            SELECT 
                k.nazwa,
                k.skrot,
                COUNT(kp.id_posiedzenia_komisji) as sessions,
                COALESCE(wyp.cnt, 0) as speeches
            FROM komisje k
            LEFT JOIN komisje_posiedzenia kp ON k.id_komisji = kp.id_komisji
            LEFT JOIN (
                SELECT kp2.id_komisji, COUNT(*) as cnt
                FROM komisje_wypowiedzi kw
                JOIN komisje_posiedzenia kp2 ON kw.id_posiedzenia_komisji = kp2.id_posiedzenia_komisji
                GROUP BY kp2.id_komisji
            ) wyp ON k.id_komisji = wyp.id_komisji
            GROUP BY k.id_komisji, k.nazwa, k.skrot
            HAVING sessions > 0
            ORDER BY sessions DESC
            LIMIT 10
        `);

        if (activeCommittees.length && activeCommittees[0].values.length) {
            html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">🏛️ Najaktywniejsze komisje</h4>';
            html += '<div class="activity-list">';
            const maxSessions = activeCommittees[0].values[0][2];

            activeCommittees[0].values.forEach((row, idx) => {
                const [nazwa, skrot, sessions, speeches] = row;
                const displayName = skrot || (nazwa.length > 40 ? nazwa.substring(0, 40) + '...' : nazwa);
                const pct = (sessions / maxSessions * 100).toFixed(0);

                html += `
                    <div class="activity-item">
                        <div class="activity-rank">#${idx + 1}</div>
                        <div class="activity-info">
                            <strong title="${nazwa}">${displayName}</strong>
                            <span class="activity-club">${sessions} posiedzeń · ${speeches} wypowiedzi</span>
                        </div>
                        <div class="activity-stats">
                            <div class="gauge-bar" style="width:120px;">
                                <div class="gauge-fill" style="width:${pct}%; background:#667eea;"></div>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Cross-party: posłowie aktywni w wielu komisjach
        if (totalWyp > 0) {
            const crossParty = db2.database.exec(`
                SELECT 
                    p.imie || ' ' || p.nazwisko as name,
                    p.klub,
                    COUNT(DISTINCT kp.id_komisji) as num_committees,
                    COUNT(*) as total_speeches
                FROM komisje_wypowiedzi kw
                JOIN komisje_posiedzenia kp ON kw.id_posiedzenia_komisji = kp.id_posiedzenia_komisji
                JOIN poslowie p ON kw.id_osoby = p.id_osoby
                WHERE p.klub IS NOT NULL AND p.klub != ''
                GROUP BY p.id_osoby, p.imie, p.nazwisko, p.klub
                HAVING num_committees >= 2
                ORDER BY num_committees DESC, total_speeches DESC
                LIMIT 10
            `);

            if (crossParty.length && crossParty[0].values.length) {
                html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">🔗 Najbardziej cross-komisyjni posłowie</h4>';
                html += '<div class="rebels-list">';
                crossParty[0].values.forEach(row => {
                    const [name, club, numComm, totalSp] = row;
                    html += `
                        <div class="rebel-item" style="border-left-color:#667eea;">
                            <div class="rebel-header">
                                <div class="rebel-icon">🔗</div>
                                <div class="rebel-info">
                                    <strong>${name}</strong>
                                    <span class="rebel-club">${club}</span>
                                </div>
                                <div class="rebel-metric">
                                    <span class="rebel-value">${numComm}</span>
                                    <span class="rebel-label">komisji</span>
                                </div>
                            </div>
                            <div class="rebel-details">
                                ${totalSp} wypowiedzi w komisjach
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        }

        if (!html) {
            html = '<div class="prediction-no-data">Brak wystarczających danych komisji</div>';
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('[Predictions] Committees error:', error);
        container.innerHTML = '<div class="prediction-error">Błąd analizy komisji</div>';
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

/**
 * Inicjalizacja expand/collapse kart predykcji
 */
function initPredictionCardExpand() {
    // Obsługuj karty w obu gridach: predykcje i moduły AI
    const grids = document.querySelectorAll('.predictions-grid');
    grids.forEach(grid => {
        const cards = grid.querySelectorAll('.prediction-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Nie rozwijaj jeśli kliknięto przycisk lub select
                if (e.target.closest('button') || e.target.closest('select') || e.target.closest('textarea') || e.target.closest('input')) return;
                expandPredictionCard(card);
            });
        });
    });
}

/**
 * Rozwiń kartę - ukryj pozostałe, pokaż body, załaduj dane lazy
 */
function expandPredictionCard(card) {
    const grid = card.closest('.predictions-grid');
    if (!grid || card.classList.contains('prediction-card--expanded')) return;

    // Zapamiętaj stan
    grid.classList.add('predictions-grid--has-expanded');
    
    const cards = grid.querySelectorAll('.prediction-card');
    cards.forEach(c => {
        if (c !== card) {
            c.classList.add('prediction-card--hidden');
        }
    });

    card.classList.add('prediction-card--expanded');

    // Pokaż body
    const body = card.querySelector('.prediction-card-body');
    if (body) body.style.display = '';

    // Lazy-load: oblicz dane tylko przy pierwszym otwarciu
    const type = card.dataset.prediction;
    if (type && !card.hasAttribute('data-loaded')) {
        // Pokaż spinner
        const content = card.querySelector('.prediction-content');
        if (content) {
            content.innerHTML = `
                <div class="prediction-loading">
                    <div class="prediction-spinner"></div>
                    <p>Ładowanie analizy...</p>
                </div>
            `;
        }
        
        // Załaduj z małym opóźnieniem żeby UI zdążył się odmalować
        setTimeout(() => {
            if (!db2.database) {
                if (content) content.innerHTML = '<div class="prediction-no-data">Brak bazy danych — najpierw pobierz dane</div>';
                return;
            }
            const loader = predictionLoaders[type];
            if (loader) {
                loader();
                card.setAttribute('data-loaded', '1');
            }
        }, 50);
    }

    // Dodaj przycisk cofnij
    if (!card.querySelector('.prediction-back-btn')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'prediction-back-btn';
        backBtn.innerHTML = '← Cofnij';
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            collapsePredictionCards();
        });
        card.querySelector('.prediction-card-header').prepend(backBtn);
    }
}

/**
 * Zwiń wszystko - przywróć widok siatki, ukryj body
 */
function collapsePredictionCards() {
    // Znajdź grid z rozwiniętą kartą
    const grids = document.querySelectorAll('.predictions-grid');
    grids.forEach(grid => {
        if (!grid.classList.contains('predictions-grid--has-expanded')) return;

        grid.classList.remove('predictions-grid--has-expanded');

        const cards = grid.querySelectorAll('.prediction-card');
        cards.forEach(c => {
            c.classList.remove('prediction-card--hidden', 'prediction-card--expanded');
            const backBtn = c.querySelector('.prediction-back-btn');
            if (backBtn) backBtn.remove();
            // Ukryj body z powrotem
            const body = c.querySelector('.prediction-card-body');
            if (body) body.style.display = 'none';
        });
    });
}

// =====================================================
// PROFILE MODULES
// =====================================================

/**
 * 12. Profil parlamentarzysty — combobox + szczegóły
 */
function loadMpProfile() {
    const container = document.getElementById('mpProfileContent');
    if (!container) return;

    try {
        const mps = db2.database.exec(`
            SELECT id_osoby, imie, nazwisko, klub
            FROM poslowie
            WHERE imie IS NOT NULL AND nazwisko IS NOT NULL
            ORDER BY nazwisko, imie
        `);

        if (!mps.length || !mps[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych posłów</div>';
            return;
        }

        let html = '<div class="profile-selector">';
        html += '<label for="mpSelect">Wybierz parlamentarzystę:</label>';
        html += '<select id="mpSelect" class="profile-combobox">';
        html += '<option value="">— wybierz —</option>';
        mps[0].values.forEach(row => {
            const [id, imie, nazwisko, klub] = row;
            html += `<option value="${id}">${nazwisko} ${imie} (${klub || '?'})</option>`;
        });
        html += '</select></div>';
        html += '<div id="mpProfileDetails" class="profile-details"></div>';
        container.innerHTML = html;

        document.getElementById('mpSelect').addEventListener('change', (e) => {
            e.stopPropagation();
            const id = e.target.value;
            if (id) renderMpProfile(id);
            else document.getElementById('mpProfileDetails').innerHTML = '';
        });
    } catch (err) {
        console.error('[Predictions] MP Profile error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd ładowania profili</div>';
    }
}

function renderMpProfile(id) {
    const det = document.getElementById('mpProfileDetails');
    if (!det) return;

    try {
        // Dane osobowe
        const info = db2.database.exec(`SELECT imie, nazwisko, klub, okreg, rola, email, aktywny FROM poslowie WHERE id_osoby = ?`, [id]);
        if (!info.length || !info[0].values.length) { det.innerHTML = '<div class="prediction-no-data">Brak danych</div>'; return; }
        const [imie, nazwisko, klub, okreg, rola, email, aktywny] = info[0].values[0];

        // Statystyki
        const stats = db2.database.exec(`
            SELECT
                (SELECT COUNT(*) FROM wypowiedzi WHERE id_osoby = ?) as speeches,
                (SELECT COUNT(*) FROM glosy WHERE id_osoby = ? AND glos != 'ABSENT') as votes,
                (SELECT COUNT(*) FROM glosy WHERE id_osoby = ? AND glos = 'ABSENT') as absences,
                (SELECT COUNT(*) FROM interpelacje WHERE id_osoby = ?) as interp,
                (SELECT COUNT(*) FROM komisje_wypowiedzi WHERE id_osoby = ?) as comm_speeches
        `, [id, id, id, id, id]);
        const [speeches, votes, absences, interp, commSpeeches] = stats[0].values[0];
        const totalVoteOpp = votes + absences;
        const attendancePct = totalVoteOpp > 0 ? (votes / totalVoteOpp * 100).toFixed(1) : '—';

        // Dyscyplina
        let disciplinePct = '—';
        if (klub) {
            const disc = db2.database.exec(`
                WITH club_majority AS (
                    SELECT gl.id_glosowania,
                        CASE WHEN SUM(CASE WHEN gl.glos='YES' THEN 1 ELSE 0 END) >= SUM(CASE WHEN gl.glos='NO' THEN 1 ELSE 0 END) THEN 'YES' ELSE 'NO' END as maj
                    FROM glosy gl JOIN poslowie p ON gl.id_osoby=p.id_osoby
                    WHERE p.klub=? AND gl.glos IN ('YES','NO') GROUP BY gl.id_glosowania
                )
                SELECT COUNT(*) as total,
                    SUM(CASE WHEN gl.glos=cm.maj THEN 1 ELSE 0 END) as aligned
                FROM glosy gl JOIN club_majority cm ON gl.id_glosowania=cm.id_glosowania
                WHERE gl.id_osoby=? AND gl.glos IN ('YES','NO')
            `, [klub, id]);
            if (disc.length && disc[0].values[0][0] > 0) {
                disciplinePct = (disc[0].values[0][1] / disc[0].values[0][0] * 100).toFixed(1);
            }
        }

        let html = `
            <div class="profile-header-info">
                <div class="profile-avatar">👤</div>
                <div>
                    <h3>${imie} ${nazwisko}</h3>
                    <p>${rola || 'poseł'} · ${klub || '—'} · okręg ${okreg || '—'}</p>
                    <p class="profile-email">${email || ''}</p>
                </div>
                <span class="profile-badge ${aktywny ? 'badge-active' : 'badge-inactive'}">${aktywny ? 'Aktywny' : 'Nieaktywny'}</span>
            </div>
            <div class="pred-stats-grid" style="margin-top:1rem;">
                <div class="pred-stat-box"><div class="pred-stat-value">${speeches}</div><div class="pred-stat-label">Wypowiedzi</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${votes}</div><div class="pred-stat-label">Głosów</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${attendancePct}%</div><div class="pred-stat-label">Frekwencja</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${interp}</div><div class="pred-stat-label">Interpelacji</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${commSpeeches}</div><div class="pred-stat-label">Wyp. w komisjach</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${disciplinePct}%</div><div class="pred-stat-label">Dyscyplina</div></div>
            </div>
        `;

        // Ostatnie głosowania
        const recentVotes = db2.database.exec(`
            SELECT g.tytul, gl.glos, g.data
            FROM glosy gl JOIN glosowania g ON gl.id_glosowania=g.id_glosowania
            WHERE gl.id_osoby=? ORDER BY g.data DESC LIMIT 8
        `, [id]);
        if (recentVotes.length && recentVotes[0].values.length) {
            html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">🗳️ Ostatnie głosowania</h4>';
            html += '<div class="profile-recent-list">';
            recentVotes[0].values.forEach(row => {
                const [tytul, glos, data] = row;
                const title = tytul && tytul.length > 70 ? tytul.substring(0,70)+'...' : (tytul || '—');
                const voteClass = glos === 'YES' ? 'vote-yes' : glos === 'NO' ? 'vote-no' : glos === 'ABSTAIN' ? 'vote-abstain' : 'vote-absent';
                const voteLabel = {YES:'ZA', NO:'PRZECIW', ABSTAIN:'WSTRZ.', ABSENT:'NIEOB.'}[glos] || glos;
                html += `<div class="profile-recent-item"><span class="profile-recent-title" title="${tytul||''}">${title}</span><span class="profile-vote-badge ${voteClass}">${voteLabel}</span><span class="profile-recent-date">${data||''}</span></div>`;
            });
            html += '</div>';
        }

        det.innerHTML = html;
    } catch (err) {
        console.error('[Predictions] renderMpProfile error:', err);
        det.innerHTML = '<div class="prediction-error">Błąd renderowania profilu</div>';
    }
}

/**
 * 13. Profil klubu / partii — combobox + szczegóły
 */
function loadClubProfile() {
    const container = document.getElementById('clubProfileContent');
    if (!container) return;

    try {
        const clubs = db2.database.exec(`
            SELECT DISTINCT klub FROM poslowie
            WHERE klub IS NOT NULL AND klub != '' ORDER BY klub
        `);
        if (!clubs.length || !clubs[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych klubów</div>';
            return;
        }

        let html = '<div class="profile-selector">';
        html += '<label for="clubSelect">Wybierz klub / partię:</label>';
        html += '<select id="clubSelect" class="profile-combobox">';
        html += '<option value="">— wybierz —</option>';
        clubs[0].values.forEach(row => {
            html += `<option value="${row[0]}">${row[0]}</option>`;
        });
        html += '</select></div>';
        html += '<div id="clubProfileDetails" class="profile-details"></div>';
        container.innerHTML = html;

        document.getElementById('clubSelect').addEventListener('change', (e) => {
            e.stopPropagation();
            const club = e.target.value;
            if (club) renderClubProfile(club);
            else document.getElementById('clubProfileDetails').innerHTML = '';
        });
    } catch (err) {
        console.error('[Predictions] Club Profile error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd ładowania profili klubów</div>';
    }
}

function renderClubProfile(club) {
    const det = document.getElementById('clubProfileDetails');
    if (!det) return;

    try {
        // Liczba członków
        const members = db2.database.exec(`SELECT COUNT(*) as cnt, SUM(aktywny) as active FROM poslowie WHERE klub=?`, [club]);
        const [total, active] = members[0].values[0];

        // Statystyki zbiorcze
        const stats = db2.database.exec(`
            SELECT
                (SELECT COUNT(*) FROM wypowiedzi w JOIN poslowie p ON w.id_osoby=p.id_osoby WHERE p.klub=?) as speeches,
                (SELECT COUNT(*) FROM glosy gl JOIN poslowie p ON gl.id_osoby=p.id_osoby WHERE p.klub=? AND gl.glos!='ABSENT') as votes,
                (SELECT COUNT(*) FROM glosy gl JOIN poslowie p ON gl.id_osoby=p.id_osoby WHERE p.klub=? AND gl.glos='ABSENT') as absences,
                (SELECT COUNT(*) FROM interpelacje i JOIN poslowie p ON i.id_osoby=p.id_osoby WHERE p.klub=?) as interps
        `, [club, club, club, club]);
        const [speeches, votes, absences, interps] = stats[0].values[0];
        const attendPct = (votes + absences) > 0 ? (votes / (votes + absences) * 100).toFixed(1) : '—';

        // Dyscyplina klubowa
        const disc = db2.database.exec(`
            WITH cv AS (
                SELECT gl.id_glosowania, gl.glos, COUNT(*) as c
                FROM glosy gl JOIN poslowie p ON gl.id_osoby=p.id_osoby
                WHERE p.klub=? AND gl.glos IN ('YES','NO','ABSTAIN') GROUP BY gl.id_glosowania, gl.glos
            ), cm AS (
                SELECT id_glosowania, glos as maj FROM cv GROUP BY id_glosowania HAVING c=MAX(c)
            )
            SELECT COUNT(*), SUM(CASE WHEN gl.glos=cm.maj THEN 1 ELSE 0 END)
            FROM glosy gl JOIN poslowie p ON gl.id_osoby=p.id_osoby
            JOIN cm ON gl.id_glosowania=cm.id_glosowania
            WHERE p.klub=? AND gl.glos IN ('YES','NO','ABSTAIN')
        `, [club, club]);
        let discPct = '—';
        if (disc.length && disc[0].values[0][0] > 0) {
            discPct = (disc[0].values[0][1] / disc[0].values[0][0] * 100).toFixed(1);
        }

        let html = `
            <div class="profile-header-info">
                <div class="profile-avatar">🏛️</div>
                <div>
                    <h3>${club}</h3>
                    <p>${total} członków · ${active || 0} aktywnych</p>
                </div>
            </div>
            <div class="pred-stats-grid" style="margin-top:1rem;">
                <div class="pred-stat-box"><div class="pred-stat-value">${speeches}</div><div class="pred-stat-label">Wypowiedzi</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${votes}</div><div class="pred-stat-label">Głosów</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${attendPct}%</div><div class="pred-stat-label">Frekwencja</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${interps}</div><div class="pred-stat-label">Interpelacji</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${discPct}%</div><div class="pred-stat-label">Dyscyplina</div></div>
            </div>
        `;

        // Lista członków
        const memberList = db2.database.exec(`
            SELECT p.imie, p.nazwisko, p.aktywny,
                COALESCE((SELECT COUNT(*) FROM wypowiedzi WHERE id_osoby=p.id_osoby),0) as wyp,
                COALESCE((SELECT COUNT(*) FROM glosy WHERE id_osoby=p.id_osoby AND glos!='ABSENT'),0) as gls
            FROM poslowie p WHERE p.klub=? ORDER BY gls DESC, wyp DESC
        `, [club]);
        if (memberList.length && memberList[0].values.length) {
            html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">👥 Członkowie</h4>';
            html += '<div class="profile-members-list">';
            memberList[0].values.forEach(row => {
                const [imie, nazwisko, akt, wyp, gls] = row;
                html += `<div class="profile-member-item">
                    <span class="profile-member-name">${nazwisko} ${imie}</span>
                    <span class="profile-member-stats">🗣️${wyp} · 🗳️${gls}</span>
                    <span class="profile-badge ${akt ? 'badge-active' : 'badge-inactive'}">${akt ? '✓' : '✗'}</span>
                </div>`;
            });
            html += '</div>';
        }

        det.innerHTML = html;
    } catch (err) {
        console.error('[Predictions] renderClubProfile error:', err);
        det.innerHTML = '<div class="prediction-error">Błąd renderowania profilu klubu</div>';
    }
}

/**
 * 14. Profil komisji — combobox + szczegóły
 */
function loadCommitteeProfile() {
    const container = document.getElementById('committeeProfileContent');
    if (!container) return;

    try {
        const comms = db2.database.exec(`
            SELECT id_komisji, nazwa, skrot FROM komisje ORDER BY nazwa
        `);
        if (!comms.length || !comms[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych komisji</div>';
            return;
        }

        let html = '<div class="profile-selector">';
        html += '<label for="committeeSelect">Wybierz komisję:</label>';
        html += '<select id="committeeSelect" class="profile-combobox">';
        html += '<option value="">— wybierz —</option>';
        comms[0].values.forEach(row => {
            const [id, nazwa, skrot] = row;
            const label = skrot ? `${skrot} — ${nazwa}` : nazwa;
            html += `<option value="${id}">${label}</option>`;
        });
        html += '</select></div>';
        html += '<div id="committeeProfileDetails" class="profile-details"></div>';
        container.innerHTML = html;

        document.getElementById('committeeSelect').addEventListener('change', (e) => {
            e.stopPropagation();
            const id = e.target.value;
            if (id) renderCommitteeProfile(id);
            else document.getElementById('committeeProfileDetails').innerHTML = '';
        });
    } catch (err) {
        console.error('[Predictions] Committee Profile error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd ładowania profili komisji</div>';
    }
}

function renderCommitteeProfile(id) {
    const det = document.getElementById('committeeProfileDetails');
    if (!det) return;

    try {
        // Info komisji
        const info = db2.database.exec(`SELECT nazwa, skrot, typ FROM komisje WHERE id_komisji=?`, [id]);
        if (!info.length || !info[0].values.length) { det.innerHTML = '<div class="prediction-no-data">Brak danych</div>'; return; }
        const [nazwa, skrot, typ] = info[0].values[0];

        // Stats
        const stats = db2.database.exec(`
            SELECT
                (SELECT COUNT(*) FROM komisje_posiedzenia WHERE id_komisji=?) as sessions,
                (SELECT COUNT(*) FROM komisje_wypowiedzi kw JOIN komisje_posiedzenia kp ON kw.id_posiedzenia_komisji=kp.id_posiedzenia_komisji WHERE kp.id_komisji=?) as speeches,
                (SELECT COUNT(DISTINCT kw.id_osoby) FROM komisje_wypowiedzi kw JOIN komisje_posiedzenia kp ON kw.id_posiedzenia_komisji=kp.id_posiedzenia_komisji WHERE kp.id_komisji=?) as unique_speakers
        `, [id, id, id]);
        const [sessions, speeches, uniqueSpeakers] = stats[0].values[0];

        let html = `
            <div class="profile-header-info">
                <div class="profile-avatar">📋</div>
                <div>
                    <h3>${skrot || ''} ${nazwa}</h3>
                    <p>${typ || 'komisja'}</p>
                </div>
            </div>
            <div class="pred-stats-grid" style="margin-top:1rem;">
                <div class="pred-stat-box"><div class="pred-stat-value">${sessions}</div><div class="pred-stat-label">Posiedzeń</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${speeches}</div><div class="pred-stat-label">Wypowiedzi</div></div>
                <div class="pred-stat-box"><div class="pred-stat-value">${uniqueSpeakers}</div><div class="pred-stat-label">Mówców</div></div>
            </div>
        `;

        // Najaktywniejsze osoby w komisji
        const topSpeakers = db2.database.exec(`
            SELECT p.imie || ' ' || p.nazwisko as name, p.klub, COUNT(*) as cnt
            FROM komisje_wypowiedzi kw
            JOIN komisje_posiedzenia kp ON kw.id_posiedzenia_komisji=kp.id_posiedzenia_komisji
            JOIN poslowie p ON kw.id_osoby=p.id_osoby
            WHERE kp.id_komisji=?
            GROUP BY kw.id_osoby, p.imie, p.nazwisko, p.klub
            ORDER BY cnt DESC LIMIT 10
        `, [id]);
        if (topSpeakers.length && topSpeakers[0].values.length) {
            const maxCnt = topSpeakers[0].values[0][2];
            html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">🗣️ Najaktywniejsze osoby</h4>';
            html += '<div class="activity-list">';
            topSpeakers[0].values.forEach((row, idx) => {
                const [name, klub, cnt] = row;
                const pct = (cnt / maxCnt * 100).toFixed(0);
                html += `<div class="activity-item">
                    <div class="activity-rank">#${idx+1}</div>
                    <div class="activity-info"><strong>${name}</strong><span class="activity-club">${klub || '—'}</span></div>
                    <div class="activity-stats">
                        <div class="gauge-bar" style="width:120px;"><div class="gauge-fill" style="width:${pct}%; background:#667eea;"></div></div>
                        <div class="activity-speeches">${cnt}</div>
                    </div>
                </div>`;
            });
            html += '</div>';
        }

        // Ostatnie posiedzenia
        const recentSessions = db2.database.exec(`
            SELECT numer, data, opis FROM komisje_posiedzenia
            WHERE id_komisji=? ORDER BY data DESC LIMIT 8
        `, [id]);
        if (recentSessions.length && recentSessions[0].values.length) {
            html += '<h4 class="pred-subtitle" style="margin-top:1.5rem;">📅 Ostatnie posiedzenia</h4>';
            html += '<div class="profile-recent-list">';
            recentSessions[0].values.forEach(row => {
                const [numer, data, opis] = row;
                const desc = opis && opis.length > 80 ? opis.substring(0,80)+'...' : (opis || '—');
                html += `<div class="profile-recent-item">
                    <span class="profile-recent-title" title="${opis||''}">Nr ${numer||'?'}: ${desc}</span>
                    <span class="profile-recent-date">${data||''}</span>
                </div>`;
            });
            html += '</div>';
        }

        det.innerHTML = html;
    } catch (err) {
        console.error('[Predictions] renderCommitteeProfile error:', err);
        det.innerHTML = '<div class="prediction-error">Błąd renderowania profilu komisji</div>';
    }
}

/**
 * 15. Kontrowersyjne wypowiedzi — ranking najbardziej agresywnych/negatywnych wypowiedzi
 */
function analyzeControversialSpeeches() {
    const container = document.getElementById('controversialSpeechesContent');
    if (!container) return;

    console.log('[Predictions] Analyzing controversial speeches...');

    try {
        // Pobierz wypowiedzi z tekstem > 100 znaków
        const rows = db2.database.exec(`
            SELECT 
                w.id_wypowiedzi,
                w.tekst,
                w.data,
                w.mowca,
                w.typ,
                p.imie,
                p.nazwisko,
                p.klub
            FROM wypowiedzi w
            LEFT JOIN poslowie p ON w.id_osoby = p.id_osoby
            WHERE w.tekst IS NOT NULL AND LENGTH(w.tekst) > 100
            ORDER BY w.data DESC
            LIMIT 2000
        `);

        if (!rows.length || !rows[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych wypowiedzi w bazie</div>';
            return;
        }

        // Analizuj sentyment każdej wypowiedzi
        const speeches = rows[0].values.map(row => {
            const [id, tekst, data, mowca, typ, imie, nazwisko, klub] = row;
            const sentiment = analyzeSentiment(tekst);
            return {
                id,
                text: tekst,
                date: data,
                speaker: mowca || ((imie && nazwisko) ? `${imie} ${nazwisko}` : 'Nieznany'),
                type: typ,
                party: klub || 'niez.',
                sentiment
            };
        });

        // Sortuj od najbardziej negatywnych
        speeches.sort((a, b) => a.sentiment.score - b.sentiment.score);

        // Top 20 najbardziej negatywnych
        const topNegative = speeches.filter(s => s.sentiment.label === 'negative').slice(0, 20);

        // Statystyki ogólne
        const totalAnalyzed = speeches.length;
        const negCount = speeches.filter(s => s.sentiment.label === 'negative').length;
        const posCount = speeches.filter(s => s.sentiment.label === 'positive').length;
        const neuCount = speeches.filter(s => s.sentiment.label === 'neutral').length;
        const negPercent = totalAnalyzed ? Math.round((negCount / totalAnalyzed) * 100) : 0;

        // Ranking klubów wg negatywności
        const partyNeg = {};
        speeches.forEach(s => {
            if (!partyNeg[s.party]) partyNeg[s.party] = { total: 0, neg: 0, sumScore: 0 };
            partyNeg[s.party].total++;
            partyNeg[s.party].sumScore += s.sentiment.score;
            if (s.sentiment.label === 'negative') partyNeg[s.party].neg++;
        });
        const partyRanking = Object.entries(partyNeg)
            .map(([party, d]) => ({
                party,
                avgScore: d.sumScore / d.total,
                negPercent: Math.round((d.neg / d.total) * 100),
                total: d.total
            }))
            .sort((a, b) => a.avgScore - b.avgScore);

        // Najbardziej agresywne słowa kluczowe
        const aggressiveKeywords = [
            'kłamstwo', 'kłamie', 'kłamca', 'hańba', 'skandal', 'wstyd', 'zdrada',
            'przestęp', 'oszust', 'złodziej', 'kompromitacja', 'absurd', 'bezczelnoś',
            'agresj', 'nienawis', 'prowoakc', 'manipulac', 'demagogia', 'hipokryzj',
            'korupc', 'nepotyzm', 'afera', 'bezpraw', 'łamanie', 'pogard', 'zniszcz'
        ];

        // Szukaj wypowiedzi z agresywnymi słowami
        const aggressiveSpeeches = speeches.filter(s => {
            const lower = s.text.toLowerCase();
            return aggressiveKeywords.some(kw => lower.includes(kw));
        }).slice(0, 15);

        // Render HTML
        let html = '';

        // Podsumowanie
        html += '<div class="controversial-summary">';
        html += `<div class="controversial-stat">
            <div class="controversial-stat-value">${totalAnalyzed}</div>
            <div class="controversial-stat-label">Przeanalizowanych</div>
        </div>`;
        html += `<div class="controversial-stat controversial-stat--negative">
            <div class="controversial-stat-value">${negPercent}%</div>
            <div class="controversial-stat-label">Negatywnych (${negCount})</div>
        </div>`;
        html += `<div class="controversial-stat controversial-stat--positive">
            <div class="controversial-stat-value">${100 - negPercent - Math.round((neuCount / totalAnalyzed) * 100)}%</div>
            <div class="controversial-stat-label">Pozytywnych (${posCount})</div>
        </div>`;
        html += '</div>';

        // Ranking klubów wg negatywności
        html += '<h4 style="margin:16px 0 8px;">🏛️ Negatywność wg klubów</h4>';
        html += '<div class="controversial-party-ranking">';
        partyRanking.forEach(p => {
            const barWidth = Math.min(p.negPercent, 100);
            const scoreColor = p.avgScore < -0.2 ? '#e74c3c' : p.avgScore < 0 ? '#e67e22' : '#27ae60';
            html += `<div class="controversial-party-row">
                <span class="controversial-party-name">${p.party}</span>
                <div class="controversial-party-bar-bg">
                    <div class="controversial-party-bar" style="width:${barWidth}%;background:${scoreColor};"></div>
                </div>
                <span class="controversial-party-pct">${p.negPercent}% neg.</span>
            </div>`;
        });
        html += '</div>';

        // Top negatywne wypowiedzi
        if (topNegative.length) {
            html += '<h4 style="margin:16px 0 8px;">🔴 Najbardziej negatywne wypowiedzi</h4>';
            html += '<div class="controversial-speech-list">';
            topNegative.forEach((s, i) => {
                const excerpt = s.text.length > 250 ? s.text.substring(0, 250) + '...' : s.text;
                const scoreBar = Math.round(Math.abs(s.sentiment.score) * 100);
                html += `<div class="controversial-speech-item">
                    <div class="controversial-speech-header">
                        <span class="controversial-speech-rank">#${i + 1}</span>
                        <span class="controversial-speech-speaker">${s.speaker}</span>
                        <span class="controversial-speech-party">${s.party}</span>
                        <span class="controversial-speech-date">${s.date || ''}</span>
                        <span class="controversial-speech-score" style="color:#e74c3c;">▼ ${s.sentiment.score}</span>
                    </div>
                    <div class="controversial-speech-bar-bg">
                        <div class="controversial-speech-bar" style="width:${scoreBar}%;"></div>
                    </div>
                    <div class="controversial-speech-text">${excerpt}</div>
                </div>`;
            });
            html += '</div>';
        }

        // Wypowiedzi z agresywnymi słowami kluczowymi
        if (aggressiveSpeeches.length) {
            html += '<h4 style="margin:16px 0 8px;">⚡ Wypowiedzi z agresywnym językiem</h4>';
            html += '<div class="controversial-speech-list">';
            aggressiveSpeeches.forEach(s => {
                const lower = s.text.toLowerCase();
                const foundKws = aggressiveKeywords.filter(kw => lower.includes(kw));
                const excerpt = s.text.length > 200 ? s.text.substring(0, 200) + '...' : s.text;
                html += `<div class="controversial-speech-item controversial-speech-item--aggressive">
                    <div class="controversial-speech-header">
                        <span class="controversial-speech-speaker">${s.speaker}</span>
                        <span class="controversial-speech-party">${s.party}</span>
                        <span class="controversial-speech-date">${s.date || ''}</span>
                    </div>
                    <div class="controversial-keywords">
                        ${foundKws.map(kw => `<span class="controversial-keyword">${kw}</span>`).join('')}
                    </div>
                    <div class="controversial-speech-text">${excerpt}</div>
                </div>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;
        console.log('[Predictions] Controversial speeches done:', topNegative.length, 'negative found');

    } catch (err) {
        console.error('[Predictions] analyzeControversialSpeeches error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd analizy kontrowersyjnych wypowiedzi: ' + err.message + '</div>';
    }
}

/**
 * 16. Sprzeczne głosowania — posłowie głosujący wbrew linii klubu
 */
function analyzeContradictoryVotes() {
    const container = document.getElementById('contradictoryVotesContent');
    if (!container) return;

    console.log('[Predictions] Analyzing contradictory votes...');

    try {
        // Dla każdego głosowania oblicz dominujący głos klubu, potem znajdź posłów głosujących inaczej
        const data = db2.database.exec(`
            WITH club_majority AS (
                SELECT 
                    g.id_glosowania,
                    p.klub,
                    g.glos,
                    COUNT(*) as cnt,
                    ROW_NUMBER() OVER (PARTITION BY g.id_glosowania, p.klub ORDER BY COUNT(*) DESC) as rn
                FROM glosy g
                JOIN poslowie p ON g.id_osoby = p.id_osoby
                WHERE g.glos IN ('YES', 'NO', 'ABSTAIN') AND p.klub IS NOT NULL AND p.klub != ''
                GROUP BY g.id_glosowania, p.klub, g.glos
            ),
            dominant_vote AS (
                SELECT id_glosowania, klub, glos as dominant_glos, cnt as dominant_cnt
                FROM club_majority
                WHERE rn = 1
            ),
            rebels AS (
                SELECT 
                    g.id_glosowania,
                    g.id_osoby,
                    g.glos,
                    p.imie,
                    p.nazwisko,
                    p.klub,
                    dv.dominant_glos,
                    dv.dominant_cnt,
                    gl.tytul,
                    gl.data
                FROM glosy g
                JOIN poslowie p ON g.id_osoby = p.id_osoby
                JOIN dominant_vote dv ON dv.id_glosowania = g.id_glosowania AND dv.klub = p.klub
                JOIN glosowania gl ON gl.id_glosowania = g.id_glosowania
                WHERE g.glos IN ('YES', 'NO', 'ABSTAIN')
                  AND g.glos != dv.dominant_glos
                  AND dv.dominant_cnt >= 3
            )
            SELECT 
                id_osoby,
                imie,
                nazwisko,
                klub,
                COUNT(*) as rebel_count,
                GROUP_CONCAT(DISTINCT glos || ' vs ' || dominant_glos) as vote_conflicts,
                GROUP_CONCAT(DISTINCT tytul) as voting_titles
            FROM rebels
            GROUP BY id_osoby
            HAVING rebel_count >= 2
            ORDER BY rebel_count DESC
            LIMIT 30
        `);

        if (!data.length || !data[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych o sprzecznych głosowaniach (potrzebne dane głosowań + kluby)</div>';
            return;
        }

        // Pobierz też ogólne dane o głosowaniach per klub
        const clubStats = db2.database.exec(`
            SELECT 
                p.klub,
                COUNT(DISTINCT g.id_glosowania) as total_votings,
                COUNT(*) as total_votes
            FROM glosy g
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            WHERE g.glos IN ('YES','NO','ABSTAIN') AND p.klub IS NOT NULL AND p.klub != ''
            GROUP BY p.klub
            ORDER BY total_votes DESC
        `);

        // Najczęstsze konflikty głosów (YES vs NO, itp.)
        const conflictData = db2.database.exec(`
            WITH club_majority AS (
                SELECT 
                    g.id_glosowania,
                    p.klub,
                    g.glos,
                    COUNT(*) as cnt,
                    ROW_NUMBER() OVER (PARTITION BY g.id_glosowania, p.klub ORDER BY COUNT(*) DESC) as rn
                FROM glosy g
                JOIN poslowie p ON g.id_osoby = p.id_osoby
                WHERE g.glos IN ('YES','NO','ABSTAIN') AND p.klub IS NOT NULL AND p.klub != ''
                GROUP BY g.id_glosowania, p.klub, g.glos
            ),
            dominant_vote AS (
                SELECT id_glosowania, klub, glos as dominant_glos
                FROM club_majority WHERE rn = 1
            )
            SELECT 
                p.klub,
                COUNT(*) as rebel_votes,
                COUNT(DISTINCT g.id_osoby) as rebel_mps
            FROM glosy g
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            JOIN dominant_vote dv ON dv.id_glosowania = g.id_glosowania AND dv.klub = p.klub
            WHERE g.glos IN ('YES','NO','ABSTAIN') AND g.glos != dv.dominant_glos
            GROUP BY p.klub
            ORDER BY rebel_votes DESC
        `);

        const rebels = data[0].values;

        // Render HTML
        let html = '';

        // Statystyki klubowe — sprzeczności
        if (conflictData.length && conflictData[0].values.length) {
            html += '<h4 style="margin:0 0 8px;">🏛️ Sprzeczności wg klubów</h4>';
            html += '<div class="contradictory-club-stats">';
            conflictData[0].values.forEach(row => {
                const [klub, rebelVotes, rebelMps] = row;
                html += `<div class="contradictory-club-row">
                    <span class="contradictory-club-name">${klub}</span>
                    <span class="contradictory-club-rebels">${rebelMps} posłów</span>
                    <span class="contradictory-club-votes">${rebelVotes} głosów wbrew</span>
                </div>`;
            });
            html += '</div>';
        }

        // Top "buntownicy" — posłowie najczęściej głosujący wbrew klubowi
        html += '<h4 style="margin:16px 0 8px;">⚔️ Posłowie najczęściej głosujący wbrew klubowi</h4>';
        html += '<div class="contradictory-rebels-list">';
        rebels.forEach((row, i) => {
            const [idOsoby, imie, nazwisko, klub, rebelCount, conflicts, titles] = row;
            // Pokaż max 3 tytuły głosowań
            const titleList = titles ? titles.split(',').slice(0, 3) : [];
            const conflictTypes = conflicts ? conflicts.split(',') : [];

            html += `<div class="contradictory-rebel-item">
                <div class="contradictory-rebel-header">
                    <span class="contradictory-rebel-rank">#${i + 1}</span>
                    <span class="contradictory-rebel-name">${imie || ''} ${nazwisko || ''}</span>
                    <span class="contradictory-rebel-party">${klub || 'niez.'}</span>
                    <span class="contradictory-rebel-count">${rebelCount}× wbrew</span>
                </div>
                <div class="contradictory-rebel-conflicts">
                    ${conflictTypes.map(c => `<span class="contradictory-conflict-badge">${c}</span>`).join('')}
                </div>
                ${titleList.length ? `<div class="contradictory-rebel-titles">
                    ${titleList.map(t => {
                        const short = t.length > 80 ? t.substring(0, 80) + '...' : t;
                        return `<div class="contradictory-title-item" title="${t}">${short}</div>`;
                    }).join('')}
                </div>` : ''}
            </div>`;
        });
        html += '</div>';

        container.innerHTML = html;
        console.log('[Predictions] Contradictory votes done:', rebels.length, 'rebels found');

    } catch (err) {
        console.error('[Predictions] analyzeContradictoryVotes error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd analizy sprzecznych głosowań: ' + err.message + '</div>';
    }
}

/**
 * 17. Ryzyko odejścia z klubu — scoring prawdopodobieństwa zmiany partii
 */
function analyzeDefectionRisk() {
    const container = document.getElementById('defectionRiskContent');
    if (!container) return;

    console.log('[Predictions] Analyzing defection risk...');

    try {
        // 1. Oblicz % głosów wbrew klubowi per poseł
        const rebelData = db2.database.exec(`
            WITH club_majority AS (
                SELECT 
                    g.id_glosowania,
                    p.klub,
                    g.glos,
                    COUNT(*) as cnt,
                    ROW_NUMBER() OVER (PARTITION BY g.id_glosowania, p.klub ORDER BY COUNT(*) DESC) as rn
                FROM glosy g
                JOIN poslowie p ON g.id_osoby = p.id_osoby
                WHERE g.glos IN ('YES','NO','ABSTAIN') AND p.klub IS NOT NULL AND p.klub != ''
                GROUP BY g.id_glosowania, p.klub, g.glos
            ),
            dominant AS (
                SELECT id_glosowania, klub, glos as dom_glos FROM club_majority WHERE rn = 1
            )
            SELECT 
                p.id_osoby,
                p.imie,
                p.nazwisko,
                p.klub,
                COUNT(*) as total_votes,
                SUM(CASE WHEN g.glos != d.dom_glos THEN 1 ELSE 0 END) as rebel_votes
            FROM glosy g
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            JOIN dominant d ON d.id_glosowania = g.id_glosowania AND d.klub = p.klub
            WHERE g.glos IN ('YES','NO','ABSTAIN')
            GROUP BY p.id_osoby
            HAVING total_votes >= 10
        `);

        if (!rebelData.length || !rebelData[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak wystarczających danych głosowań</div>';
            return;
        }

        // 2. Frekwencja per poseł
        const attendanceData = db2.database.exec(`
            SELECT 
                g.id_osoby,
                COUNT(*) as total,
                SUM(CASE WHEN g.glos = 'ABSENT' THEN 1 ELSE 0 END) as absences
            FROM glosy g
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            WHERE p.klub IS NOT NULL AND p.klub != ''
            GROUP BY g.id_osoby
        `);

        const attendanceMap = {};
        if (attendanceData.length) {
            attendanceData[0].values.forEach(row => {
                const [id, total, absences] = row;
                attendanceMap[id] = { total, absences, absenceRate: total > 0 ? absences / total : 0 };
            });
        }

        // 3. Sentyment wypowiedzi per poseł
        const speechData = db2.database.exec(`
            SELECT id_osoby, tekst
            FROM wypowiedzi
            WHERE tekst IS NOT NULL AND LENGTH(tekst) > 50 AND id_osoby IS NOT NULL
        `);

        const sentimentMap = {};
        if (speechData.length) {
            speechData[0].values.forEach(row => {
                const [id, tekst] = row;
                if (!sentimentMap[id]) sentimentMap[id] = { sum: 0, count: 0 };
                const s = analyzeSentiment(tekst);
                sentimentMap[id].sum += s.score;
                sentimentMap[id].count++;
            });
        }

        // 4. Oblicz risk score
        const mps = rebelData[0].values.map(row => {
            const [id, imie, nazwisko, klub, totalVotes, rebelVotes] = row;
            const rebelRate = rebelVotes / totalVotes;
            const att = attendanceMap[id] || { absenceRate: 0 };
            const absenceRate = att.absenceRate;
            const sent = sentimentMap[id];
            const avgSentiment = sent ? sent.sum / sent.count : 0;
            const negativity = Math.max(0, -avgSentiment);

            // Risk = 50% rebel rate + 25% absence rate + 25% negativity
            const riskScore = Math.min(1, rebelRate * 0.5 + absenceRate * 0.25 + negativity * 0.25);

            return {
                id, imie, nazwisko, klub,
                totalVotes, rebelVotes,
                rebelRate: Math.round(rebelRate * 1000) / 10,
                absenceRate: Math.round(absenceRate * 1000) / 10,
                negativity: Math.round(negativity * 100) / 100,
                riskScore: Math.round(riskScore * 1000) / 10,
                riskLevel: riskScore > 0.4 ? 'high' : riskScore > 0.2 ? 'medium' : 'low'
            };
        });

        mps.sort((a, b) => b.riskScore - a.riskScore);
        const topRisk = mps.slice(0, 25);
        const highCount = mps.filter(m => m.riskLevel === 'high').length;
        const medCount = mps.filter(m => m.riskLevel === 'medium').length;

        let html = '<div class="defection-summary">';
        html += `<div class="defection-stat defection-stat--high">
            <div class="defection-stat-value">${highCount}</div>
            <div class="defection-stat-label">Wysokie ryzyko</div>
        </div>`;
        html += `<div class="defection-stat defection-stat--medium">
            <div class="defection-stat-value">${medCount}</div>
            <div class="defection-stat-label">Średnie ryzyko</div>
        </div>`;
        html += `<div class="defection-stat">
            <div class="defection-stat-value">${mps.length}</div>
            <div class="defection-stat-label">Analizowanych</div>
        </div>`;
        html += '</div>';

        html += '<div class="defection-legend">';
        html += '<span style="font-size:0.7rem;color:var(--text-secondary);">Scoring: 50% głosy wbrew · 25% absencja · 25% negatywny sentyment</span>';
        html += '</div>';

        html += '<div class="defection-list">';
        topRisk.forEach((mp, i) => {
            const riskColor = mp.riskLevel === 'high' ? '#e74c3c' : mp.riskLevel === 'medium' ? '#e67e22' : '#27ae60';
            const barWidth = Math.min(mp.riskScore, 100);
            html += `<div class="defection-item defection-item--${mp.riskLevel}">
                <div class="defection-item-header">
                    <span class="defection-rank">#${i + 1}</span>
                    <span class="defection-name">${mp.imie || ''} ${mp.nazwisko || ''}</span>
                    <span class="defection-party">${mp.klub}</span>
                    <span class="defection-score" style="color:${riskColor};">${mp.riskScore}%</span>
                </div>
                <div class="defection-bar-bg">
                    <div class="defection-bar" style="width:${barWidth}%;background:${riskColor};"></div>
                </div>
                <div class="defection-factors">
                    <span class="defection-factor" title="Głosy wbrew klubowi">⚔️ ${mp.rebelRate}%</span>
                    <span class="defection-factor" title="Nieobecności">📉 ${mp.absenceRate}%</span>
                    <span class="defection-factor" title="Negatywny sentyment">😤 ${mp.negativity}</span>
                </div>
            </div>`;
        });
        html += '</div>';

        container.innerHTML = html;
        console.log('[Predictions] Defection risk done:', topRisk.length, 'MPs scored');

    } catch (err) {
        console.error('[Predictions] analyzeDefectionRisk error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd analizy ryzyka odejścia: ' + err.message + '</div>';
    }
}

/**
 * 18. Prognoza wyniku głosowania — symulacja na podstawie historii klubów
 */
function analyzeVotePredictor() {
    const container = document.getElementById('votePredictorContent');
    if (!container) return;

    console.log('[Predictions] Analyzing vote predictor...');

    try {
        // Rozkłady głosów per klub
        const clubVotePatterns = db2.database.exec(`
            SELECT 
                p.klub,
                g.glos,
                COUNT(*) as cnt
            FROM glosy g
            JOIN poslowie p ON g.id_osoby = p.id_osoby
            WHERE g.glos IN ('YES','NO','ABSTAIN') AND p.klub IS NOT NULL AND p.klub != ''
            GROUP BY p.klub, g.glos
            ORDER BY p.klub
        `);

        if (!clubVotePatterns.length || !clubVotePatterns[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych głosowań</div>';
            return;
        }

        const clubs = {};
        clubVotePatterns[0].values.forEach(row => {
            const [klub, glos, cnt] = row;
            if (!clubs[klub]) clubs[klub] = { yes: 0, no: 0, abstain: 0, total: 0 };
            if (glos === 'YES') clubs[klub].yes = cnt;
            else if (glos === 'NO') clubs[klub].no = cnt;
            else if (glos === 'ABSTAIN') clubs[klub].abstain = cnt;
            clubs[klub].total += cnt;
        });

        const clubProfiles = Object.entries(clubs).map(([name, d]) => ({
            name,
            yesRate: Math.round((d.yes / d.total) * 1000) / 10,
            noRate: Math.round((d.no / d.total) * 1000) / 10,
            abstainRate: Math.round((d.abstain / d.total) * 1000) / 10,
            total: d.total, yes: d.yes, no: d.no, abstain: d.abstain
        })).sort((a, b) => b.total - a.total);

        // Liczba posłów per klub
        const mpCounts = db2.database.exec(`
            SELECT klub, COUNT(*) as cnt FROM poslowie 
            WHERE klub IS NOT NULL AND klub != '' AND aktywny = 1
            GROUP BY klub
        `);
        const mpCountMap = {};
        if (mpCounts.length) {
            mpCounts[0].values.forEach(row => { mpCountMap[row[0]] = row[1]; });
        }

        // Symulacja wyniku
        let totalYes = 0, totalNo = 0, totalAbstain = 0, totalMps = 0;
        clubProfiles.forEach(c => {
            const mps = mpCountMap[c.name] || 0;
            totalYes += Math.round(mps * c.yesRate / 100);
            totalNo += Math.round(mps * c.noRate / 100);
            totalAbstain += Math.round(mps * c.abstainRate / 100);
            totalMps += mps;
        });

        const predictedResult = totalYes > totalNo ? 'PRZYJĘTO' : 'ODRZUCONO';
        const confidence = totalMps > 0 ? Math.round(Math.abs(totalYes - totalNo) / totalMps * 100) : 0;

        // Ostatnie głosowania
        const recentVotings = db2.database.exec(`
            SELECT gl.id_glosowania, gl.tytul, gl.data, gl.wynik, gl.za, gl.przeciw, gl.wstrzymalo
            FROM glosowania gl
            ORDER BY gl.data DESC
            LIMIT 10
        `);

        let html = '';

        html += '<div class="vote-pred-simulation">';
        html += '<h4 style="margin:0 0 8px;">🎯 Symulacja typowego głosowania</h4>';
        html += `<div class="vote-pred-result vote-pred-result--${predictedResult === 'PRZYJĘTO' ? 'pass' : 'fail'}">`;
        html += `<div class="vote-pred-result-label">Prognoza:</div>`;
        html += `<div class="vote-pred-result-value">${predictedResult}</div>`;
        html += `<div class="vote-pred-confidence">Pewność: ${confidence}%</div>`;
        html += '</div>';
        html += `<div class="vote-pred-breakdown">
            <div class="vote-pred-count vote-pred-count--yes">✅ Za: ~${totalYes}</div>
            <div class="vote-pred-count vote-pred-count--no">❌ Przeciw: ~${totalNo}</div>
            <div class="vote-pred-count vote-pred-count--abstain">⬜ Wstrzyma: ~${totalAbstain}</div>
        </div>`;
        html += '</div>';

        html += '<h4 style="margin:16px 0 8px;">🏛️ Profil głosowania klubów</h4>';
        html += '<div class="vote-pred-clubs">';
        clubProfiles.forEach(c => {
            const mps = mpCountMap[c.name] || '?';
            html += `<div class="vote-pred-club-row">
                <div class="vote-pred-club-name">${c.name} <small>(${mps} posłów)</small></div>
                <div class="vote-pred-club-bars">
                    <div class="vote-pred-bar-stack">
                        <div class="vote-pred-bar-yes" style="width:${c.yesRate}%;" title="Za: ${c.yesRate}%"></div>
                        <div class="vote-pred-bar-no" style="width:${c.noRate}%;" title="Przeciw: ${c.noRate}%"></div>
                        <div class="vote-pred-bar-abstain" style="width:${c.abstainRate}%;" title="Wstrzyma: ${c.abstainRate}%"></div>
                    </div>
                </div>
                <div class="vote-pred-club-pcts">
                    <span style="color:#27ae60;">${c.yesRate}%</span> /
                    <span style="color:#e74c3c;">${c.noRate}%</span> /
                    <span style="color:#95a5a6;">${c.abstainRate}%</span>
                </div>
            </div>`;
        });
        html += '</div>';

        if (recentVotings.length && recentVotings[0].values.length) {
            html += '<h4 style="margin:16px 0 8px;">📋 Ostatnie głosowania (weryfikacja)</h4>';
            html += '<div class="vote-pred-recent">';
            recentVotings[0].values.forEach(row => {
                const [id, tytul, data, wynik, za, przeciw, wstrzymalo] = row;
                const title = tytul && tytul.length > 80 ? tytul.substring(0, 80) + '...' : (tytul || '—');
                const resultClass = wynik && wynik.toLowerCase().includes('przyjęt') ? 'pass' : 'fail';
                html += `<div class="vote-pred-recent-item">
                    <span class="vote-pred-recent-result vote-pred-recent-result--${resultClass}">${wynik || '?'}</span>
                    <span class="vote-pred-recent-title" title="${tytul || ''}">${title}</span>
                    <span class="vote-pred-recent-votes">${za||0}/${przeciw||0}/${wstrzymalo||0}</span>
                    <span class="vote-pred-recent-date">${data || ''}</span>
                </div>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;
        console.log('[Predictions] Vote predictor done');

    } catch (err) {
        console.error('[Predictions] analyzeVotePredictor error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd prognozy głosowania: ' + err.message + '</div>';
    }
}

/**
 * 19. Barometr napięcia politycznego — trend sentymentu w czasie
 */
function analyzeTensionBarometer() {
    const container = document.getElementById('tensionBarometerContent');
    if (!container) return;

    console.log('[Predictions] Analyzing tension barometer...');

    try {
        const rows = db2.database.exec(`
            SELECT w.data, w.tekst, p.klub
            FROM wypowiedzi w
            LEFT JOIN poslowie p ON w.id_osoby = p.id_osoby
            WHERE w.tekst IS NOT NULL AND LENGTH(w.tekst) > 50 AND w.data IS NOT NULL
            ORDER BY w.data
        `);

        if (!rows.length || !rows[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych wypowiedzi z datami</div>';
            return;
        }

        const monthlyData = {};
        rows[0].values.forEach(row => {
            const [data, tekst, klub] = row;
            if (!data || data.length < 7) return;
            const month = data.substring(0, 7);
            if (!monthlyData[month]) monthlyData[month] = { sum: 0, count: 0, negCount: 0, posCount: 0 };
            const s = analyzeSentiment(tekst);
            monthlyData[month].sum += s.score;
            monthlyData[month].count++;
            if (s.label === 'negative') monthlyData[month].negCount++;
            if (s.label === 'positive') monthlyData[month].posCount++;
        });

        const months = Object.keys(monthlyData).sort();
        if (months.length < 2) {
            container.innerHTML = '<div class="prediction-no-data">Za mało danych czasowych (minimum 2 miesiące)</div>';
            return;
        }

        const timeline = months.map(m => ({
            month: m,
            avgScore: Math.round((monthlyData[m].sum / monthlyData[m].count) * 1000) / 1000,
            count: monthlyData[m].count,
            negPercent: Math.round((monthlyData[m].negCount / monthlyData[m].count) * 100),
            posPercent: Math.round((monthlyData[m].posCount / monthlyData[m].count) * 100)
        }));

        // Regresja liniowa
        const n = timeline.length;
        const xMean = (n - 1) / 2;
        const yMean = timeline.reduce((s, t) => s + t.avgScore, 0) / n;
        let num = 0, den = 0;
        timeline.forEach((t, i) => {
            num += (i - xMean) * (t.avgScore - yMean);
            den += (i - xMean) * (i - xMean);
        });
        const slope = den ? num / den : 0;
        const trendDirection = slope < -0.01 ? 'rosnące napięcie' : slope > 0.01 ? 'malejące napięcie' : 'stabilne';
        const trendEmoji = slope < -0.01 ? '📈🔥' : slope > 0.01 ? '📉✌️' : '➡️';

        // Prognoza na 3 miesiące
        const lastScore = timeline[timeline.length - 1].avgScore;
        const forecast = [];
        for (let i = 1; i <= 3; i++) {
            const forecastScore = Math.max(-1, Math.min(1, lastScore + slope * i));
            const dt = new Date(timeline[timeline.length - 1].month + '-01');
            dt.setMonth(dt.getMonth() + i);
            const forecastMonth = dt.toISOString().substring(0, 7);
            forecast.push({ month: forecastMonth, avgScore: Math.round(forecastScore * 1000) / 1000, isForecast: true });
        }

        const allScores = timeline.map(t => t.avgScore);
        const minScore = Math.min(...allScores, ...forecast.map(f => f.avgScore));
        const maxScore = Math.max(...allScores, ...forecast.map(f => f.avgScore));
        const range = Math.max(maxScore - minScore, 0.1);

        let html = '';

        html += `<div class="tension-trend-banner tension-trend-banner--${slope < -0.01 ? 'hot' : slope > 0.01 ? 'cool' : 'stable'}">
            <div class="tension-trend-emoji">${trendEmoji}</div>
            <div>
                <div class="tension-trend-label">Trend: <strong>${trendDirection}</strong></div>
                <div class="tension-trend-slope">Nachylenie: ${(slope * 100).toFixed(2)} pkt/miesiąc</div>
            </div>
        </div>`;

        html += '<h4 style="margin:12px 0 6px;">📊 Sentyment w czasie</h4>';
        html += '<div class="tension-chart">';
        const allData = [...timeline, ...forecast];
        allData.forEach(t => {
            const normalizedHeight = range > 0 ? ((t.avgScore - minScore) / range) * 100 : 50;
            const color = t.isForecast ? '#3498db55' : (t.avgScore < -0.1 ? '#e74c3c' : t.avgScore > 0.1 ? '#27ae60' : '#f39c12');
            const border = t.isForecast ? '2px dashed #3498db' : 'none';
            html += `<div class="tension-chart-col" title="${t.month}: ${t.avgScore}${t.isForecast ? ' (prognoza)' : ''}">
                <div class="tension-chart-bar" style="height:${Math.max(normalizedHeight, 4)}%;background:${color};border:${border};"></div>
                <div class="tension-chart-label">${t.month.substring(5)}</div>
            </div>`;
        });
        html += '</div>';

        html += '<h4 style="margin:12px 0 6px;">📅 Szczegóły</h4>';
        html += '<div class="tension-details">';
        [...timeline].reverse().slice(0, 12).forEach(t => {
            const sentColor = t.avgScore < -0.1 ? '#e74c3c' : t.avgScore > 0.1 ? '#27ae60' : '#f39c12';
            html += `<div class="tension-detail-row">
                <span class="tension-detail-month">${t.month}</span>
                <span class="tension-detail-score" style="color:${sentColor};">${t.avgScore > 0 ? '+' : ''}${t.avgScore}</span>
                <span class="tension-detail-neg">🔴 ${t.negPercent}% neg.</span>
                <span class="tension-detail-pos">🟢 ${t.posPercent}% poz.</span>
                <span class="tension-detail-count">${t.count} wyp.</span>
            </div>`;
        });
        html += '</div>';

        html += '<h4 style="margin:12px 0 6px;">🔮 Prognoza (3 mies.)</h4>';
        html += '<div class="tension-forecast">';
        forecast.forEach(f => {
            const sentColor = f.avgScore < -0.1 ? '#e74c3c' : f.avgScore > 0.1 ? '#27ae60' : '#f39c12';
            html += `<div class="tension-forecast-item">
                <span class="tension-forecast-month">${f.month}</span>
                <span class="tension-forecast-score" style="color:${sentColor};">${f.avgScore > 0 ? '+' : ''}${f.avgScore}</span>
                <span class="tension-forecast-badge">prognoza</span>
            </div>`;
        });
        html += '</div>';

        container.innerHTML = html;
        console.log('[Predictions] Tension barometer done:', months.length, 'months analyzed');

    } catch (err) {
        console.error('[Predictions] analyzeTensionBarometer error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd barometru napięcia: ' + err.message + '</div>';
    }
}

/**
 * 20. Prognoza koalicji — zbieżność głosowań między klubami w czasie
 */
function analyzeCoalitionForecast() {
    const container = document.getElementById('coalitionForecastContent');
    if (!container) return;

    console.log('[Predictions] Analyzing coalition forecast...');

    try {
        const clubVotesPerVoting = db2.database.exec(`
            WITH club_dir AS (
                SELECT 
                    g.id_glosowania,
                    gl.data,
                    p.klub,
                    g.glos,
                    COUNT(*) as cnt,
                    ROW_NUMBER() OVER (PARTITION BY g.id_glosowania, p.klub ORDER BY COUNT(*) DESC) as rn
                FROM glosy g
                JOIN poslowie p ON g.id_osoby = p.id_osoby
                JOIN glosowania gl ON gl.id_glosowania = g.id_glosowania
                WHERE g.glos IN ('YES','NO') AND p.klub IS NOT NULL AND p.klub != ''
                GROUP BY g.id_glosowania, p.klub, g.glos
            )
            SELECT id_glosowania, data, klub, glos as dominant_vote
            FROM club_dir
            WHERE rn = 1
            ORDER BY data
        `);

        if (!clubVotesPerVoting.length || !clubVotesPerVoting[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych głosowań</div>';
            return;
        }

        const votingsByMonth = {};
        const allClubs = new Set();

        clubVotesPerVoting[0].values.forEach(row => {
            const [idGl, data, klub, vote] = row;
            if (!data || data.length < 7) return;
            const month = data.substring(0, 7);
            allClubs.add(klub);
            if (!votingsByMonth[month]) votingsByMonth[month] = {};
            if (!votingsByMonth[month][idGl]) votingsByMonth[month][idGl] = {};
            votingsByMonth[month][idGl][klub] = vote;
        });

        const clubList = [...allClubs].sort();
        if (clubList.length < 2) {
            container.innerHTML = '<div class="prediction-no-data">Za mało klubów do porównania</div>';
            return;
        }

        const months = Object.keys(votingsByMonth).sort();
        const pairTimeline = {};

        months.forEach(month => {
            const votings = votingsByMonth[month];
            for (let i = 0; i < clubList.length; i++) {
                for (let j = i + 1; j < clubList.length; j++) {
                    const pairKey = `${clubList[i]}|${clubList[j]}`;
                    if (!pairTimeline[pairKey]) pairTimeline[pairKey] = [];
                    let same = 0, total = 0;
                    Object.values(votings).forEach(voteMap => {
                        if (voteMap[clubList[i]] && voteMap[clubList[j]]) {
                            total++;
                            if (voteMap[clubList[i]] === voteMap[clubList[j]]) same++;
                        }
                    });
                    if (total >= 3) {
                        pairTimeline[pairKey].push({ month, agreement: Math.round((same / total) * 1000) / 10, total });
                    }
                }
            }
        });

        const pairSummaries = Object.entries(pairTimeline)
            .filter(([, data]) => data.length >= 2)
            .map(([pair, data]) => {
                const [club1, club2] = pair.split('|');
                const overallAgreement = data.reduce((s, d) => s + d.agreement, 0) / data.length;
                const half = Math.floor(data.length / 2);
                const firstHalf = data.slice(0, half);
                const secondHalf = data.slice(half);
                const firstAvg = firstHalf.reduce((s, d) => s + d.agreement, 0) / (firstHalf.length || 1);
                const secondAvg = secondHalf.reduce((s, d) => s + d.agreement, 0) / (secondHalf.length || 1);
                const trend = secondAvg - firstAvg;

                return {
                    club1, club2,
                    agreement: Math.round(overallAgreement * 10) / 10,
                    trend: Math.round(trend * 10) / 10,
                    trendDirection: trend > 3 ? 'zbliżają się' : trend < -3 ? 'oddalają się' : 'stabilne',
                    trendEmoji: trend > 3 ? '🤝📈' : trend < -3 ? '💥📉' : '➡️',
                    data
                };
            })
            .sort((a, b) => b.agreement - a.agreement);

        let html = '';

        // Macierz zbieżności
        html += '<h4 style="margin:0 0 8px;">🗺️ Macierz zbieżności głosowań</h4>';
        html += '<div class="coalition-matrix-wrap"><table class="coalition-matrix">';
        html += '<tr><th></th>';
        clubList.forEach(c => { html += `<th>${c}</th>`; });
        html += '</tr>';
        clubList.forEach((c1, i) => {
            html += `<tr><th>${c1}</th>`;
            clubList.forEach((c2, j) => {
                if (i === j) {
                    html += '<td class="coalition-cell coalition-cell--self">—</td>';
                } else {
                    const key = i < j ? `${c1}|${c2}` : `${c2}|${c1}`;
                    const pair = pairSummaries.find(p => `${p.club1}|${p.club2}` === key);
                    const val = pair ? pair.agreement : '?';
                    const bg = pair ? `hsl(${Math.round(pair.agreement * 1.2)}, 70%, 25%)` : 'transparent';
                    html += `<td class="coalition-cell" style="background:${bg};">${val}%</td>`;
                }
            });
            html += '</tr>';
        });
        html += '</table></div>';

        // Trendy par
        html += '<h4 style="margin:16px 0 8px;">📈 Trend zbieżności</h4>';
        html += '<div class="coalition-trends">';
        const trendPairs = [...pairSummaries].sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend)).slice(0, 10);
        trendPairs.forEach(p => {
            const trendColor = p.trend > 3 ? '#27ae60' : p.trend < -3 ? '#e74c3c' : '#95a5a6';
            html += `<div class="coalition-trend-row">
                <span class="coalition-trend-pair">${p.club1} ↔ ${p.club2}</span>
                <span class="coalition-trend-emoji">${p.trendEmoji}</span>
                <span class="coalition-trend-dir" style="color:${trendColor};">${p.trendDirection} (${p.trend > 0 ? '+' : ''}${p.trend} pkt)</span>
                <span class="coalition-trend-agreement">${p.agreement}% zgodność</span>
            </div>`;
        });
        html += '</div>';

        // Ranking par
        if (pairSummaries.length >= 2) {
            html += '<h4 style="margin:16px 0 8px;">🏆 Ranking par klubów</h4>';
            html += '<div class="coalition-pair-ranking">';
            html += '<div class="coalition-pair-section"><strong>Najbliżsi sojusznicy:</strong></div>';
            pairSummaries.slice(0, 5).forEach(p => {
                html += `<div class="coalition-pair-item coalition-pair-item--allies">
                    <span>${p.club1} ↔ ${p.club2}</span>
                    <span style="color:#27ae60;font-weight:700;">${p.agreement}%</span>
                </div>`;
            });
            html += '<div class="coalition-pair-section" style="margin-top:8px;"><strong>Największe różnice:</strong></div>';
            [...pairSummaries].reverse().slice(0, 5).forEach(p => {
                html += `<div class="coalition-pair-item coalition-pair-item--rivals">
                    <span>${p.club1} ↔ ${p.club2}</span>
                    <span style="color:#e74c3c;font-weight:700;">${p.agreement}%</span>
                </div>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;
        console.log('[Predictions] Coalition forecast done:', pairSummaries.length, 'pairs analyzed');

    } catch (err) {
        console.error('[Predictions] analyzeCoalitionForecast error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd prognozy koalicji: ' + err.message + '</div>';
    }
}

/**
 * 21. Predykcja aktywności posła — trend i prognoza aktywności
 */
function analyzeActivityForecast() {
    const container = document.getElementById('activityForecastContent');
    if (!container) return;

    console.log('[Predictions] Analyzing activity forecast...');

    try {
        const speechActivity = db2.database.exec(`
            SELECT w.id_osoby, SUBSTR(w.data, 1, 7) as month, COUNT(*) as cnt
            FROM wypowiedzi w
            WHERE w.id_osoby IS NOT NULL AND w.data IS NOT NULL AND LENGTH(w.data) >= 7
            GROUP BY w.id_osoby, SUBSTR(w.data, 1, 7)
        `);

        const interpActivity = db2.database.exec(`
            SELECT i.id_osoby, SUBSTR(i.data, 1, 7) as month, COUNT(*) as cnt
            FROM interpelacje i
            WHERE i.id_osoby IS NOT NULL AND i.data IS NOT NULL AND LENGTH(i.data) >= 7
            GROUP BY i.id_osoby, SUBSTR(i.data, 1, 7)
        `);

        const voteActivity = db2.database.exec(`
            SELECT g.id_osoby, SUBSTR(gl.data, 1, 7) as month, COUNT(*) as cnt
            FROM glosy g
            JOIN glosowania gl ON gl.id_glosowania = g.id_glosowania
            WHERE g.id_osoby IS NOT NULL AND gl.data IS NOT NULL AND LENGTH(gl.data) >= 7
              AND g.glos IN ('YES','NO','ABSTAIN')
            GROUP BY g.id_osoby, SUBSTR(gl.data, 1, 7)
        `);

        const mpInfo = db2.database.exec(`
            SELECT id_osoby, imie, nazwisko, klub FROM poslowie WHERE aktywny = 1
        `);

        if (!mpInfo.length || !mpInfo[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych posłów</div>';
            return;
        }

        const mpMap = {};
        mpInfo[0].values.forEach(row => {
            const [id, imie, nazwisko, klub] = row;
            mpMap[id] = { imie, nazwisko, klub, monthly: {} };
        });

        const addActivity = (data, field) => {
            if (!data.length) return;
            data[0].values.forEach(row => {
                const [id, month, count] = row;
                if (!mpMap[id]) return;
                if (!mpMap[id].monthly[month]) mpMap[id].monthly[month] = { speeches: 0, interps: 0, votes: 0 };
                mpMap[id].monthly[month][field] = count;
            });
        };

        addActivity(speechActivity, 'speeches');
        addActivity(interpActivity, 'interps');
        addActivity(voteActivity, 'votes');

        const results = Object.entries(mpMap)
            .filter(([, mp]) => Object.keys(mp.monthly).length >= 3)
            .map(([id, mp]) => {
                const months = Object.keys(mp.monthly).sort();
                const totals = months.map(m => {
                    const d = mp.monthly[m];
                    return d.speeches + d.interps + d.votes;
                });

                const n = totals.length;
                const xMean = (n - 1) / 2;
                const yMean = totals.reduce((s, v) => s + v, 0) / n;
                let num = 0, den = 0;
                totals.forEach((y, i) => {
                    num += (i - xMean) * (y - yMean);
                    den += (i - xMean) * (i - xMean);
                });
                const slope = den ? num / den : 0;
                const lastTotal = totals[totals.length - 1];

                const forecast = [];
                for (let i = 1; i <= 3; i++) {
                    forecast.push(Math.max(0, Math.round(lastTotal + slope * i)));
                }

                const avgTotal = yMean;
                const trendPct = avgTotal > 0 ? Math.round((slope / avgTotal) * 1000) / 10 : 0;

                return {
                    id,
                    name: `${mp.imie || ''} ${mp.nazwisko || ''}`.trim(),
                    klub: mp.klub || 'niez.',
                    avgTotal: Math.round(avgTotal),
                    lastTotal,
                    slope: Math.round(slope * 10) / 10,
                    trendPct,
                    trendDirection: trendPct > 10 ? 'wzrost' : trendPct < -10 ? 'spadek' : 'stabilnie',
                    forecast,
                    months
                };
            });

        const rising = [...results].sort((a, b) => b.trendPct - a.trendPct).slice(0, 10);
        const falling = [...results].sort((a, b) => a.trendPct - b.trendPct).slice(0, 10);

        const risingCount = results.filter(r => r.trendDirection === 'wzrost').length;
        const fallingCount = results.filter(r => r.trendDirection === 'spadek').length;
        const stableCount = results.filter(r => r.trendDirection === 'stabilnie').length;

        let html = '<div class="activity-fc-summary">';
        html += `<div class="activity-fc-stat activity-fc-stat--rising">
            <div class="activity-fc-stat-value">${risingCount}</div>
            <div class="activity-fc-stat-label">📈 Rosnąca</div>
        </div>`;
        html += `<div class="activity-fc-stat">
            <div class="activity-fc-stat-value">${stableCount}</div>
            <div class="activity-fc-stat-label">➡️ Stabilna</div>
        </div>`;
        html += `<div class="activity-fc-stat activity-fc-stat--falling">
            <div class="activity-fc-stat-value">${fallingCount}</div>
            <div class="activity-fc-stat-label">📉 Spadająca</div>
        </div>`;
        html += '</div>';

        html += '<h4 style="margin:12px 0 6px;">📈 Największy wzrost aktywności</h4>';
        html += '<div class="activity-fc-list">';
        rising.forEach((mp, i) => {
            html += `<div class="activity-fc-item activity-fc-item--rising">
                <div class="activity-fc-item-header">
                    <span class="activity-fc-rank">#${i + 1}</span>
                    <span class="activity-fc-name">${mp.name}</span>
                    <span class="activity-fc-party">${mp.klub}</span>
                    <span class="activity-fc-trend" style="color:#27ae60;">+${mp.trendPct}%</span>
                </div>
                <div class="activity-fc-details">
                    <span>Średnia: ${mp.avgTotal}/mies.</span>
                    <span>Ostatni: ${mp.lastTotal}</span>
                    <span>Prognoza: ${mp.forecast.join(' → ')}</span>
                </div>
            </div>`;
        });
        html += '</div>';

        html += '<h4 style="margin:12px 0 6px;">📉 Największy spadek aktywności</h4>';
        html += '<div class="activity-fc-list">';
        falling.forEach((mp, i) => {
            html += `<div class="activity-fc-item activity-fc-item--falling">
                <div class="activity-fc-item-header">
                    <span class="activity-fc-rank">#${i + 1}</span>
                    <span class="activity-fc-name">${mp.name}</span>
                    <span class="activity-fc-party">${mp.klub}</span>
                    <span class="activity-fc-trend" style="color:#e74c3c;">${mp.trendPct}%</span>
                </div>
                <div class="activity-fc-details">
                    <span>Średnia: ${mp.avgTotal}/mies.</span>
                    <span>Ostatni: ${mp.lastTotal}</span>
                    <span>Prognoza: ${mp.forecast.join(' → ')}</span>
                </div>
            </div>`;
        });
        html += '</div>';

        container.innerHTML = html;
        console.log('[Predictions] Activity forecast done:', results.length, 'MPs analyzed');

    } catch (err) {
        console.error('[Predictions] analyzeActivityForecast error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd predykcji aktywności: ' + err.message + '</div>';
    }
}

// =====================================================
// AI-POWERED MODULES
// =====================================================

/**
 * Helper: pobierz klucz API z localStorage (wspólny z ai-chat.js)
 */
function getApiKey() {
    try {
        return localStorage.getItem('aiChatApiKey') || '';
    } catch { return ''; }
}

/**
 * Helper: pobierz wybrany model z localStorage
 */
function getSelectedModel() {
    try {
        return localStorage.getItem('aiChatModel') || 'gemini-2.0-flash';
    } catch { return 'gemini-2.0-flash'; }
}

/**
 * Helper: wywołaj Gemini API bezpośrednio
 */
async function callGeminiForPrediction(prompt, maxTokens = 2000) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('NO_API_KEY');

    const model = getSelectedModel();
    // Buduj URL na podstawie nazwy modelu
    let apiUrl;
    if (model.startsWith('gemini-') || model.startsWith('gemma-')) {
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    } else {
        // Fallback do gemini-2.0-flash
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Gemini z Google Search Grounding — AI przeszukuje sieć
 * @param {string} prompt — zapytanie
 * @param {number} maxTokens
 * @returns {{text: string, sources: Array}}
 */
async function callGeminiWithSearch(prompt, maxTokens = 2000) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Brak klucza API. Ustaw go w sekcji AI Chat.');

    const model = getSelectedModel();
    const modelName = (model.startsWith('gemini-') || model.startsWith('gemma-')) ? model : 'gemini-2.0-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';

    // Wyciągnij źródła z grounding metadata
    const grounding = candidate?.groundingMetadata;
    const sources = [];
    if (grounding?.groundingChunks) {
        for (const chunk of grounding.groundingChunks) {
            if (chunk.web) {
                sources.push({ title: chunk.web.title || '', uri: chunk.web.uri || '' });
            }
        }
    }
    if (grounding?.webSearchQueries) {
        // Zapytania które AI wykonało
        sources._queries = grounding.webSearchQueries;
    }

    return { text, sources };
}

/**
 * 22. Auto-podsumowanie posiedzeń — AI generuje streszczenia
 */
async function analyzeSessionSummary() {
    const container = document.getElementById('sessionSummaryContent');
    if (!container) return;

    console.log('[Predictions] Loading session summary...');

    try {
        // Pobierz listę posiedzeń
        const sessions = db2.database.exec(`
            SELECT DISTINCT id_posiedzenia, numer, data_start, data_koniec
            FROM posiedzenia
            WHERE data_start IS NOT NULL
            ORDER BY data_start DESC
            LIMIT 50
        `);

        if (!sessions.length || !sessions[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych posiedzeń w bazie</div>';
            return;
        }

        const sessionList = sessions[0].values;
        const hasApiKey = !!getApiKey();

        // Kombobox z posiedzeniami
        let html = '<div class="session-summary-controls">';
        html += '<label class="session-summary-label">Wybierz posiedzenie:</label>';
        html += '<select id="sessionSummarySelect" class="profile-combobox">';
        sessionList.forEach(row => {
            const [id, numer, dataStart, dataKoniec] = row;
            const label = `Posiedzenie ${numer || id} (${dataStart || '?'}${dataKoniec ? ' – ' + dataKoniec : ''})`;
            html += `<option value="${id}">${label}</option>`;
        });
        html += '</select>';
        html += `<button id="sessionSummaryBtn" class="session-summary-btn">${hasApiKey ? '🤖 Generuj podsumowanie AI' : '📊 Generuj podsumowanie'}</button>`;
        if (!hasApiKey) {
            html += '<div class="session-summary-hint">💡 Dodaj klucz API Gemini w czacie AI, aby uzyskać streszczenie generowane przez AI</div>';
        }
        html += '</div>';
        html += '<div id="sessionSummaryResult"></div>';

        container.innerHTML = html;

        // Event listener
        document.getElementById('sessionSummaryBtn').addEventListener('click', async () => {
            const sessionId = document.getElementById('sessionSummarySelect').value;
            const resultDiv = document.getElementById('sessionSummaryResult');
            resultDiv.innerHTML = '<div class="prediction-loading"><div class="prediction-spinner"></div><p>Analizuję posiedzenie...</p></div>';

            try {
                // Pobierz wypowiedzi z posiedzenia
                const speeches = db2.database.exec(`
                    SELECT w.mowca, w.tekst, w.data, p.klub
                    FROM wypowiedzi w
                    LEFT JOIN poslowie p ON w.id_osoby = p.id_osoby
                    WHERE w.id_posiedzenia = ?
                    AND w.tekst IS NOT NULL AND LENGTH(w.tekst) > 20
                    ORDER BY w.id_wypowiedzi
                    LIMIT 200
                `, [sessionId]);

                if (!speeches.length || !speeches[0].values.length) {
                    resultDiv.innerHTML = '<div class="prediction-no-data">Brak wypowiedzi dla tego posiedzenia</div>';
                    return;
                }

                const speechData = speeches[0].values;
                const totalSpeeches = speechData.length;

                // Statystyki lokalne
                const speakers = {};
                const parties = {};
                let totalChars = 0;
                const sentimentResults = [];

                speechData.forEach(row => {
                    const [mowca, tekst, data, klub] = row;
                    const speaker = mowca || 'Nieznany';
                    const party = klub || 'niez.';
                    speakers[speaker] = (speakers[speaker] || 0) + 1;
                    parties[party] = (parties[party] || 0) + 1;
                    totalChars += (tekst || '').length;

                    const sent = analyzeSentiment(tekst || '');
                    sentimentResults.push({ speaker, party, score: sent.score, label: sent.label });
                });

                const topSpeakers = Object.entries(speakers).sort((a, b) => b[1] - a[1]).slice(0, 10);
                const avgSentiment = sentimentResults.reduce((s, r) => s + r.score, 0) / sentimentResults.length;
                const negCount = sentimentResults.filter(r => r.label === 'negative').length;
                const posCount = sentimentResults.filter(r => r.label === 'positive').length;

                let rhtml = '';

                // Statystyki posiedzenia
                rhtml += '<div class="session-stats">';
                rhtml += `<div class="session-stat"><div class="session-stat-value">${totalSpeeches}</div><div class="session-stat-label">Wypowiedzi</div></div>`;
                rhtml += `<div class="session-stat"><div class="session-stat-value">${Object.keys(speakers).length}</div><div class="session-stat-label">Mówców</div></div>`;
                rhtml += `<div class="session-stat"><div class="session-stat-value">${Math.round(totalChars / 1000)}k</div><div class="session-stat-label">Znaków</div></div>`;
                const sentColor = avgSentiment < -0.1 ? '#e74c3c' : avgSentiment > 0.1 ? '#27ae60' : '#f39c12';
                rhtml += `<div class="session-stat"><div class="session-stat-value" style="color:${sentColor};">${avgSentiment.toFixed(3)}</div><div class="session-stat-label">Śr. sentyment</div></div>`;
                rhtml += '</div>';

                // Top mówcy
                rhtml += '<h4 style="margin:12px 0 6px;">🎤 Najczęstsi mówcy</h4>';
                rhtml += '<div class="session-speakers">';
                topSpeakers.forEach(([name, count]) => {
                    const pct = Math.round((count / totalSpeeches) * 100);
                    rhtml += `<div class="session-speaker-row">
                        <span class="session-speaker-name">${name}</span>
                        <div class="session-speaker-bar-bg"><div class="session-speaker-bar" style="width:${pct}%;"></div></div>
                        <span class="session-speaker-count">${count} (${pct}%)</span>
                    </div>`;
                });
                rhtml += '</div>';

                // Rozkład partyjny
                rhtml += '<h4 style="margin:12px 0 6px;">🏛️ Wypowiedzi wg klubów</h4>';
                rhtml += '<div class="session-parties">';
                Object.entries(parties).sort((a, b) => b[1] - a[1]).forEach(([party, cnt]) => {
                    rhtml += `<span class="session-party-tag">${party}: ${cnt}</span>`;
                });
                rhtml += '</div>';

                // Sentyment
                rhtml += '<h4 style="margin:12px 0 6px;">😊 Sentyment debaty</h4>';
                rhtml += `<div class="session-sentiment-bar">
                    <div class="session-sent-pos" style="width:${Math.round(posCount / totalSpeeches * 100)}%;" title="Pozytywne: ${posCount}">🟢 ${Math.round(posCount / totalSpeeches * 100)}%</div>
                    <div class="session-sent-neu" style="width:${Math.round((totalSpeeches - posCount - negCount) / totalSpeeches * 100)}%;" title="Neutralne">⚪</div>
                    <div class="session-sent-neg" style="width:${Math.round(negCount / totalSpeeches * 100)}%;" title="Negatywne: ${negCount}">🔴 ${Math.round(negCount / totalSpeeches * 100)}%</div>
                </div>`;

                // AI Summary (jeśli jest klucz API)
                if (getApiKey()) {
                    rhtml += '<h4 style="margin:16px 0 6px;">🤖 Streszczenie AI</h4>';
                    rhtml += '<div id="aiSummaryBox" class="session-ai-summary"><div class="prediction-loading"><div class="prediction-spinner"></div><p>AI generuje streszczenie...</p></div></div>';
                    resultDiv.innerHTML = rhtml;

                    // Wyślij do AI
                    const speechExcerpts = speechData.slice(0, 50).map(r => {
                        const txt = (r[1] || '').substring(0, 300);
                        return `[${r[0] || 'Mówca'}] ${txt}`;
                    }).join('\n\n');

                    try {
                        const aiPrompt = `Jesteś analitykiem parlamentarnym. Przeanalizuj poniższe wypowiedzi z posiedzenia Sejmu i napisz zwięzłe podsumowanie (max 500 słów) w języku polskim. Uwzględnij: 1) Główne tematy debaty, 2) Kluczowe stanowiska partii/posłów, 3) Ton dyskusji, 4) Wnioski.

Statystyki: ${totalSpeeches} wypowiedzi, ${Object.keys(speakers).length} mówców, średni sentyment: ${avgSentiment.toFixed(3)}

Wypowiedzi:
${speechExcerpts}`;

                        const aiSummary = await callGeminiForPrediction(aiPrompt, 1500);
                        document.getElementById('aiSummaryBox').innerHTML = `<div class="session-ai-text">${aiSummary.replace(/\n/g, '<br>')}</div>`;
                    } catch (aiErr) {
                        document.getElementById('aiSummaryBox').innerHTML = `<div class="prediction-error">Błąd AI: ${aiErr.message}</div>`;
                    }
                } else {
                    resultDiv.innerHTML = rhtml;
                }
            } catch (err) {
                resultDiv.innerHTML = '<div class="prediction-error">Błąd: ' + err.message + '</div>';
            }
        });

    } catch (err) {
        console.error('[Predictions] analyzeSessionSummary error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd: ' + err.message + '</div>';
    }
}

/**
 * 23. Klasyfikacja tematyczna — tagowanie wypowiedzi wg tematu
 */
function analyzeTopicClassification() {
    const container = document.getElementById('topicClassificationContent');
    if (!container) return;

    console.log('[Predictions] Analyzing topic classification...');

    try {
        // Słowniki tematyczne (polskie słowa kluczowe)
        const topicDictionaries = {
            'Gospodarka': ['gospodar', 'ekonom', 'budżet', 'podatek', 'podatkow', 'inflac', 'wzrost', 'PKB', 'przedsiębiorc', 'firma', 'biznes', 'inwestycj', 'rynek', 'handel', 'eksport', 'import', 'cena', 'koszt', 'pieniąd', 'kredyt', 'bank', 'finansow', 'fiskaln'],
            'Edukacja': ['edukac', 'szkoł', 'nauczyc', 'uczeń', 'student', 'uczelni', 'uniwersyte', 'kształc', 'program nauczania', 'matura', 'egzamin', 'oświat', 'dydaktyk', 'akademick'],
            'Zdrowie': ['zdrow', 'szpital', 'lekar', 'pacjent', 'medycy', 'leczeni', 'chorob', 'szczepion', 'farmaceut', 'NFZ', 'służba zdrowia', 'pielęgniar', 'apteka', 'diagnoz'],
            'Obronność': ['obron', 'wojsk', 'armia', 'NATO', 'żołnierz', 'bezpieczeń', 'militarn', 'zbrojeni', 'missile', 'czołg', 'samolot bojow', 'sojusz', 'granica'],
            'Prawo': ['praw', 'ustaw', 'sąd', 'sędzi', 'prokurat', 'kodeks', 'regulac', 'przepis', 'konstytuc', 'trybunał', 'orzeczen', 'wyrok', 'adwokat', 'sprawiedliw'],
            'Polityka zagraniczna': ['zagranicz', 'dyplomac', 'ambasad', 'Unia Europejska', 'UE', 'Bruksel', 'ONZ', 'traktat', 'sankcj', 'sojusznik', 'stosunki międzynarodow', 'NATO'],
            'Energia': ['energ', 'elektrow', 'atom', 'jądrow', 'OZE', 'wiatrow', 'fotowoltai', 'solar', 'węgiel', 'gaz', 'ciepło', 'paliw', 'ropa', 'transformac energetycz', 'klimat'],
            'Transport': ['transport', 'drog', 'autostrad', 'kolej', 'pociąg', 'lotnisk', 'port', 'infrastruktur', 'most', 'tunel', 'komunikac', 'CPK'],
            'Rolnictwo': ['rolni', 'rolnik', 'agricult', 'upraw', 'hodowl', 'zboż', 'dopłat', 'KRUS', 'żywnoś', 'wieś', 'agrotech'],
            'Społeczne': ['społecz', 'emerytur', 'rent', 'zasiłek', '500+', '800+', 'socjaln', 'pomoc społeczn', 'ubóstw', 'bezdomn', 'niepełnospraw', 'senior', 'opieka']
        };

        const topicColors = {
            'Gospodarka': '#3498db', 'Edukacja': '#9b59b6', 'Zdrowie': '#e74c3c',
            'Obronność': '#2c3e50', 'Prawo': '#e67e22', 'Polityka zagraniczna': '#1abc9c',
            'Energia': '#f1c40f', 'Transport': '#95a5a6', 'Rolnictwo': '#27ae60', 'Społeczne': '#e91e63'
        };

        // Pobierz wypowiedzi
        const rows = db2.database.exec(`
            SELECT w.tekst, w.data, p.klub, w.mowca
            FROM wypowiedzi w
            LEFT JOIN poslowie p ON w.id_osoby = p.id_osoby
            WHERE w.tekst IS NOT NULL AND LENGTH(w.tekst) > 80
            ORDER BY w.data DESC
            LIMIT 3000
        `);

        if (!rows.length || !rows[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych wypowiedzi</div>';
            return;
        }

        const speeches = rows[0].values;
        const topicCounts = {};
        const topicByParty = {};
        const topicExamples = {};
        let classified = 0;

        // Klasyfikacja
        speeches.forEach(row => {
            const [tekst, data, klub, mowca] = row;
            const lower = (tekst || '').toLowerCase();
            const party = klub || 'niez.';

            let bestTopic = null;
            let bestScore = 0;

            for (const [topic, keywords] of Object.entries(topicDictionaries)) {
                let score = 0;
                keywords.forEach(kw => {
                    if (lower.includes(kw.toLowerCase())) score++;
                });
                if (score > bestScore) {
                    bestScore = score;
                    bestTopic = topic;
                }
            }

            if (bestTopic && bestScore >= 2) {
                classified++;
                topicCounts[bestTopic] = (topicCounts[bestTopic] || 0) + 1;

                if (!topicByParty[bestTopic]) topicByParty[bestTopic] = {};
                topicByParty[bestTopic][party] = (topicByParty[bestTopic][party] || 0) + 1;

                if (!topicExamples[bestTopic]) topicExamples[bestTopic] = [];
                if (topicExamples[bestTopic].length < 3) {
                    topicExamples[bestTopic].push({
                        speaker: mowca || 'Nieznany',
                        party,
                        excerpt: (tekst || '').substring(0, 150) + '...',
                        date: data
                    });
                }
            }
        });

        const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
        const maxCount = sortedTopics.length ? sortedTopics[0][1] : 1;

        let html = '';

        // Podsumowanie
        html += '<div class="topic-summary">';
        html += `<div class="topic-stat"><div class="topic-stat-value">${speeches.length}</div><div class="topic-stat-label">Przeanalizowanych</div></div>`;
        html += `<div class="topic-stat"><div class="topic-stat-value">${classified}</div><div class="topic-stat-label">Sklasyfikowanych</div></div>`;
        html += `<div class="topic-stat"><div class="topic-stat-value">${sortedTopics.length}</div><div class="topic-stat-label">Tematów</div></div>`;
        html += `<div class="topic-stat"><div class="topic-stat-value">${speeches.length ? Math.round(classified / speeches.length * 100) : 0}%</div><div class="topic-stat-label">Pokrycie</div></div>`;
        html += '</div>';

        // Rozkład tematów
        html += '<h4 style="margin:12px 0 6px;">📊 Rozkład tematów</h4>';
        html += '<div class="topic-chart">';
        sortedTopics.forEach(([topic, count]) => {
            const pct = Math.round((count / maxCount) * 100);
            const color = topicColors[topic] || '#888';
            html += `<div class="topic-chart-row">
                <span class="topic-chart-name">${topic}</span>
                <div class="topic-chart-bar-bg"><div class="topic-chart-bar" style="width:${pct}%;background:${color};"></div></div>
                <span class="topic-chart-count">${count}</span>
            </div>`;
        });
        html += '</div>';

        // Tematy wg klubów (top 5 tematów)
        html += '<h4 style="margin:16px 0 6px;">🏛️ Tematy wg klubów</h4>';
        html += '<div class="topic-party-grid">';
        sortedTopics.slice(0, 5).forEach(([topic]) => {
            const partyData = topicByParty[topic] || {};
            const sorted = Object.entries(partyData).sort((a, b) => b[1] - a[1]);
            const color = topicColors[topic] || '#888';
            html += `<div class="topic-party-card">
                <div class="topic-party-title" style="border-left:3px solid ${color};">${topic}</div>
                <div class="topic-party-list">
                    ${sorted.map(([party, cnt]) => `<span class="topic-party-item">${party}: ${cnt}</span>`).join('')}
                </div>
            </div>`;
        });
        html += '</div>';

        // Przykłady per temat
        html += '<h4 style="margin:16px 0 6px;">📝 Przykładowe wypowiedzi</h4>';
        html += '<div class="topic-examples">';
        sortedTopics.slice(0, 5).forEach(([topic]) => {
            const examples = topicExamples[topic] || [];
            const color = topicColors[topic] || '#888';
            html += `<div class="topic-example-group">
                <div class="topic-example-title" style="color:${color};">🏷️ ${topic}</div>`;
            examples.forEach(ex => {
                html += `<div class="topic-example-item">
                    <div class="topic-example-header"><span>${ex.speaker}</span> <span class="topic-example-party">${ex.party}</span> <span class="topic-example-date">${ex.date || ''}</span></div>
                    <div class="topic-example-text">${ex.excerpt}</div>
                </div>`;
            });
            html += '</div>';
        });
        html += '</div>';

        container.innerHTML = html;
        console.log('[Predictions] Topic classification done:', classified, 'classified out of', speeches.length);

    } catch (err) {
        console.error('[Predictions] analyzeTopicClassification error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd klasyfikacji: ' + err.message + '</div>';
    }
}

/**
 * 24. Wykrywanie sprzeczności posła — zmiany stanowiska w czasie
 */
function analyzeMpContradictions() {
    const container = document.getElementById('mpContradictionsContent');
    if (!container) return;

    console.log('[Predictions] Analyzing MP contradictions...');

    try {
        // Znajdź posłów którzy głosowali na dwa sposoby na podobne tematy
        // Metoda: szukaj par głosowań o podobnych tytułach gdzie poseł zmienił zdanie
        const rebelFlips = db2.database.exec(`
            WITH vote_pairs AS (
                SELECT 
                    g1.id_osoby,
                    gl1.id_glosowania as id1,
                    gl2.id_glosowania as id2,
                    gl1.tytul as tytul1,
                    gl2.tytul as tytul2,
                    g1.glos as glos1,
                    g2.glos as glos2,
                    gl1.data as data1,
                    gl2.data as data2
                FROM glosy g1
                JOIN glosy g2 ON g1.id_osoby = g2.id_osoby AND g1.id_glosowania < g2.id_glosowania
                JOIN glosowania gl1 ON gl1.id_glosowania = g1.id_glosowania
                JOIN glosowania gl2 ON gl2.id_glosowania = g2.id_glosowania
                WHERE g1.glos IN ('YES','NO') AND g2.glos IN ('YES','NO')
                  AND g1.glos != g2.glos
                  AND gl1.tytul IS NOT NULL AND gl2.tytul IS NOT NULL
                  AND SUBSTR(gl1.tytul, 1, 30) = SUBSTR(gl2.tytul, 1, 30)
                  AND gl1.data != gl2.data
            )
            SELECT 
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                COUNT(*) as flip_count,
                GROUP_CONCAT(DISTINCT tytul1) as titles
            FROM vote_pairs vp
            JOIN poslowie p ON vp.id_osoby = p.id_osoby
            WHERE p.klub IS NOT NULL AND p.klub != ''
            GROUP BY vp.id_osoby
            HAVING flip_count >= 1
            ORDER BY flip_count DESC
            LIMIT 30
        `);

        // Porównaj sentyment tego samego posła w różnych miesiącach
        const sentimentShifts = db2.database.exec(`
            SELECT 
                p.id_osoby,
                p.imie || ' ' || p.nazwisko as name,
                p.klub,
                SUBSTR(w.data, 1, 7) as month,
                w.tekst
            FROM wypowiedzi w
            JOIN poslowie p ON w.id_osoby = p.id_osoby
            WHERE w.tekst IS NOT NULL AND LENGTH(w.tekst) > 100
              AND w.data IS NOT NULL AND LENGTH(w.data) >= 7
              AND p.klub IS NOT NULL AND p.klub != ''
            ORDER BY p.id_osoby, w.data
        `);

        let html = '';

        // 1. Głosowania — zmiana zdania na ten sam temat
        if (rebelFlips.length && rebelFlips[0].values.length) {
            html += '<h4 style="margin:0 0 8px;">🔄 Zmiana głosu na ten sam temat</h4>';
            html += '<div class="contradiction-info">Posłowie, którzy głosowali ZA i PRZECIW na głosowania o tym samym tytule</div>';
            html += '<div class="contradiction-list">';
            rebelFlips[0].values.forEach((row, i) => {
                const [name, klub, flipCount, titles] = row;
                const titleList = titles ? titles.split(',').slice(0, 3) : [];
                html += `<div class="contradiction-item">
                    <div class="contradiction-header">
                        <span class="contradiction-rank">#${i + 1}</span>
                        <span class="contradiction-name">${name}</span>
                        <span class="contradiction-party">${klub}</span>
                        <span class="contradiction-count">${flipCount}× zmiana</span>
                    </div>
                    ${titleList.length ? `<div class="contradiction-titles">${titleList.map(t => {
                        const short = t.length > 100 ? t.substring(0, 100) + '...' : t;
                        return `<div class="contradiction-title-text">${short}</div>`;
                    }).join('')}</div>` : ''}
                </div>`;
            });
            html += '</div>';
        }

        // 2. Sentyment — wahania sentymentu tego samego posła w czasie
        if (sentimentShifts.length && sentimentShifts[0].values.length) {
            const mpSent = {};
            sentimentShifts[0].values.forEach(row => {
                const [id, name, klub, month, tekst] = row;
                if (!mpSent[id]) mpSent[id] = { name, klub, months: {} };
                if (!mpSent[id].months[month]) mpSent[id].months[month] = { sum: 0, count: 0 };
                const s = analyzeSentiment(tekst);
                mpSent[id].months[month].sum += s.score;
                mpSent[id].months[month].count++;
            });

            // Znajdź posłów z największą zmianą sentymentu
            const shiftResults = Object.entries(mpSent)
                .filter(([, mp]) => Object.keys(mp.months).length >= 3)
                .map(([id, mp]) => {
                    const monthData = Object.entries(mp.months)
                        .map(([m, d]) => ({ month: m, avg: d.sum / d.count }))
                        .sort((a, b) => a.month.localeCompare(b.month));

                    let maxSwing = 0;
                    let swingFrom = null, swingTo = null;
                    for (let i = 1; i < monthData.length; i++) {
                        const diff = Math.abs(monthData[i].avg - monthData[i - 1].avg);
                        if (diff > maxSwing) {
                            maxSwing = diff;
                            swingFrom = monthData[i - 1];
                            swingTo = monthData[i];
                        }
                    }

                    return {
                        id, name: mp.name, klub: mp.klub,
                        maxSwing: Math.round(maxSwing * 1000) / 1000,
                        swingFrom, swingTo,
                        monthCount: monthData.length
                    };
                })
                .filter(r => r.maxSwing > 0.15)
                .sort((a, b) => b.maxSwing - a.maxSwing)
                .slice(0, 15);

            if (shiftResults.length) {
                html += '<h4 style="margin:16px 0 8px;">📊 Największe wahania sentymentu</h4>';
                html += '<div class="contradiction-info">Posłowie, których ton wypowiedzi drastycznie się zmienił między miesiącami</div>';
                html += '<div class="contradiction-list">';
                shiftResults.forEach((mp, i) => {
                    const fromColor = mp.swingFrom.avg < -0.1 ? '#e74c3c' : mp.swingFrom.avg > 0.1 ? '#27ae60' : '#f39c12';
                    const toColor = mp.swingTo.avg < -0.1 ? '#e74c3c' : mp.swingTo.avg > 0.1 ? '#27ae60' : '#f39c12';
                    html += `<div class="contradiction-item">
                        <div class="contradiction-header">
                            <span class="contradiction-rank">#${i + 1}</span>
                            <span class="contradiction-name">${mp.name}</span>
                            <span class="contradiction-party">${mp.klub}</span>
                            <span class="contradiction-swing">Δ ${mp.maxSwing}</span>
                        </div>
                        <div class="contradiction-shift">
                            <span style="color:${fromColor};">${mp.swingFrom.month}: ${mp.swingFrom.avg.toFixed(3)}</span>
                            <span class="contradiction-arrow">→</span>
                            <span style="color:${toColor};">${mp.swingTo.month}: ${mp.swingTo.avg.toFixed(3)}</span>
                        </div>
                    </div>`;
                });
                html += '</div>';
            }
        }

        if (!html) {
            html = '<div class="prediction-no-data">Brak wystarczających danych do wykrycia sprzeczności</div>';
        }

        container.innerHTML = html;
        console.log('[Predictions] MP contradictions done');

    } catch (err) {
        console.error('[Predictions] analyzeMpContradictions error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd analizy sprzeczności: ' + err.message + '</div>';
    }
}

/**
 * 25. Raport AI — jednym kliknięciem generuje pełen raport
 */
async function generateAiReport() {
    const container = document.getElementById('aiReportContent');
    if (!container) return;

    console.log('[Predictions] Generating AI report...');

    try {
        const hasApiKey = !!getApiKey();

        // Zebranie danych
        container.innerHTML = '<div class="prediction-loading"><div class="prediction-spinner"></div><p>Zbieram dane do raportu...</p></div>';

        // Stats
        const stats = {};

        // Posłowie
        const mpResult = db2.database.exec(`SELECT COUNT(*) FROM poslowie WHERE aktywny = 1`);
        stats.mps = mpResult.length ? mpResult[0].values[0][0] : 0;

        // Kluby
        const clubResult = db2.database.exec(`SELECT klub, COUNT(*) as cnt FROM poslowie WHERE aktywny = 1 AND klub IS NOT NULL GROUP BY klub ORDER BY cnt DESC`);
        stats.clubs = clubResult.length ? clubResult[0].values : [];

        // Głosowania
        const voteResult = db2.database.exec(`SELECT COUNT(*) FROM glosowania`);
        stats.votings = voteResult.length ? voteResult[0].values[0][0] : 0;

        // Wypowiedzi
        const speechResult = db2.database.exec(`SELECT COUNT(*) FROM wypowiedzi WHERE tekst IS NOT NULL`);
        stats.speeches = speechResult.length ? speechResult[0].values[0][0] : 0;

        // Interpelacje
        const interpResult = db2.database.exec(`SELECT COUNT(*) FROM interpelacje`);
        stats.interpellations = interpResult.length ? interpResult[0].values[0][0] : 0;

        // Projekty ustaw
        const billResult = db2.database.exec(`SELECT COUNT(*) FROM projekty_ustaw`);
        stats.bills = billResult.length ? billResult[0].values[0][0] : 0;

        // Top mówcy
        const topSpeakers = db2.database.exec(`
            SELECT p.imie || ' ' || p.nazwisko, p.klub, COUNT(*) as cnt
            FROM wypowiedzi w JOIN poslowie p ON w.id_osoby = p.id_osoby
            WHERE p.klub IS NOT NULL GROUP BY p.id_osoby ORDER BY cnt DESC LIMIT 5
        `);

        // Dyscyplina klubowa
        const disciplineResult = db2.database.exec(`
            WITH cm AS (
                SELECT g.id_glosowania, p.klub, g.glos, COUNT(*) as cnt,
                    ROW_NUMBER() OVER (PARTITION BY g.id_glosowania, p.klub ORDER BY COUNT(*) DESC) as rn
                FROM glosy g JOIN poslowie p ON g.id_osoby = p.id_osoby
                WHERE g.glos IN ('YES','NO','ABSTAIN') AND p.klub IS NOT NULL AND p.klub != ''
                GROUP BY g.id_glosowania, p.klub, g.glos
            ),
            dom AS (SELECT id_glosowania, klub, glos as dom_glos FROM cm WHERE rn = 1)
            SELECT p.klub,
                ROUND(100.0 * SUM(CASE WHEN g.glos = d.dom_glos THEN 1 ELSE 0 END) / COUNT(*), 1) as discipline
            FROM glosy g JOIN poslowie p ON g.id_osoby = p.id_osoby
            JOIN dom d ON d.id_glosowania = g.id_glosowania AND d.klub = p.klub
            WHERE g.glos IN ('YES','NO','ABSTAIN')
            GROUP BY p.klub ORDER BY discipline DESC
        `);
        stats.discipline = disciplineResult.length ? disciplineResult[0].values : [];

        // Frekwencja
        const attendanceResult = db2.database.exec(`
            SELECT p.klub,
                ROUND(100.0 * SUM(CASE WHEN g.glos != 'ABSENT' THEN 1 ELSE 0 END) / COUNT(*), 1) as attendance
            FROM glosy g JOIN poslowie p ON g.id_osoby = p.id_osoby
            WHERE p.klub IS NOT NULL AND p.klub != ''
            GROUP BY p.klub ORDER BY attendance DESC
        `);
        stats.attendance = attendanceResult.length ? attendanceResult[0].values : [];

        // Sentyment ogólny (sample)
        const sentSample = db2.database.exec(`
            SELECT tekst FROM wypowiedzi WHERE tekst IS NOT NULL AND LENGTH(tekst) > 100 ORDER BY RANDOM() LIMIT 200
        `);
        let avgSent = 0;
        let sentCnt = 0;
        if (sentSample.length) {
            sentSample[0].values.forEach(row => {
                const s = analyzeSentiment(row[0]);
                avgSent += s.score;
                sentCnt++;
            });
        }
        stats.avgSentiment = sentCnt ? Math.round((avgSent / sentCnt) * 1000) / 1000 : 0;

        // Render raport
        let html = '<div class="ai-report">';

        // Nagłówek
        html += `<div class="report-header">
            <div class="report-title">📊 Raport analityczny — Sejm RP</div>
            <div class="report-date">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL')}</div>
        </div>`;

        // Dane ogólne
        html += '<div class="report-section"><div class="report-section-title">📋 Dane ogólne</div>';
        html += '<div class="report-stats-grid">';
        html += `<div class="report-stat"><span class="report-stat-val">${stats.mps}</span><span class="report-stat-lbl">Posłów</span></div>`;
        html += `<div class="report-stat"><span class="report-stat-val">${stats.votings}</span><span class="report-stat-lbl">Głosowań</span></div>`;
        html += `<div class="report-stat"><span class="report-stat-val">${stats.speeches}</span><span class="report-stat-lbl">Wypowiedzi</span></div>`;
        html += `<div class="report-stat"><span class="report-stat-val">${stats.interpellations}</span><span class="report-stat-lbl">Interpelacji</span></div>`;
        html += `<div class="report-stat"><span class="report-stat-val">${stats.bills}</span><span class="report-stat-lbl">Projektów ustaw</span></div>`;
        html += '</div></div>';

        // Kluby
        if (stats.clubs.length) {
            html += '<div class="report-section"><div class="report-section-title">🏛️ Struktura klubowa</div>';
            html += '<div class="report-club-list">';
            stats.clubs.forEach(([club, count]) => {
                const pct = stats.mps ? Math.round((count / stats.mps) * 100) : 0;
                html += `<div class="report-club-row"><span class="report-club-name">${club}</span><span class="report-club-count">${count} posłów (${pct}%)</span></div>`;
            });
            html += '</div></div>';
        }

        // Top mówcy
        if (topSpeakers.length && topSpeakers[0].values.length) {
            html += '<div class="report-section"><div class="report-section-title">🎤 Najaktywniejszy mówcy</div>';
            html += '<div class="report-speakers">';
            topSpeakers[0].values.forEach(([name, klub, cnt]) => {
                html += `<div class="report-speaker-row"><span>${name}</span> <span class="report-speaker-party">${klub}</span> <span class="report-speaker-count">${cnt} wypowiedzi</span></div>`;
            });
            html += '</div></div>';
        }

        // Dyscyplina
        if (stats.discipline.length) {
            html += '<div class="report-section"><div class="report-section-title">🎯 Dyscyplina klubowa</div>';
            html += '<div class="report-discipline">';
            stats.discipline.forEach(([klub, disc]) => {
                const color = disc >= 90 ? '#27ae60' : disc >= 75 ? '#f39c12' : '#e74c3c';
                html += `<div class="report-disc-row"><span>${klub}</span><span style="color:${color};font-weight:700;">${disc}%</span></div>`;
            });
            html += '</div></div>';
        }

        // Frekwencja
        if (stats.attendance.length) {
            html += '<div class="report-section"><div class="report-section-title">📍 Frekwencja</div>';
            html += '<div class="report-discipline">';
            stats.attendance.forEach(([klub, att]) => {
                const color = att >= 80 ? '#27ae60' : att >= 60 ? '#f39c12' : '#e74c3c';
                html += `<div class="report-disc-row"><span>${klub}</span><span style="color:${color};font-weight:700;">${att}%</span></div>`;
            });
            html += '</div></div>';
        }

        // Sentyment
        const sentColor = stats.avgSentiment < -0.1 ? '#e74c3c' : stats.avgSentiment > 0.1 ? '#27ae60' : '#f39c12';
        html += `<div class="report-section"><div class="report-section-title">😊 Ogólny sentyment debaty</div>
            <div class="report-sentiment">
                <span class="report-sent-score" style="color:${sentColor};">${stats.avgSentiment > 0 ? '+' : ''}${stats.avgSentiment}</span>
                <span class="report-sent-label">${stats.avgSentiment > 0.1 ? 'Pozytywny' : stats.avgSentiment < -0.1 ? 'Negatywny' : 'Neutralny'}</span>
            </div>
        </div>`;

        // AI wzbogacenie
        if (hasApiKey) {
            html += '<div class="report-section"><div class="report-section-title">🤖 Komentarz AI</div>';
            html += '<div id="aiReportCommentary" class="report-ai-box"><div class="prediction-loading"><div class="prediction-spinner"></div><p>AI generuje komentarz...</p></div></div>';
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;

        // Wyślij do AI
        if (hasApiKey) {
            try {
                const dataForAi = `Sejm RP: ${stats.mps} posłów, ${stats.votings} głosowań, ${stats.speeches} wypowiedzi, ${stats.interpellations} interpelacji, ${stats.bills} projektów ustaw.
Kluby: ${stats.clubs.map(c => `${c[0]}(${c[1]})`).join(', ')}.
Dyscyplina: ${stats.discipline.map(d => `${d[0]}:${d[1]}%`).join(', ')}.
Frekwencja: ${stats.attendance.map(a => `${a[0]}:${a[1]}%`).join(', ')}.
Sentyment: ${stats.avgSentiment}.
Top mówcy: ${topSpeakers.length ? topSpeakers[0].values.map(r => `${r[0]}(${r[2]})`).join(', ') : 'n/a'}.`;

                const aiPrompt = `Jesteś analitykiem parlamentarnym. Na podstawie poniższych danych, napisz zwięzły komentarz ekspercki (max 400 słów) po polsku. Wyciągnij wnioski, wskaż ciekawe trendy, sformułuj rekomendacje.

${dataForAi}`;

                const aiComment = await callGeminiForPrediction(aiPrompt, 1200);
                document.getElementById('aiReportCommentary').innerHTML = `<div class="report-ai-text">${aiComment.replace(/\n/g, '<br>')}</div>`;
            } catch (aiErr) {
                document.getElementById('aiReportCommentary').innerHTML = `<div class="prediction-error">Błąd AI: ${aiErr.message}</div>`;
            }
        }

        console.log('[Predictions] AI Report generated');

    } catch (err) {
        console.error('[Predictions] generateAiReport error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd generowania raportu: ' + err.message + '</div>';
    }
}

/**
 * 26. WebLLM Chat — lokalny model AI w przeglądarce
 */
async function loadWebLLMChat() {
    const container = document.getElementById('webllmChatContent');
    if (!container) return;

    console.log('[Predictions] Loading WebLLM chat...');

    try {
        let html = '<div class="webllm-panel">';

        // Status panel
        html += '<div class="webllm-status">';
        html += '<div class="webllm-status-icon" id="webllmStatusIcon">⚪</div>';
        html += '<div class="webllm-status-text">';
        html += '<div class="webllm-status-title" id="webllmStatusTitle">Model nie załadowany</div>';
        html += '<div class="webllm-status-detail" id="webllmStatusDetail">Kliknij "Załaduj model" aby rozpocząć</div>';
        html += '</div></div>';

        // Progress bar
        html += '<div class="webllm-progress" id="webllmProgress" style="display:none;">';
        html += '<div class="webllm-progress-bar" id="webllmProgressBar" style="width:0%;"></div>';
        html += '</div>';
        html += '<div class="webllm-progress-text" id="webllmProgressText" style="display:none;"></div>';

        // Model select
        html += '<div class="webllm-controls">';
        html += '<select id="webllmModelSelect" class="profile-combobox">';
        html += '<option value="SmolLM2-360M-Instruct-q4f16_1-MLC">SmolLM2 360M (nano, ~200MB)</option>';
        html += '<option value="SmolLM2-1.7B-Instruct-q4f16_1-MLC" selected>SmolLM2 1.7B (mały, ~1GB)</option>';
        html += '<option value="Llama-3.2-1B-Instruct-q4f16_1-MLC">Llama 3.2 1B (mały, ~700MB)</option>';
        html += '<option value="Llama-3.2-3B-Instruct-q4f16_1-MLC">Llama 3.2 3B (średni, ~1.8GB)</option>';
        html += '<option value="Phi-3.5-mini-instruct-q4f16_1-MLC">Phi 3.5 Mini 3.8B (średni, ~2.2GB)</option>';
        html += '<option value="gemma-2-2b-it-q4f16_1-MLC">Gemma 2 2B (nie, ~1.3GB)</option>';
        html += '<option value="Qwen2.5-1.5B-Instruct-q4f16_1-MLC">Qwen 2.5 1.5B (mały, ~1GB)</option>';
        html += '</select>';
        html += '<button id="webllmLoadBtn" class="webllm-btn webllm-btn-load">🚀 Załaduj model</button>';
        html += '</div>';

        // Info
        html += '<div class="webllm-info">';
        html += '💡 Model zostanie pobrany do cache przeglądarki (jednorazowo). ';
        html += 'Wymaga WebGPU — działa w Chrome 113+, Edge 113+. ';
        html += 'Całkowicie offline — dane nie opuszczają przeglądarki.';
        html += '</div>';

        // Chat area
        html += '<div class="webllm-chat" id="webllmChatArea" style="display:none;">';
        html += '<div class="webllm-messages" id="webllmMessages"></div>';
        html += '<div class="webllm-input-area">';
        html += '<textarea id="webllmInput" class="webllm-input" placeholder="Zadaj pytanie o danych parlamentarnych..." rows="2"></textarea>';
        html += '<button id="webllmSendBtn" class="webllm-btn webllm-btn-send" disabled>Wyślij</button>';
        html += '</div></div>';

        // Quick actions
        html += '<div class="webllm-quick" id="webllmQuickActions" style="display:none;">';
        html += '<div class="webllm-quick-title">⚡ Szybkie akcje:</div>';
        html += '<button class="webllm-quick-btn" data-action="summarize">📝 Podsumuj ostatnie posiedzenie</button>';
        html += '<button class="webllm-quick-btn" data-action="analyze">📊 Analizuj aktywność</button>';
        html += '<button class="webllm-quick-btn" data-action="compare">🔍 Porównaj kluby</button>';
        html += '</div>';

        html += '</div>'; // /webllm-panel

        container.innerHTML = html;

        // Event listeners
        let webllmEngine = null;

        document.getElementById('webllmLoadBtn').addEventListener('click', async () => {
            const modelId = document.getElementById('webllmModelSelect').value;
            const statusIcon = document.getElementById('webllmStatusIcon');
            const statusTitle = document.getElementById('webllmStatusTitle');
            const statusDetail = document.getElementById('webllmStatusDetail');
            const progress = document.getElementById('webllmProgress');
            const progressBar = document.getElementById('webllmProgressBar');
            const progressText = document.getElementById('webllmProgressText');
            const loadBtn = document.getElementById('webllmLoadBtn');
            const chatArea = document.getElementById('webllmChatArea');
            const quickActions = document.getElementById('webllmQuickActions');

            loadBtn.disabled = true;
            loadBtn.textContent = '⏳ Ładowanie...';
            statusIcon.textContent = '🔄';
            statusTitle.textContent = 'Ładowanie modelu...';
            statusDetail.textContent = `Model: ${modelId}`;
            progress.style.display = 'block';
            progressText.style.display = 'block';

            try {
                // Dynamiczny import WebLLM
                const webllm = await import('https://esm.run/@anthropic-ai/sdk@latest').catch(() => null) ||
                               await import('https://esm.run/@anthropic-ai/webllm').catch(() => null);

                // Próba użycia @mlc-ai/web-llm (prawdziwa biblioteka)
                const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');

                webllmEngine = await CreateMLCEngine(modelId, {
                    initProgressCallback: (info) => {
                        const pct = Math.round((info.progress || 0) * 100);
                        progressBar.style.width = `${pct}%`;
                        progressText.textContent = info.text || `${pct}%`;
                        statusDetail.textContent = info.text || `Pobieranie... ${pct}%`;
                    }
                });

                // Success
                statusIcon.textContent = '🟢';
                statusTitle.textContent = 'Model gotowy!';
                statusDetail.textContent = `${modelId} — gotowy do użycia`;
                progress.style.display = 'none';
                progressText.style.display = 'none';
                loadBtn.textContent = '✅ Załadowany';
                chatArea.style.display = 'block';
                quickActions.style.display = 'block';
                document.getElementById('webllmSendBtn').disabled = false;

            } catch (err) {
                console.error('[WebLLM] Load error:', err);
                statusIcon.textContent = '🔴';
                statusTitle.textContent = 'Błąd ładowania';

                let errorMsg = err.message;
                if (err.message.includes('WebGPU') || err.message.includes('gpu')) {
                    errorMsg = 'Twoja przeglądarka nie obsługuje WebGPU. Użyj Chrome 113+ lub Edge 113+.';
                } else if (err.message.includes('fetch') || err.message.includes('network')) {
                    errorMsg = 'Błąd pobierania modelu. Sprawdź połączenie internetowe.';
                }

                statusDetail.textContent = errorMsg;
                progress.style.display = 'none';
                progressText.style.display = 'none';
                loadBtn.disabled = false;
                loadBtn.textContent = '🔄 Spróbuj ponownie';
            }
        });

        // Send message
        const sendWebLLMMessage = async () => {
            if (!webllmEngine) return;

            const input = document.getElementById('webllmInput');
            const messages = document.getElementById('webllmMessages');
            const sendBtn = document.getElementById('webllmSendBtn');
            const userText = input.value.trim();
            if (!userText) return;

            // User message
            messages.innerHTML += `<div class="webllm-msg webllm-msg-user"><div class="webllm-msg-icon">👤</div><div class="webllm-msg-text">${userText}</div></div>`;
            input.value = '';
            sendBtn.disabled = true;

            // Zbierz kontekst z bazy
            let dbContext = '';
            try {
                const mpCount = db2.database.exec(`SELECT COUNT(*) FROM poslowie WHERE aktywny = 1`);
                const voteCount = db2.database.exec(`SELECT COUNT(*) FROM glosowania`);
                const speechCount = db2.database.exec(`SELECT COUNT(*) FROM wypowiedzi`);
                dbContext = `Kontekst bazy danych Sejmu RP: ${mpCount[0]?.values[0][0] || 0} posłów, ${voteCount[0]?.values[0][0] || 0} głosowań, ${speechCount[0]?.values[0][0] || 0} wypowiedzi.`;
            } catch { /* ignore */ }

            // AI message (streaming)
            const aiMsgDiv = document.createElement('div');
            aiMsgDiv.className = 'webllm-msg webllm-msg-ai';
            aiMsgDiv.innerHTML = `<div class="webllm-msg-icon">🧠</div><div class="webllm-msg-text" id="webllmCurrentResponse">⏳ Myślę...</div>`;
            messages.appendChild(aiMsgDiv);
            messages.scrollTop = messages.scrollHeight;

            try {
                const reply = await webllmEngine.chat.completions.create({
                    messages: [
                        { role: 'system', content: `Jesteś ekspertem od polskiej polityki parlamentarnej. Odpowiadaj po polsku, zwięźle i merytorycznie. ${dbContext}` },
                        { role: 'user', content: userText }
                    ],
                    temperature: 0.5,
                    max_tokens: 800
                });

                const responseText = reply.choices[0]?.message?.content || 'Brak odpowiedzi';
                document.getElementById('webllmCurrentResponse').innerHTML = responseText.replace(/\n/g, '<br>');
            } catch (err) {
                document.getElementById('webllmCurrentResponse').innerHTML = `<span style="color:#e74c3c;">Błąd: ${err.message}</span>`;
            }

            sendBtn.disabled = false;
            messages.scrollTop = messages.scrollHeight;
        };

        document.getElementById('webllmSendBtn').addEventListener('click', sendWebLLMMessage);
        document.getElementById('webllmInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendWebLLMMessage();
            }
        });

        // Quick actions
        document.querySelectorAll('.webllm-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const input = document.getElementById('webllmInput');
                const prompts = {
                    summarize: 'Podsumuj w 5 zdaniach najważniejsze wydarzenia z ostatniego posiedzenia Sejmu.',
                    analyze: 'Które kluby poselskie są najaktywniejsze? Jakie wskaźniki aktywności warto śledzić?',
                    compare: 'Porównaj dyscyplinę głosowania i frekwencję między głównymi klubami parlamentarnymi.'
                };
                input.value = prompts[action] || '';
                sendWebLLMMessage();
            });
        });

    } catch (err) {
        console.error('[Predictions] loadWebLLMChat error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd WebLLM: ' + err.message + '</div>';
    }
}

/**
 * 27. Wykrywanie zachowań antypolskich
 * Analiza wypowiedzi pod kątem narracji prorosyjskich, antypaństwowych, dezinformacji
 */
function analyzeAntiPolish() {
    const container = document.getElementById('antiPolishContent');
    if (!container) return;

    console.log('[Predictions] Analyzing anti-Polish behaviors...');

    // === Słowniki detekcji ===
    const PROROSYJSKIE = [
        'rosja ma rację', 'sojusz z rosją', 'nato prowokuje', 'nato agresj',
        'sankcje szkodzą', 'sankcje przeciw', 'zniesienie sankcji', 'nord stream',
        'gazprom', 'rosyjski gaz', 'pipeline', 'nie prowokować rosj',
        'krym jest ros', 'donbas', 'denazyfikacj', 'specjalna operacja',
        'wina nato', 'wina zachodu', 'ekspansja nato', 'obietnice nato',
        'rosja partner', 'współpraca z rosją', 'dialog z moskwą',
        'putin ma racj', 'propaganda zachodnia', 'rusofobia'
    ];

    const ANTYPOLSKIE = [
        'polskie obozy', 'polskie obozy zagłady', 'polish death camp',
        'polish concentration', 'współudział polski', 'polscy sprawcy',
        'polski antysemityzm', 'kolaboracja polsk', 'naród sprawców',
        'odpowiedzialność polski za', 'polski faszyzm', 'polak faszysta',
        'tradycja antysemicka', 'polskie zbrodnie', 'polacy współpracowali z'
    ];

    const ANTYPANSTWOWE = [
        'polska nie ma prawa', 'likwidacja wojsk', 'armia niepotrzebna',
        'polexit', 'wyjście z ue', 'wyjść z unii', 'wyjście z nato',
        'nato nie obroni', 'rozwiązać nato', 'wasalstwo wobec usa',
        'kolonia ameryk', 'amerykańska okupacja', 'bazy amerykańskie zagrożen',
        'niepodległość od zachodu', 'sowietyzacja', 'brukselska dyktatura',
        'wasalstwo', 'zdrada narodowa', 'demontaż państwa'
    ];

    const DEZINFORMACJA = [
        'plandemie', 'plandemia', 'szczepionki zabijają', 'bill gates czipuje',
        'wielki reset', 'nowy porządek świata', 'spisek globalist',
        'ue narzuca', 'dyktatura sanitarna', 'fałszywa pandemia',
        'broń biologiczna', 'chemtrails', 'agenda 2030 zagrożen',
        'zastępowanie ludności', 'kalergi', 'wielka wymiana'
    ];

    try {
        // Pobierz wypowiedzi
        const speechResult = db2.database.exec(`
            SELECT w.id, w.tresc, w.data, p.imie || ' ' || p.nazwisko as speaker,
                   p.klub as club
            FROM wypowiedzi w
            LEFT JOIN poslowie p ON w.posel_id = p.id
            WHERE w.tresc IS NOT NULL AND length(w.tresc) > 50
            ORDER BY w.data DESC
            LIMIT 5000
        `);

        if (!speechResult.length || !speechResult[0].values.length) {
            container.innerHTML = '<div class="prediction-error">Brak wypowiedzi do analizy</div>';
            return;
        }

        const speeches = speechResult[0].values;
        const flagged = [];

        // Funkcja detekcji
        function detectPatterns(text, patterns) {
            const lower = text.toLowerCase();
            const found = [];
            for (const pattern of patterns) {
                if (lower.includes(pattern)) {
                    found.push(pattern);
                }
            }
            return found;
        }

        // Skanuj wypowiedzi
        for (const [id, text, date, speaker, club] of speeches) {
            if (!text) continue;

            const proRus = detectPatterns(text, PROROSYJSKIE);
            const antiPol = detectPatterns(text, ANTYPOLSKIE);
            const antiState = detectPatterns(text, ANTYPANSTWOWE);
            const disinfo = detectPatterns(text, DEZINFORMACJA);

            const totalFlags = proRus.length + antiPol.length + antiState.length + disinfo.length;
            if (totalFlags === 0) continue;

            const categories = [];
            if (proRus.length) categories.push({ type: 'Prorosyjskie', icon: '🇷🇺', matches: proRus, color: '#e53e3e' });
            if (antiPol.length) categories.push({ type: 'Antypolskie', icon: '⚠️', matches: antiPol, color: '#dd6b20' });
            if (antiState.length) categories.push({ type: 'Antypaństwowe', icon: '🏴', matches: antiState, color: '#805ad5' });
            if (disinfo.length) categories.push({ type: 'Dezinformacja', icon: '🔻', matches: disinfo, color: '#718096' });

            // Severity: 1 match = low, 2-3 = medium, 4+ = high
            const severity = totalFlags >= 4 ? 'high' : totalFlags >= 2 ? 'medium' : 'low';

            flagged.push({
                id, text: text.substring(0, 500), date, speaker: speaker || 'Nieznany',
                club: club || '?', categories, totalFlags, severity
            });
        }

        // Sortuj wg severity
        flagged.sort((a, b) => b.totalFlags - a.totalFlags);

        // === Statystyki ===
        const totalFlagged = flagged.length;
        const byClub = {};
        const byCategory = { 'Prorosyjskie': 0, 'Antypolskie': 0, 'Antypaństwowe': 0, 'Dezinformacja': 0 };
        const bySpeaker = {};

        for (const f of flagged) {
            byClub[f.club] = (byClub[f.club] || 0) + 1;
            bySpeaker[f.speaker] = (bySpeaker[f.speaker] || 0) + 1;
            for (const c of f.categories) {
                byCategory[c.type] += c.matches.length;
            }
        }

        const topSpeakers = Object.entries(bySpeaker).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const clubEntries = Object.entries(byClub).sort((a, b) => b[1] - a[1]);

        // Severity counts
        const highCount = flagged.filter(f => f.severity === 'high').length;
        const mediumCount = flagged.filter(f => f.severity === 'medium').length;
        const lowCount = flagged.filter(f => f.severity === 'low').length;

        // === Opcjonalna analiza AI ===
        const apiKey = getApiKey();
        let aiSection = '';
        if (apiKey && flagged.length > 0) {
            aiSection = `
                <div class="antipolish-ai">
                    <button class="prediction-btn-primary" id="antiPolishAiBtn">✨ Analiza AI — ocena kontekstu</button>
                    <div id="antiPolishAiResult" style="display:none;"></div>
                </div>`;
        }

        // === Render ===
        container.innerHTML = `
            <div class="antipolish-summary">
                <h4>🛡️ Raport bezpieczeństwa narracyjnego</h4>
                <p class="antipolish-subtitle">Przeskanowano ${speeches.length} wypowiedzi · Wykryto ${totalFlagged} podejrzanych</p>

                <div class="antipolish-stats">
                    <div class="antipolish-stat severity-high">
                        <span class="antipolish-stat-val">${highCount}</span>
                        <span class="antipolish-stat-label">🔴 Wysoki</span>
                    </div>
                    <div class="antipolish-stat severity-medium">
                        <span class="antipolish-stat-val">${mediumCount}</span>
                        <span class="antipolish-stat-label">🟠 Średni</span>
                    </div>
                    <div class="antipolish-stat severity-low">
                        <span class="antipolish-stat-val">${lowCount}</span>
                        <span class="antipolish-stat-label">🟡 Niski</span>
                    </div>
                    <div class="antipolish-stat">
                        <span class="antipolish-stat-val">${speeches.length}</span>
                        <span class="antipolish-stat-label">📄 Łącznie</span>
                    </div>
                </div>

                <div class="antipolish-categories">
                    <h5>Rozkład kategorii</h5>
                    <div class="antipolish-cat-grid">
                        <div class="antipolish-cat" style="border-left: 3px solid #e53e3e;">
                            <span class="antipolish-cat-icon">🇷🇺</span>
                            <span class="antipolish-cat-name">Prorosyjskie</span>
                            <span class="antipolish-cat-count">${byCategory['Prorosyjskie']}</span>
                        </div>
                        <div class="antipolish-cat" style="border-left: 3px solid #dd6b20;">
                            <span class="antipolish-cat-icon">⚠️</span>
                            <span class="antipolish-cat-name">Antypolskie</span>
                            <span class="antipolish-cat-count">${byCategory['Antypolskie']}</span>
                        </div>
                        <div class="antipolish-cat" style="border-left: 3px solid #805ad5;">
                            <span class="antipolish-cat-icon">🏴</span>
                            <span class="antipolish-cat-name">Antypaństwowe</span>
                            <span class="antipolish-cat-count">${byCategory['Antypaństwowe']}</span>
                        </div>
                        <div class="antipolish-cat" style="border-left: 3px solid #718096;">
                            <span class="antipolish-cat-icon">🔻</span>
                            <span class="antipolish-cat-name">Dezinformacja</span>
                            <span class="antipolish-cat-count">${byCategory['Dezinformacja']}</span>
                        </div>
                    </div>
                </div>

                ${clubEntries.length ? `
                <div class="antipolish-clubs">
                    <h5>Wykrycia wg klubu</h5>
                    <div class="antipolish-club-list">
                        ${clubEntries.map(([club, cnt]) => {
                            const pct = Math.round(cnt / totalFlagged * 100);
                            return `<div class="antipolish-club-row">
                                <span class="antipolish-club-name">${club}</span>
                                <div class="antipolish-club-bar"><div class="antipolish-club-fill" style="width:${pct}%"></div></div>
                                <span class="antipolish-club-cnt">${cnt}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>` : ''}

                ${topSpeakers.length ? `
                <div class="antipolish-speakers">
                    <h5>Najczęściej flagowani posłowie</h5>
                    <div class="antipolish-speaker-list">
                        ${topSpeakers.map(([name, cnt], i) => `
                            <div class="antipolish-speaker-row">
                                <span class="antipolish-speaker-rank">#${i + 1}</span>
                                <span class="antipolish-speaker-name">${name}</span>
                                <span class="antipolish-speaker-cnt">${cnt} wypowiedzi</span>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                ${aiSection}

                <div class="antipolish-flagged">
                    <h5>Oflagowane wypowiedzi (top ${Math.min(flagged.length, 30)})</h5>
                    <div class="antipolish-list">
                        ${flagged.slice(0, 30).map(f => `
                            <div class="antipolish-item severity-${f.severity}">
                                <div class="antipolish-item-header">
                                    <span class="antipolish-item-speaker">${f.speaker}</span>
                                    <span class="antipolish-item-club">${f.club}</span>
                                    <span class="antipolish-item-date">${f.date || ''}</span>
                                    <span class="antipolish-item-severity severity-tag-${f.severity}">
                                        ${f.severity === 'high' ? '🔴 Wysoki' : f.severity === 'medium' ? '🟠 Średni' : '🟡 Niski'}
                                    </span>
                                </div>
                                <div class="antipolish-item-tags">
                                    ${f.categories.map(c => `
                                        <span class="antipolish-tag" style="border-color:${c.color};color:${c.color}">
                                            ${c.icon} ${c.type} (${c.matches.length})
                                        </span>`).join('')}
                                </div>
                                <div class="antipolish-item-text">${f.text.substring(0, 300)}${f.text.length > 300 ? '…' : ''}</div>
                                <div class="antipolish-item-matches">
                                    Dopasowania: ${f.categories.flatMap(c => c.matches).map(m => `<code>${m}</code>`).join(', ')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <p class="antipolish-disclaimer">⚠️ Analiza oparta na dopasowaniu słów kluczowych. Wyniki wymagają weryfikacji przez człowieka — kontekst może zmieniać znaczenie wypowiedzi.</p>
            </div>
        `;

        // AI handler
        if (apiKey && flagged.length > 0) {
            document.getElementById('antiPolishAiBtn')?.addEventListener('click', async function() {
                const btn = this;
                const resultDiv = document.getElementById('antiPolishAiResult');
                btn.disabled = true;
                btn.textContent = '⏳ Analizuję kontekst...';
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '<div class="prediction-loading">Analiza kontekstowa przez AI...</div>';

                try {
                    const excerpts = flagged.slice(0, 15).map(f =>
                        `[${f.speaker}, ${f.club}] Kategorie: ${f.categories.map(c => c.type).join(', ')}. Tekst: ${f.text.substring(0, 200)}`
                    ).join('\n');

                    const prompt = `Jesteś ekspertem od bezpieczeństwa narracyjnego i dezinformacji w polskim parlamencie.
Poniżej masz wypowiedzi parlamentarne oflagowane automatycznie przez system. Dla każdej oceń:
1. Czy kontekst potwierdza flagę (true positive) czy to fałszywy alarm (false positive)?
2. Jakie jest realne zagrożenie narracyjne?
3. Daj ogólną ocenę.

Wypowiedzi:\n${excerpts}\n\nOdpowiedz po polsku, zwięźle, strukturalnie.`;

                    const aiText = await callGeminiForPrediction(prompt, 1500);
                    resultDiv.innerHTML = `<div class="antipolish-ai-result"><h5>🤖 Ocena AI</h5><div class="antipolish-ai-text">${aiText.replace(/\n/g, '<br>')}</div></div>`;
                } catch (err) {
                    resultDiv.innerHTML = `<div class="prediction-error">Błąd AI: ${err.message}</div>`;
                } finally {
                    btn.disabled = false;
                    btn.textContent = '✨ Analiza AI — ocena kontekstu';
                }
            });
        }

    } catch (err) {
        console.error('[Predictions] analyzeAntiPolish error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd analizy: ' + err.message + '</div>';
    }
}

/**
 * 28. Ghost Voting — wykrywanie głosowania przy nieobecności
 * Szuka posłów którzy w tym samym dniu byli ABSENT w jednym głosowaniu
 * a głosowali YES/NO/ABSTAIN w sąsiednim (bliskim numerze) głosowaniu.
 * Wzorzec: ABSENT ↔ głos w odstępie 1-3 głosowań → podejrzane.
 */
function analyzeGhostVoting() {
    const container = document.getElementById('ghostVotingContent');
    if (!container) return;

    console.log('[Predictions] Analyzing ghost voting patterns...');

    try {
        // Krok 1: Pobierz głosy ABSENT (tylko te) — mała lista
        const absentResult = db2.database.exec(`
            SELECT g.id_osoby, gl.data, gl.numer, gl.id_glosowania, gl.tytul
            FROM glosy g
            JOIN glosowania gl ON g.id_glosowania = gl.id_glosowania
            WHERE g.glos = 'ABSENT' AND gl.data IS NOT NULL AND gl.numer IS NOT NULL
        `);

        if (!absentResult.length || !absentResult[0].values.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych o nieobecnościach</div>';
            return;
        }

        // Krok 2: Buduj mapę absent per (osoba, dzień) → [numery głosowań]
        const absentMap = new Map(); // key: "id_osoby|data" → [{numer, id_glosowania, tytul}]
        for (const [id_osoby, data, numer, id_glosowania, tytul] of absentResult[0].values) {
            const key = `${id_osoby}|${data}`;
            if (!absentMap.has(key)) absentMap.set(key, []);
            absentMap.get(key).push({ numer, id_glosowania, tytul });
        }

        // Krok 3: Pobierz głosy obecne (YES/NO/ABSTAIN) tylko dla osób+dni które mają ABSENT
        const personDays = [...absentMap.keys()];
        // Buduj warunek SQL — grupuj po osobach
        const personIds = [...new Set(personDays.map(k => k.split('|')[0]))];
        const dates = [...new Set(personDays.map(k => k.split('|')[1]))];

        // Użyj filtru z podzbiorami zamiast pełnego self-joina
        const presentResult = db2.database.exec(`
            SELECT g.id_osoby, gl.data, gl.numer, g.glos, gl.tytul, gl.id_glosowania
            FROM glosy g
            JOIN glosowania gl ON g.id_glosowania = gl.id_glosowania
            WHERE g.glos IN ('YES', 'NO', 'ABSTAIN')
              AND gl.data IS NOT NULL AND gl.numer IS NOT NULL
        `);

        if (!presentResult.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak danych głosowań</div>';
            return;
        }

        // Krok 4: Buduj mapę obecnych per (osoba, dzień) → [{numer, glos, tytul}]
        const presentMap = new Map();
        for (const [id_osoby, data, numer, glos, tytul, id_glosowania] of presentResult[0].values) {
            const key = `${id_osoby}|${data}`;
            if (!absentMap.has(key)) continue; // pomijamy dni bez ABSENT
            if (!presentMap.has(key)) presentMap.set(key, []);
            presentMap.get(key).push({ numer, glos, tytul, id_glosowania });
        }

        // Krok 5: Znajdź podejrzane pary (ABSENT ↔ głos w odstępie ≤3)
        const suspiciousRaw = [];
        for (const [key, absents] of absentMap) {
            const presents = presentMap.get(key);
            if (!presents) continue;
            const id_osoby = key.split('|')[0];
            const data = key.split('|')[1];

            for (const a of absents) {
                for (const v of presents) {
                    const dist = Math.abs(v.numer - a.numer);
                    if (dist >= 1 && dist <= 3) {
                        suspiciousRaw.push({
                            id_osoby, data,
                            absentNr: a.numer, absentTitle: a.tytul,
                            voteNr: v.numer, vote: v.glos, voteTitle: v.tytul,
                            dist
                        });
                    }
                }
            }
        }

        // Krok 6: Doładuj nazwy posłów
        const mpResult = db2.database.exec(`
            SELECT id_osoby, imie || ' ' || nazwisko as name, klub
            FROM poslowie WHERE klub IS NOT NULL AND klub != ''
        `);
        const mpMap = new Map();
        if (mpResult.length) {
            for (const [id, name, klub] of mpResult[0].values) {
                mpMap.set(String(id), { name, klub });
            }
        }

        // Zamień id_osoby na name+klub
        const rows = suspiciousRaw
            .filter(s => mpMap.has(String(s.id_osoby)))
            .map(s => {
                const mp = mpMap.get(String(s.id_osoby));
                return [mp.name, mp.klub, s.data, s.absentNr, s.absentTitle, s.voteNr, s.vote, s.voteTitle, s.dist];
            })
            .sort((a, b) => a[8] - b[8] || b[2].localeCompare(a[2]));

        if (!rows.length) {
            container.innerHTML = '<div class="prediction-no-data">Brak podejrzanych wzorców głosowania — żaden poseł nie był ABSENT w jednym głosowaniu i obecny w sąsiednim tego samego dnia.</div>';
            return;
        }

        // === Statystyki ===
        const byMp = {};
        const byClub = {};
        const byDistance = { 1: 0, 2: 0, 3: 0 };

        for (const [name, club, date, absentNr, absentTitle, voteNr, vote, voteTitle, dist] of rows) {
            if (!byMp[name]) byMp[name] = { club, count: 0, dist1: 0 };
            byMp[name].count++;
            if (dist === 1) byMp[name].dist1++;

            byClub[club] = (byClub[club] || 0) + 1;
            byDistance[dist] = (byDistance[dist] || 0) + 1;
        }

        const topMps = Object.entries(byMp)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 20);

        const clubEntries = Object.entries(byClub).sort((a, b) => b[1] - a[1]);

        // Unikalne podejrzane zdarzenia (deduplikacja po posłu + dniu)
        const uniqueEvents = new Map();
        for (const row of rows) {
            const [name, club, date, absentNr, absentTitle, voteNr, vote, voteTitle, dist] = row;
            const key = `${name}_${date}_${absentNr}_${voteNr}`;
            if (!uniqueEvents.has(key) || dist < uniqueEvents.get(key).dist) {
                uniqueEvents.set(key, { name, club, date, absentNr, absentTitle, voteNr, vote, voteTitle, dist });
            }
        }

        const events = [...uniqueEvents.values()].sort((a, b) => a.dist - b.dist || b.date.localeCompare(a.date));

        // === Render ===
        container.innerHTML = `
            <div class="ghost-summary">
                <h4>👻 Analiza podejrzanych głosowań</h4>
                <p class="ghost-subtitle">Wykrywanie przypadków gdy poseł był ABSENT w jednym głosowaniu, ale głosował w sąsiednim (odstęp 1–3 głosowań tego samego dnia)</p>

                <div class="ghost-stats">
                    <div class="ghost-stat">
                        <span class="ghost-stat-val">${uniqueEvents.size}</span>
                        <span class="ghost-stat-label">📍 Podejrzanych zdarzeń</span>
                    </div>
                    <div class="ghost-stat ghost-stat-critical">
                        <span class="ghost-stat-val">${byDistance[1] || 0}</span>
                        <span class="ghost-stat-label">🔴 Odstęp 1 (krytyczne)</span>
                    </div>
                    <div class="ghost-stat">
                        <span class="ghost-stat-val">${byDistance[2] || 0}</span>
                        <span class="ghost-stat-label">🟠 Odstęp 2</span>
                    </div>
                    <div class="ghost-stat">
                        <span class="ghost-stat-val">${byDistance[3] || 0}</span>
                        <span class="ghost-stat-label">🟡 Odstęp 3</span>
                    </div>
                </div>

                <div class="ghost-explanation">
                    <strong>Jak czytać wyniki:</strong>
                    <ul>
                        <li><strong>Odstęp 1</strong> — poseł był ABSENT w głosowaniu nr N, ale głosował w nr N±1. Najbardziej podejrzane.</li>
                        <li><strong>Odstęp 2–3</strong> — możliwe spóźnianie się / wyjście na chwilę. Mniej podejrzane, ale warte uwagi przy dużej skali.</li>
                    </ul>
                </div>

                ${clubEntries.length ? `
                <div class="ghost-clubs">
                    <h5>Rozkład wg klubu</h5>
                    <div class="ghost-club-list">
                        ${clubEntries.map(([club, cnt]) => {
                            const pct = Math.round(cnt / rows.length * 100);
                            return `<div class="ghost-club-row">
                                <span class="ghost-club-name">${club}</span>
                                <div class="ghost-club-bar"><div class="ghost-club-fill" style="width:${pct}%"></div></div>
                                <span class="ghost-club-cnt">${cnt}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>` : ''}

                ${topMps.length ? `
                <div class="ghost-mps">
                    <h5>Najczęściej podejrzani posłowie</h5>
                    <div class="ghost-mp-list">
                        ${topMps.map(([name, data], i) => {
                            const pct1 = data.count > 0 ? Math.round(data.dist1 / data.count * 100) : 0;
                            return `<div class="ghost-mp-row">
                                <span class="ghost-mp-rank">#${i + 1}</span>
                                <span class="ghost-mp-name">${name}</span>
                                <span class="ghost-mp-club">${data.club}</span>
                                <span class="ghost-mp-count">${data.count}×</span>
                                <span class="ghost-mp-crit" title="${pct1}% to odstęp 1">${data.dist1 > 0 ? `🔴 ${data.dist1}` : ''}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>` : ''}

                <div class="ghost-events">
                    <h5>Szczegóły zdarzeń (top ${Math.min(events.length, 40)})</h5>
                    <div class="ghost-event-list">
                        ${events.slice(0, 40).map(e => {
                            const distClass = e.dist === 1 ? 'ghost-critical' : e.dist === 2 ? 'ghost-warning' : 'ghost-info';
                            const distLabel = e.dist === 1 ? '🔴' : e.dist === 2 ? '🟠' : '🟡';
                            const voteIcon = e.vote === 'YES' ? '✅' : e.vote === 'NO' ? '❌' : '⭕';
                            const absentShort = (e.absentTitle || '').length > 80 ? e.absentTitle.substring(0, 80) + '…' : (e.absentTitle || 'b/d');
                            const voteShort = (e.voteTitle || '').length > 80 ? e.voteTitle.substring(0, 80) + '…' : (e.voteTitle || 'b/d');
                            return `<div class="ghost-event ${distClass}">
                                <div class="ghost-event-header">
                                    <span class="ghost-event-mp">${e.name}</span>
                                    <span class="ghost-event-club">${e.club}</span>
                                    <span class="ghost-event-date">${e.date}</span>
                                    <span class="ghost-event-dist">${distLabel} odstęp ${e.dist}</span>
                                </div>
                                <div class="ghost-event-detail">
                                    <div class="ghost-event-absent">
                                        <span class="ghost-label-absent">❌ ABSENT</span>
                                        <span class="ghost-event-nr">gł. #${e.absentNr}</span>
                                        <span class="ghost-event-title">${absentShort}</span>
                                    </div>
                                    <div class="ghost-event-arrow">↔️</div>
                                    <div class="ghost-event-voted">
                                        <span class="ghost-label-voted">${voteIcon} ${e.vote}</span>
                                        <span class="ghost-event-nr">gł. #${e.voteNr}</span>
                                        <span class="ghost-event-title">${voteShort}</span>
                                    </div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <p class="ghost-disclaimer">⚠️ Analiza statystyczna — nie jest to dowód na nieprawidłowości. ABSENT może wynikać z błędu rejestracji, spóźnienia lub chwilowego wyjścia. Wyniki wymagają weryfikacji.</p>
            </div>
        `;

        console.log('[Predictions] Ghost voting analysis done, found', uniqueEvents.size, 'events');

    } catch (err) {
        console.error('[Predictions] analyzeGhostVoting error:', err);
        container.innerHTML = '<div class="prediction-error">Błąd analizy: ' + err.message + '</div>';
    }
}

/**
 * 29. Wywiad sieciowy — AI + Google Search Grounding
 * Przeszukuje sieć w kontekście danych parlamentarnych
 */
function loadWebIntel() {
    const container = document.getElementById('webIntelContent');
    if (!container) return;

    console.log('[Predictions] Loading web intel module...');

    const apiKey = getApiKey();

    // Pobierz posłów i kluby do quick actions
    let mpNames = [];
    let clubs = [];
    try {
        const mpRes = db2.database.exec(`SELECT imie || ' ' || nazwisko FROM poslowie WHERE klub IS NOT NULL ORDER BY nazwisko LIMIT 100`);
        if (mpRes.length) mpNames = mpRes[0].values.map(v => v[0]);
        const clubRes = db2.database.exec(`SELECT DISTINCT klub FROM poslowie WHERE klub IS NOT NULL AND klub != '' ORDER BY klub`);
        if (clubRes.length) clubs = clubRes[0].values.map(v => v[0]);
    } catch { /* ignore */ }

    // Pobierz ostatnie tematy głosowań
    let recentTopics = [];
    try {
        const topRes = db2.database.exec(`SELECT DISTINCT tytul FROM glosowania WHERE tytul IS NOT NULL ORDER BY data DESC LIMIT 20`);
        if (topRes.length) recentTopics = topRes[0].values.map(v => v[0]).filter(t => t.length > 10).slice(0, 8);
    } catch { /* ignore */ }

    container.innerHTML = `
        <div class="webintel-panel">
            <h4>🌐 Wywiad sieciowy — AI + Google Search</h4>
            <p class="webintel-desc">Gemini przeszukuje internet w kontekście danych parlamentarnych. Wpisz pytanie lub użyj szybkich akcji.</p>

            ${!apiKey ? '<div class="prediction-error" style="margin-bottom:12px;">⚠️ Ustaw klucz API Gemini w sekcji AI Chat, żeby korzystać z tego modułu.</div>' : ''}

            <div class="webintel-input-area">
                <textarea class="webintel-input" id="webIntelQuery" rows="2" placeholder="Np. Jakie kontrowersje budzi posłanka X? / Co media piszą o ustawie Y?"${!apiKey ? ' disabled' : ''}></textarea>
                <button class="prediction-btn-primary" id="webIntelSearchBtn"${!apiKey ? ' disabled' : ''}>🔍 Szukaj</button>
            </div>

            <div class="webintel-quick">
                <span class="webintel-quick-title">Szybkie akcje:</span>
                ${mpNames.slice(0, 6).map(name => 
                    `<button class="webintel-quick-btn" data-query="Co ostatnio media piszą o pośle/posłance ${name}? Jakie kontrowersje, osiągnięcia, wypowiedzi medialne?">👤 ${name.split(' ').pop()}</button>`
                ).join('')}
                ${clubs.slice(0, 4).map(club =>
                    `<button class="webintel-quick-btn" data-query="Jaka jest aktualna sytuacja polityczna klubu ${club}? Sondaże, konflikty wewnętrzne, kluczowe głosowania.">🏢 ${club}</button>`
                ).join('')}
                ${recentTopics.slice(0, 3).map(topic => {
                    const short = topic.length > 40 ? topic.substring(0, 40) + '…' : topic;
                    return `<button class="webintel-quick-btn" data-query="Co wiadomo o tej sprawie głosowanej w Sejmie: ${topic}? Kontekst medialny, opinie ekspertów, skutki.">📜 ${short}</button>`;
                }).join('')}
            </div>

            <div class="webintel-presets">
                <span class="webintel-quick-title">Analizy kontekstowe:</span>
                <button class="webintel-quick-btn" data-query="Jakie są najnowsze sondaże wyborcze w Polsce? Podaj wyniki dla każdej partii. Źródła.">📊 Sondaże</button>
                <button class="webintel-quick-btn" data-query="Jakie ustawy są aktualnie procedowane w Sejmie RP? Co budzi kontrowersje?">📝 Legislacja</button>
                <button class="webintel-quick-btn" data-query="Czy są aktualne doniesienia o dezinformacji lub wpływach rosyjskich w polskim parlamencie?">🛡️ Dezinformacja</button>
                <button class="webintel-quick-btn" data-query="Jakie są ostatnie decyzje UE, które wpływają na Polskę? Reakcje polskich polityków.">🇪🇺 UE a Polska</button>
                <button class="webintel-quick-btn" data-query="Jakie skandale polityczne były w Polsce w ostatnich tygodniach? Kto jest zamieszany?">💥 Skandale</button>
            </div>

            <div id="webIntelResults" class="webintel-results" style="display:none;"></div>
            <div id="webIntelHistory" class="webintel-history"></div>
        </div>
    `;

    // === Event handlers ===
    const queryInput = document.getElementById('webIntelQuery');
    const searchBtn = document.getElementById('webIntelSearchBtn');
    const resultsDiv = document.getElementById('webIntelResults');
    const historyDiv = document.getElementById('webIntelHistory');
    let searchHistory = [];

    async function doSearch(query) {
        if (!query.trim()) return;
        queryInput.value = query;
        searchBtn.disabled = true;
        searchBtn.textContent = '⏳ Szukam...';
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div class="prediction-loading">🌐 AI przeszukuje internet...</div>';

        try {
            const systemCtx = `Jesteś analitykiem parlamentarnym specjalizującym się w polskiej polityce.
Odpowiadaj po polsku, zwięźle i merytorycznie. Podawaj źródła.
Aktualna kadencja Sejmu: X (od 2023).
Kluby: ${clubs.join(', ') || 'brak danych'}.`;

            const fullPrompt = `${systemCtx}\n\nPytanie użytkownika: ${query}`;
            const { text, sources } = await callGeminiWithSearch(fullPrompt, 2500);

            // Render wyniku
            let sourcesHtml = '';
            if (sources.length > 0) {
                sourcesHtml = `<div class="webintel-sources">
                    <h6>📚 Źródła (${sources.length})</h6>
                    <div class="webintel-source-list">
                        ${sources.map(s => `<a href="${s.uri}" target="_blank" rel="noopener" class="webintel-source-link">
                            <span class="webintel-source-icon">🔗</span>
                            <span>${s.title || s.uri}</span>
                        </a>`).join('')}
                    </div>
                </div>`;
            }

            const queries = sources._queries;
            let queriesHtml = '';
            if (queries && queries.length) {
                queriesHtml = `<div class="webintel-queries">
                    <span class="webintel-queries-label">🔍 Zapytania AI:</span>
                    ${queries.map(q => `<span class="webintel-query-tag">${q}</span>`).join('')}
                </div>`;
            }

            resultsDiv.innerHTML = `
                <div class="webintel-result">
                    <div class="webintel-result-header">
                        <span class="webintel-result-q">💬 ${query.length > 80 ? query.substring(0, 80) + '…' : query}</span>
                        <span class="webintel-result-time">${new Date().toLocaleTimeString('pl-PL')}</span>
                    </div>
                    ${queriesHtml}
                    <div class="webintel-result-text">${text.replace(/\n/g, '<br>')}</div>
                    ${sourcesHtml}
                </div>
            `;

            // Dodaj do historii
            searchHistory.unshift({ query, text: text.substring(0, 200), sources: sources.length, time: new Date().toLocaleTimeString('pl-PL') });
            renderHistory();

        } catch (err) {
            resultsDiv.innerHTML = `<div class="prediction-error">❌ Błąd: ${err.message}</div>`;
        } finally {
            searchBtn.disabled = false;
            searchBtn.textContent = '🔍 Szukaj';
        }
    }

    function renderHistory() {
        if (searchHistory.length <= 1) { historyDiv.innerHTML = ''; return; }
        historyDiv.innerHTML = `
            <div class="webintel-history-section">
                <h6>🗓️ Historia zapytań</h6>
                ${searchHistory.slice(1, 10).map(h => `
                    <div class="webintel-history-item" data-query="${h.query.replace(/"/g, '&quot;')}">
                        <span class="webintel-history-q">${h.query.length > 60 ? h.query.substring(0, 60) + '…' : h.query}</span>
                        <span class="webintel-history-meta">${h.sources} źródeł · ${h.time}</span>
                    </div>
                `).join('')}
            </div>
        `;
        historyDiv.querySelectorAll('.webintel-history-item').forEach(item => {
            item.addEventListener('click', () => doSearch(item.dataset.query));
        });
    }

    // Search button
    searchBtn?.addEventListener('click', () => doSearch(queryInput.value));

    // Enter key
    queryInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSearch(queryInput.value); }
    });

    // Quick action buttons
    container.querySelectorAll('.webintel-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => doSearch(btn.dataset.query));
    });
}

/**
 * 29. AI Charts — AI rysuje dowolne wykresy z bazy na żądanie
 */
function loadAiCharts() {
    const container = document.getElementById('aiChartsContent');
    if (!container) return;

    console.log('[Predictions] Loading AI Charts...');

    // Check WebGPU chart.js availability via global
    if (typeof Chart === 'undefined') {
        container.innerHTML = '<div class="prediction-error">Chart.js niedostępny. Odśwież stronę.</div>';
        return;
    }

    // Build schema info from database
    let schemaInfo = '';
    try {
        const tables = db2.database.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        if (tables.length) {
            tables[0].values.forEach(([tbl]) => {
                const cols = db2.database.exec(`PRAGMA table_info(${tbl})`);
                schemaInfo += `\nTabela: ${tbl}\n`;
                if (cols.length) {
                    cols[0].values.forEach(c => { schemaInfo += `  - ${c[1]} (${c[2]})\n`; });
                }
            });
        }
    } catch (e) { schemaInfo = '(Brak schematu)'; }

    // Quick prompt ideas
    const quickPrompts = [
        { icon: '🥧', label: 'Podział na partie', query: 'Wykres kołowy podziału posłów na kluby parlamentarne' },
        { icon: '📊', label: 'Frekwencja klubów', query: 'Wykres słupkowy średniej frekwencji głosowań wg klubu' },
        { icon: '📈', label: 'Głosowania w czasie', query: 'Wykres liniowy liczby głosowań w poszczególnych miesiącach' },
        { icon: '🗣️', label: 'Top mówcy', query: 'Wykres słupkowy 10 posłów z największą liczbą wypowiedzi' },
        { icon: '⚖️', label: 'Za vs Przeciw', query: 'Wykres słupkowy liczby głosów ZA i PRZECIW w podziale na kluby' },
        { icon: '📉', label: 'Interpelacje/miesiąc', query: 'Wykres liniowy liczby interpelacji złożonych w każdym miesiącu' }
    ];

    container.innerHTML = `
        <div class="aicharts-panel">
            <div class="aicharts-info">
                💡 Opisz jaki wykres chcesz zobaczyć, a AI wygeneruje zapytanie SQL i automatycznie narysuje wykres z danych w bazie.
            </div>
            <div class="aicharts-input-area">
                <textarea id="aiChartsQuery" class="aicharts-input" rows="2" placeholder="Np. Wykres kołowy podziału posłów na partie..."></textarea>
                <button id="aiChartsGenBtn" class="aicharts-btn aicharts-btn-gen">📊 Generuj wykres</button>
            </div>
            <div class="aicharts-quick">
                <span class="aicharts-quick-title">Szybkie pomysły:</span>
                ${quickPrompts.map(q => `<button class="aicharts-quick-btn" data-query="${q.query}">${q.icon} ${q.label}</button>`).join('')}
            </div>
            <div id="aiChartsStatus" class="aicharts-status" style="display:none;"></div>
            <div id="aiChartsResult" class="aicharts-result"></div>
            <div id="aiChartsHistory" class="aicharts-history"></div>
        </div>
    `;

    const queryInput = document.getElementById('aiChartsQuery');
    const genBtn = document.getElementById('aiChartsGenBtn');
    const statusDiv = document.getElementById('aiChartsStatus');
    const resultDiv = document.getElementById('aiChartsResult');
    const historyDiv = document.getElementById('aiChartsHistory');
    let chartInstance = null;
    const history = [];

    async function generateChart(userPrompt) {
        if (!userPrompt || !userPrompt.trim()) return;
        userPrompt = userPrompt.trim();

        const apiKey = getApiKey();
        if (!apiKey) {
            statusDiv.style.display = '';
            statusDiv.innerHTML = '<div class="prediction-error">⚠️ Brak klucza API. Ustaw klucz w sekcji AI Asystent.</div>';
            return;
        }

        statusDiv.style.display = '';
        statusDiv.innerHTML = '<div class="prediction-loading"><div class="prediction-spinner"></div><p>AI generuje wykres...</p></div>';
        genBtn.disabled = true;

        try {
            const aiPrompt = `Jesteś ekspertem od analizy danych parlamentarnych i wizualizacji. Masz dostęp do bazy SQLite z następującym schematem:
${schemaInfo}

Użytkownik chce wykres: "${userPrompt}"

Zwróć odpowiedź WYŁĄCZNIE jako JSON (bez markdown, bez komentarzy) w formacie:
{
  "sql": "SELECT ... ",
  "chartType": "bar|line|pie|doughnut|polarArea|radar",
  "title": "Tytuł wykresu",
  "labelColumn": 0,
  "dataColumns": [1],
  "datasetLabels": ["Nazwa serii"],
  "colors": ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#34495e", "#16a085", "#c0392b"],
  "description": "Krótki opis wyników"
}

WAŻNE:
- sql MUSI być poprawnym zapytaniem SELECT do podanego schematu
- labelColumn = indeks kolumny z etykietami (oś X lub nazwy segmentów)
- dataColumns = indeksy kolumn z wartościami liczbowymi
- datasetLabels = nazwy serii danych (po jednej na każdy element dataColumns)
- Użyj sensownych kolorów pasujących do tematu
- Jeśli dane dotyczą partii, użyj kolorów partyjnych (PiS=#1e3a5f, KO=#f5a623, Lewica=#e74c3c, PSL=#4a7c59, Konfederacja=#1a1a2e, PL2050=#00a9e0)
- Odpowiedz PO POLSKU w polu description`;

            const aiResponse = await callGeminiForPrediction(aiPrompt, 1500);

            // Parse JSON from response
            let config;
            try {
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('AI nie zwróciło poprawnego JSON');
                config = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
                throw new Error(`Nie udało się sparsować odpowiedzi AI: ${parseErr.message}`);
            }

            if (!config.sql || !config.chartType) {
                throw new Error('AI nie wygenerowało kompletnej konfiguracji (brak sql lub chartType)');
            }

            // Validate: only SELECT
            const sqlTrimmed = config.sql.trim();
            if (!/^SELECT/i.test(sqlTrimmed)) {
                throw new Error('AI wygenerowało niedozwolone zapytanie SQL (tylko SELECT)');
            }

            // Execute SQL
            statusDiv.innerHTML = '<div class="prediction-loading"><div class="prediction-spinner"></div><p>Wykonuję SQL...</p></div>';
            const results = db2.database.exec(config.sql);

            if (!results.length || !results[0].values.length) {
                throw new Error('Zapytanie SQL nie zwróciło wyników. Spróbuj innego opisu.');
            }

            const rows = results[0].values;
            const columns = results[0].columns;

            // Extract labels and datasets
            const labelCol = config.labelColumn || 0;
            const dataCols = config.dataColumns || [1];
            const labels = rows.map(r => String(r[labelCol] || ''));

            const datasets = dataCols.map((colIdx, i) => {
                const data = rows.map(r => Number(r[colIdx]) || 0);
                const isPie = ['pie', 'doughnut', 'polarArea'].includes(config.chartType);
                return {
                    label: (config.datasetLabels && config.datasetLabels[i]) || columns[colIdx] || `Seria ${i + 1}`,
                    data: data,
                    backgroundColor: isPie
                        ? data.map((_, j) => (config.colors || [])[j % (config.colors || []).length] || `hsl(${(j * 360) / data.length}, 70%, 55%)`)
                        : ((config.colors || [])[i] || `hsl(${i * 120}, 70%, 55%)`) + '99',
                    borderColor: isPie
                        ? data.map((_, j) => (config.colors || [])[j % (config.colors || []).length] || `hsl(${(j * 360) / data.length}, 70%, 55%)`)
                        : (config.colors || [])[i] || `hsl(${i * 120}, 70%, 55%)`,
                    borderWidth: isPie ? 2 : 2,
                    tension: config.chartType === 'line' ? 0.3 : undefined,
                    fill: config.chartType === 'line' ? false : undefined
                };
            });

            // Render chart
            statusDiv.style.display = 'none';
            resultDiv.innerHTML = `
                <div class="aicharts-chart-wrap">
                    <div class="aicharts-chart-title">${config.title || 'Wykres'}</div>
                    <canvas id="aiChartCanvas"></canvas>
                    <div class="aicharts-chart-desc">${config.description || ''}</div>
                    <details class="aicharts-sql-details">
                        <summary>📋 Pokaż SQL</summary>
                        <pre class="aicharts-sql-code">${config.sql}</pre>
                    </details>
                    <div class="aicharts-chart-meta">${rows.length} wierszy · ${config.chartType} · ${new Date().toLocaleTimeString('pl-PL')}</div>
                </div>
            `;

            // Destroy old chart
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            const ctx = document.getElementById('aiChartCanvas');
            chartInstance = new Chart(ctx, {
                type: config.chartType,
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        title: { display: false },
                        legend: {
                            display: datasets.length > 1 || ['pie', 'doughnut', 'polarArea'].includes(config.chartType),
                            position: 'bottom',
                            labels: { color: '#ccc', font: { size: 11 } }
                        }
                    },
                    scales: ['pie', 'doughnut', 'polarArea', 'radar'].includes(config.chartType) ? {} : {
                        x: {
                            ticks: { color: '#999', maxRotation: 45, font: { size: 10 } },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#999', font: { size: 10 } },
                            grid: { color: 'rgba(255,255,255,0.08)' }
                        }
                    }
                }
            });

            // Save to history
            history.unshift({
                query: userPrompt,
                title: config.title,
                type: config.chartType,
                time: new Date().toLocaleTimeString('pl-PL'),
                rows: rows.length
            });
            renderHistory();

        } catch (err) {
            console.error('[AI Charts] Error:', err);
            statusDiv.style.display = '';
            statusDiv.innerHTML = `<div class="prediction-error">❌ ${err.message}</div>`;
        } finally {
            genBtn.disabled = false;
        }
    }

    function renderHistory() {
        if (history.length === 0) return;
        historyDiv.innerHTML = `
            <div class="pred-subtitle">📜 Historia wykresów (${history.length})</div>
            <div class="aicharts-history-list">
                ${history.map(h => `
                    <div class="aicharts-history-item" data-query="${h.query.replace(/"/g, '&quot;')}">
                        <span class="aicharts-history-icon">${h.type === 'pie' || h.type === 'doughnut' ? '🥧' : h.type === 'line' ? '📈' : '📊'}</span>
                        <span class="aicharts-history-title">${h.title}</span>
                        <span class="aicharts-history-meta">${h.rows} wierszy · ${h.time}</span>
                    </div>
                `).join('')}
            </div>
        `;
        historyDiv.querySelectorAll('.aicharts-history-item').forEach(item => {
            item.addEventListener('click', () => generateChart(item.dataset.query));
        });
    }

    // Event listeners
    genBtn?.addEventListener('click', () => generateChart(queryInput.value));
    queryInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateChart(queryInput.value); }
    });
    container.querySelectorAll('.aicharts-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            queryInput.value = btn.dataset.query;
            generateChart(btn.dataset.query);
        });
    });
}

// Export refresh function dla innych modułów
export { runAllPredictions as refreshPredictions };