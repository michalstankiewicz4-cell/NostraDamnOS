// Główna logika aplikacji
import { parseJSONL, countWords, displayFileInfo } from './modules/utils.js';
import { initNLP, analyzeSentiment, analyzeTopics } from './modules/nlp.js';
import { initWebLLM, generateSummary, compareSpeeches } from './modules/webllm.js';
import { dataLoader } from './modules/data-loader.js';

// Stan aplikacji
const state = {
    data: null,
    allData: null, // Wszystkie dane z data-loader
    modelsLoaded: {
        webllm: false,
        transformers: false
    }
};

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    setupEventListeners();
});

function initUI() {
    console.log('🚀 Aplikacja uruchomiona');
    updateModelStatus('webllmStatus', 'inactive');
    updateModelStatus('transformersStatus', 'inactive');
}

function setupEventListeners() {
    // Legacy buttons - zakomentowane (nie istnieją w nowym UI)
    /*
    const loadDataBtn = document.getElementById('loadDataBtn');
    if (loadDataBtn) loadDataBtn.addEventListener('click', handleAutoLoadData);
    
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);
    */
    
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

// Automatyczne ładowanie danych z serwera
async function handleAutoLoadData() {
    const btn = document.getElementById('loadDataBtn');
    const statusDiv = document.getElementById('dataStatus');
    
    btn.disabled = true;
    btn.textContent = '⏳ Ładowanie...';
    statusDiv.innerHTML = '';
    
    try {
        // Wczytaj wszystkie dane
        await dataLoader.loadAll((progress) => {
            statusDiv.innerHTML = `
                <div class="progress-info">
                    <p>📥 Wczytywanie: ${progress.file}</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.progress}%"></div>
                    </div>
                    <p>${progress.current} / ${progress.total} plików</p>
                </div>
            `;
        });
        
        // Zapisz dane w stanie
        state.allData = dataLoader.getData();
        state.data = state.allData.wypowiedzi; // Domyślnie wypowiedzi
        
        // Wyświetl statystyki
        const stats = dataLoader.getStats();
        statusDiv.innerHTML = `
            <div class="data-loaded">
                <h4>✅ Dane załadowane pomyślnie!</h4>
                <ul>
                    <li>📊 Posłowie: ${stats.poslowie?.count || 0}</li>
                    <li>📅 Posiedzenia: ${stats.posiedzenia?.count || 0}</li>
                    <li>💬 Wypowiedzi: ${stats.wypowiedzi?.count || 0}</li>
                    <li>🗳️ Głosowania: ${stats.glosowania?.count || 0}</li>
                    <li>✅ Głosy: ${stats.glosy?.count || 0}</li>
                </ul>
            </div>
        `;
        
        btn.textContent = '✅ Dane wczytane';
        console.log('✅ Wszystkie dane załadowane:', state.allData);
        
    } catch (error) {
        console.error('❌ Błąd ładowania danych:', error);
        statusDiv.innerHTML = `
            <p style="color: var(--danger-color);">
                ❌ Nie udało się wczytać danych. Upewnij się, że pliki są dostępne w folderze /data/
            </p>
        `;
        btn.disabled = false;
        btn.textContent = 'Spróbuj ponownie';
    }
}

// Obsługa ręcznego wczytywania pliku
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        state.data = parseJSONL(text);
        
        displayFileInfo(file.name, state.data.length);
        console.log(`✅ Wczytano ${state.data.length} wypowiedzi`);
        
    } catch (error) {
        console.error('❌ Błąd wczytywania pliku:', error);
        showError('Nie udało się wczytać pliku. Sprawdź format JSONL.');
    }
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
    if (!state.data) {
        showError('Najpierw wczytaj dane!');
        return;
    }
    
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<p>⏳ Analiza w toku...</p>';
    
    try {
        let results;
        
        switch(type) {
            case 'sentiment':
                results = await analyzeSentiment(state.data);
                break;
            case 'topics':
                results = await analyzeTopics(state.data);
                break;
            case 'summary':
                results = await generateSummary(state.data);
                break;
            case 'compare':
                results = await compareSpeeches(state.data);
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
