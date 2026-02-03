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

/**
 * Zapisuje zapytania do bazy (UPSERT)
 */
export function saveZapytania(db, normalized) {
    console.log(`[Normalizer] Saving ${normalized.zapytania.length} zapytania + ${normalized.zapytania_odpowiedzi.length} replies...`);
    
    // 1. Zapytania
    const stmtZapytania = db.prepare(`
        INSERT INTO zapytania (term, num, title, receiptDate, lastModified, sentDate, from_mp_ids, to_ministries, answerDelayedDays)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(term, num) DO UPDATE SET
            title = excluded.title,
            lastModified = excluded.lastModified,
            sentDate = excluded.sentDate,
            from_mp_ids = excluded.from_mp_ids,
            to_ministries = excluded.to_ministries,
            answerDelayedDays = excluded.answerDelayedDays
    `);
    
    for (const z of normalized.zapytania) {
        stmtZapytania.run(
            z.term, z.num, z.title, z.receiptDate, z.lastModified, 
            z.sentDate, z.from_mp_ids, z.to_ministries, z.answerDelayedDays
        );
    }
    
    // 2. Odpowiedzi
    const stmtOdpowiedzi = db.prepare(`
        INSERT INTO zapytania_odpowiedzi (zapytanie_term, zapytanie_num, key, from_author, receiptDate, lastModified, onlyAttachment, prolongation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(zapytanie_term, zapytanie_num, key) DO UPDATE SET
            from_author = excluded.from_author,
            lastModified = excluded.lastModified,
            onlyAttachment = excluded.onlyAttachment,
            prolongation = excluded.prolongation
    `);
    
    for (const o of normalized.zapytania_odpowiedzi) {
        stmtOdpowiedzi.run(
            o.zapytanie_term, o.zapytanie_num, o.key, o.from_author,
            o.receiptDate, o.lastModified, o.onlyAttachment, o.prolongation
        );
    }
    
    console.log(`[Normalizer] ✓ Saved zapytania successfully`);
}
