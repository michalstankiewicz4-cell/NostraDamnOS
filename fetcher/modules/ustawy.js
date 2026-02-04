/**
 * Module: ustawy.js
 * Fetcher dla aktów prawnych z ELI API
 * 
 * ENDPOINTS:
 * - /eli/acts/{publisher}/{year}        - lista aktów z danego roku
 * - /eli/acts/{publisher}/{year}/{pos}  - szczegóły pojedynczego aktu
 * 
 * PUBLISHERS:
 * - DU = Dziennik Ustaw
 * - MP = Monitor Polski
 * 
 * UWAGA: To NIE są projekty ustaw (druki)!
 * - projekty_ustaw.js → /sejm/term10/prints (druki sejmowe)
 * - ustawy.js → /eli/acts/DU/2024 (uchwalone akty prawne)
 * 
 * Parametry:
 * - publisher: DU lub MP (default: DU)
 * - year: rok publikacji (default: 2024)
 * - limit: max liczba wyników (default: 500)
 * - offset: offset dla paginacji (default: 0)
 * - title: wyszukiwanie w tytule
 * - type: typ aktu (Ustawa, Rozporządzenie, etc.)
 * - status: status aktu (obowiązujący, uchylony, etc.)
 */

import { safeFetch } from '../fetcher.js';

export async function fetchUstawy({ 
    publisher = 'DU',
    year = new Date().getFullYear(),
    limit = 500,
    offset = 0,
    title = null,
    type = null,
    status = null
} = {}) {
    
    // Build query params
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);
    if (title) params.append('title', title);
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    
    const url = `https://api.sejm.gov.pl/eli/acts/${publisher}/${year}?${params.toString()}`;
    
    try {
        const response = await safeFetch(url);
        
        // API zwraca { count: X, items: [...] }
        if (response && response.items) {
            return response.items;
        }
        
        return [];
    } catch (e) {
        console.error(`[Ustawy] Error:`, e.message);
        return [];
    }
}

/**
 * Pobiera szczegóły pojedynczej ustawy
 */
export async function fetchUstawaDetails({ publisher = 'DU', year, pos }) {
    const url = `https://api.sejm.gov.pl/eli/acts/${publisher}/${year}/${pos}`;
    
    try {
        return await safeFetch(url);
    } catch (e) {
        console.error(`[Ustawy] Error fetching ${publisher}/${year}/${pos}:`, e.message);
        return null;
    }
}

/**
 * Pobiera tekst ustawy w formacie PDF
 */
export async function fetchUstawaTextPDF({ publisher = 'DU', year, pos }) {
    const url = `https://api.sejm.gov.pl/eli/acts/${publisher}/${year}/${pos}/text.pdf`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.blob();
    } catch (e) {
        console.error(`[Ustawy] Error fetching PDF:`, e.message);
        return null;
    }
}

/**
 * Pobiera tekst ustawy w formacie HTML
 */
export async function fetchUstawaTextHTML({ publisher = 'DU', year, pos }) {
    const url = `https://api.sejm.gov.pl/eli/acts/${publisher}/${year}/${pos}/text.html`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.text();
    } catch (e) {
        console.error(`[Ustawy] Error fetching HTML:`, e.message);
        return null;
    }
}
