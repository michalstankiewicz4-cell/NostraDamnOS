// rodo.js — centralny filtr danych wrażliwych
// Usuwa pola zdefiniowane w RODO_RULES z każdego modułu raw

export const RODO_RULES = {
    poslowie: ['telefon', 'adres', 'pesel', 'email_domowy', 'email'],
    interpelacje: ['adres'],
    oswiadczenia: ['adres_zamieszkania'],
    zapytania: [], // Zapytania pisemne - brak wrażliwych pól (zawartość jest publiczna)
    zapytania_odpowiedzi: [], // Odpowiedzi na zapytania - brak wrażliwych pól
    // Możesz dopisywać kolejne moduły i pola
};

export function applyRodo(raw, rules = RODO_RULES) {
    const cleaned = {};

    for (const key of Object.keys(raw)) {
        const rows = raw[key];
        const moduleRules = rules[key] || [];

        if (!Array.isArray(rows)) {
            cleaned[key] = rows;
            continue;
        }

        cleaned[key] = rows.map(row => {
            const copy = { ...row };
            moduleRules.forEach(field => {
                if (field in copy) delete copy[field];
            });
            return copy;
        });
    }

    return cleaned;
}
