// Module: analyzer.js
// Łączy i analizuje dane z różnych modułów
// NIE pobiera danych z API - tylko operacje na lokalnych danych

import { findGlosowaniaNadProjektem, getGlosPosla, analizujGlosy } from './glosowania.js';

/**
 * Łączy posłów z ich głosami
 * 
 * @param {Array} poslowie - Tablica posłów
 * @param {Array} glosowania - Tablica głosowań (ze szczegółami, z polem votes)
 * @returns {Array} Posłowie z dodanym polem 'glosy'
 */
export function linkPoselToVotes(poslowie, glosowania) {
    return poslowie.map(posel => {
        const glosy = [];
        
        glosowania.forEach(glosowanie => {
            if (!glosowanie.votes) return;
            
            const vote = glosowanie.votes.find(v => v.MP === posel.id);
            if (vote) {
                glosy.push({
                    sitting: glosowanie.sitting,
                    votingNumber: glosowanie.votingNumber,
                    date: glosowanie.date,
                    topic: glosowanie.topic,
                    description: glosowanie.description,
                    vote: vote.vote
                });
            }
        });
        
        return {
            ...posel,
            glosy: glosy,
            liczbaGlosow: glosy.length
        };
    });
}

/**
 * Łączy projekty ustaw z głosowaniami nad nimi
 * 
 * @param {Array} projekty - Tablica projektów ustaw
 * @param {Array} glosowania - Tablica głosowań (podstawowe, bez szczegółów)
 * @returns {Array} Projekty z dodanym polem 'glosowania'
 */
export function linkProjektToVotings(projekty, glosowania) {
    return projekty.map(projekt => {
        const glosowaniaNadProjektem = findGlosowaniaNadProjektem(glosowania, projekt.number);
        
        return {
            ...projekt,
            glosowania: glosowaniaNadProjektem,
            liczbaGlosowań: glosowaniaNadProjektem.length
        };
    });
}

/**
 * Tworzy statystyki klubu na podstawie głosowań
 * 
 * @param {Array} glosowania - Tablica głosowań (ze szczegółami, z polem votes)
 * @param {string} klubName - Nazwa klubu
 * @returns {Object} Statystyki klubu
 */
export function createKlubStats(glosowania, klubName) {
    const stats = {
        klub: klubName,
        totalVotings: 0,
        votes: {
            yes: 0,
            no: 0,
            abstain: 0,
            absent: 0
        },
        jednomyslnosc: 0, // % głosowań gdzie wszyscy z klubu głosowali tak samo
        zgodnosc: {}, // zgodność z innymi klubami
        topTopics: {} // najczęstsze tematy głosowań
    };
    
    const votingPatterns = []; // wzorce głosowania dla analizy jednomyślności
    
    glosowania.forEach(glosowanie => {
        if (!glosowanie.votes) return;
        
        const klubVotes = glosowanie.votes.filter(v => v.club === klubName);
        if (klubVotes.length === 0) return;
        
        stats.totalVotings++;
        
        const pattern = {
            yes: 0,
            no: 0,
            abstain: 0,
            absent: 0
        };
        
        klubVotes.forEach(vote => {
            if (vote.vote === 'YES') {
                stats.votes.yes++;
                pattern.yes++;
            } else if (vote.vote === 'NO') {
                stats.votes.no++;
                pattern.no++;
            } else if (vote.vote === 'ABSTAIN') {
                stats.votes.abstain++;
                pattern.abstain++;
            } else {
                stats.votes.absent++;
                pattern.absent++;
            }
        });
        
        // Sprawdź jednomyślność
        const totalVotes = pattern.yes + pattern.no + pattern.abstain;
        if (totalVotes > 0) {
            const maxVotes = Math.max(pattern.yes, pattern.no, pattern.abstain);
            if (maxVotes === totalVotes) {
                votingPatterns.push('unanimous');
            } else {
                votingPatterns.push('split');
            }
        }
        
        // Tematy
        if (glosowanie.topic) {
            if (!stats.topTopics[glosowanie.topic]) {
                stats.topTopics[glosowanie.topic] = 0;
            }
            stats.topTopics[glosowanie.topic]++;
        }
    });
    
    // Oblicz % jednomyślności
    const unanimousCount = votingPatterns.filter(p => p === 'unanimous').length;
    if (votingPatterns.length > 0) {
        stats.jednomyslnosc = Math.round((unanimousCount / votingPatterns.length) * 100);
    }
    
    return stats;
}

/**
 * Porównuje wzorce głosowania dwóch klubów
 * 
 * @param {Array} glosowania - Tablica głosowań (ze szczegółami)
 * @param {string} klub1Name - Nazwa pierwszego klubu
 * @param {string} klub2Name - Nazwa drugiego klubu
 * @returns {Object} Analiza zgodności
 */
export function compareKluby(glosowania, klub1Name, klub2Name) {
    let zgodne = 0;
    let rozne = 0;
    let total = 0;
    
    glosowania.forEach(glosowanie => {
        if (!glosowanie.votes) return;
        
        const klub1Votes = glosowanie.votes.filter(v => v.club === klub1Name);
        const klub2Votes = glosowanie.votes.filter(v => v.club === klub2Name);
        
        if (klub1Votes.length === 0 || klub2Votes.length === 0) return;
        
        total++;
        
        // Sprawdź dominujący głos każdego klubu
        const klub1Yes = klub1Votes.filter(v => v.vote === 'YES').length;
        const klub1No = klub1Votes.filter(v => v.vote === 'NO').length;
        
        const klub2Yes = klub2Votes.filter(v => v.vote === 'YES').length;
        const klub2No = klub2Votes.filter(v => v.vote === 'NO').length;
        
        const klub1Dominant = klub1Yes > klub1No ? 'YES' : 'NO';
        const klub2Dominant = klub2Yes > klub2No ? 'YES' : 'NO';
        
        if (klub1Dominant === klub2Dominant) {
            zgodne++;
        } else {
            rozne++;
        }
    });
    
    const zgodnosc = total > 0 ? Math.round((zgodne / total) * 100) : 0;
    
    return {
        klub1: klub1Name,
        klub2: klub2Name,
        totalGlosowań: total,
        zgodne: zgodne,
        rozne: rozne,
        zgodnosc: zgodnosc,
        opis: `${klub1Name} i ${klub2Name} głosowały zgodnie w ${zgodnosc}% głosowań`
    };
}

/**
 * Analizuje jak poseł głosował nad projektami zawierającymi keyword
 * 
 * @param {number} poselId - ID posła
 * @param {Array} projekty - Tablica projektów
 * @param {Array} glosowania - Tablica głosowań (ze szczegółami)
 * @param {string} keyword - Słowo kluczowe w tytule projektu
 * @returns {Object} Analiza głosowań posła
 */
export function analyzePoselVotingOnProjects(poselId, projekty, glosowania, keyword) {
    const matchingProjekty = projekty.filter(p => 
        p.title.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const results = [];
    
    matchingProjekty.forEach(projekt => {
        const glosowaniaNadProjektem = findGlosowaniaNadProjektem(glosowania, projekt.number);
        
        glosowaniaNadProjektem.forEach(glosowanie => {
            const vote = getGlosPosla(glosowanie, poselId);
            
            if (vote) {
                results.push({
                    projekt: {
                        number: projekt.number,
                        title: projekt.title.substring(0, 100) + '...'
                    },
                    glosowanie: {
                        sitting: glosowanie.sitting,
                        votingNumber: glosowanie.votingNumber,
                        date: glosowanie.date
                    },
                    vote: vote.vote
                });
            }
        });
    });
    
    // Statystyki
    const stats = {
        poselId: poselId,
        keyword: keyword,
        projektCount: matchingProjekty.length,
        glosowaniaCount: results.length,
        votes: {
            yes: results.filter(r => r.vote === 'YES').length,
            no: results.filter(r => r.vote === 'NO').length,
            abstain: results.filter(r => r.vote === 'ABSTAIN').length
        },
        results: results
    };
    
    return stats;
}

/**
 * Tworzy macierz zgodności głosowań między posłami
 * 
 * @param {Array} poslowie - Tablica posłów (max 10 dla czytelności)
 * @param {Array} glosowania - Tablica głosowań (ze szczegółami)
 * @returns {Object} Macierz zgodności
 */
export function createVotingAgreementMatrix(poslowie, glosowania) {
    const matrix = {};
    
    // Inicjalizuj macierz
    poslowie.forEach(p1 => {
        matrix[p1.id] = {
            name: `${p1.firstName} ${p1.lastName}`,
            club: p1.club,
            agreements: {}
        };
        
        poslowie.forEach(p2 => {
            if (p1.id !== p2.id) {
                matrix[p1.id].agreements[p2.id] = {
                    name: `${p2.firstName} ${p2.lastName}`,
                    total: 0,
                    agreed: 0,
                    disagreed: 0,
                    percentage: 0
                };
            }
        });
    });
    
    // Oblicz zgodność
    glosowania.forEach(glosowanie => {
        if (!glosowanie.votes) return;
        
        poslowie.forEach(p1 => {
            const vote1 = glosowanie.votes.find(v => v.MP === p1.id);
            if (!vote1) return;
            
            poslowie.forEach(p2 => {
                if (p1.id === p2.id) return;
                
                const vote2 = glosowanie.votes.find(v => v.MP === p2.id);
                if (!vote2) return;
                
                matrix[p1.id].agreements[p2.id].total++;
                
                if (vote1.vote === vote2.vote) {
                    matrix[p1.id].agreements[p2.id].agreed++;
                } else {
                    matrix[p1.id].agreements[p2.id].disagreed++;
                }
            });
        });
    });
    
    // Oblicz procenty
    Object.keys(matrix).forEach(id1 => {
        Object.keys(matrix[id1].agreements).forEach(id2 => {
            const agreement = matrix[id1].agreements[id2];
            if (agreement.total > 0) {
                agreement.percentage = Math.round((agreement.agreed / agreement.total) * 100);
            }
        });
    });
    
    return matrix;
}

/**
 * Znajduje najbardziej kontrowersyjne głosowania
 * 
 * @param {Array} glosowania - Tablica głosowań (ze szczegółami)
 * @param {number} limit - Ile najbardziej kontrowersyjnych (default: 10)
 * @returns {Array} Najbardziejkontrowersyjne głosowania
 */
export function findMostControversialVotings(glosowania, limit = 10) {
    const controversial = [];
    
    glosowania.forEach(glosowanie => {
        if (!glosowanie.votes || glosowanie.votes.length === 0) return;
        
        const analiza = analizujGlosy(glosowanie);
        
        // Kontrowersyjność = jak blisko 50/50 był wynik
        const totalVoted = analiza.za.count + analiza.przeciw.count;
        if (totalVoted === 0) return;
        
        const yesPercent = (analiza.za.count / totalVoted) * 100;
        const controversyScore = 100 - Math.abs(50 - yesPercent) * 2;
        
        controversial.push({
            sitting: glosowanie.sitting,
            votingNumber: glosowanie.votingNumber,
            date: glosowanie.date,
            topic: glosowanie.topic,
            description: glosowanie.description,
            yes: analiza.za.count,
            no: analiza.przeciw.count,
            abstain: analiza.wstrzymali.count,
            controversyScore: Math.round(controversyScore),
            yesPercent: Math.round(yesPercent)
        });
    });
    
    // Sortuj według controversy score (malejąco)
    controversial.sort((a, b) => b.controversyScore - a.controversyScore);
    
    return controversial.slice(0, limit);
}
