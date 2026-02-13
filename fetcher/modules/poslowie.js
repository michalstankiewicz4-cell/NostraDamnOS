// Module: poslowie.js
// Fetches deputies list (Sejm) with extended functionality

import { safeFetch } from '../fetcher.js';

/**
 * Pobiera listę posłów
 */
export async function fetchPoslowie({ kadencja = 10, typ = 'sejm' }) {
    if (typ !== 'sejm') {
        console.warn('[poslowie] Senators list not implemented yet');
        return [];
    }

    const url = `https://api.sejm.gov.pl/sejm/term${kadencja}/MP`;

    try {
        return await safeFetch(url);
    } catch (e) {
        console.warn(`[Poslowie] Failed:`, e.message);
        return [];
    }
}

/**
 * Pobiera pojedynczego posła po ID
 * @param {number|string} id - ID posła
 * @param {Object} config - Konfiguracja (kadencja, typ)
 * @returns {Promise<Object|null>} Dane posła lub null
 */
export async function fetchPosel(id, { kadencja = 10, typ = 'sejm' } = {}) {
    if (typ !== 'sejm') {
        console.warn('[poslowie] Senators not implemented yet');
        return null;
    }

    const url = `https://api.sejm.gov.pl/sejm/term${kadencja}/MP/${id}`;

    try {
        return await safeFetch(url);
    } catch (e) {
        console.warn(`[Poslowie] Failed to fetch MP ${id}:`, e.message);
        return null;
    }
}

/**
 * Pobiera interpelacje konkretnego posła
 * 
 * @param {number|string} poselId - ID posła
 * @param {Object} config - Konfiguracja (kadencja, typ)
 * @returns {Promise<Array>} Interpelacje posła
 */
export async function getPoselInterpelacje(poselId, config = {}) {
    const { kadencja = 10, typ = 'sejm' } = config;
    
    // Pobierz wszystkie interpelacje
    const interpelacje = await fetchInterpelacje({ kadencja, typ });
    
    // Filtruj po posle
    return findInterpelacjeByPosel(interpelacje, poselId);
}

/**
 * Znajduje posła po nazwisku
 * 
 * @param {Array} poslowie - Tablica posłów
 * @param {string} lastName - Nazwisko posła
 * @param {boolean} exact - Czy szukać dokładnego dopasowania (default: false)
 * @returns {Array} Znalezieni posłowie
 */
export function findPoselByLastName(poslowie, lastName, exact = false) {
    const searchTerm = lastName.toLowerCase();
    
    return poslowie.filter(posel => {
        const poselLastName = posel.lastName.toLowerCase();
        
        if (exact) {
            return poselLastName === searchTerm;
        } else {
            return poselLastName.includes(searchTerm);
        }
    });
}

/**
 * Znajduje posłów z danego klubu
 * 
 * @param {Array} poslowie - Tablica posłów
 * @param {string} clubName - Nazwa klubu (np. "PiS", "KO")
 * @returns {Array} Posłowie z klubu
 */
export function findPoslowieByClub(poslowie, clubName) {
    return poslowie.filter(posel => posel.club === clubName);
}

/**
 * Znajduje posłów z danego okręgu
 * 
 * @param {Array} poslowie - Tablica posłów
 * @param {number} districtNum - Numer okręgu
 * @returns {Array} Posłowie z okręgu
 */
export function findPoslowieByDistrict(poslowie, districtNum) {
    return poslowie.filter(posel => posel.districtNum === districtNum);
}

/**
 * Grupuje posłów według klubów
 * 
 * @param {Array} poslowie - Tablica posłów
 * @returns {Object} Obiekt z klubami jako kluczami
 */
export function groupPoslowieByClub(poslowie) {
    const grouped = {};
    
    poslowie.forEach(posel => {
        const club = posel.club || 'Nieokreślony';
        if (!grouped[club]) {
            grouped[club] = [];
        }
        grouped[club].push(posel);
    });
    
    return grouped;
}

/**
 * Analizuje statystyki posłów
 * 
 * @param {Array} poslowie - Tablica posłów
 * @returns {Object} Statystyki posłów
 */
export function analyzePoslowie(poslowie) {
    const stats = {
        total: poslowie.length,
        active: 0,
        inactive: 0,
        byClub: {},
        byVoivodeship: {},
        avgVotes: 0,
        educationLevels: {}
    };
    
    let totalVotes = 0;
    
    poslowie.forEach(posel => {
        // Aktywność
        if (posel.active) {
            stats.active++;
        } else {
            stats.inactive++;
        }
        
        // Kluby
        const club = posel.club || 'Nieokreślony';
        if (!stats.byClub[club]) {
            stats.byClub[club] = 0;
        }
        stats.byClub[club]++;
        
        // Województwa
        const voivodeship = posel.voivodeship || 'Nieokreślone';
        if (!stats.byVoivodeship[voivodeship]) {
            stats.byVoivodeship[voivodeship] = 0;
        }
        stats.byVoivodeship[voivodeship]++;
        
        // Głosy
        if (posel.numberOfVotes) {
            totalVotes += posel.numberOfVotes;
        }
        
        // Wykształcenie
        const education = posel.educationLevel || 'Nieokreślone';
        if (!stats.educationLevels[education]) {
            stats.educationLevels[education] = 0;
        }
        stats.educationLevels[education]++;
    });
    
    // Średnia liczba głosów
    if (poslowie.length > 0) {
        stats.avgVotes = Math.round(totalVotes / poslowie.length);
    }
    
    return stats;
}
