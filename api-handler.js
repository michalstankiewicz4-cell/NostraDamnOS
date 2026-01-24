// Obsługa pobierania z API + Cache + SQLite
import { apiFetcher } from './modules/api-fetcher.js';
import { normalizer } from './modules/normalizer.js';
import { db } from './modules/database.js';
import { cache } from './modules/cache.js';

let isFetching = false;
let shouldCancel = false;

function showError(msg) {
    alert(msg);
    console.error(msg);
}

// Inicjalizacja SQLite przy starcie
let dbInitialized = false;
async function ensureDbInit() {
    if (!dbInitialized) {
        await db.init();
        dbInitialized = true;
    }
}

// Przycisk główny
document.getElementById('apiFetchBtn').addEventListener('click', async () => {
    if (isFetching) return;
    
    const range = parseInt(document.getElementById('apiRange').value);
    const getTranscripts = document.getElementById('apiTranscripts').checked;
    const getVotings = document.getElementById('apiVotings').checked;
    
    if (!getTranscripts && !getVotings) {
        showError('Wybierz przynajmniej jeden rodzaj danych!');
        return;
    }
    
    if (!range || range < 1 || range > 50) {
        showError('Nieprawidłowy zakres posiedzeń!');
        return;
    }
    
    await startFetching(range, getTranscripts, getVotings);
});

async function startFetching(range, getTranscripts, getVotings) {
    const btn = document.getElementById('apiFetchBtn');
    const progress = document.getElementById('apiProgress');
    const progressBar = document.getElementById('apiProgressBar');
    const progressText = document.getElementById('apiProgressText');
    const logs = document.getElementById('apiLogs');
    const status = document.getElementById('apiStatus');
    const statusDetails = document.getElementById('apiStatusDetails');
    
    function log(msg, type = 'info') {
        const div = document.createElement('div');
        div.style.color = type === 'error' ? '#e53e3e' : type === 'warning' ? '#d69e2e' : type === 'success' ? '#38a169' : '#3182ce';
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logs.appendChild(div);
        logs.scrollTop = logs.scrollHeight;
        console.log(msg);
    }
    
    function updateProgress(pct, text) {
        progressBar.style.width = pct + '%';
        progressText.textContent = text;
    }
    
    isFetching = true;
    shouldCancel = false;
    btn.disabled = true;
    btn.textContent = 'Anuluj';
    progress.style.display = 'block';
    logs.innerHTML = '';
    status.style.display = 'none';
    
    btn.onclick = () => {
        shouldCancel = true;
        log('⚠️  Anulowanie...', 'warning');
    };
    
    try {
        const startTime = Date.now();
        
        // Inicjalizuj SQLite
        await ensureDbInit();
        log('✅ SQLite zainicjalizowane');
        
        // Sprawdź plan cache
        log('🔍 Sprawdzanie cache...');
        const plan = await cache.getPlan(apiFetcher, range, getTranscripts, getVotings);
        updateProgress(5, 'Planowanie...');
        
        // Pobierz posłów
        let deputies;
        if (plan.needDeputies) {
            log('📥 Pobieranie posłów z API (10 kadencja)...');
            deputies = await apiFetcher.fetchDeputies(10);
            log(`✅ Pobrano ${deputies.length} posłów`, 'success');
        } else {
            deputies = plan.cachedDeputies;
            log(`✅ Posłowie z cache (${deputies.length})`, 'success');
        }
        updateProgress(15, `Posłowie: ${deputies.length}`);
        
        // Pobierz posiedzenia
        let proceedings;
        if (plan.needProceedings) {
            log('📥 Pobieranie listy posiedzeń (10 kadencja)...');
            proceedings = await apiFetcher.fetchProceedings(10);
            log(`✅ Pobrano ${proceedings.length} posiedzeń`, 'success');
        } else {
            proceedings = plan.cachedProceedings;
            log(`✅ Posiedzenia z cache (${proceedings.length})`, 'success');
        }
        updateProgress(25, 'Wybór posiedzeń...');
        
        // Wybierz ostatnie N posiedzeń
        const sorted = proceedings.sort((a, b) => b.number - a.number);
        const targetProceedings = sorted.slice(0, range);
        const targetNums = new Set(targetProceedings.map(p => p.number));
        
        log(`🎯 Wybrano ostatnie ${range} posiedzeń: ${Array.from(targetNums).sort((a,b) => a-b).join(', ')}`);
        
        // Sprawdź które musimy pobrać
        // null = wszystkie (pierwsze uruchomienie), [] = żadne (wszystko w cache)
        const sittingsToFetch = plan.sittingsToFetch === null ? Array.from(targetNums) : plan.sittingsToFetch;
        
        let allStatements = [];
        let allVotings = [];
        
        if (sittingsToFetch.length > 0) {
            log(`📥 Pobieranie danych z ${sittingsToFetch.length} posiedzeń...`);
            
            // Pobierz wypowiedzi i głosowania
            for (let i = 0; i < sittingsToFetch.length; i++) {
                if (shouldCancel) throw new Error('Anulowano przez użytkownika');
                
                const sittingNum = sittingsToFetch[i];
                const proc = targetProceedings.find(p => p.number === sittingNum);
                
                updateProgress(30 + (i / sittingsToFetch.length) * 50, 
                              `Posiedzenie ${sittingNum} (${i+1}/${sittingsToFetch.length})`);
                
                if (getTranscripts) {
                    log(`📖 Pobieranie wypowiedzi z posiedzenia ${sittingNum}...`);
                    const statements = await apiFetcher.fetchStatements(10, sittingNum);
                    allStatements.push(...statements);
                }
                
                if (getVotings) {
                    log(`🗳️  Pobieranie głosowań z posiedzenia ${sittingNum}...`);
                    const votings = await apiFetcher.fetchVotings(10, sittingNum);
                    allVotings.push(...votings);
                }
            }
        } else {
            log('✅ Wszystkie dane w cache/SQLite - pomijam API', 'success');
        }
        
        updateProgress(80, 'Normalizacja danych...');
        
        // Normalizacja tylko nowo pobranych
        let normalizedStatements = [];
        if (allStatements.length > 0) {
            log('🔄 Normalizacja wypowiedzi...');
            normalizer.loadDeputies(deputies);
            normalizedStatements = normalizer.normalizeAll(allStatements);
            log(`✅ Znormalizowano ${normalizedStatements.length} wypowiedzi`, 'success');
        }
        
        updateProgress(85, 'Zapisywanie do SQLite...');
        
        // Zapisz nowe dane do SQLite
        if (deputies.length > 0 && !plan.cachedDeputies) {
            log('💾 Zapisywanie posłów do SQLite...');
            await db.insertDeputies(deputies);
        }
        
        if (normalizedStatements.length > 0) {
            log(`💾 Zapisywanie ${normalizedStatements.length} wypowiedzi do SQLite...`);
            await db.insertStatements(normalizedStatements);
        }
        
        updateProgress(90, 'Aktualizacja cache...');
        
        // Zaktualizuj cache (tylko metadane!)
        const newFetchedSittings = [...new Set([
            ...(cache.getCache()?.fetchedSittings || []),
            ...sittingsToFetch
        ])];
        
        cache.saveCache({
            deputies: deputies,
            proceedings: proceedings,
            fetchedSittings: newFetchedSittings,
            range: range,
            hasFetchedTranscripts: getTranscripts,
            hasFetchedVotings: getVotings
        });
        
        updateProgress(95, 'Pobieranie z SQLite...');
        
        // Pobierz wszystkie dane z SQLite dla wybranych posiedzeń
        log('📊 Pobieranie danych z SQLite...');
        const sittingsList = Array.from(targetNums).join(',');
        const finalStatements = await db.query(
            `SELECT * FROM statements WHERE sitting IN (${sittingsList}) ORDER BY date, id`
        );
        
        updateProgress(100, 'Gotowe!');
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const dbStats = db.getStats();
        
        // Pokaż statystyki
        status.style.display = 'block';
        statusDetails.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                <div>
                    <div style="font-size: 2rem; font-weight: bold; color: #3182ce;">${deputies.length}</div>
                    <div style="color: #718096;">Posłów</div>
                </div>
                <div>
                    <div style="font-size: 2rem; font-weight: bold; color: #3182ce;">${targetProceedings.length}</div>
                    <div style="color: #718096;">Posiedzeń</div>
                </div>
                <div>
                    <div style="font-size: 2rem; font-weight: bold; color: #38a169;">${finalStatements.length}</div>
                    <div style="color: #718096;">Wypowiedzi (SQLite)</div>
                </div>
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                <p><strong>Czas:</strong> ${elapsed}s</p>
                <p><strong>SQLite:</strong> ${dbStats.totalStatements} wypowiedzi, ${dbStats.matchedSpeakers} dopasowanych</p>
                <p><strong>Cache:</strong> ${newFetchedSittings.length} posiedzeń w pamięci</p>
                ${sittingsToFetch.length === 0 ? '<p style="color: #38a169;">✅ Wszystkie dane z cache - brak pobierania z API!</p>' : ''}
            </div>
        `;
        
        log(`✅ Zakończono w ${elapsed}s`, 'success');
        log(`📊 SQLite: ${dbStats.totalStatements} wypowiedzi, ${dbStats.matchedSpeakers} dopasowanych`, 'info');
        
    } catch (err) {
        log(`❌ Błąd: ${err.message}`, 'error');
        showError(err.message);
    } finally {
        isFetching = false;
        btn.disabled = false;
        btn.textContent = 'Pobierz dane z API';
        btn.onclick = null;
    }
}

// Wyczyść cache
document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
    if (confirm('Wyczyścić cache? (SQLite pozostanie niezmienione)')) {
        cache.clear();
        alert('Cache wyczyszczony!');
    }
});

// Eksport bazy SQLite
document.getElementById('exportDbBtn')?.addEventListener('click', () => {
    const blob = db.export();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parliament-${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
});
