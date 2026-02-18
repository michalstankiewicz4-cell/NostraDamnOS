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

const RODO_CHUNK_SIZE = 2000;

export async function applyRodo(raw, rules = RODO_RULES) {
    const cleaned = {};

    for (const key of Object.keys(raw)) {
        const rows = raw[key];
        const moduleRules = rules[key] || [];

        if (!Array.isArray(rows) || moduleRules.length === 0) {
            cleaned[key] = rows;
            continue;
        }

        // Małe tablice: synchronicznie (bez overhead)
        if (rows.length <= RODO_CHUNK_SIZE) {
            cleaned[key] = rows.map(row => {
                const copy = { ...row };
                moduleRules.forEach(field => { if (field in copy) delete copy[field]; });
                return copy;
            });
            continue;
        }

        // Duże tablice: chunki z yield to main thread
        const result = [];
        for (let i = 0; i < rows.length; i += RODO_CHUNK_SIZE) {
            const end = Math.min(i + RODO_CHUNK_SIZE, rows.length);
            for (let j = i; j < end; j++) {
                const copy = { ...rows[j] };
                moduleRules.forEach(field => { if (field in copy) delete copy[field]; });
                result.push(copy);
            }
            await new Promise(r => setTimeout(r, 0));
        }
        cleaned[key] = result;
    }

    return cleaned;
}
