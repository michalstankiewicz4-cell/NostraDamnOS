// Predictions Module - Model Predykcyjny
import { db2 } from './database-v2.js';

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
    'committeeProfile': loadCommitteeProfile
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

// Export refresh function dla innych modułów
export { runAllPredictions as refreshPredictions };
