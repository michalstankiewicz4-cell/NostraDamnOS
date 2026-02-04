// Module: queries.js
// Zaawansowane zapytania łączące wiele modułów
// Automatycznie pobiera dane z API i zwraca gotowe wyniki

import { fetchPoslowie, findPoselByLastName, getPoselInterpelacje } from './poslowie.js';
import { fetchGlosowania, fetchGlosowanieDetails, fetchGlosowaniaWithDetails, findGlosowaniaNadProjektem, getGlosPosla } from './glosowania.js';
import { fetchProjektyUstaw } from './projekty_ustaw.js';
import { fetchPosiedzenia } from './posiedzenia.js';
import { fetchInterpelacje } from './interpelacje.js';
import { 
    linkPoselToVotes, 
    createKlubStats, 
    compareKluby,
    analyzePoselVotingOnProjects 
} from './analyzer.js';

/**
 * Pobiera pełną historię głosowań posła
 * 
 * @param {number|string} poselId - ID posła lub nazwisko
 * @param {Object} config - Konfiguracja
 * @param {number} config.kadencja - Numer kadencji (default: 10)
 * @param {string} config.typ - 'sejm' lub 'senat' (default: 'sejm')
 * @param {Array} config.posiedzenia - Lista numerów posiedzeń (opcjonalne, default: wszystkie)
 * @param {number} config.limit - Max liczba głosowań do pobrania (default: all)
 * @returns {Promise<Object>} Historia głosowań posła
 */
export async function getPoselVotingHistory(poselId, config = {}) {
    const { kadencja = 10, typ = 'sejm', limit } = config;
    
    console.log(`[queries] Fetching voting history for MP ${poselId}...`);
    
    // 1. Znajdź posła
    const poslowie = await fetchPoslowie({ kadencja, typ });
    let posel;
    
    if (typeof poselId === 'string') {
        const found = findPoselByLastName(poslowie, poselId, false);
        if (found.length === 0) {
            throw new Error(`Nie znaleziono posła: ${poselId}`);
        }
        if (found.length > 1) {
            console.warn(`[queries] Znaleziono ${found.length} posłów z nazwiskiem "${poselId}". Użyto pierwszego.`);
        }
        posel = found[0];
    } else {
        posel = poslowie.find(p => p.id === poselId);
        if (!posel) {
            throw new Error(`Nie znaleziono posła o ID: ${poselId}`);
        }
    }
    
    // 2. Pobierz posiedzenia jeśli nie podano
    let posiedzenia = config.posiedzenia;
    if (!posiedzenia) {
        const allPosiedzenia = await fetchPosiedzenia({ kadencja, typ });
        posiedzenia = allPosiedzenia;
    }
    
    // 3. Pobierz głosowania (podstawowe)
    const glosowania = await fetchGlosowania({ kadencja, typ, posiedzenia });
    
    // 4. Pobierz szczegóły z votes (z limitem dla optymalizacji)
    const toFetch = limit ? glosowania.slice(0, limit) : glosowania;
    console.log(`[queries] Fetching details for ${toFetch.length} votings...`);
    
    const glosowaniaDetails = await fetchGlosowaniaWithDetails(toFetch, { kadencja, typ });
    
    // 5. Wyfiltruj głosy posła
    const historia = [];
    
    glosowaniaDetails.forEach(glosowanie => {
        const vote = getGlosPosla(glosowanie, posel.id);
        
        if (vote) {
            historia.push({
                sitting: glosowanie.sitting,
                votingNumber: glosowanie.votingNumber,
                date: glosowanie.date,
                topic: glosowanie.topic,
                description: glosowanie.description,
                vote: vote.vote,
                totalYes: glosowanie.yes,
                totalNo: glosowanie.no,
                totalAbstain: glosowanie.abstain
            });
        }
    });
    
    // 6. Statystyki
    const stats = {
        yes: historia.filter(h => h.vote === 'YES').length,
        no: historia.filter(h => h.vote === 'NO').length,
        abstain: historia.filter(h => h.vote === 'ABSTAIN').length,
        absent: historia.filter(h => h.vote !== 'YES' && h.vote !== 'NO' && h.vote !== 'ABSTAIN').length
    };
    
    console.log(`[queries] Found ${historia.length} votes for ${posel.firstName} ${posel.lastName}`);
    
    return {
        posel: {
            id: posel.id,
            firstName: posel.firstName,
            lastName: posel.lastName,
            club: posel.club
        },
        historia: historia,
        stats: stats,
        total: historia.length
    };
}

/**
 * Analizuje jak poseł głosował nad projektami zawierającymi keyword
 * 
 * @param {Object} params
 * @param {number|string} params.poselId - ID posła lub nazwisko
 * @param {string} params.projectKeyword - Słowo kluczowe w tytule projektu
 * @param {number} params.kadencja - Numer kadencji (default: 10)
 * @param {string} params.typ - 'sejm' lub 'senat' (default: 'sejm')
 * @param {number} params.posiedzeniaLimit - Max liczba posiedzeń (default: 10)
 * @returns {Promise<Object>} Analiza głosowań
 */
export async function getPoselVotingOnProjects(params) {
    const { 
        poselId, 
        projectKeyword, 
        kadencja = 10, 
        typ = 'sejm',
        posiedzeniaLimit = 10 
    } = params;
    
    console.log(`[queries] Analyzing MP votes on projects with "${projectKeyword}"...`);
    
    // 1. Znajdź posła
    const poslowie = await fetchPoslowie({ kadencja, typ });
    let posel;
    
    if (typeof poselId === 'string') {
        const found = findPoselByLastName(poslowie, poselId, false);
        if (found.length === 0) {
            throw new Error(`Nie znaleziono posła: ${poselId}`);
        }
        posel = found[0];
    } else {
        posel = poslowie.find(p => p.id === poselId);
        if (!posel) {
            throw new Error(`Nie znaleziono posła o ID: ${poselId}`);
        }
    }
    
    // 2. Pobierz projekty z keyword
    const projekty = await fetchProjektyUstaw({ kadencja, typ });
    const matchingProjekty = projekty.filter(p => 
        p.title.toLowerCase().includes(projectKeyword.toLowerCase())
    );
    
    console.log(`[queries] Found ${matchingProjekty.length} projects with "${projectKeyword}"`);
    
    // 3. Pobierz głosowania (pierwsze N posiedzeń)
    const posiedzenia = await fetchPosiedzenia({ kadencja, typ });
    const limitedPosiedzenia = posiedzenia.slice(0, posiedzeniaLimit);
    const glosowania = await fetchGlosowania({ kadencja, typ, posiedzenia: limitedPosiedzenia });
    
    // 4. Znajdź głosowania nad tymi projektami
    const relevantGlosowania = [];
    matchingProjekty.forEach(projekt => {
        const glosowaniaNadProjektem = findGlosowaniaNadProjektem(glosowania, projekt.number);
        glosowaniaNadProjektem.forEach(g => {
            relevantGlosowania.push({
                ...g,
                projektNumber: projekt.number,
                projektTitle: projekt.title
            });
        });
    });
    
    console.log(`[queries] Found ${relevantGlosowania.length} votings on these projects`);
    
    // 5. Pobierz szczegóły
    const glosowaniaDetails = await fetchGlosowaniaWithDetails(relevantGlosowania, { kadencja, typ });
    
    // 6. Znajdź głosy posła
    const results = [];
    
    glosowaniaDetails.forEach(glosowanie => {
        const vote = getGlosPosla(glosowanie, posel.id);
        
        if (vote) {
            results.push({
                projekt: {
                    number: glosowanie.projektNumber,
                    title: glosowanie.projektTitle.substring(0, 100) + '...'
                },
                glosowanie: {
                    sitting: glosowanie.sitting,
                    votingNumber: glosowanie.votingNumber,
                    date: glosowanie.date,
                    topic: glosowanie.topic
                },
                vote: vote.vote
            });
        }
    });
    
    // 7. Statystyki
    const stats = {
        yes: results.filter(r => r.vote === 'YES').length,
        no: results.filter(r => r.vote === 'NO').length,
        abstain: results.filter(r => r.vote === 'ABSTAIN').length
    };
    
    console.log(`[queries] ${posel.firstName} ${posel.lastName} voted on ${results.length} related votings`);
    
    return {
        posel: {
            id: posel.id,
            firstName: posel.firstName,
            lastName: posel.lastName,
            club: posel.club
        },
        keyword: projectKeyword,
        projektCount: matchingProjekty.length,
        glosowaniaCount: results.length,
        stats: stats,
        results: results
    };
}

/**
 * Pobiera statystyki głosowań klubu
 * 
 * @param {string} klubName - Nazwa klubu (np. "PiS", "KO")
 * @param {Object} config
 * @param {number} config.kadencja - Numer kadencji (default: 10)
 * @param {string} config.typ - 'sejm' lub 'senat' (default: 'sejm')
 * @param {number} config.posiedzeniaLimit - Max liczba posiedzeń (default: 10)
 * @returns {Promise<Object>} Statystyki klubu
 */
export async function getClubVotingStats(klubName, config = {}) {
    const { kadencja = 10, typ = 'sejm', posiedzeniaLimit = 10 } = config;
    
    console.log(`[queries] Fetching voting stats for club ${klubName}...`);
    
    // 1. Pobierz posiedzenia
    const posiedzenia = await fetchPosiedzenia({ kadencja, typ });
    const limitedPosiedzenia = posiedzenia.slice(0, posiedzeniaLimit);
    
    // 2. Pobierz głosowania (podstawowe)
    const glosowania = await fetchGlosowania({ kadencja, typ, posiedzenia: limitedPosiedzenia });
    
    // 3. Pobierz szczegóły
    console.log(`[queries] Fetching details for ${glosowania.length} votings...`);
    const glosowaniaDetails = await fetchGlosowaniaWithDetails(glosowania, { kadencja, typ });
    
    // 4. Użyj analyzer do stworzenia statystyk
    const stats = createKlubStats(glosowaniaDetails, klubName);
    
    console.log(`[queries] ${klubName}: ${stats.totalVotings} votings analyzed`);
    
    return stats;
}

/**
 * Porównuje wzorce głosowania dwóch posłów
 * 
 * @param {number|string} poselId1 - ID lub nazwisko pierwszego posła
 * @param {number|string} poselId2 - ID lub nazwisko drugiego posła
 * @param {Object} config
 * @param {number} config.kadencja - Numer kadencji (default: 10)
 * @param {string} config.typ - 'sejm' lub 'senat' (default: 'sejm')
 * @param {number} config.posiedzeniaLimit - Max liczba posiedzeń (default: 10)
 * @returns {Promise<Object>} Porównanie posłów
 */
export async function comparePoselVoting(poselId1, poselId2, config = {}) {
    const { kadencja = 10, typ = 'sejm', posiedzeniaLimit = 10 } = config;
    
    console.log(`[queries] Comparing voting patterns of ${poselId1} vs ${poselId2}...`);
    
    // 1. Znajdź posłów
    const poslowie = await fetchPoslowie({ kadencja, typ });
    
    const findPosel = (id) => {
        if (typeof id === 'string') {
            const found = findPoselByLastName(poslowie, id, false);
            if (found.length === 0) throw new Error(`Nie znaleziono posła: ${id}`);
            return found[0];
        } else {
            const p = poslowie.find(p => p.id === id);
            if (!p) throw new Error(`Nie znaleziono posła o ID: ${id}`);
            return p;
        }
    };
    
    const posel1 = findPosel(poselId1);
    const posel2 = findPosel(poselId2);
    
    // 2. Pobierz głosowania
    const posiedzenia = await fetchPosiedzenia({ kadencja, typ });
    const limitedPosiedzenia = posiedzenia.slice(0, posiedzeniaLimit);
    const glosowania = await fetchGlosowania({ kadencja, typ, posiedzenia: limitedPosiedzenia });
    
    console.log(`[queries] Fetching details for ${glosowania.length} votings...`);
    const glosowaniaDetails = await fetchGlosowaniaWithDetails(glosowania, { kadencja, typ });
    
    // 3. Porównaj głosy
    let total = 0;
    let zgodne = 0;
    let rozne = 0;
    const details = [];
    
    glosowaniaDetails.forEach(glosowanie => {
        const vote1 = getGlosPosla(glosowanie, posel1.id);
        const vote2 = getGlosPosla(glosowanie, posel2.id);
        
        if (vote1 && vote2) {
            total++;
            
            if (vote1.vote === vote2.vote) {
                zgodne++;
            } else {
                rozne++;
                details.push({
                    sitting: glosowanie.sitting,
                    votingNumber: glosowanie.votingNumber,
                    date: glosowanie.date,
                    topic: glosowanie.topic,
                    vote1: vote1.vote,
                    vote2: vote2.vote
                });
            }
        }
    });
    
    const zgodnosc = total > 0 ? Math.round((zgodne / total) * 100) : 0;
    
    console.log(`[queries] Agreement: ${zgodnosc}% (${zgodne}/${total} votings)`);
    
    return {
        posel1: {
            id: posel1.id,
            firstName: posel1.firstName,
            lastName: posel1.lastName,
            club: posel1.club
        },
        posel2: {
            id: posel2.id,
            firstName: posel2.firstName,
            lastName: posel2.lastName,
            club: posel2.club
        },
        total: total,
        zgodne: zgodne,
        rozne: rozne,
        zgodnosc: zgodnosc,
        opis: `${posel1.lastName} i ${posel2.lastName} głosowali zgodnie w ${zgodnosc}% głosowań`,
        roznice: details.slice(0, 10) // Pierwsze 10 różnic
    };
}

/**
 * Pobiera kompleksowy profil posła
 * 
 * @param {number|string} poselId - ID posła lub nazwisko
 * @param {Object} config
 * @param {number} config.kadencja - Numer kadencji (default: 10)
 * @param {string} config.typ - 'sejm' lub 'senat' (default: 'sejm')
 * @param {number} config.posiedzeniaLimit - Max liczba posiedzeń dla głosowań (default: 5)
 * @returns {Promise<Object>} Kompleksowy profil posła
 */
export async function getPoselProfile(poselId, config = {}) {
    const { kadencja = 10, typ = 'sejm', posiedzeniaLimit = 5 } = config;
    
    console.log(`[queries] Building complete profile for MP ${poselId}...`);
    
    // 1. Znajdź posła
    const poslowie = await fetchPoslowie({ kadencja, typ });
    let posel;
    
    if (typeof poselId === 'string') {
        const found = findPoselByLastName(poslowie, poselId, false);
        if (found.length === 0) throw new Error(`Nie znaleziono posła: ${poselId}`);
        posel = found[0];
    } else {
        posel = poslowie.find(p => p.id === poselId);
        if (!posel) throw new Error(`Nie znaleziono posła o ID: ${poselId}`);
    }
    
    console.log(`[queries] Building profile for ${posel.firstName} ${posel.lastName}...`);
    
    // 2. Pobierz interpelacje
    const interpelacje = await getPoselInterpelacje(posel.id, { kadencja, typ });
    
    // 3. Pobierz historię głosowań (ograniczona)
    const votingHistory = await getPoselVotingHistory(posel.id, {
        kadencja,
        typ,
        posiedzeniaLimit,
        limit: 50 // Maksymalnie 50 głosowań
    });
    
    // 4. Zbuduj profil
    const profil = {
        dane: posel,
        interpelacje: {
            total: interpelacje.length,
            lista: interpelacje.slice(0, 10) // Pierwsze 10
        },
        glosowania: {
            total: votingHistory.total,
            stats: votingHistory.stats,
            ostatnie: votingHistory.historia.slice(0, 10) // Ostatnie 10
        },
        aktywnosc: {
            interpelacje: interpelacje.length,
            glosowania: votingHistory.total,
            obecnosc: votingHistory.total > 0 
                ? Math.round(((votingHistory.stats.yes + votingHistory.stats.no + votingHistory.stats.abstain) / votingHistory.total) * 100)
                : 0
        }
    };
    
    console.log(`[queries] Profile complete: ${interpelacje.length} interpellations, ${votingHistory.total} votes`);
    
    return profil;
}

/**
 * Pobiera kompleksowy profil klubu
 * 
 * @param {string} klubName - Nazwa klubu
 * @param {Object} config
 * @param {number} config.kadencja - Numer kadencji (default: 10)
 * @param {string} config.typ - 'sejm' lub 'senat' (default: 'sejm')
 * @param {number} config.posiedzeniaLimit - Max liczba posiedzeń (default: 5)
 * @returns {Promise<Object>} Kompleksowy profil klubu
 */
export async function getKlubProfile(klubName, config = {}) {
    const { kadencja = 10, typ = 'sejm', posiedzeniaLimit = 5 } = config;
    
    console.log(`[queries] Building complete profile for club ${klubName}...`);
    
    // 1. Pobierz posłów z klubu
    const poslowie = await fetchPoslowie({ kadencja, typ });
    const poslowieKlubu = poslowie.filter(p => p.club === klubName);
    
    if (poslowieKlubu.length === 0) {
        throw new Error(`Nie znaleziono klubu: ${klubName}`);
    }
    
    // 2. Pobierz statystyki głosowań
    const votingStats = await getClubVotingStats(klubName, { kadencja, typ, posiedzeniaLimit });
    
    // 3. Pobierz interpelacje członków klubu
    const interpelacje = await fetchInterpelacje({ kadencja, typ });
    const interpelacjeKlubu = interpelacje.filter(interp => {
        if (!interp.from || !Array.isArray(interp.from)) return false;
        return interp.from.some(authorId => {
            return poslowieKlubu.some(p => String(p.id) === String(authorId));
        });
    });
    
    // 4. Zbuduj profil
    const profil = {
        klub: klubName,
        poslowie: {
            total: poslowieKlubu.length,
            lista: poslowieKlubu.map(p => ({
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName
            }))
        },
        glosowania: votingStats,
        interpelacje: {
            total: interpelacjeKlubu.length,
            naPoselka: Math.round(interpelacjeKlubu.length / poslowieKlubu.length * 10) / 10
        },
        statystyki: {
            liczbaPostow: poslowieKlubu.length,
            interpelacji: interpelacjeKlubu.length,
            glosowań: votingStats.totalVotings,
            jednomyslnosc: votingStats.jednomyslnosc
        }
    };
    
    console.log(`[queries] Profile complete: ${poslowieKlubu.length} MPs, ${votingStats.totalVotings} votings`);
    
    return profil;
}
