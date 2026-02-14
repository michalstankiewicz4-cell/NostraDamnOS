/**
 * Security Module — centralne funkcje bezpieczeństwa
 * 
 * escapeHtml — zapobiega XSS przy wstawianiu tekstu do DOM via innerHTML
 * sanitizeSQL — walidacja zapytań SQL generowanych przez AI
 * sanitizeUrl — walidacja URL-i (zapobiega javascript: protocol)
 */

/**
 * Escape HTML entities aby zapobiec XSS
 * Użyj ZAWSZE przed wstawianiem tekstu z zewnętrznych źródeł do innerHTML
 * @param {string} text — tekst do zabezpieczenia
 * @returns {string} bezpieczny HTML
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Walidacja SQL wygenerowanego przez AI — dozwolone TYLKO pojedyncze SELECT
 * Blokuje: multi-statement (;), DML/DDL, ATTACH, PRAGMA, komentarze z podwójnym dashes
 * @param {string} sql — zapytanie SQL
 * @returns {{ safe: boolean, reason?: string }} wynik walidacji
 */
export function sanitizeSQL(sql) {
    if (!sql || typeof sql !== 'string') {
        return { safe: false, reason: 'Brak zapytania SQL' };
    }

    const trimmed = sql.trim();

    // Usuń komentarze jednolinijkowe i blokowe
    const noComments = trimmed
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

    // Musi zaczynać się od SELECT (po usunięciu komentarzy)
    if (!/^SELECT\b/i.test(noComments)) {
        return { safe: false, reason: 'Dozwolone są tylko zapytania SELECT' };
    }

    // Blokuj średnik — zapobiega multi-statement injection
    // Wyjątek: średnik na końcu (opcjonalny terminator)
    const withoutTrailingSemicolon = noComments.replace(/;\s*$/, '');
    if (withoutTrailingSemicolon.includes(';')) {
        return { safe: false, reason: 'Wykryto wiele instrukcji SQL (średnik)' };
    }

    // Blokuj niebezpieczne słowa kluczowe (nawet w subquery)
    // Usuń literały stringów aby nie blokować np. WHERE tekst LIKE '%DELETE%'
    const noStrings = noComments
        .replace(/'[^']*'/g, "''")
        .replace(/"[^"]*"/g, '""');
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|ATTACH|DETACH|PRAGMA|REINDEX|VACUUM|LOAD_EXTENSION)\b/i;
    if (forbidden.test(noStrings)) {
        return { safe: false, reason: 'Wykryto niedozwoloną operację SQL' };
    }

    return { safe: true };
}

/**
 * Walidacja tableName — musi być prostym identyfikatorem (litery, cyfry, podkreślenie)
 * @param {string} name — nazwa tabeli
 * @returns {boolean}
 */
export function isValidTableName(name) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Sanityzacja URL — blokuje javascript:, data:, vbscript: protocols
 * @param {string} url
 * @returns {string} bezpieczny URL lub '#' jeśli niebezpieczny
 */
export function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#';
    return trimmed;
}
