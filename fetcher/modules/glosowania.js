// Module: glosowania.js
// Pobiera głosowania z API Sejmu, z opcją pobierania szczegółowych głosów posłów
import { safeFetch } from '../fetcher.js';
import { getSittingNumbers } from '../fetcher.js';

/**
 * Pobiera podstawowe dane głosowań (bez indywidualnych głosów)
 * Szybkie, zwięzłe - do ogólnego przeglądu
 */
// Speed profiles: normal / fast / risky
function getSpeedConfig(speed) {
    switch (speed) {
        case 'fast':  return { batch: 10, delay: 50 };
        case 'risky': return { batch: 13, delay: 25 };
        default:      return { batch: 5, delay: 100 };
    }
}

export async function fetchGlosowania(config) {
    const results = [];
    const { posiedzenia, kadencja = 10, typ = 'sejm', fetchSpeed = 'normal', onItemProgress } = config;
    const sittingNumbers = getSittingNumbers(posiedzenia, config);
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const speedCfg = getSpeedConfig(fetchSpeed);
    const totalItems = sittingNumbers.length;
    let doneItems = 0;
    
    for (let i = 0; i < sittingNumbers.length; i += speedCfg.batch) {
        const batch = sittingNumbers.slice(i, i + speedCfg.batch);
        const batchResults = await Promise.all(batch.map(async num => {
            const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/votings/${num}`;
            try {
                const data = await safeFetch(url);
                return Array.isArray(data) ? data : [];
            } catch (e) {
                console.warn(`[Glosowania] Failed for sitting ${num}:`, e.message);
                return [];
            }
        }));
        results.push(...batchResults.flat());
        doneItems = Math.min(i + speedCfg.batch, totalItems);
        if (onItemProgress) onItemProgress(doneItems, totalItems, 'głosowania');
        if (speedCfg.delay > 0) await new Promise(r => setTimeout(r, speedCfg.delay));
    }
    
    return results;
}

/**
 * Pobiera szczegółowe dane pojedynczego głosowania z indywidualnymi głosami posłów
 * 
 * @param {Object} params
 * @param {number} params.sitting - Numer posiedzenia
 * @param {number} params.votingNumber - Numer głosowania
 * @param {number} params.kadencja - Kadencja (default: 10)
 * @param {string} params.typ - 'sejm' lub 'senat' (default: 'sejm')
 * @returns {Promise<Object>} Szczegółowe dane głosowania z polem 'votes'
 */
export async function fetchGlosowanieDetails({ sitting, votingNumber, kadencja = 10, typ = 'sejm' }) {
    const base = typ === 'sejm' ? 'sejm' : 'senat';
    const url = `https://api.sejm.gov.pl/${base}/term${kadencja}/votings/${sitting}/${votingNumber}`;
    
    try {
        const data = await safeFetch(url);
        return data;
    } catch (e) {
        console.error(`[Glosowania] Error fetching details for ${sitting}/${votingNumber}:`, e.message);
        return null;
    }
}

/**
 * Pobiera szczegółowe dane dla wielu głosowań naraz
 * 
 * @param {Array} glosowania - Tablica głosowań z polami {sitting, votingNumber}
 * @param {Object} config - Konfiguracja (kadencja, typ)
 * @returns {Promise<Array>} Tablica szczegółowych danych głosowań
 */
export async function fetchGlosowaniaWithDetails(glosowania, config = {}) {
    const { kadencja = 10, typ = 'sejm' } = config;
    const results = [];
    
    console.log(`[Glosowania] Fetching details for ${glosowania.length} votings...`);
    
    for (const g of glosowania) {
        const details = await fetchGlosowanieDetails({
            sitting: g.sitting,
            votingNumber: g.votingNumber,
            kadencja,
            typ
        });
        
        if (details) {
            results.push(details);
        }
    }
    
    console.log(`[Glosowania] Retrieved ${results.length} detailed votings`);
    return results;
}

/**
 * Znajduje głosowania związane z konkretnym projektem ustawy (drukiem)
 * 
 * @param {Array} glosowania - Tablica głosowań
 * @param {string|number} numerDruku - Numer druku (projektu ustawy)
 * @returns {Array} Głosowania związane z tym drukiem
 */
export function findGlosowaniaNadProjektem(glosowania, numerDruku) {
    const numer = String(numerDruku);
    
    return glosowania.filter(g => {
        const desc = g.description || '';
        const topic = g.topic || '';
        
        return desc.includes(`druk ${numer}`) ||
               desc.includes(`nr ${numer}`) ||
               desc.includes(`druków ${numer}`) ||
               topic.includes(`druk ${numer}`) ||
               topic.includes(`nr ${numer}`);
    });
}

/**
 * Analizuje indywidualne głosy - zwraca statystyki
 * 
 * @param {Object} glosowanie - Głosowanie z polem 'votes'
 * @returns {Object} Analiza głosów
 */
export function analizujGlosy(glosowanie) {
    if (!glosowanie.votes || !Array.isArray(glosowanie.votes)) {
        return {
            error: 'Brak danych o indywidualnych głosach',
            total: 0
        };
    }
    
    // Podstawowe podsumowanie
    const za = glosowanie.votes.filter(v => v.vote === 'YES');
    const przeciw = glosowanie.votes.filter(v => v.vote === 'NO');
    const wstrzymali = glosowanie.votes.filter(v => v.vote === 'ABSTAIN');
    const nieGlosowali = glosowanie.votes.filter(v => 
        v.vote !== 'YES' && v.vote !== 'NO' && v.vote !== 'ABSTAIN'
    );
    
    // Analiza po klubach
    const kluby = {};
    glosowanie.votes.forEach(v => {
        const klub = v.club || 'Nieokreślony';
        if (!kluby[klub]) {
            kluby[klub] = {
                za: 0,
                przeciw: 0,
                wstrzymali: 0,
                nieGlosowali: 0,
                total: 0
            };
        }
        
        kluby[klub].total++;
        if (v.vote === 'YES') kluby[klub].za++;
        else if (v.vote === 'NO') kluby[klub].przeciw++;
        else if (v.vote === 'ABSTAIN') kluby[klub].wstrzymali++;
        else kluby[klub].nieGlosowali++;
    });
    
    return {
        total: glosowanie.votes.length,
        za: {
            count: za.length,
            poslowie: za
        },
        przeciw: {
            count: przeciw.length,
            poslowie: przeciw
        },
        wstrzymali: {
            count: wstrzymali.length,
            poslowie: wstrzymali
        },
        nieGlosowali: {
            count: nieGlosowali.length,
            poslowie: nieGlosowali
        },
        kluby: kluby,
        // Podstawowe metadane głosowania
        meta: {
            sitting: glosowanie.sitting,
            votingNumber: glosowanie.votingNumber,
            date: glosowanie.date,
            topic: glosowanie.topic,
            description: glosowanie.description
        }
    };
}

/**
 * Sprawdza jak konkretny poseł głosował w danym głosowaniu
 * 
 * @param {Object} glosowanie - Głosowanie z polem 'votes'
 * @param {number} poselId - ID posła
 * @returns {Object|null} Głos posła lub null jeśli nie znaleziono
 */
export function getGlosPosla(glosowanie, poselId) {
    if (!glosowanie.votes || !Array.isArray(glosowanie.votes)) {
        return null;
    }
    
    return glosowanie.votes.find(v => v.MP === poselId) || null;
}

/**
 * Tworzy raport głosowania w formacie czytelnym dla człowieka
 * 
 * @param {Object} analiza - Wynik funkcji analizujGlosy()
 * @returns {string} Sformatowany raport tekstowy
 */
export function createGlosowanieReport(analiza) {
    if (analiza.error) {
        return `❌ ${analiza.error}`;
    }
    
    const lines = [];
    lines.push('═══════════════════════════════════════════════');
    lines.push('   RAPORT GŁOSOWANIA');
    lines.push('═══════════════════════════════════════════════');
    lines.push('');
    
    // Metadane
    if (analiza.meta) {
        lines.push(`Posiedzenie: ${analiza.meta.sitting}, Głosowanie: ${analiza.meta.votingNumber}`);
        lines.push(`Data: ${analiza.meta.date}`);
        lines.push(`Temat: ${analiza.meta.topic}`);
        if (analiza.meta.description) {
            lines.push(`Opis: ${analiza.meta.description}`);
        }
        lines.push('');
    }
    
    // Podsumowanie
    lines.push(`Łącznie głosowało: ${analiza.total} posłów`);
    lines.push(`✅ Za: ${analiza.za.count}`);
    lines.push(`❌ Przeciw: ${analiza.przeciw.count}`);
    lines.push(`⚪ Wstrzymało się: ${analiza.wstrzymali.count}`);
    lines.push(`⭕ Nie głosowało: ${analiza.nieGlosowali.count}`);
    lines.push('');
    
    // Kluby
    lines.push('🏛️  PODZIAŁ PO KLUBACH:');
    Object.entries(analiza.kluby).forEach(([klub, stats]) => {
        lines.push(`   ${klub}:`);
        lines.push(`      Za: ${stats.za}, Przeciw: ${stats.przeciw}, Wstrzymało się: ${stats.wstrzymali}`);
    });
    
    lines.push('');
    lines.push('═══════════════════════════════════════════════');
    
    return lines.join('\n');
}
