// Models handler - obsługa ładowania modeli AI
import { initNLP, analyzeSentiment, analyzeTopics } from './modules/nlp.js';
import { initWebLLM, generateSummary, compareSpeeches } from './modules/webllm.js';

// Stan modeli
const state = {
    modelsLoaded: {
        webllm: false,
        transformers: false
    }
};

// Inicjalizacja po załadowaniu DOM
// Deduplication check to prevent duplicate initialization
if (!window.__modelsInitialized) {
    window.__modelsInitialized = true;
    document.addEventListener('DOMContentLoaded', () => {
        initUI();
        setupEventListeners();
    });
}

function initUI() {
    console.log('🤖 Models handler uruchomiony');
    updateModelStatus('webllmStatus', 'inactive');
    updateModelStatus('transformersStatus', 'inactive');
}

function setupEventListeners() {
    // Ładowanie modeli
    const loadModelsBtn = document.getElementById('loadModels');
    if (loadModelsBtn) loadModelsBtn.addEventListener('click', handleLoadModels);
    
    // Przyciski analiz
    const analyzeSentimentBtn = document.getElementById('analyzeSentiment');
    const analyzeTopicsBtn = document.getElementById('analyzeTopics');
    const generateSummaryBtn = document.getElementById('generateSummary');
    const compareSpeechesBtn = document.getElementById('compareSpeeches');
    
    if (analyzeSentimentBtn) analyzeSentimentBtn.addEventListener('click', () => runAnalysis('sentiment'));
    if (analyzeTopicsBtn) analyzeTopicsBtn.addEventListener('click', () => runAnalysis('topics'));
    if (generateSummaryBtn) generateSummaryBtn.addEventListener('click', () => runAnalysis('summary'));
    if (compareSpeechesBtn) compareSpeechesBtn.addEventListener('click', () => runAnalysis('compare'));
}

// Ładowanie modeli AI
async function handleLoadModels() {
    const btn = document.getElementById('loadModels');
    btn.disabled = true;
    btn.textContent = 'Ładowanie modeli...';
    
    try {
        // Ładowanie Transformers.js
        updateModelStatus('transformersStatus', 'loading');
        await initNLP();
        state.modelsLoaded.transformers = true;
        updateModelStatus('transformersStatus', 'ready');
        
        // Ładowanie WebLLM
        updateModelStatus('webllmStatus', 'loading');
        await initWebLLM();
        state.modelsLoaded.webllm = true;
        updateModelStatus('webllmStatus', 'ready');
        
        enableAnalysisButtons();
        btn.textContent = '✅ Modele załadowane';
        
    } catch (error) {
        console.error('❌ Błąd ładowania modeli:', error);
        showError('Nie udało się załadować modeli AI');
        btn.disabled = false;
        btn.textContent = 'Spróbuj ponownie';
    }
}

// Uruchamianie analiz
async function runAnalysis(type) {
    // Sprawdź czy dane są w bazie
    const { db2 } = await import('./modules/database-v2.js');
    
    if (!db2.database) {
        showError('Najpierw pobierz dane z API!');
        return;
    }
    
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<p>⏳ Analiza w toku...</p>';
    
    try {
        // Pobierz dane z bazy
        const data = db2.database.exec('SELECT * FROM wypowiedzi LIMIT 100');
        
        if (!data || data.length === 0) {
            showError('Brak danych w bazie. Najpierw pobierz dane z API!');
            return;
        }
        
        let results;
        
        switch(type) {
            case 'sentiment':
                results = await analyzeSentiment(data);
                break;
            case 'topics':
                results = await analyzeTopics(data);
                break;
            case 'summary':
                results = await generateSummary(data);
                break;
            case 'compare':
                results = await compareSpeeches(data);
                break;
        }
        
        displayResults(results, type);
        
    } catch (error) {
        console.error('❌ Błąd analizy:', error);
        showError('Wystąpił błąd podczas analizy');
    }
}

// Wyświetlanie wyników
function displayResults(results, type) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <h3>Wyniki: ${type}</h3>
        <pre>${JSON.stringify(results, null, 2)}</pre>
    `;
}

// Funkcje pomocnicze UI
function updateModelStatus(elementId, status) {
    const statusElement = document.getElementById(elementId);
    if (!statusElement) return;
    
    const statusMap = {
        'inactive': { text: '⏳ Nieaktywny', color: '#94a3b8' },
        'loading': { text: '⏳ Ładowanie...', color: '#f59e0b' },
        'ready': { text: '✅ Gotowy', color: '#10b981' },
        'error': { text: '❌ Błąd', color: '#ef4444' }
    };
    
    const { text, color } = statusMap[status];
    statusElement.textContent = text;
    statusElement.style.backgroundColor = color + '20';
    statusElement.style.color = color;
}

function enableAnalysisButtons() {
    const buttons = document.querySelectorAll('.analysis-buttons .btn');
    buttons.forEach(btn => btn.disabled = false);
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<p style="color: var(--danger-color);">❌ ${message}</p>`;
}
