// Funkcje pomocnicze do pracy z danymi JSONL

/**
 * Parsuje plik JSONL do tablicy obiektów
 */
export function parseJSONL(text) {
    const lines = text.trim().split('\n');
    const data = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
            const entry = JSON.parse(line);
            data.push(entry);
        } catch (error) {
            console.warn(`Błąd parsowania linii ${i + 1}:`, error);
        }
    }
    
    return data;
}

/**
 * Liczy słowa w tekście
 */
export function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
}

/**
 * Wyświetla informacje o wczytanym pliku
 */
export function displayFileInfo(fileName, count) {
    const fileInfoDiv = document.getElementById('fileInfo');
    fileInfoDiv.classList.add('visible');
    fileInfoDiv.innerHTML = `
        <strong>📄 ${fileName}</strong><br>
        Wczytano: ${count} wypowiedzi
    `;
}

/**
 * Grupuje wypowiedzi według klucza
 */
export function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
}

/**
 * Sortuje wypowiedzi według daty
 */
export function sortByDate(array, ascending = true) {
    return array.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return ascending ? dateA - dateB : dateB - dateA;
    });
}

/**
 * Filtruje wypowiedzi według kryteriów
 */
export function filterSpeeches(array, filters) {
    return array.filter(item => {
        for (const [key, value] of Object.entries(filters)) {
            if (item[key] !== value) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Pobiera unikalne wartości dla klucza
 */
export function getUniqueValues(array, key) {
    return [...new Set(array.map(item => item[key]))];
}

/**
 * Oblicza statystyki dla wypowiedzi
 */
export function calculateStats(speeches) {
    const totalWords = speeches.reduce((sum, speech) => sum + countWords(speech.text), 0);
    const avgWords = totalWords / speeches.length;
    
    return {
        total: speeches.length,
        totalWords,
        avgWords: Math.round(avgWords),
        speakers: getUniqueValues(speeches, 'speaker').length,
        parties: getUniqueValues(speeches, 'party').length
    };
}
