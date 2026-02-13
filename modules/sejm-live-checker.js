// Sejm Live Transmission Checker
// Sprawdza czy trwa transmisja na żywo z Sejmu i pobiera szczegóły

let pollInterval = null;
let lastKnownStatus = null;
let lastLiveData = null;

/**
 * Sprawdza czy aktualna godzina mieści się w czasie pracy Sejmu
 * @returns {boolean}
 */
function isWorkingHours() {
    const hour = new Date().getHours();
    return hour >= 8 && hour <= 23;
}

/**
 * Pobiera szczegóły aktualnego posiedzenia
 * @param {number} proceedingNum - numer posiedzenia
 * @returns {Promise<Object|null>}
 */
async function getProceedingDetails(proceedingNum) {
    try {
        const response = await fetch(`https://api.sejm.gov.pl/sejm/term10/proceedings/${proceedingNum}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('[Sejm Live] Failed to get proceeding details:', error);
        return null;
    }
}

/**
 * Pobiera najnowsze głosowania z aktualnego posiedzenia
 * @param {number} proceedingNum - numer posiedzenia
 * @returns {Promise<Array>}
 */
async function getRecentVotings(proceedingNum) {
    try {
        const response = await fetch(`https://api.sejm.gov.pl/sejm/term10/votings/${proceedingNum}`);
        if (!response.ok) return [];
        const votings = await response.json();
        // Zwróć 3 ostatnie głosowania
        return votings.slice(-3).reverse();
    } catch (error) {
        console.error('[Sejm Live] Failed to get votings:', error);
        return [];
    }
}

/**
 * Pobiera najnowsze wypowiedzi z dzisiejszego stenogramu
 * @param {number} proceedingNum - numer posiedzenia
 * @param {string} date - data w formacie YYYY-MM-DD
 * @param {number} day - dzień posiedzenia
 * @returns {Promise<Array>}
 */
async function getRecentSpeakers(proceedingNum, date, day) {
    try {
        const response = await fetch(`https://api.sejm.gov.pl/sejm/term10/proceedings/${proceedingNum}/${date}/transcripts/${day}`);
        if (!response.ok) return [];
        const data = await response.json();
        
        // Wyciągnij ostatnie wypowiedzi
        const speakers = [];
        if (data.statement && Array.isArray(data.statement)) {
            // Pobierz ostatnie 5 wypowiedzi
            const recent = data.statement.slice(-5).reverse();
            for (const stmt of recent) {
                if (stmt.speakerName) {
                    speakers.push({
                        name: stmt.speakerName,
                        role: stmt.speakerFunction || 'Poseł',
                        time: stmt.startDateTime || null
                    });
                }
            }
        }
        return speakers;
    } catch (error) {
        console.error('[Sejm Live] Failed to get speakers:', error);
        return [];
    }
}

/**
 * Sprawdza czy dzisiaj odbywa się posiedzenie Sejmu i pobiera szczegóły
 * @returns {Promise<Object|boolean>} - obiekt z danymi live lub false
 */
export async function checkSejmLive() {
    try {
        // Sprawdź godziny pracy - jeśli poza nimi, nie ma sensu odpytywać API
        if (!isWorkingHours()) {
            return false;
        }

        const today = new Date().toISOString().split('T')[0];
        
        // Pobierz listę posiedzeń z bieżącej kadencji
        const response = await fetch('https://api.sejm.gov.pl/sejm/term10/proceedings');
        
        if (!response.ok) {
            console.warn('[Sejm Live] API error:', response.status);
            return false;
        }

        const proceedings = await response.json();
        
        // Znajdź posiedzenie dzisiejsze
        let currentProceeding = null;
        let dayNumber = 1;
        
        for (const proc of proceedings) {
            if (!proc.dates || !Array.isArray(proc.dates)) continue;
            
            const todayIndex = proc.dates.indexOf(today);
            if (todayIndex !== -1) {
                currentProceeding = proc;
                dayNumber = todayIndex + 1;
                break;
            }
        }
        
        if (!currentProceeding) {
            return false; // Brak posiedzenia dzisiaj
        }

        // Pobierz szczegóły posiedzenia
        const details = await getProceedingDetails(currentProceeding.num);
        console.log('[Sejm Live] Proceeding details:', details);
        
        // Pobierz najnowsze głosowania
        const recentVotings = await getRecentVotings(currentProceeding.num);
        console.log('[Sejm Live] Recent votings:', recentVotings.length, 'votes');
        
        // Pobierz ostatnich mówców
        const recentSpeakers = await getRecentSpeakers(currentProceeding.num, today, dayNumber);
        console.log('[Sejm Live] Recent speakers:', recentSpeakers.length, 'speakers');
        
        // Zwróć pełny obiekt z danymi
        const liveData = {
            isLive: true,
            proceeding: {
                num: currentProceeding.num,
                title: currentProceeding.title || `Posiedzenie ${currentProceeding.num}`,
                dates: currentProceeding.dates,
                currentDay: dayNumber,
                totalDays: currentProceeding.dates.length
            },
            agenda: details?.agenda || [],
            recentVotings: recentVotings.map(v => ({
                votingNumber: v.votingNumber,
                topic: v.topic || 'Głosowanie',
                yes: v.yes || 0,
                no: v.no || 0,
                abstain: v.abstain || 0,
                time: v.date || null
            })),
            recentSpeakers: recentSpeakers,
            lastUpdate: new Date().toISOString()
        };
        
        console.log('[Sejm Live] Full live data:', liveData);
        lastLiveData = liveData;
        return liveData;
        
    } catch (error) {
        console.error('[Sejm Live] Check failed:', error);
        return false;
    }
}

/**
 * Rozpoczyna periodyczne sprawdzanie statusu transmisji
 * @param {Function} callback - funkcja wywoływana przy zmianie statusu (otrzymuje obiekt z danymi lub false)
 * @param {number} intervalMinutes - częstotliwość sprawdzania w minutach (domyślnie: 5)
 */
export function startLivePolling(callback, intervalMinutes = 5) {
    if (pollInterval) {
        console.warn('[Sejm Live] Polling already running');
        return;
    }

    console.log(`[Sejm Live] Starting polling (every ${intervalMinutes} min)`);

    // Pierwsze sprawdzenie natychmiast
    checkSejmLive().then(liveData => {
        lastKnownStatus = liveData;
        lastLiveData = liveData;
        if (callback) callback(liveData);
    });

    // Następne co N minut
    pollInterval = setInterval(async () => {
        const liveData = await checkSejmLive();
        
        // Wywołaj callback jeśli status się zmienił lub są nowe dane
        const isLiveNow = !!liveData;
        const wasLive = !!lastKnownStatus;
        
        if (isLiveNow !== wasLive || (isLiveNow && hasDataChanged(lastKnownStatus, liveData))) {
            console.log('[Sejm Live] Data updated');
            lastKnownStatus = liveData;
            lastLiveData = liveData;
            if (callback) callback(liveData);
        }
    }, intervalMinutes * 60 * 1000);
}

/**
 * Sprawdza czy dane live się zmieniły (nowe głosowania, mówcy)
 */
function hasDataChanged(oldData, newData) {
    if (!oldData || !newData) return true;
    
    // Porównaj liczbę głosowań
    const oldVotings = oldData.recentVotings?.length || 0;
    const newVotings = newData.recentVotings?.length || 0;
    if (oldVotings !== newVotings) return true;
    
    // Porównaj ostatniego mówcę
    const oldSpeaker = oldData.recentSpeakers?.[0]?.name;
    const newSpeaker = newData.recentSpeakers?.[0]?.name;
    if (oldSpeaker !== newSpeaker) return true;
    
    return false;
}

/**
 * Zatrzymuje periodyczne sprawdzanie statusu transmisji
 */
export function stopLivePolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        lastKnownStatus = null;
        console.log('[Sejm Live] Polling stopped');
    }
}

/**
 * Pobiera ostatni znany status (bez odpytywania API)
 * @returns {Object|boolean|null} - obiekt z danymi live, false (brak transmisji) lub null (nie sprawdzano)
 */
export function getLastKnownStatus() {
    return lastKnownStatus;
}

/**
 * Pobiera ostatnie dane live
 * @returns {Object|null}
 */
export function getLastLiveData() {
    return lastLiveData;
}

// Export dla debugowania w konsoli
if (typeof window !== 'undefined') {
    window.checkSejmLive = checkSejmLive;
    window.startSejmLivePolling = startLivePolling;
    window.stopSejmLivePolling = stopLivePolling;
}
