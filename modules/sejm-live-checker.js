// Sejm Live Transmission Checker
// Sprawdza czy trwa transmisja na żywo z Sejmu

let pollInterval = null;
let lastKnownStatus = null;

/**
 * Sprawdza czy aktualna godzina mieści się w czasie pracy Sejmu
 * @returns {boolean}
 */
function isWorkingHours() {
    const hour = new Date().getHours();
    return hour >= 8 && hour <= 23;
}

/**
 * Sprawdza czy dzisiaj odbywa się posiedzenie Sejmu
 * @returns {Promise<boolean>}
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
        
        // Sprawdź czy któreś posiedzenie ma dzisiejszą datę
        const isLiveToday = proceedings.some(proceeding => {
            if (!proceeding.dates || !Array.isArray(proceeding.dates)) {
                return false;
            }
            return proceeding.dates.includes(today);
        });

        return isLiveToday;
    } catch (error) {
        console.error('[Sejm Live] Check failed:', error);
        return false;
    }
}

/**
 * Rozpoczyna periodyczne sprawdzanie statusu transmisji
 * @param {Function} callback - funkcja wywoływana przy zmianie statusu (otrzymuje boolean)
 * @param {number} intervalMinutes - częstotliwość sprawdzania w minutach (domyślnie: 5)
 */
export function startLivePolling(callback, intervalMinutes = 5) {
    if (pollInterval) {
        console.warn('[Sejm Live] Polling already running');
        return;
    }

    console.log(`[Sejm Live] Starting polling (every ${intervalMinutes} min)`);

    // Pierwsze sprawdzenie natychmiast
    checkSejmLive().then(isLive => {
        lastKnownStatus = isLive;
        if (callback) callback(isLive);
    });

    // Następne co N minut
    pollInterval = setInterval(async () => {
        const isLive = await checkSejmLive();
        
        // Wywołaj callback tylko jeśli status się zmienił
        if (isLive !== lastKnownStatus) {
            console.log(`[Sejm Live] Status changed: ${lastKnownStatus} → ${isLive}`);
            lastKnownStatus = isLive;
            if (callback) callback(isLive);
        }
    }, intervalMinutes * 60 * 1000);
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
 * @returns {boolean|null}
 */
export function getLastKnownStatus() {
    return lastKnownStatus;
}

// Export dla debugowania w konsoli
if (typeof window !== 'undefined') {
    window.checkSejmLive = checkSejmLive;
    window.startSejmLivePolling = startLivePolling;
    window.stopSejmLivePolling = stopLivePolling;
}
