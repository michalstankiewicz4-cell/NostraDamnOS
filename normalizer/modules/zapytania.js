/**
 * Normalizer dla zapytań pisemnych (writtenQuestions)
 * 
 * Transformuje surowe dane z API do formatu bazy danych.
 * 
 * STRUKTURA DANYCH:
 * - zapytania: tabela główna (term, num, title, receiptDate, ...)
 * - zapytania_odpowiedzi: odpowiedzi na zapytania
 * 
 * RÓŻNICA interpelacje vs zapytania:
 * - Interpelacje: odpowiedź w 21 dni
 * - Zapytania: odpowiedź w 7 dni, krótsze
 */

import { applyRODOFilter } from '../../modules/rodo.js';

export function normalizeZapytania(rawData, config = {}) {
    const zapytania = [];
    const odpowiedzi = [];
    
    console.log(`[NORMALIZER] Przetwarzanie ${rawData.length} zapytań pisemnych...`);
    
    for (const item of rawData) {
        // RODO: usuwamy wrażliwe dane osobowe
        let title = item.title || '';
        let to = item.to || [];
        
        if (config.enableRODO) {
            title = applyRODOFilter(title, ['nazwisko', 'imie', 'pesel', 'adres']);
            to = to.map(minister => applyRODOFilter(minister, ['nazwisko', 'imie']));
        }
        
        // Główny rekord zapytania
        const zapytanie = {
            term: item.term,
            num: item.num,
            title: title,
            receiptDate: item.receiptDate || null,
            lastModified: item.lastModified || null,
            sentDate: item.sentDate || null,
            from_mp_ids: JSON.stringify(item.from || []),
            to_ministries: JSON.stringify(to),
            answerDelayedDays: item.answerDelayedDays || 0
        };
        
        zapytania.push(zapytanie);
        
        // Odpowiedzi
        if (item.replies && Array.isArray(item.replies)) {
            for (const reply of item.replies) {
                let fromAuthor = reply.from || '';
                
                if (config.enableRODO) {
                    fromAuthor = applyRODOFilter(fromAuthor, ['nazwisko', 'imie']);
                }
                
                const odpowiedz = {
                    zapytanie_term: item.term,
                    zapytanie_num: item.num,
                    key: reply.key || '',
                    from_author: fromAuthor,
                    receiptDate: reply.receiptDate || null,
                    lastModified: reply.lastModified || null,
                    onlyAttachment: reply.onlyAttachment ? 1 : 0,
                    prolongation: reply.prolongation ? 1 : 0
                };
                
                odpowiedzi.push(odpowiedz);
            }
        }
    }
    
    console.log(`[NORMALIZER] ✓ Znormalizowano ${zapytania.length} zapytań, ${odpowiedzi.length} odpowiedzi`);
    
    return {
        zapytania,
        zapytania_odpowiedzi: odpowiedzi
    };
}

/**
 * SQL schema
 */
export function getZapytaniaSchema() {
    return {
        zapytania: `
            CREATE TABLE IF NOT EXISTS zapytania (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                term INTEGER NOT NULL,
                num INTEGER NOT NULL,
                title TEXT,
                receiptDate TEXT,
                lastModified TEXT,
                sentDate TEXT,
                from_mp_ids TEXT,
                to_ministries TEXT,
                answerDelayedDays INTEGER DEFAULT 0,
                UNIQUE(term, num)
            )
        `,
        zapytania_odpowiedzi: `
            CREATE TABLE IF NOT EXISTS zapytania_odpowiedzi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zapytanie_term INTEGER NOT NULL,
                zapytanie_num INTEGER NOT NULL,
                key TEXT NOT NULL,
                from_author TEXT,
                receiptDate TEXT,
                lastModified TEXT,
                onlyAttachment INTEGER DEFAULT 0,
                prolongation INTEGER DEFAULT 0,
                FOREIGN KEY(zapytanie_term, zapytanie_num) 
                    REFERENCES zapytania(term, num) 
                    ON DELETE CASCADE,
                UNIQUE(zapytanie_term, zapytanie_num, key)
            )
        `
    };
}

/**
 * Indeksy dla wydajności
 */
export function getZapytaniaIndexes() {
    return [
        'CREATE INDEX IF NOT EXISTS idx_zapytania_term ON zapytania(term)',
        'CREATE INDEX IF NOT EXISTS idx_zapytania_receiptDate ON zapytania(receiptDate)',
        'CREATE INDEX IF NOT EXISTS idx_zapytania_lastModified ON zapytania(lastModified)',
        'CREATE INDEX IF NOT EXISTS idx_zapytania_delayed ON zapytania(answerDelayedDays)',
        'CREATE INDEX IF NOT EXISTS idx_zapytania_odpowiedzi_zapytanie ON zapytania_odpowiedzi(zapytanie_term, zapytanie_num)'
    ];
}
