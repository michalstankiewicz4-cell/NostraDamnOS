# POŁĄCZENIA MIĘDZY MODUŁAMI - Analiza i Propozycje

## 🎯 AKTUALNY STAN

### ✅ BEZPOŚREDNIE POŁĄCZENIA (działają natywnie)

```
1. POSEŁ ←→ GŁOS
   poseł.id === vote.MP
   ✅ Działa: TAK
   Użycie: getGlosPosla(glosowanie, poselId)

2. PROJEKT ←→ GŁOSOWANIE
   projekt.number === glosowanie.description (zawiera "druk X")
   ✅ Działa: TAK
   Użycie: findGlosowaniaNadProjektem(glosowania, numerDruku)

3. POSIEDZENIE ←→ GŁOSOWANIE
   posiedzenie.number === glosowanie.sitting
   ✅ Działa: TAK
   Użycie: fetchGlosowania({ posiedzenia: [1, 2, 3] })

4. POSEŁ ←→ INTERPELACJE
   poseł.id === interpelacja.from (string)
   ✅ Działa: TAK (potencjalnie)
   Użycie: BRAK FUNKCJI - DO DODANIA
```

---

## ⚠️ POŁĄCZENIA POŚREDNIE (wymagają wielu kroków)

```
1. POSEŁ → PROJEKTY (jakie projekty popierał poseł)
   Kroki: poseł.id → głosy → głosowania → projekty
   Status: MOŻLIWE, ale brak funkcji pomocniczej

2. KLUB → PROJEKTY (jak klub głosował nad projektami)
   Kroki: klub → posłowie → głosy → głosowania → projekty
   Status: MOŻLIWE, ale brak funkcji pomocniczej

3. PROJEKT → POSŁOWIE (kto głosował za projektem)
   Kroki: projekt → głosowania → szczegóły → głosy → posłowie
   Status: MOŻLIWE, ale brak funkcji pomocniczej
```

---

## ❌ BRAKUJĄCE POŁĄCZENIA (nie ma w API)

```
1. PROJEKT → AUTORZY
   API nie zawiera informacji kto złożył projekt
   Możliwość: NIE (chyba że web scraping)

2. POSEŁ → PROJEKTY (jako autor)
   API nie łączy posła z projektami które złożył
   Możliwość: NIE (chyba że web scraping)

3. KOMISJA → POSŁOWIE (członkowie)
   API nie zwraca składu komisji
   Możliwość: DO SPRAWDZENIA

4. POSEŁ → KOMISJE (członkostwo)
   API nie zwraca w jakich komisjach jest poseł
   Możliwość: DO SPRAWDZENIA
```

---

## 🔧 PROPOZYCJE ROZSZERZEŃ

### WARIANT 1: Nowy moduł "queries.js" (funkcje łączące)

Stworzenie dedykowanego modułu z funkcjami do zaawansowanych zapytań:

```javascript
// fetcher/modules/queries.js

/**
 * Znajdź wszystkie głosowania posła
 */
export async function getPoselVotingHistory(poselId, config) {
    // 1. Pobierz wszystkie głosowania
    // 2. Pobierz szczegóły z votes
    // 3. Wyfiltruj głosy posła
    // 4. Zwróć historię
}

/**
 * Znajdź jak klub głosował nad projektami danego typu
 */
export async function getClubVotingOnProjectType(clubName, projectKeyword, config) {
    // 1. Znajdź projekty z keyword
    // 2. Znajdź głosowania nad tymi projektami
    // 3. Pobierz szczegóły
    // 4. Analiza klubu
}

/**
 * Znajdź interpelacje posła
 */
export async function getPoselInterpelacje(poselId, config) {
    // 1. Pobierz interpelacje
    // 2. Filtruj po from === poselId
}

/**
 * Kompleksowa analiza posła
 */
export async function getPoselProfile(poselId, config) {
    return {
        dane: await getPoselData(poselId),
        glosowania: await getPoselVotingHistory(poselId, config),
        interpelacje: await getPoselInterpelacje(poselId, config),
        statystyki: calculatePoselStats(...)
    };
}

/**
 * Porównaj jak dwóch posłów głosowało
 */
export async function comparePoselVoting(poselId1, poselId2, config) {
    // Analiza zgodności głosowania
}
```

**Zalety:**
- ✅ Czyste oddzielenie logiki
- ✅ Łatwe w użyciu
- ✅ Nie modyfikuje istniejących modułów

**Wady:**
- ⚠️ Nowy moduł do utrzymania
- ⚠️ Duplikacja niektórych zapytań

---

### WARIANT 2: Rozszerzenie istniejących modułów

Dodanie funkcji łączących do istniejących modułów:

```javascript
// W poslowie.js
export async function getPoselWithHistory(poselId, config) {
    const posel = await fetchPoselDetails(poselId);
    const glosowania = await fetchGlosowaniaForPosel(poselId, config);
    const interpelacje = await fetchInterpelacjeForPosel(poselId, config);
    return { ...posel, glosowania, interpelacje };
}

// W glosowania.js (już mamy!)
export function findGlosowaniaNadProjektem(glosowania, numerDruku) {...}
export function getGlosPosla(glosowanie, poselId) {...}

// W projekty_ustaw.js
export async function getProjektWithVotings(numerDruku, config) {
    const projekt = await fetchProjektDetails(numerDruku);
    const glosowania = await findGlosowaniaNadProjektem(...);
    return { ...projekt, glosowania };
}
```

**Zalety:**
- ✅ Logika blisko danych
- ✅ Mniej plików

**Wady:**
- ⚠️ Duże moduły
- ⚠️ Cross-dependencies między modułami

---

### WARIANT 3: Moduł "analyzer.js" (tylko analiza)

Moduł który przyjmuje już pobrane dane i je łączy/analizuje:

```javascript
// analyzer.js

/**
 * Łączy dane z różnych modułów
 * NIE pobiera danych - tylko je łączy
 */

export function linkPoselToVotes(poslowie, glosowania) {
    return poslowie.map(posel => ({
        ...posel,
        glosy: glosowania.flatMap(g => 
            g.votes?.filter(v => v.MP === posel.id) || []
        )
    }));
}

export function linkProjektToVotings(projekty, glosowania) {
    return projekty.map(projekt => ({
        ...projekt,
        glosowania: findGlosowaniaNadProjektem(glosowania, projekt.number)
    }));
}

export function createKlubStats(glosowania, klubName) {
    // Statystyki klubu
}
```

**Zalety:**
- ✅ Szybkie (operacje na lokalnych danych)
- ✅ Nie dotyka API
- ✅ Łatwe do testowania

**Wady:**
- ⚠️ Wymaga wcześniejszego pobrania wszystkich danych
- ⚠️ Nie pobiera danych automatycznie

---

## 💡 REKOMENDACJA

### Kombinacja wariantów:

```
1. Rozszerzyć istniejące moduły o podstawowe funkcje łączące
   → glosowania.js: już ma findGlosowaniaNadProjektem, getGlosPosla ✅
   → poslowie.js: dodać getPoselInterpelacje
   → interpelacje.js: dodać findInterpelacjeByPosel

2. Stworzyć queries.js dla zaawansowanych analiz
   → getPoselProfile
   → comparePoselVoting
   → getClubProjectVoting

3. Stworzyć analyzer.js dla operacji na danych lokalnych
   → linkPoselToVotes
   → linkProjektToVotings
   → createKlubStats
```

---

## 📊 PRZYKŁADY UŻYCIA

### Obecnie (bez rozszerzeń):

```javascript
// Pytanie: "Jak poseł Adamczyk głosował nad projektami o komisjach?"

// KROK 1: Znajdź posła
const poslowie = await fetchPoslowie({ kadencja: 10 });
const posel = poslowie.find(p => p.lastName === 'Adamczyk');

// KROK 2: Znajdź projekty
const projekty = await fetchProjektyUstaw({ kadencja: 10 });
const projektKomisji = projekty.filter(p => p.title.includes('komisji'));

// KROK 3: Dla każdego projektu znajdź głosowania
const glosowania = await fetchGlosowania({ kadencja: 10, posiedzenia: [1,2,3] });
const wyniki = [];

for (const projekt of projektKomisji) {
    const glosowaniaNadProjektem = findGlosowaniaNadProjektem(glosowania, projekt.number);
    
    for (const glos of glosowaniaNadProjektem) {
        const szczegoly = await fetchGlosowanieDetails({
            sitting: glos.sitting,
            votingNumber: glos.votingNumber,
            kadencja: 10
        });
        
        const vote = getGlosPosla(szczegoly, posel.id);
        
        if (vote) {
            wyniki.push({
                projekt: projekt.title,
                glosowanie: glos.votingNumber,
                glos: vote.vote
            });
        }
    }
}

console.log(wyniki);
// WYNIK: 10+ linii kodu, wielokrotne API calls
```

### Po rozszerzeniu (queries.js):

```javascript
// Pytanie: "Jak poseł Adamczyk głosował nad projektami o komisjach?"

import { getPoselVotingOnProjects } from './fetcher/modules/queries.js';

const wyniki = await getPoselVotingOnProjects({
    poselLastName: 'Adamczyk',
    projectKeyword: 'komisji',
    kadencja: 10
});

console.log(wyniki);
// WYNIK: 5 linii kodu, zoptymalizowane API calls
```

---

## 🎯 PRIORYTET IMPLEMENTACJI

### FAZA 1: Podstawowe połączenia (1-2h pracy)

```
1. interpelacje.js:
   ✅ findInterpelacjeByPosel(interpelacje, poselId)
   ✅ findInterpelacjeByRecipient(interpelacje, recipient)

2. poslowie.js:
   ✅ getPoselInterpelacje(poselId, config)

3. analyzer.js (nowy):
   ✅ linkPoselToVotes(poslowie, glosowania)
   ✅ linkProjektToVotings(projekty, glosowania)
```

### FAZA 2: Zaawansowane zapytania (3-4h pracy)

```
4. queries.js (nowy):
   ✅ getPoselVotingHistory(poselId, config)
   ✅ getPoselVotingOnProjects(params)
   ✅ getClubVotingStats(clubName, config)
   ✅ comparePoselVoting(poselId1, poselId2, config)
```

### FAZA 3: Kompleksowe profile (2-3h pracy)

```
5. queries.js:
   ✅ getPoselProfile(poselId, config)
   ✅ getKlubProfile(klubName, config)
   ✅ getProjektProfile(numerDruku, config)
```

---

## 📋 CHECKLIST IMPLEMENTACJI

```
FAZA 1 - Podstawowe:
[ ] Rozszerzyć interpelacje.js
[ ] Rozszerzyć poslowie.js
[ ] Stworzyć analyzer.js
[ ] Testy jednostkowe
[ ] Dokumentacja

FAZA 2 - Zaawansowane:
[ ] Stworzyć queries.js
[ ] Zaimplementować 4 funkcje zapytań
[ ] Optymalizacja API calls (cache)
[ ] Testy integracyjne
[ ] Dokumentacja + przykłady

FAZA 3 - Profile:
[ ] Kompleksowe profile
[ ] Dashboard UI
[ ] Eksport danych
[ ] Dokumentacja końcowa
```

---

## 💬 PODSUMOWANIE

**OBECNY STAN:**
- ✅ 3 bezpośrednie połączenia działają
- ⚠️ Połączenia pośrednie wymagają wielu kroków
- ❌ Brak funkcji pomocniczych

**PO ROZSZERZENIU:**
- ✅ Wszystkie popularne zapytania w 1-2 liniach
- ✅ Zoptymalizowane API calls
- ✅ Łatwe w użyciu
- ✅ Dobrze udokumentowane

**REKOMENDACJA:**
Rozpocząć od FAZY 1 (1-2h pracy) - da natychmiastowe korzyści.
