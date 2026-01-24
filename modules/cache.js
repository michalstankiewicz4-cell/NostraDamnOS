// modules/cache-v2.js
// Lekki cache - tylko metadane, pełne dane w SQLite

export class CacheManager {
    constructor() {
        this.CACHE_KEY = 'parliament_cache';
        this.CACHE_DURATION = {
            deputies: 7 * 24 * 60 * 60 * 1000,    // 7 dni
            proceedings: 24 * 60 * 60 * 1000      // 1 dzień
        };
    }

    // Pobierz cache z localStorage
    getCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            console.error('❌ Cache parse error:', e.message);
            return null;
        }
    }

    // Zapisz cache (tylko metadane, bez pełnych tekstów)
    saveCache(data) {
        const lightCache = {
            deputies: data.deputies,
            proceedings: data.proceedings,
            fetchedSittings: data.fetchedSittings || [],
            range: data.range || 1,
            hasFetchedTranscripts: data.hasFetchedTranscripts || false,
            hasFetchedVotings: data.hasFetchedVotings || false,
            deputiesTimestamp: new Date().toISOString(),
            proceedingsTimestamp: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };
        
        const jsonStr = JSON.stringify(lightCache);
        localStorage.setItem(this.CACHE_KEY, jsonStr);
        
        console.log(`💾 Cache zapisany: ${lightCache.fetchedSittings.length} posiedzeń, ` +
                   `range=${lightCache.range}, size=${(jsonStr.length / 1024).toFixed(1)}KB`);
    }

    // Sprawdź czy dane są świeże
    isFresh(cachedTimestamp, type) {
        if (!cachedTimestamp) return false;
        
        const age = Date.now() - new Date(cachedTimestamp).getTime();
        const maxAge = this.CACHE_DURATION[type];
        
        return age < maxAge;
    }

    // Sprawdź czy posiedzenie zostało pobrane
    hasSitting(sittingNum) {
        const cache = this.getCache();
        return cache?.fetchedSittings?.includes(sittingNum) || false;
    }

    // Sprawdź zakres cache
    getCachedRange() {
        const cache = this.getCache();
        return cache?.range || 0;
    }

    // Strategia pobierania - nowa architektura
    async getPlan(apiFetcher, requestedRange, needTranscripts, needVotings) {
        const cache = this.getCache();
        const plan = {
            needDeputies: true,
            needProceedings: true,
            sittingsToFetch: null,  // null = trzeba ustalić po pobraniu proceedings
            useCache: false,
            cachedDeputies: null,
            cachedProceedings: null
        };
        
        if (!cache) {
            console.log('📥 Brak cache - pobieranie wszystkiego');
            return plan;
        }
        
        // Sprawdź posłów
        if (cache.deputies && this.isFresh(cache.deputiesTimestamp, 'deputies')) {
            console.log('✅ Posłowie z cache (skip)');
            plan.needDeputies = false;
            plan.cachedDeputies = cache.deputies;
        }
        
        // Sprawdź posiedzenia
        if (cache.proceedings && this.isFresh(cache.proceedingsTimestamp, 'proceedings')) {
            console.log('✅ Posiedzenia z cache');
            plan.needProceedings = false;
            plan.cachedProceedings = cache.proceedings;
            
            // Sprawdź które posiedzenia trzeba pobrać
            const sorted = cache.proceedings.sort((a, b) => b.number - a.number);
            const targetProceedings = sorted.slice(0, requestedRange);
            const targetNums = new Set(targetProceedings.map(p => p.number));
            
            // Które posiedzenia nie mamy w SQLite?
            const missing = [];
            const fetchedSet = new Set(cache.fetchedSittings || []);
            
            for (const num of targetNums) {
                // Sprawdź czy to posiedzenie było kiedykolwiek pobrane
                const wasFetched = fetchedSet.has(num);
                
                // Jeśli nie było pobrane W OGÓLE - dodaj do missing
                if (!wasFetched) {
                    missing.push(num);
                    continue;
                }
                
                // Jeśli było pobrane, sprawdź czy user chce nowy typ danych
                const needsNewTranscripts = needTranscripts && !cache.hasFetchedTranscripts;
                const needsNewVotings = needVotings && !cache.hasFetchedVotings;
                
                if (needsNewTranscripts || needsNewVotings) {
                    missing.push(num);
                }
            }
            
            plan.sittingsToFetch = missing;
            console.log(`📊 Posiedzenia do pobrania: ${missing.length}/${targetProceedings.length}`);
        }
        
        plan.useCache = !plan.needDeputies || !plan.needProceedings;
        return plan;
    }

    // Wyczyść cache
    clear() {
        localStorage.removeItem(this.CACHE_KEY);
        console.log('🗑️  Cache wyczyszczony');
    }
}

export const cache = new CacheManager();
