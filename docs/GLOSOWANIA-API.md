# GLOSOWANIA.JS - Rozszerzona dokumentacja

## 📋 Przegląd

Moduł `glosowania.js` został rozbudowany o zaawansowane funkcje analizy głosowań z dostępem do indywidualnych głosów posłów.

## 🎯 Nowe funkcjonalności

### 1. **fetchGlosowanieDetails()** - Szczegółowe dane głosowania
```javascript
import { fetchGlosowanieDetails } from './fetcher/modules/glosowania.js';

const szczegoly = await fetchGlosowanieDetails({
    sitting: 1,
    votingNumber: 18,
    kadencja: 10,
    typ: 'sejm'
});

// Zwraca:
// {
//   votingNumber: 18,
//   sitting: 1,
//   yes: 273,
//   no: 178,
//   abstain: 3,
//   votes: [
//     { MP: 1, firstName: "Andrzej", lastName: "Adamczyk", club: "PiS", vote: "NO" },
//     { MP: 2, firstName: "Piotr", lastName: "Adamowicz", club: "KO", vote: "YES" },
//     ...460 głosów...
//   ]
// }
```

### 2. **findGlosowaniaNadProjektem()** - Znajdź głosowania nad ustawą
```javascript
import { findGlosowaniaNadProjektem } from './fetcher/modules/glosowania.js';

// Masz listę głosowań i numer druku
const glosowania = await fetchGlosowania(config);
const glosowaniaNadDrukiem20 = findGlosowaniaNadProjektem(glosowania, 20);

// Zwraca tablicę głosowań które dotyczą druku nr 20
```

### 3. **analizujGlosy()** - Analiza statystyczna
```javascript
import { analizujGlosy } from './fetcher/modules/glosowania.js';

const analiza = analizujGlosy(szczegoly);

// Zwraca:
// {
//   total: 460,
//   za: { count: 273, poslowie: [...] },
//   przeciw: { count: 178, poslowie: [...] },
//   wstrzymali: { count: 3, poslowie: [...] },
//   kluby: {
//     "PiS": { za: 10, przeciw: 178, wstrzymali: 0, total: 191 },
//     "KO": { za: 155, przeciw: 0, wstrzymali: 2, total: 157 },
//     ...
//   }
// }
```

### 4. **getGlosPosla()** - Głos konkretnego posła
```javascript
import { getGlosPosla } from './fetcher/modules/glosowania.js';

const glosPosla = getGlosPosla(szczegoly, 1); // ID posła

// Zwraca:
// {
//   MP: 1,
//   firstName: "Andrzej",
//   lastName: "Adamczyk",
//   club: "PiS",
//   vote: "NO"
// }
```

### 5. **createGlosowanieReport()** - Raport tekstowy
```javascript
import { createGlosowanieReport, analizujGlosy } from './fetcher/modules/glosowania.js';

const analiza = analizujGlosy(szczegoly);
const raport = createGlosowanieReport(analiza);

console.log(raport);
// Wyświetla sformatowany raport z pełną analizą
```

## 🔄 Pełny przykład: Od projektu do głosów

```javascript
import { fetchProjektyUstaw } from './fetcher/modules/projekty_ustaw.js';
import { 
    fetchGlosowania, 
    findGlosowaniaNadProjektem,
    fetchGlosowanieDetails,
    analizujGlosy 
} from './fetcher/modules/glosowania.js';

async function ktoGlosowalZaUstawe() {
    // KROK 1: Znajdź projekt ustawy
    const projekty = await fetchProjektyUstaw({ kadencja: 10, typ: 'sejm' });
    const projekt = projekty.find(p => p.title.includes('komisji sejmowych'));
    
    console.log(`Znaleziono druk nr ${projekt.number}`);
    
    // KROK 2: Pobierz wszystkie głosowania
    const glosowania = await fetchGlosowania({ 
        kadencja: 10, 
        typ: 'sejm',
        posiedzenia: [1, 2, 3] // pierwsze 3 posiedzenia
    });
    
    // KROK 3: Znajdź głosowania nad tym projektem
    const glosowaniaNadProjektem = findGlosowaniaNadProjektem(glosowania, projekt.number);
    
    console.log(`Znaleziono ${glosowaniaNadProjektem.length} głosowań nad tym projektem`);
    
    // KROK 4: Pobierz szczegóły pierwszego głosowania
    const pierwsze = glosowaniaNadProjektem[0];
    const szczegoly = await fetchGlosowanieDetails({
        sitting: pierwsze.sitting,
        votingNumber: pierwsze.votingNumber,
        kadencja: 10,
        typ: 'sejm'
    });
    
    // KROK 5: Analizuj głosy
    const analiza = analizujGlosy(szczegoly);
    
    console.log(`Za: ${analiza.za.count} posłów`);
    console.log(`Przeciw: ${analiza.przeciw.count} posłów`);
    
    // Pokaż posłów którzy głosowali ZA
    console.log('\nPosłowie którzy głosowali ZA:');
    analiza.za.poslowie.slice(0, 10).forEach(p => {
        console.log(`- ${p.firstName} ${p.lastName} (${p.club})`);
    });
    
    // Pokaż podział po klubach
    console.log('\nPodział po klubach:');
    Object.entries(analiza.kluby).forEach(([klub, stats]) => {
        console.log(`${klub}: Za: ${stats.za}, Przeciw: ${stats.przeciw}`);
    });
}
```

## 📊 Typy głosów

- `YES` - Za
- `NO` - Przeciw
- `ABSTAIN` - Wstrzymał się
- Inne wartości - Nie głosował (nieobecny, brak uprawnień, etc.)

## 🏛️ Analiza po klubach

Każde głosowanie zawiera pełny podział na kluby parlamentarne z liczbą głosów:
- Za
- Przeciw  
- Wstrzymało się
- Nie głosowało
- Suma

## 💡 Przypadki użycia

### Sprawdzenie jak klub głosował
```javascript
const analiza = analizujGlosy(szczegoly);
const klubPiS = analiza.kluby['PiS'];
console.log(`PiS: ${klubPiS.za} za, ${klubPiS.przeciw} przeciw`);
```

### Historia głosowań posła
```javascript
const glosowania = await fetchGlosowaniaWithDetails(allVotings, config);
const historiaPostla = glosowania.map(g => ({
    votingNumber: g.votingNumber,
    vote: getGlosPosla(g, poselId)?.vote
}));
```

### Wyszukiwanie głosowań nad konkretnymi projektami
```javascript
const projektyOZdrowiu = projekty.filter(p => 
    p.title.toLowerCase().includes('zdrowie')
);

projektyOZdrowiu.forEach(projekt => {
    const glosowania = findGlosowaniaNadProjektem(allVotings, projekt.number);
    console.log(`Druk ${projekt.number}: ${glosowania.length} głosowań`);
});
```

## 🔧 Integracja z bazą danych

Wszystkie funkcje zwracają dane gotowe do zapisu w SQLite:

```javascript
// Tabela głosowań szczegółowych
CREATE TABLE glosowania_szczegoly (
    id INTEGER PRIMARY KEY,
    sitting INTEGER,
    voting_number INTEGER,
    posel_id INTEGER,
    posel_imie TEXT,
    posel_nazwisko TEXT,
    klub TEXT,
    glos TEXT
);

// Import danych
const szczegoly = await fetchGlosowanieDetails({...});
szczegoly.votes.forEach(vote => {
    db.run(`INSERT INTO glosowania_szczegoly VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [null, szczegoly.sitting, szczegoly.votingNumber, 
         vote.MP, vote.firstName, vote.lastName, vote.club, vote.vote]
    );
});
```

## 📈 Wydajność

- Podstawowe głosowania: ~100-200ms na posiedzenie
- Szczegóły z votes: ~300-500ms na głosowanie
- Batch szczegółów: ~1-2s dla 5 głosowań
- Analiza: <10ms (obliczenia lokalne)

## ⚠️ Ważne uwagi

1. **Pole `votes` tylko w szczegółach** - Podstawowe API `/votings/{sitting}` nie zwraca indywidualnych głosów
2. **Użyj `/votings/{sitting}/{votingNumber}`** - Aby pobrać pole `votes`
3. **Duże dane** - Każde głosowanie to ~460 głosów posłów
4. **Optymalizacja** - Używaj batch funkcji dla wielu głosowań naraz

## 🎓 Przykłady z rzeczywistego API

Głosowanie nad drukiem nr 20 (1. posiedzenie, głosowanie 18):
```
Data: 2023-11-21
Temat: głosowanie nad przyjęciem wniosku z druku
Za: 273 posłów
Przeciw: 178 posłów  
Wstrzymało się: 3 posłów

Kluby:
- PiS: 10 za, 178 przeciw (191 posłów)
- KO: 155 za, 0 przeciw (157 posłów)
- PSL-TD: 32 za, 0 przeciw (32 posłów)
- Konfederacja: 16 za, 0 przeciw, 1 wstrzymał (17 posłów)
- Polska2050-TD: 33 za (33 posłów)
- Lewica: 25 za (25 posłów)
- Kukiz15: 2 za (2 posłów)
```
