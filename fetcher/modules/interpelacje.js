// Module: interpelacje.js
// Fetches interpellations with helper functions

import { safeFetch } from '../fetcher.js';

/**
 * Pobiera pojedynczą interpelację po numerze
 * @param {number|string} num - Numer interpelacji
 * @param {Object} config - Konfiguracja (kadencja, typ)
 * @returns {Promise<Object|null>} Dane interpelacji lub null
 */
export async function fetchInterpelacja(num, { kadencja, typ = 'sejm' } = {}) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/interpellations/${num}`;

    try {
        const data = await safeFetch(url);
        return data || null;
    } catch (e) {
        console.warn(`[Interpelacje] Failed to fetch interpellation ${num}:`, e.message);
        return null;
    }
}

/**
 * Pobiera wszystkie interpelacje dla danej kadencji (z paginacją)
 */
export async function fetchInterpelacje({ kadencja, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const pageSize = 500;
    let allResults = [];
    let offset = 0;

    try {
        while (true) {
            const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/interpellations?limit=${pageSize}&offset=${offset}`;
            const data = await safeFetch(url);
            const batch = Array.isArray(data) ? data : [];

            if (batch.length === 0) break;

            allResults = allResults.concat(batch);
            console.log(`[Interpelacje] Fetched ${allResults.length} (offset=${offset})`);

            if (batch.length < pageSize) break;
            offset += batch.length;
        }

        console.log(`[Interpelacje] Total: ${allResults.length}`);
        return allResults;
    } catch (e) {
        console.warn(`[Interpelacje] Error at offset ${offset}:`, e.message);
        return allResults;
    }
}

/**
 * Znajduje interpelacje złożone przez konkretnego posła
 * 
 * @param {Array} interpelacje - Tablica interpelacji
 * @param {number|string} poselId - ID posła (może być number lub string)
 * @returns {Array} Interpelacje złożone przez posła
 */
export function findInterpelacjeByPosel(interpelacje, poselId) {
    const id = String(poselId); // API używa stringów
    
    return interpelacje.filter(interp => {
        if (!interp.from || !Array.isArray(interp.from)) {
            return false;
        }
        return interp.from.includes(id);
    });
}

/**
 * Znajduje interpelacje skierowane do konkretnego odbiorcy
 * 
 * @param {Array} interpelacje - Tablica interpelacji
 * @param {string} recipient - Nazwa odbiorcy (np. "minister finansów")
 * @param {boolean} caseSensitive - Czy porównanie ma uwzględniać wielkość liter (default: false)
 * @returns {Array} Interpelacje skierowane do odbiorcy
 */
export function findInterpelacjeByRecipient(interpelacje, recipient, caseSensitive = false) {
    const searchTerm = caseSensitive ? recipient : recipient.toLowerCase();
    
    return interpelacje.filter(interp => {
        if (!interp.to || !Array.isArray(interp.to)) {
            return false;
        }
        
        return interp.to.some(to => {
            const toCompare = caseSensitive ? to : to.toLowerCase();
            return toCompare.includes(searchTerm);
        });
    });
}

/**
 * Znajduje interpelacje według słowa kluczowego w tytule
 * 
 * @param {Array} interpelacje - Tablica interpelacji
 * @param {string} keyword - Słowo kluczowe do wyszukania
 * @param {boolean} caseSensitive - Czy porównanie ma uwzględniać wielkość liter (default: false)
 * @returns {Array} Interpelacje zawierające słowo kluczowe
 */
export function findInterpelacjeByKeyword(interpelacje, keyword, caseSensitive = false) {
    const searchTerm = caseSensitive ? keyword : keyword.toLowerCase();
    
    return interpelacje.filter(interp => {
        if (!interp.title) return false;
        
        const title = caseSensitive ? interp.title : interp.title.toLowerCase();
        return title.includes(searchTerm);
    });
}

/**
 * Grupuje interpelacje według odbiorcy
 * 
 * @param {Array} interpelacje - Tablica interpelacji
 * @returns {Object} Obiekt z odbiorcami jako kluczami i tablicami interpelacji jako wartościami
 */
export function groupInterpelacjeByRecipient(interpelacje) {
    const grouped = {};
    
    interpelacje.forEach(interp => {
        if (!interp.to || !Array.isArray(interp.to)) return;
        
        interp.to.forEach(recipient => {
            if (!grouped[recipient]) {
                grouped[recipient] = [];
            }
            grouped[recipient].push(interp);
        });
    });
    
    return grouped;
}

/**
 * Analizuje statystyki interpelacji
 * 
 * @param {Array} interpelacje - Tablica interpelacji
 * @returns {Object} Statystyki interpelacji
 */
export function analyzeInterpelacje(interpelacje) {
    const stats = {
        total: interpelacje.length,
        withReplies: 0,
        withoutReplies: 0,
        delayed: 0,
        avgDelayDays: 0,
        byRecipient: {},
        byAuthor: {}
    };
    
    let totalDelayDays = 0;
    
    interpelacje.forEach(interp => {
        // Odpowiedzi
        if (interp.replies && interp.replies.length > 0) {
            stats.withReplies++;
        } else {
            stats.withoutReplies++;
        }
        
        // Opóźnienia
        if (interp.answerDelayedDays && interp.answerDelayedDays > 0) {
            stats.delayed++;
            totalDelayDays += interp.answerDelayedDays;
        }
        
        // Według odbiorcy
        if (interp.to && Array.isArray(interp.to)) {
            interp.to.forEach(recipient => {
                if (!stats.byRecipient[recipient]) {
                    stats.byRecipient[recipient] = 0;
                }
                stats.byRecipient[recipient]++;
            });
        }
        
        // Według autora
        if (interp.from && Array.isArray(interp.from)) {
            interp.from.forEach(authorId => {
                if (!stats.byAuthor[authorId]) {
                    stats.byAuthor[authorId] = 0;
                }
                stats.byAuthor[authorId]++;
            });
        }
    });
    
    // Średnie opóźnienie
    if (stats.delayed > 0) {
        stats.avgDelayDays = Math.round(totalDelayDays / stats.delayed);
    }
    
    return stats;
}
