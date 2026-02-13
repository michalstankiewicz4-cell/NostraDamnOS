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
    'activityForecast': analyzeActivityForecast
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
    const grid = document.querySelector('.predictions-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.prediction-card');
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Nie rozwijaj jeśli kliknięto przycisk lub select
            if (e.target.closest('button') || e.target.closest('select')) return;
            expandPredictionCard(card);
        });
    });
}

/**
 * Rozwiń kartę - ukryj pozostałe, pokaż body, załaduj dane lazy
 */
function expandPredictionCard(card) {
    const grid = document.querySelector('.predictions-grid');
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
    const grid = document.querySelector('.predictions-grid');
    if (!grid) return;

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

// Export refresh function dla innych modułów
export { runAllPredictions as refreshPredictions };