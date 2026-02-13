// Sentiment Analysis - polski leksykon i szybka analiza
import { db2 } from './database-v2.js';

// Polski leksykon sentymentu
const SENTIMENT_WORDS = {
    positive: [
        'dobr', 'świetn', 'wspaniał', 'pozytywn', 'sukces', 'wspiera', 'rozwój', 'korzyść', 
        'poprawa', 'zysk', 'wzrost', 'innowac', 'efektywn', 'konstruktywn', 'ciesz', 'gratulow',
        'pochwał', 'pochwal', 'zadowolon', 'radość', 'wspólprac', 'zgoda', 'akceptuj', 'aprobu',
        'komplement', 'doceni', 'dziękuj', 'wspaniał', 'znakomit', 'rewelacyjn', 'fantastyczn',
        'optymiz', 'nadzieja', 'przyszłość', 'postęp', 'pomyśl', 'racjonał', 'słuszn', 'uzasadnion'
    ],
    negative: [
        'zł', 'niedobr', 'probl', 'katastrof', 'skandal', 'kryzys', 'zagrożen', 'niebezpieczn',
        'pogarszaj', 'strat', 'spadek', 'nieefektywn', 'destrukcyjn', 'martwi', 'krytyk',
        'potępi', 'potępien', 'rozczarow', 'smutek', 'konflikt', 'sprzeciw', 'odrzu', 'negaty',
        'błąd', 'wstyd', 'hańba', 'gorsz', 'okropn', 'fataln', 'tragiczn', 'katastrofal',
        'pesymiz', 'obaw', 'niepokój', 'regres', 'niepowodzeni', 'absurd', 'bezpraw', 'nieuzasadnion',
        'szkodliw', 'niewłaściw', 'nieodpowiedni', 'bezsenso', 'niesprawiedliw', 'niezgod'
    ],
    intensifiers: [
        'bardzo', 'niezwykle', 'niezmiernie', 'wyjątkowo', 'nadzwyczaj', 'całkowicie',
        'absolutnie', 'kompletnie', 'skrajnie', 'ekstremalnie', 'ultra'
    ]
};

/**
 * Analizuje sentyment tekstu na podstawie polskiego leksykonu
 * @param {string} text - tekst do analizy
 * @returns {object} - {score: -1 do 1, label: 'positive'|'negative'|'neutral', positive: int, negative: int}
 */
export function analyzeSentiment(text) {
    if (!text || text.length < 10) {
        return { score: 0, label: 'neutral', positive: 0, negative: 0 };
    }
    
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    let positiveCount = 0;
    let negativeCount = 0;
    let intensifier = 1;
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        // Sprawdź wzmacniacze
        if (SENTIMENT_WORDS.intensifiers.some(int => word.includes(int))) {
            intensifier = 1.5;
            continue;
        }
        
        // Sprawdź słowa pozytywne
        if (SENTIMENT_WORDS.positive.some(pos => word.includes(pos))) {
            positiveCount += intensifier;
            intensifier = 1;
        }
        
        // Sprawdź słowa negatywne
        if (SENTIMENT_WORDS.negative.some(neg => word.includes(neg))) {
            negativeCount += intensifier;
            intensifier = 1;
        }
    }
    
    const total = positiveCount + negativeCount;
    const score = total === 0 ? 0 : (positiveCount - negativeCount) / total;
    
    let label = 'neutral';
    if (score > 0.15) label = 'positive';
    else if (score < -0.15) label = 'negative';
    
    return { 
        score: Math.round(score * 1000) / 1000,
        label,
        positive: positiveCount,
        negative: negativeCount,
        total: words.length
    };
}

/**
 * Analizuje sentyment wypowiedzi z bazy danych
 * @param {object} options - opcje filtrowania {limit, klub, kadencja, startDate, endDate}
 * @returns {Promise<Array>} - array wyników z sentimentem
 */
export async function analyzeSpeechesSentiment(options = {}) {
    if (!db2.database) {
        throw new Error('Baza danych nie jest zainicjalizowana');
    }
    
    const {
        limit = 500,
        klub = null,
        kadencja = null,
        startDate = null,
        endDate = null
    } = options;
    
    // Buduj zapytanie SQL
    let sql = `
        SELECT 
            w.id_wypowiedzi,
            w.tekst,
            w.data,
            w.mowca,
            p.imie,
            p.nazwisko,
            p.klub,
            p.kadencja
        FROM wypowiedzi w
        LEFT JOIN poslowie p ON w.id_osoby = p.id_osoby
        WHERE w.tekst IS NOT NULL AND LENGTH(w.tekst) > 100
    `;
    
    const params = [];
    
    if (klub) {
        sql += ` AND p.klub = ?`;
        params.push(klub);
    }
    
    if (kadencja) {
        sql += ` AND p.kadencja = ?`;
        params.push(kadencja);
    }
    
    if (startDate) {
        sql += ` AND w.data >= ?`;
        params.push(startDate);
    }
    
    if (endDate) {
        sql += ` AND w.data <= ?`;
        params.push(endDate);
    }
    
    sql += ` ORDER BY w.data DESC LIMIT ?`;
    params.push(limit);
    
    console.log('[Sentiment] Analyzing speeches...', { limit, klub, kadencja });
    
    const stmt = db2.database.prepare(sql);
    stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        const sentiment = analyzeSentiment(row.tekst);
        
        results.push({
            id: row.id_wypowiedzi,
            speaker: row.mowca || `${row.imie} ${row.nazwisko}`,
            party: row.klub,
            date: row.data,
            kadencja: row.kadencja,
            sentiment: sentiment,
            textLength: row.tekst.length
        });
    }
    
    stmt.free();
    
    console.log(`[Sentiment] Analyzed ${results.length} speeches`);
    return results;
}

/**
 * Agreguje sentyment per klub
 * @param {Array} sentimentData - wyniki z analyzeSpeechesSentiment
 * @returns {Array} - agregacja per klub
 */
export function aggregateByParty(sentimentData) {
    const partyStats = {};
    
    sentimentData.forEach(item => {
        const party = item.party || 'Niez.';
        
        if (!partyStats[party]) {
            partyStats[party] = {
                party,
                count: 0,
                avgScore: 0,
                totalScore: 0,
                positive: 0,
                negative: 0,
                neutral: 0
            };
        }
        
        const stats = partyStats[party];
        stats.count++;
        stats.totalScore += item.sentiment.score;
        
        if (item.sentiment.label === 'positive') stats.positive++;
        else if (item.sentiment.label === 'negative') stats.negative++;
        else stats.neutral++;
    });
    
    return Object.values(partyStats).map(stats => ({
        ...stats,
        avgScore: Math.round((stats.totalScore / stats.count) * 1000) / 1000
    })).sort((a, b) => b.avgScore - a.avgScore);
}

/**
 * Agreguje sentyment w czasie (per miesiąc)
 * @param {Array} sentimentData - wyniki z analyzeSpeechesSentiment
 * @returns {Array} - agregacja per miesiąc
 */
export function aggregateByTime(sentimentData) {
    const timeStats = {};
    
    sentimentData.forEach(item => {
        if (!item.date) return;
        
        // Grupuj per miesiąc: YYYY-MM
        const month = item.date.substring(0, 7);
        
        if (!timeStats[month]) {
            timeStats[month] = {
                month,
                count: 0,
                avgScore: 0,
                totalScore: 0,
                positive: 0,
                negative: 0,
                neutral: 0
            };
        }
        
        const stats = timeStats[month];
        stats.count++;
        stats.totalScore += item.sentiment.score;
        
        if (item.sentiment.label === 'positive') stats.positive++;
        else if (item.sentiment.label === 'negative') stats.negative++;
        else stats.neutral++;
    });
    
    return Object.values(timeStats).map(stats => ({
        ...stats,
        avgScore: Math.round((stats.totalScore / stats.count) * 1000) / 1000
    })).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Znajduje top mówców (najbardziej pozytywni/negatywni)
 * @param {Array} sentimentData - wyniki z analyzeSpeechesSentiment
 * @param {number} limit - ile mówców
 * @returns {object} - {positive: Array, negative: Array}
 */
export function getTopSpeakers(sentimentData, limit = 10) {
    const speakerStats = {};
    
    sentimentData.forEach(item => {
        const speaker = item.speaker || 'Nieznany';
        
        if (!speakerStats[speaker]) {
            speakerStats[speaker] = {
                speaker,
                party: item.party,
                count: 0,
                avgScore: 0,
                totalScore: 0
            };
        }
        
        const stats = speakerStats[speaker];
        stats.count++;
        stats.totalScore += item.sentiment.score;
    });
    
    const speakers = Object.values(speakerStats)
        .filter(s => s.count >= 3) // Min 3 wypowiedzi
        .map(stats => ({
            ...stats,
            avgScore: Math.round((stats.totalScore / stats.count) * 1000) / 1000
        }));
    
    return {
        positive: [...speakers].sort((a, b) => b.avgScore - a.avgScore).slice(0, limit),
        negative: [...speakers].sort((a, b) => a.avgScore - b.avgScore).slice(0, limit)
    };
}

/**
 * Rozkład sentymentu (ile positive/negative/neutral)
 * @param {Array} sentimentData - wyniki z analyzeSpeechesSentiment
 * @returns {object} - {positive, negative, neutral}
 */
export function getSentimentDistribution(sentimentData) {
    const dist = {
        positive: 0,
        negative: 0,
        neutral: 0
    };
    
    sentimentData.forEach(item => {
        dist[item.sentiment.label]++;
    });
    
    return dist;
}
