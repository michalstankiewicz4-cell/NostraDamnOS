# QUERIES.JS - Zaawansowane zapytania

## 📋 Przegląd

Moduł `queries.js` to zaawansowany system zapytań, który automatycznie pobiera i łączy dane z wielu modułów API Sejmu. Umożliwia wykonywanie skomplikowanych analiz w 1-3 liniach kodu.

## 🎯 Funkcje

### 1. **getPoselVotingHistory()** - Historia głosowań posła

Pobiera pełną historię głosowań posła wraz ze statystykami.

```javascript
import { getPoselVotingHistory } from './fetcher/modules/queries.js';

// Użyj nazwiska
const historia = await getPoselVotingHistory('Adamczyk', {
    kadencja: 10,
    posiedzeniaLimit: 10,
    limit: 50  // Max 50 głosowań
});

// Lub użyj ID
const historia2 = await getPoselVotingHistory(1, {
    kadencja: 10
});

// Wynik:
// {
//   posel: { id, firstName, lastName, club },
//   historia: [
//     { sitting, votingNumber, date, topic, vote, totalYes, totalNo, ... }
//   ],
//   stats: { yes: 150, no: 80, abstain: 10, absent: 5 },
//   total: 245
// }
```

### 2. **getPoselVotingOnProjects()** - Głosowania nad projektami

Analizuje jak poseł głosował nad projektami zawierającymi keyword.

```javascript
import { getPoselVotingOnProjects } from './fetcher/modules/queries.js';

const analiza = await getPoselVotingOnProjects({
    poselId: 'Adamczyk',  // Lub ID
    projectKeyword: 'zdrowie',
    kadencja: 10,
    posiedzeniaLimit: 10
});

// Wynik:
// {
//   posel: { id, firstName, lastName, club },
//   keyword: 'zdrowie',
//   projektCount: 45,
//   glosowaniaCount: 23,
//   stats: { yes: 18, no: 3, abstain: 2 },
//   results: [
//     { projekt: {...}, glosowanie: {...}, vote: 'YES' }
//   ]
// }
```

### 3. **getClubVotingStats()** - Statystyki klubu

Pobiera kompleksowe statystyki głosowań klubu parlamentarnego.

```javascript
import { getClubVotingStats } from './fetcher/modules/queries.js';

const stats = await getClubVotingStats('PiS', {
    kadencja: 10,
    posiedzeniaLimit: 20
});

// Wynik:
// {
//   klub: 'PiS',
//   totalVotings: 150,
//   votes: { yes: 12000, no: 8000, abstain: 500, absent: 1000 },
//   jednomyslnosc: 85,  // % głosowań z 100% zgodności
//   topTopics: { 'Projekt ustawy...': 5, ... }
// }
```

### 4. **comparePoselVoting()** - Porównanie posłów

Porównuje wzorce głosowania dwóch posłów.

```javascript
import { comparePoselVoting } from './fetcher/modules/queries.js';

const porownanie = await comparePoselVoting('Adamczyk', 'Adamowicz', {
    kadencja: 10,
    posiedzeniaLimit: 15
});

// Wynik:
// {
//   posel1: { id, firstName, lastName, club },
//   posel2: { id, firstName, lastName, club },
//   total: 120,
//   zgodne: 30,
//   rozne: 90,
//   zgodnosc: 25,  // %
//   opis: 'Adamczyk i Adamowicz głosowali zgodnie w 25% głosowań',
//   roznice: [  // Pierwsze 10 różnic
//     { sitting, votingNumber, vote1, vote2, ... }
//   ]
// }
```

### 5. **getPoselProfile()** - Kompleksowy profil posła

Pobiera wszystkie dostępne informacje o pośle w jednym zapytaniu.

```javascript
import { getPoselProfile } from './fetcher/modules/queries.js';

const profil = await getPoselProfile('Adamczyk', {
    kadencja: 10,
    posiedzeniaLimit: 5
});

// Wynik:
// {
//   dane: {  // Wszystkie dane osobowe
//     id, firstName, lastName, club, district, email, ...
//   },
//   interpelacje: {
//     total: 15,
//     lista: [...]  // Pierwsze 10
//   },
//   glosowania: {
//     total: 245,
//     stats: { yes, no, abstain, absent },
//     ostatnie: [...]  // Ostatnie 10
//   },
//   aktywnosc: {
//     interpelacje: 15,
//     glosowania: 245,
//     obecnosc: 92  // % obecności
//   }
// }
```

### 6. **getKlubProfile()** - Kompleksowy profil klubu

Pobiera wszystkie dostępne informacje o klubie parlamentarnym.

```javascript
import { getKlubProfile } from './fetcher/modules/queries.js';

const profil = await getKlubProfile('PiS', {
    kadencja: 10,
    posiedzeniaLimit: 10
});

// Wynik:
// {
//   klub: 'PiS',
//   poslowie: {
//     total: 202,
//     lista: [{ id, firstName, lastName }, ...]
//   },
//   glosowania: {
//     totalVotings, votes, jednomyslnosc, ...
//   },
//   interpelacje: {
//     total: 450,
//     naPoselka: 2.2
//   },
//   statystyki: {
//     liczbaPostow: 202,
//     interpelacji: 450,
//     glosowań: 150,
//     jednomyslnosc: 85
//   }
// }
```

## 🚀 Przykłady użycia

### Scenariusz 1: Dashboard posła

```javascript
import { getPoselProfile } from './fetcher/modules/queries.js';

// Jeden call, wszystkie dane
const dashboard = await getPoselProfile('Kowalski', {
    kadencja: 10,
    posiedzeniaLimit: 10
});

console.log(`
  ${dashboard.dane.firstName} ${dashboard.dane.lastName}
  Klub: ${dashboard.dane.club}
  Okręg: ${dashboard.dane.districtName}
  
  Interpelacji: ${dashboard.interpelacje.total}
  Głosowań: ${dashboard.glosowania.total}
  Obecność: ${dashboard.aktywnosc.obecnosc}%
  
  Za: ${dashboard.glosowania.stats.yes}
  Przeciw: ${dashboard.glosowania.stats.no}
`);
```

### Scenariusz 2: Analiza tematyczna

```javascript
import { getPoselVotingOnProjects } from './fetcher/modules/queries.js';

// Jak poseł głosował nad projektami o zdrowiu
const zdrowie = await getPoselVotingOnProjects({
    poselId: 'Kowalski',
    projectKeyword: 'zdrowie',
    kadencja: 10
});

console.log(`
  Znaleziono ${zdrowie.projektCount} projektów o zdrowiu
  Poseł głosował w ${zdrowie.glosowaniaCount} głosowaniach
  
  Za: ${zdrowie.stats.yes}
  Przeciw: ${zdrowie.stats.no}
  Wstrzymał się: ${zdrowie.stats.abstain}
`);

// Szczegóły
zdrowie.results.forEach(r => {
    console.log(`
      ${r.projekt.title}
      Głosowanie: ${r.glosowanie.date}
      Głos: ${r.vote}
    `);
});
```

### Scenariusz 3: Porównanie koalicji

```javascript
import { getClubVotingStats, compareKluby } from './fetcher/modules/queries.js';

// Statystyki każdego klubu
const pis = await getClubVotingStats('PiS', { kadencja: 10 });
const ko = await getClubVotingStats('KO', { kadencja: 10 });

console.log(`
  PiS:
    Jednomyślność: ${pis.jednomyslnosc}%
    Za: ${pis.votes.yes}, Przeciw: ${pis.votes.no}
  
  KO:
    Jednomyślność: ${ko.jednomyslnosc}%
    Za: ${ko.votes.yes}, Przeciw: ${ko.votes.no}
`);

// Porównaj zgodność
import { compareKluby } from './fetcher/modules/analyzer.js';
import { fetchGlosowania, fetchGlosowaniaWithDetails } from './fetcher/modules/glosowania.js';

const glosowania = await fetchGlosowania({ kadencja: 10, posiedzenia: [1,2,3] });
const details = await fetchGlosowaniaWithDetails(glosowania.slice(0, 20));
const porownanie = compareKluby(details, 'PiS', 'KO');

console.log(`
  Zgodność PiS vs KO: ${porownanie.zgodnosc}%
`);
```

### Scenariusz 4: Znalezienie podobnych posłów

```javascript
import { comparePoselVoting } from './fetcher/modules/queries.js';

const porownania = [];

for (const posel2 of poslowie.slice(0, 10)) {
    const p = await comparePoselVoting('Kowalski', posel2.lastName, {
        kadencja: 10,
        posiedzeniaLimit: 5
    });
    
    porownania.push({
        posel: p.posel2.lastName,
        klub: p.posel2.club,
        zgodnosc: p.zgodnosc
    });
}

// Sortuj po zgodności
porownania.sort((a, b) => b.zgodnosc - a.zgodnosc);

console.log('Posłowie najbardziej zgodni z Kowalskim:');
porownania.slice(0, 5).forEach(p => {
    console.log(`  ${p.posel} (${p.klub}): ${p.zgodnosc}%`);
});
```

## ⚙️ Konfiguracja

Wszystkie funkcje przyjmują obiekt config:

```javascript
{
    kadencja: 10,           // Numer kadencji
    typ: 'sejm',            // 'sejm' lub 'senat'
    posiedzeniaLimit: 10,   // Max liczba posiedzeń do przeanalizowania
    limit: 50               // Max wyników (gdzie applicable)
}
```

## 🎯 Optymalizacja

### Limity dla wydajności

```javascript
// Zamiast wszystkich posiedzeń (wolne)
const profil = await getPoselProfile('Kowalski', {
    kadencja: 10,
    posiedzeniaLimit: 5  // Tylko 5 pierwszych posiedzeń
});

// Zamiast wszystkich głosowań (wolne)
const historia = await getPoselVotingHistory('Kowalski', {
    kadencja: 10,
    limit: 30  // Tylko 30 głosowań
});
```

### Cache dla wielokrotnych zapytań

```javascript
// Pobierz raz, użyj wiele razy
const poslowie = await fetchPoslowie({ kadencja: 10 });
const glosowania = await fetchGlosowania({ kadencja: 10, posiedzenia: [1,2,3] });
const details = await fetchGlosowaniaWithDetails(glosowania);

// Teraz użyj funkcji z analyzer.js (bez API calls)
const stats1 = createKlubStats(details, 'PiS');
const stats2 = createKlubStats(details, 'KO');
const porownanie = compareKluby(details, 'PiS', 'KO');
```

## 📊 Przykładowe czasy wykonania

```
getPoselVotingHistory (3 posiedzenia, 30 głosowań):  ~5-8s
getPoselVotingOnProjects (10 posiedzeń):             ~8-12s
getClubVotingStats (5 posiedzeń):                    ~3-5s
comparePoselVoting (5 posiedzeń):                    ~5-8s
getPoselProfile (5 posiedzeń):                       ~10-15s
getKlubProfile (5 posiedzeń):                        ~8-12s
```

## 🔗 Powiązane moduły

- **analyzer.js** - Operacje na lokalnych danych (szybkie)
- **poslowie.js** - Podstawowe funkcje dla posłów
- **glosowania.js** - Funkcje głosowań
- **interpelacje.js** - Funkcje interpelacji
- **projekty_ustaw.js** - Projekty ustaw

## 💡 Best Practices

1. **Używaj limitów** - Zawsze określaj `posiedzeniaLimit` dla szybszych zapytań
2. **Cache danych** - Pobierz raz, analizuj wiele razy
3. **Łącz z analyzer.js** - Dla operacji na lokalnych danych użyj analyzer.js
4. **Nazwiska > ID** - Funkcje akceptują nazwiska dla wygody
5. **Error handling** - Zawsze opakowuj w try-catch

## 🎉 Podsumowanie

Moduł `queries.js` to **najwyższa warstwa abstrakcji** w NostraDamnOS:

```
queries.js          ← Zaawansowane zapytania (1-3 linie kodu)
    ↓
analyzer.js         ← Analiza lokalnych danych
    ↓
glosowania.js       ← Funkcje głosowań
poslowie.js         ← Funkcje posłów
interpelacje.js     ← Funkcje interpelacji
    ↓
API Sejmu           ← Surowe dane
```

**Użyj queries.js gdy chcesz:**
- Szybko uzyskać kompleksowe wyniki
- Nie martwić się o wiele API calls
- Pisać mniej kodu

**Użyj analyzer.js gdy chcesz:**
- Pracować na już pobranych danych
- Maksymalną wydajność
- Pełną kontrolę nad danymi
