// Investigation Engine — Conspiracy Theory Detector & Narrative Analyzer
// Wykrywa nietypowe powiązania, spekulacyjne narracje, retoryczne struktury
// i tworzy mapę pojęć z wypowiedzi parlamentarnych.

import { db2 } from './database-v2.js';
import { analyzeSentiment } from './sentiment-analysis.js';

// =====================================================
// STAŁE I KONFIGURACJA
// =====================================================

/** Kategorie narracji spiskowych */
const NARRATIVE_CATEGORIES = {
    foreign_influence: {
        label: '🕵️ Ukryte wpływy zagraniczne',
        keywords: ['zagraniczny', 'obcy', 'służby', 'wpływ', 'agent', 'szpieg', 'rosja', 'moskwa', 'kreml',
            'berlin', 'bruksela', 'pekin', 'chiny', 'lobbing', 'fundacja zagraniczna','ngo', 'soros',
            'infiltracja', 'dywersja', 'sabotaż', 'piąta kolumna', 'zdrada', 'zdrajca'],
        weight: 1.5
    },
    secret_government: {
        label: '🏛️ Tajne działania rządu',
        keywords: ['tajny', 'ukryty', 'za zamkniętymi', 'zakulisowy', 'konspiracja', 'spisek',
            'nikt nie wie', 'zatuszować', 'ukrywają', 'tuszowanie', 'ukrywanie',
            'prawda wyjdzie', 'kłamstwo', 'manipulacja', 'cenzura', 'niewygodne',
            'zamiatanie pod dywan', 'ciemne interesy', 'przekręt', 'afera'],
        weight: 1.3
    },
    media_manipulation: {
        label: '📺 Manipulacja mediami',
        keywords: ['media', 'propaganda', 'dezinformacja', 'fake news', 'narracja', 'przekaz',
            'cenzura', 'blokowanie', 'przemilczanie', 'media głównego nurtu', 'mainstream',
            'manipulacja informacją', 'kontrola informacji', 'trollowanie', 'boty',
            'fabryka trolli', 'pranie mózgu', 'socialmedia'],
        weight: 1.2
    },
    coincidences: {
        label: '🔮 Niezwykłe zbiegi okoliczności',
        keywords: ['zbieg okoliczności', 'przypadek', 'dziwne', 'podejrzane', 'zastanawiające',
            'ciekawe że', 'to nie przypadek', 'kto za tym stoi', 'cui bono',
            'komu to służy', 'nie wierzę w przypadki', 'dziwnym trafem',
            'akurat teraz', 'w tym samym czasie', 'nagle', 'niespodziewanie'],
        weight: 1.4
    },
    unexplained: {
        label: '❓ Niewyjaśnione zdarzenia',
        keywords: ['niewyjaśniony', 'zagadka', 'tajemniczy', 'niejasny', 'brak odpowiedzi',
            'dlaczego nikt', 'kto odpowiada', 'brak transparentności', 'nieprzejrzysty',
            'zamknięty', 'utajniony', 'tajne', 'poufne', 'zastrzeżone',
            'bez wyjaśnienia', 'nikt nie wyjaśnił'],
        weight: 1.1
    },
    hidden_connections: {
        label: '🕸️ Niejawne powiązania',
        keywords: ['powiązany', 'powiązania', 'sieć', 'układ', 'klika', 'grupa interesów',
            'oligarchia', 'nepotyzm', 'kolesiostwo', 'kumoterstwo', 'kolesiów',
            'znajomych', 'rodzina', 'spółka', 'fundacja', 'biznes', 'pieniądze',
            'dotacja', 'grant', 'przetarg', 'zamówienie publiczne', 'korupcja'],
        weight: 1.3
    }
};

/** Wzorce retoryczne typowe dla teorii spiskowych */
const RHETORICAL_PATTERNS = [
    { pattern: /kto za tym stoi/gi, label: 'Pytanie retoryczne o sprawcę', score: 2.0 },
    { pattern: /to nie (?:jest )?przypadek/gi, label: 'Negacja przypadkowości', score: 2.5 },
    { pattern: /prawda (?:jest taka|wyjdzie|kiedyś)/gi, label: 'Odwołanie do ukrytej prawdy', score: 1.8 },
    { pattern: /nikt (?:nie mówi|nie powie|nie chce)/gi, label: 'Argument z przemilczenia', score: 1.5 },
    { pattern: /(?:obudźcie się|otwórzcie oczy)/gi, label: 'Wezwanie do przebudzenia', score: 2.5 },
    { pattern: /(?:oficjalna wersja|oficjalnie mówią)/gi, label: 'Podważanie oficjalnej narracji', score: 2.0 },
    { pattern: /(?:dziwnym trafem|przypadkiem|akurat)/gi, label: 'Implikacja zaplanowanego działania', score: 1.5 },
    { pattern: /(?:system|establishment|elity?) (?:chc[eą]|robi[ąa])/gi, label: 'Narracja anty-systemowa', score: 1.8 },
    { pattern: /(?:ludzie nie wiedzą|nie mówi się|media milczą)/gi, label: 'Posiadanie tajnej wiedzy', score: 2.0 },
    { pattern: /(?:cui bono|komu to służy|komu na rękę)/gi, label: 'Motyw korzyści', score: 1.5 },
    { pattern: /(?:następnym razem|kolejny raz|znowu|po raz kolejny)/gi, label: 'Wzorzec powtarzalności', score: 1.0 },
    { pattern: /(?:nie wierzę|nie kupuję|nie łykam)/gi, label: 'Ekspresja nieufności', score: 1.3 },
    { pattern: /(?:zastanówcie się|pomyślcie|zadajcie sobie pytanie)/gi, label: 'Sugestia ukrytej logiki', score: 1.5 },
    { pattern: /(?:udowodni[ćł]|dowodem jest|dowodzi)/gi, label: 'Pseudo-dowodzenie', score: 1.2 },
];

/** Stop-words do wykluczenia z mapy pojęć */
const STOP_WORDS = new Set([
    'i', 'w', 'na', 'z', 'do', 'że', 'to', 'jest', 'nie', 'się', 'o', 'ale',
    'za', 'jak', 'co', 'po', 'od', 'tak', 'ten', 'tym', 'tej', 'tego', 'te',
    'pan', 'pani', 'może', 'tylko', 'już', 'też', 'jeszcze', 'więc', 'czy',
    'bardzo', 'tutaj', 'tam', 'tego', 'być', 'dla', 'przez', 'było', 'były',
    'będzie', 'przy', 'żeby', 'aby', 'bo', 'lub', 'albo', 'ani', 'gdy', 'gdyby',
    'jako', 'są', 'był', 'była', 'mnie', 'mi', 'nas', 'ich', 'my', 'wy',
    'one', 'oni', 'ona', 'on', 'ono', 'go', 'je', 'mu', 'jej', 'im',
    'swój', 'swoją', 'swoim', 'nasz', 'nasza', 'nasze', 'wasz', 'wasza',
    'ten', 'ta', 'te', 'tych', 'tą', 'ci', 'ce', 'temu',
    'który', 'która', 'które', 'którym', 'którego', 'której',
    'panie', 'marszałku', 'wysoka', 'izbo', 'szanowni', 'państwo',
    'proszę', 'dziękuję', 'chciałbym', 'chciałabym', 'uważam',
    'pan', 'pani', 'pana', 'panu', 'pańscy'
]);

// =====================================================
// FUNKCJE ANALIZY
// =====================================================

/**
 * Pobierz wypowiedzi z bazy danych
 * @param {number} limit
 * @returns {Array<{speaker: string, party: string, text: string, date: string, sessionId: string}>}
 */
function fetchSpeeches(limit = 500) {
    if (!db2.database) return [];

    try {
        const results = db2.database.exec(`
            SELECT w.mowca, w.tekst, w.data, p.klub, w.id_posiedzenia
            FROM wypowiedzi w
            LEFT JOIN poslowie p ON w.id_osoby = p.id_osoby
            WHERE w.tekst IS NOT NULL AND LENGTH(w.tekst) > 50
            ORDER BY RANDOM()
            LIMIT ?
        `, [limit]);

        if (!results.length) return [];

        return results[0].values.map(([speaker, text, date, party, sessionId]) => ({
            speaker: speaker || 'Nieznany',
            text: text || '',
            date: date || '',
            party: party || 'niez.',
            sessionId: sessionId || ''
        }));
    } catch (err) {
        console.error('[InvestigationEngine] Error fetching speeches:', err);
        return [];
    }
}

/**
 * Analizuj wypowiedź pod kątem kategorii narracji spiskowych
 * @param {string} text
 * @returns {{ categories: Object, totalScore: number, rhetoricalPatterns: Array }}
 */
function analyzeConspiracySignals(text) {
    const textLower = text.toLowerCase();
    const categories = {};
    let totalScore = 0;

    // Szukaj słów kluczowych w każdej kategorii
    for (const [catId, cat] of Object.entries(NARRATIVE_CATEGORIES)) {
        let hits = 0;
        const matchedKeywords = [];

        for (const kw of cat.keywords) {
            const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
            const matches = textLower.match(regex);
            if (matches) {
                hits += matches.length;
                matchedKeywords.push(kw);
            }
        }

        if (hits > 0) {
            const catScore = hits * cat.weight;
            categories[catId] = {
                label: cat.label,
                hits,
                score: catScore,
                keywords: matchedKeywords
            };
            totalScore += catScore;
        }
    }

    // Wykryj wzorce retoryczne
    const rhetoricalPatterns = [];
    for (const rp of RHETORICAL_PATTERNS) {
        const matches = text.match(rp.pattern);
        if (matches) {
            rhetoricalPatterns.push({
                label: rp.label,
                count: matches.length,
                score: matches.length * rp.score,
                examples: matches.slice(0, 3)
            });
            totalScore += matches.length * rp.score;
        }
    }

    return { categories, totalScore, rhetoricalPatterns };
}

/**
 * Buduj mapę współwystępowania pojęć
 * @param {Array} speeches
 * @returns {{ nodes: Array, edges: Array }}
 */
function buildConceptMap(speeches) {
    const wordFreq = {};
    const cooccurrence = {};
    const WINDOW_SIZE = 5; // okno współwystępowania

    speeches.forEach(speech => {
        const words = speech.text
            .toLowerCase()
            .replace(/[^a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ\s-]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3 && !STOP_WORDS.has(w));

        // Deduplikacja w obrębie jednej wypowiedzi dla częstości
        const uniqueWords = [...new Set(words)];
        uniqueWords.forEach(w => {
            wordFreq[w] = (wordFreq[w] || 0) + 1;
        });

        // Współwystępowanie w oknie
        for (let i = 0; i < words.length; i++) {
            for (let j = i + 1; j < Math.min(i + WINDOW_SIZE, words.length); j++) {
                const pair = [words[i], words[j]].sort().join('|||');
                cooccurrence[pair] = (cooccurrence[pair] || 0) + 1;
            }
        }
    });

    // Top pojęcia (max 40)
    const topWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40);

    const topSet = new Set(topWords.map(([w]) => w));

    // Nodes
    const nodes = topWords.map(([word, freq]) => ({
        id: word,
        label: word,
        size: Math.min(20, 5 + Math.log2(freq + 1) * 3),
        freq
    }));

    // Edges (tylko między top pojęciami, min 2 współwystąpienia)
    const edges = [];
    for (const [pair, count] of Object.entries(cooccurrence)) {
        if (count < 2) continue;
        const [a, b] = pair.split('|||');
        if (topSet.has(a) && topSet.has(b)) {
            edges.push({ source: a, target: b, weight: count });
        }
    }

    // Sortuj krawędzie malejąco po wadze i ogranicz
    edges.sort((a, b) => b.weight - a.weight);
    return { nodes, edges: edges.slice(0, 80) };
}

/**
 * Klasteryzacja narracji na podstawie kategorii
 * @param {Array} analyzedSpeeches
 * @returns {Array} klastry z nazwami
 */
function clusterNarratives(analyzedSpeeches) {
    const clusters = {};

    analyzedSpeeches.forEach(s => {
        // Przypisz do dominującej kategorii
        let dominant = null;
        let maxScore = 0;

        for (const [catId, cat] of Object.entries(s.analysis.categories)) {
            if (cat.score > maxScore) {
                maxScore = cat.score;
                dominant = catId;
            }
        }

        if (dominant) {
            if (!clusters[dominant]) {
                clusters[dominant] = {
                    category: NARRATIVE_CATEGORIES[dominant].label,
                    speeches: [],
                    totalScore: 0,
                    speakers: {},
                    parties: {}
                };
            }
            clusters[dominant].speeches.push(s);
            clusters[dominant].totalScore += s.analysis.totalScore;
            clusters[dominant].speakers[s.speaker] = (clusters[dominant].speakers[s.speaker] || 0) + 1;
            clusters[dominant].parties[s.party] = (clusters[dominant].parties[s.party] || 0) + 1;
        }
    });

    // Generuj nazwy klastrów
    const CLUSTER_NAMES = {
        foreign_influence: 'Narracja o ukrytych wpływach zagranicznych',
        secret_government: 'Narracja o tajnych działaniach władzy',
        media_manipulation: 'Narracja o manipulacji informacją',
        coincidences: 'Narracja o podejrzanych zbiegach okoliczności',
        unexplained: 'Narracja o zamiataniu spraw pod dywan',
        hidden_connections: 'Narracja o niejawnych powiązaniach i układach'
    };

    return Object.entries(clusters)
        .map(([catId, cluster]) => ({
            id: catId,
            name: CLUSTER_NAMES[catId] || cluster.category,
            icon: [...(NARRATIVE_CATEGORIES[catId]?.label || '')][0] || '🔍',
            ...cluster,
            topSpeakers: Object.entries(cluster.speakers).sort((a, b) => b[1] - a[1]).slice(0, 5),
            topParties: Object.entries(cluster.parties).sort((a, b) => b[1] - a[1]).slice(0, 5)
        }))
        .sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Wykryj powtarzające się motywy tematyczne
 * @param {Array} speeches
 * @returns {Array}
 */
function detectRecurringMotifs(speeches) {
    // Bigramy (pary wyrazów)
    const bigrams = {};

    speeches.forEach(speech => {
        const words = speech.text
            .toLowerCase()
            .replace(/[^a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ\s-]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3 && !STOP_WORDS.has(w));

        for (let i = 0; i < words.length - 1; i++) {
            const bigram = `${words[i]} ${words[i + 1]}`;
            if (!bigrams[bigram]) {
                bigrams[bigram] = { count: 0, speakers: new Set(), parties: new Set() };
            }
            bigrams[bigram].count++;
            bigrams[bigram].speakers.add(speech.speaker);
            bigrams[bigram].parties.add(speech.party);
        }
    });

    return Object.entries(bigrams)
        .filter(([, data]) => data.count >= 3 && data.speakers.size >= 2)
        .map(([bigram, data]) => ({
            phrase: bigram,
            count: data.count,
            speakerCount: data.speakers.size,
            partyCount: data.parties.size,
            crossParty: data.parties.size > 1
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 25);
}

// =====================================================
// GŁÓWNA FUNKCJA ANALIZY
// =====================================================

/**
 * Uruchom pełną analizę Investigation Engine
 * @returns {Object} wyniki analizy
 */
export function runInvestigation() {
    console.log('[InvestigationEngine] Starting full analysis...');

    const speeches = fetchSpeeches(500);
    if (!speeches.length) {
        return { error: 'NO_DATA', message: 'Brak wypowiedzi w bazie danych' };
    }

    // 1. Analiza sygnałów spiskowych w każdej wypowiedzi
    const analyzedSpeeches = speeches
        .map(s => {
            const analysis = analyzeConspiracySignals(s.text);
            const sentiment = analyzeSentiment(s.text);
            return { ...s, analysis, sentiment };
        })
        .filter(s => s.analysis.totalScore > 0)
        .sort((a, b) => b.analysis.totalScore - a.analysis.totalScore);

    // 2. Klasteryzacja narracji
    const clusters = clusterNarratives(analyzedSpeeches);

    // 3. Mapa pojęć
    const conceptMap = buildConceptMap(speeches);

    // 4. Powtarzające się motywy
    const motifs = detectRecurringMotifs(speeches);

    // 5. Statystyki globalne
    const totalAnalyzed = speeches.length;
    const flaggedCount = analyzedSpeeches.length;
    const flaggedPct = ((flaggedCount / totalAnalyzed) * 100).toFixed(1);

    // 6. Top wypowiedzi "spiskowe"
    const topConspiracy = analyzedSpeeches.slice(0, 10);

    // 7. Wzorce retoryczne — agregacja
    const rhetoricalAgg = {};
    analyzedSpeeches.forEach(s => {
        s.analysis.rhetoricalPatterns.forEach(rp => {
            if (!rhetoricalAgg[rp.label]) {
                rhetoricalAgg[rp.label] = { label: rp.label, totalCount: 0, totalScore: 0 };
            }
            rhetoricalAgg[rp.label].totalCount += rp.count;
            rhetoricalAgg[rp.label].totalScore += rp.score;
        });
    });

    const rhetoricalPatterns = Object.values(rhetoricalAgg)
        .sort((a, b) => b.totalCount - a.totalCount);

    console.log(`[InvestigationEngine] Done. ${flaggedCount}/${totalAnalyzed} flagged.`);

    return {
        totalAnalyzed,
        flaggedCount,
        flaggedPct,
        clusters,
        conceptMap,
        motifs,
        topConspiracy,
        rhetoricalPatterns
    };
}

// =====================================================
// GENEROWANIE AI TEMATÓW SPISKOWYCH
// =====================================================

/**
 * Helper: pobierz klucz API
 */
function getApiKey() {
    try {
        return localStorage.getItem('aiChatApiKey') || '';
    } catch { return ''; }
}

/**
 * Helper: pobierz wybrany model
 */
function getSelectedModel() {
    try {
        return localStorage.getItem('aiChatModel') || 'gemini-2.0-flash';
    } catch { return 'gemini-2.0-flash'; }
}

/**
 * Wywołaj Gemini AI dla generowania teorii spiskowych
 */
async function callGeminiForInvestigation(prompt, maxTokens = 3000) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('NO_API_KEY');

    const model = getSelectedModel();
    let apiUrl;
    if (model.startsWith('gemini-') || model.startsWith('gemma-')) {
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    } else {
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: maxTokens }
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
 * Generuj tematy spiskowe z AI na podstawie wyników analizy
 */
export async function generateConspiracyTopicsAI(analysisResults) {
    const { clusters, topConspiracy, motifs, rhetoricalPatterns } = analysisResults;

    // Przygotuj kontekst (skrócony) dla AI
    let context = 'WYNIKI ANALIZY WYPOWIEDZI PARLAMENTARNYCH:\n\n';

    // Klastry narracji
    context += '== WYKRYTE KLASTRY NARRACYJNE ==\n';
    clusters.forEach(c => {
        context += `• ${c.name}: ${c.speeches.length} wypowiedzi, score: ${c.totalScore.toFixed(1)}\n`;
        context += `  Top mówcy: ${c.topSpeakers.map(([n, c2]) => `${n} (${c2})`).join(', ')}\n`;
    });

    // Najciekawsze wypowiedzi
    context += '\n== TOP WYPOWIEDZI Z SYGNAŁAMI ==\n';
    topConspiracy.slice(0, 5).forEach(s => {
        const cats = Object.values(s.analysis.categories).map(c => c.label).join(', ');
        context += `• [${s.speaker}, ${s.party}] Score: ${s.analysis.totalScore.toFixed(1)} | Kategorie: ${cats}\n`;
        context += `  Fragment: "${s.text.substring(0, 200)}..."\n\n`;
    });

    // Motywy
    context += '== POWTARZAJĄCE SIĘ MOTYWY ==\n';
    motifs.slice(0, 10).forEach(m => {
        context += `• "${m.phrase}" — ${m.count}x, ${m.speakerCount} mówców${m.crossParty ? ' (trans-partyjny)' : ''}\n`;
    });

    // Wzorce retoryczne
    context += '\n== WYKRYTE WZORCE RETORYCZNE ==\n';
    rhetoricalPatterns.slice(0, 8).forEach(rp => {
        context += `• ${rp.label}: ${rp.totalCount}x\n`;
    });

    const prompt = `Jesteś "Investigation Engine" — AI analizującym narracje parlamentarne pod kątem teorii spiskowych, spekulacji i manipulacji retorycznych.

Na podstawie poniższych wyników analizy automatycznej, wygeneruj raport w stylu detektywa-analityka. Bądź ironiczny, ale merytorycznie celny.

${context}

Wygeneruj raport zawierający:

1. **🔍 GŁÓWNE TEORIE SPISKOWE** — 3-5 teorii wynikających z danych. Dla każdej podaj:
   - Nazwę (np. "Operacja Mgła" albo "Protokół Cichy Lobbysta")
   - Krótki opis (2-3 zdania)
   - Jakie dowody z danych ją wspierają
   - Werdykt: 🟢 prawdopodobne / 🟡 spekulacja / 🔴 teoria spiskowa

2. **🕸️ UKRYTE POWIĄZANIA** — nietypowe korelacje między mówcami, partiami, tematami

3. **🎭 MISTRZOWIE RETORYKI** — kto najczęściej używa technik manipulacyjnych i jakich

4. **📊 BAROMETR PARANOI** — ogólny score na skali 1-10, jak bardzo parlament "spiskuje"

5. **⚠️ DISCLAIMER** — krótkie zastrzeżenie, że to analiza algorytmiczna, nie ocena prawdziwości

Odpowiadaj po polsku. Używaj emoji. Bądź wnikliwy ale z przymrużeniem oka.`;

    return await callGeminiForInvestigation(prompt);
}

// =====================================================
// RENDEROWANIE UI
// =====================================================

/**
 * Renderuj SVG mapę pojęć (force-directed layout uproszczony)
 */
function renderConceptMapSVG(conceptMap, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { nodes, edges } = conceptMap;
    if (!nodes.length) {
        container.innerHTML = '<div class="prediction-no-data">Za mało danych do stworzenia mapy pojęć</div>';
        return;
    }

    const width = container.clientWidth || 600;
    const height = 400;

    // Prosty układ kołowy z perturbacją
    const angleStep = (2 * Math.PI) / nodes.length;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.35;

    nodes.forEach((node, i) => {
        const angle = angleStep * i;
        const r = radius * (0.6 + 0.4 * Math.random());
        node.x = cx + r * Math.cos(angle);
        node.y = cy + r * Math.sin(angle);
    });

    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="investigation-concept-svg">`;

    // Krawędzie
    const maxWeight = Math.max(...edges.map(e => e.weight), 1);
    edges.forEach(e => {
        const a = nodeMap[e.source];
        const b = nodeMap[e.target];
        if (!a || !b) return;
        const opacity = 0.15 + (e.weight / maxWeight) * 0.6;
        const strokeWidth = 0.5 + (e.weight / maxWeight) * 2.5;
        svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" 
            stroke="var(--inv-edge-color, #667eea)" stroke-opacity="${opacity}" stroke-width="${strokeWidth}"/>`;
    });

    // Węzły
    nodes.forEach(n => {
        const r = n.size;
        svg += `<g class="concept-node" data-word="${n.id}">
            <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="var(--inv-node-fill, #667eea)" fill-opacity="0.7" stroke="var(--inv-node-stroke, #5a67d8)" stroke-width="1.5"/>
            <text x="${n.x}" y="${n.y + r + 12}" text-anchor="middle" class="concept-label">${n.label}</text>
        </g>`;
    });

    svg += '</svg>';
    container.innerHTML = svg;
}

/**
 * Główne renderowanie karty Investigation Engine
 */
export function renderInvestigationCard() {
    const container = document.getElementById('investigationEngineContent');
    if (!container) return;

    console.log('[InvestigationEngine] Rendering card...');

    if (!db2.database) {
        container.innerHTML = '<div class="prediction-no-data">Brak bazy danych — najpierw pobierz dane z zakładki ETL</div>';
        return;
    }

    // Uruchom analizę
    const results = runInvestigation();

    if (results.error) {
        container.innerHTML = `<div class="prediction-no-data">${results.message}</div>`;
        return;
    }

    let html = '';

    // Header stats
    html += '<div class="inv-stats-row">';
    html += `<div class="inv-stat"><div class="inv-stat-value">${results.totalAnalyzed}</div><div class="inv-stat-label">Przeanalizowanych</div></div>`;
    html += `<div class="inv-stat"><div class="inv-stat-value inv-flagged">${results.flaggedCount}</div><div class="inv-stat-label">Oflagowanych</div></div>`;
    html += `<div class="inv-stat"><div class="inv-stat-value">${results.flaggedPct}%</div><div class="inv-stat-label">Wskaźnik</div></div>`;
    html += `<div class="inv-stat"><div class="inv-stat-value">${results.clusters.length}</div><div class="inv-stat-label">Klastrów</div></div>`;
    html += '</div>';

    // AI Generuj button
    html += '<div class="inv-ai-section">';
    html += `<button id="invGenerateAIBtn" class="inv-ai-btn">
        <span class="inv-ai-btn-icon">🕵️</span>
        <span>Generuj raport AI — teorie spiskowe</span>
        <span class="ai-badge">✨ AI</span>
    </button>`;
    html += '<div id="invAIResult" class="inv-ai-result"></div>';
    html += '</div>';

    // Tabbed sections
    html += '<div class="inv-tabs">';
    html += '<button class="inv-tab active" data-inv-tab="clusters" data-help-id="invTabClusters">🏷️ Klastry narracji</button>';
    html += '<button class="inv-tab" data-inv-tab="rhetoric" data-help-id="invTabRhetoric">🎭 Wzorce retoryczne</button>';
    html += '<button class="inv-tab" data-inv-tab="motifs" data-help-id="invTabMotifs">🔁 Motywy</button>';
    html += '<button class="inv-tab" data-inv-tab="conceptmap" data-help-id="invTabConceptMap">🕸️ Mapa pojęć</button>';
    html += '<button class="inv-tab" data-inv-tab="topflagged" data-help-id="invTabTopFlagged">🚩 Top oflagowane</button>';
    html += '</div>';

    // === Tab: Klastry ===
    html += '<div class="inv-tab-content active" data-inv-tab-content="clusters">';
    if (results.clusters.length) {
        results.clusters.forEach((cluster, ci) => {
            const barPct = Math.min(100, (cluster.speeches.length / results.flaggedCount) * 100);
            // Przygotuj przykładowe fragmenty do promptu
            const sampleTexts = cluster.speeches.slice(0, 3).map(s => s.text.substring(0, 150)).join('\n');
            const clusterDataAttr = encodeURIComponent(JSON.stringify({
                name: cluster.name,
                count: cluster.speeches.length,
                score: cluster.totalScore.toFixed(1),
                speakers: cluster.topSpeakers.slice(0, 3).map(([n]) => n),
                parties: cluster.topParties.slice(0, 3).map(([n]) => n),
                samples: sampleTexts.substring(0, 400)
            }));
            html += `<div class="inv-cluster-card">
                <div class="inv-cluster-header">
                    <span class="inv-cluster-icon">${cluster.icon}</span>
                    <div>
                        <div class="inv-cluster-name">${cluster.name}</div>
                        <div class="inv-cluster-meta">${cluster.speeches.length} wypowiedzi · score: ${cluster.totalScore.toFixed(1)}</div>
                    </div>
                    <button class="inv-investigate-btn" data-inv-cluster="${clusterDataAttr}" title="Wyślij do AI do zbadania">🔍 Zbadaj</button>
                </div>
                <div class="inv-cluster-bar-bg"><div class="inv-cluster-bar" style="width:${barPct}%;"></div></div>
                <div class="inv-cluster-details">
                    <span class="inv-cluster-detail">🎤 ${cluster.topSpeakers.map(([n, c]) => `${n} (${c})`).join(', ')}</span>
                    <span class="inv-cluster-detail">🏛️ ${cluster.topParties.map(([n, c]) => `${n} (${c})`).join(', ')}</span>
                </div>
            </div>`;
        });
    } else {
        html += '<div class="prediction-no-data">Nie wykryto klastrów narracyjnych</div>';
    }
    html += '</div>';

    // === Tab: Wzorce retoryczne ===
    html += '<div class="inv-tab-content" data-inv-tab-content="rhetoric">';
    if (results.rhetoricalPatterns.length) {
        html += '<div class="inv-rhetoric-list">';
        const maxRhetoric = Math.max(...results.rhetoricalPatterns.map(r => r.totalCount), 1);
        results.rhetoricalPatterns.forEach(rp => {
            const pct = (rp.totalCount / maxRhetoric) * 100;
            html += `<div class="inv-rhetoric-item">
                <div class="inv-rhetoric-label">${rp.label}</div>
                <div class="inv-rhetoric-bar-bg"><div class="inv-rhetoric-bar" style="width:${pct}%;"></div></div>
                <div class="inv-rhetoric-count">${rp.totalCount}×</div>
            </div>`;
        });
        html += '</div>';
    } else {
        html += '<div class="prediction-no-data">Nie wykryto wzorców retorycznych</div>';
    }
    html += '</div>';

    // === Tab: Motywy ===
    html += '<div class="inv-tab-content" data-inv-tab-content="motifs">';
    if (results.motifs.length) {
        html += '<div class="inv-motifs-grid">';
        results.motifs.forEach(m => {
            html += `<div class="inv-motif-chip ${m.crossParty ? 'inv-motif-cross' : ''}">
                <span class="inv-motif-phrase">"${m.phrase}"</span>
                <span class="inv-motif-count">${m.count}× · ${m.speakerCount} mówców</span>
                ${m.crossParty ? '<span class="inv-motif-badge">trans-partyjny</span>' : ''}
            </div>`;
        });
        html += '</div>';
    } else {
        html += '<div class="prediction-no-data">Za mało danych do wykrycia motywów</div>';
    }
    html += '</div>';

    // === Tab: Mapa pojęć ===
    html += '<div class="inv-tab-content" data-inv-tab-content="conceptmap">';
    html += '<div id="invConceptMapContainer" class="inv-concept-map-container"></div>';
    html += '</div>';

    // === Tab: Top oflagowane ===
    html += '<div class="inv-tab-content" data-inv-tab-content="topflagged">';
    if (results.topConspiracy.length) {
        results.topConspiracy.forEach((s, idx) => {
            const cats = Object.values(s.analysis.categories).map(c => c.label).join(', ');
            const sentColor = s.sentiment.score < -0.1 ? '#e74c3c' : s.sentiment.score > 0.1 ? '#27ae60' : '#f39c12';
            const flaggedDataAttr = encodeURIComponent(JSON.stringify({
                speaker: s.speaker,
                party: s.party,
                score: s.analysis.totalScore.toFixed(1),
                categories: cats,
                rhetoric: s.analysis.rhetoricalPatterns.map(r => r.label),
                text: s.text.substring(0, 500)
            }));
            html += `<div class="inv-flagged-card">
                <div class="inv-flagged-header">
                    <span class="inv-flagged-rank">#${idx + 1}</span>
                    <span class="inv-flagged-speaker">${s.speaker}</span>
                    <span class="inv-flagged-party">${s.party}</span>
                    <span class="inv-flagged-score" title="Investigation Score">🔥 ${s.analysis.totalScore.toFixed(1)}</span>
                    <span class="inv-flagged-sentiment" style="color:${sentColor};" title="Sentyment">${s.sentiment.label === 'positive' ? '😊' : s.sentiment.label === 'negative' ? '😠' : '😐'} ${s.sentiment.score.toFixed(2)}</span>
                    <button class="inv-investigate-btn" data-inv-flagged="${flaggedDataAttr}" title="Wyślij do AI do zbadania">🔍 Zbadaj</button>
                </div>
                <div class="inv-flagged-cats">${cats}</div>
                <div class="inv-flagged-text">"${s.text.substring(0, 300)}${s.text.length > 300 ? '...' : ''}"</div>
                ${s.analysis.rhetoricalPatterns.length ? `<div class="inv-flagged-rhetoric">Wzorce: ${s.analysis.rhetoricalPatterns.map(r => r.label).join(', ')}</div>` : ''}
            </div>`;
        });
    } else {
        html += '<div class="prediction-no-data">Brak oflagowanych wypowiedzi</div>';
    }
    html += '</div>';

    container.innerHTML = html;

    // Renderuj mapę pojęć po wstawieniu HTML
    setTimeout(() => {
        renderConceptMapSVG(results.conceptMap, 'invConceptMapContainer');
    }, 100);

    // Setup tabów
    container.querySelectorAll('.inv-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabId = tab.dataset.invTab;
            container.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
            container.querySelectorAll('.inv-tab-content').forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            container.querySelector(`[data-inv-tab-content="${tabId}"]`)?.classList.add('active');
        });
    });

    // AI report button → wysyła prompt do czatu AI
    const aiBtn = document.getElementById('invGenerateAIBtn');
    if (aiBtn) {
        aiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const prompt = buildFullReportPrompt(results);
            if (window.sendToAIChat) {
                window.sendToAIChat(prompt);
            } else {
                console.error('[InvestigationEngine] window.sendToAIChat not available');
            }
        });
    }

    // Cluster investigate buttons → wysyłają do czatu
    container.querySelectorAll('.inv-investigate-btn[data-inv-cluster]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                const data = JSON.parse(decodeURIComponent(btn.dataset.invCluster));
                const prompt = `🕵️ Investigation Engine — ZBADAJ KLASTER NARRACYJNY

Klaster: "${data.name}"
Liczba wypowiedzi: ${data.count}, Score: ${data.score}
Główni mówcy: ${data.speakers.join(', ')}
Partie: ${data.parties.join(', ')}

Przykładowe fragmenty:
${data.samples}

Przeanalizuj ten klaster narracyjny. Czy to uzasadniona krytyka, spekulacja, czy teoria spiskowa? Jakie wzorce retoryczne widzisz? Kto jest głównym narratorem? Czy ten temat pojawia się w kontekście rzeczywistych zdarzeń? Odpowiadaj po polsku, bądź wnikliwy ale obiektywny.`;
                if (window.sendToAIChat) {
                    window.sendToAIChat(prompt);
                }
            } catch (err) {
                console.error('[InvestigationEngine] Error parsing cluster data:', err);
            }
        });
    });

    // Flagged speech investigate buttons → wysyłają do czatu
    container.querySelectorAll('.inv-investigate-btn[data-inv-flagged]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                const data = JSON.parse(decodeURIComponent(btn.dataset.invFlagged));
                const prompt = `🕵️ Investigation Engine — ZBADAJ OFLAGOWANĄ WYPOWIEDŹ

Mówca: ${data.speaker} (${data.party})
Investigation Score: ${data.score}
Kategorie: ${data.categories}
${data.rhetoric.length ? 'Wzorce retoryczne: ' + data.rhetoric.join(', ') : ''}

Treść wypowiedzi:
"${data.text}"

Przeanalizuj tę wypowiedź. Czy zawiera elementy teorii spiskowej, manipulacji retorycznej, czy dezinformacji? A może to uzasadniona krytyka? Wskaż konkretne fragmenty i wyjaśnij dlaczego zostały oflagowane. Czy to błąd algorytmu czy rzeczywisty sygnał? Odpowiadaj po polsku.`;
                if (window.sendToAIChat) {
                    window.sendToAIChat(prompt);
                }
            } catch (err) {
                console.error('[InvestigationEngine] Error parsing flagged data:', err);
            }
        });
    });
}

/**
 * Buduj pełny prompt raportu AI do wysłania do czatu
 */
function buildFullReportPrompt(results) {
    let context = '🕵️ Investigation Engine — PEŁNY RAPORT\n\n';
    context += `Przeanalizowano ${results.totalAnalyzed} wypowiedzi, oflagowano ${results.flaggedCount} (${results.flaggedPct}%).\n\n`;

    context += '== WYKRYTE KLASTRY NARRACYJNE ==\n';
    results.clusters.forEach(c => {
        context += `• ${c.name}: ${c.speeches.length} wypowiedzi, score: ${c.totalScore.toFixed(1)}\n`;
        context += `  Top mówcy: ${c.topSpeakers.map(([n, c2]) => `${n} (${c2})`).join(', ')}\n`;
    });

    context += '\n== TOP OFLAGOWANE WYPOWIEDZI ==\n';
    results.topConspiracy.slice(0, 5).forEach(s => {
        const cats = Object.values(s.analysis.categories).map(c => c.label).join(', ');
        context += `• [${s.speaker}, ${s.party}] Score: ${s.analysis.totalScore.toFixed(1)} | ${cats}\n`;
        context += `  "${s.text.substring(0, 200)}..."\n\n`;
    });

    context += '== POWTARZAJĄCE SIĘ MOTYWY ==\n';
    results.motifs.slice(0, 10).forEach(m => {
        context += `• "${m.phrase}" — ${m.count}x, ${m.speakerCount} mówców${m.crossParty ? ' (trans-partyjny)' : ''}\n`;
    });

    context += '\n== WZORCE RETORYCZNE ==\n';
    results.rhetoricalPatterns.slice(0, 8).forEach(rp => {
        context += `• ${rp.label}: ${rp.totalCount}x\n`;
    });

    context += `\nNa podstawie tych danych wygeneruj raport detektywa-analityka z teoriami spiskowymi, ukrytymi powiązaniami, mistrzami retoryki i barometrem paranoi. Bądź ironiczny ale merytorycznie celny. Odpowiadaj po polsku.`;

    return context;
}
