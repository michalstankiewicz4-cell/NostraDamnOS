# 🏗️ Architektura Systemu

## Przegląd

System pobiera dane z API Sejmu bezpośrednio w przeglądarce, wykorzystując:
- **localStorage** - lekki cache metadanych (~50KB)
- **SQLite w RAM** - pełna baza danych (5-50MB, resetuje się przy F5)
- **Inteligentny fetching** - pobiera tylko brakujące dane

---

## Diagram przepływu danych

```
┌─────────────────────┐
│   UI (index.html)   │
│  • Wybierz zakres   │
│  • Kliknij przycisk │
└──────────┬──────────┘
           │
           ▼
┌───────────────────────────────────┐
│      api-handler.js               │
│  1. Sprawdź cache (co mamy?)      │
│  2. Oblicz (co pobrać z API?)     │
│  3. Pobierz brakujące             │
│  4. Normalizuj (dopasuj speakerID)│
│  5. Zapisz SQLite + cache         │
└─────┬─────────────────────────┬───┘
      │                         │
      ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│    Cache     │      │   API Fetcher    │
│ (localStorage)│      │  • Parallel (5x) │
│              │      │  • UTF-8 decode  │
│ • deputies   │      │  • Retry 3x      │
│ • proceedings│      │  • Timeout 30s   │
│ • fetchedSit │      │                  │
│ • flags      │      │ api.sejm.gov.pl  │
│   ~50KB      │      └────────┬─────────┘
└──────┬───────┘               │
       │                       ▼
       │              ┌─────────────────┐
       │              │   Normalizer    │
       │              │  • Match speaker│
       │              │  • Detect role  │
       │              │  • 97.6% success│
       │              └────────┬────────┘
       │                       │
       └───────┬───────────────┘
               ▼
      ┌────────────────┐
      │   SQLite DB    │
      │   (sql.js)     │
      │                │
      │ • deputies     │
      │ • statements   │
      │                │
      │ RAM 5-50MB     │
      │ ⚠️ Non-persist │
      └────────────────┘
```

---

## Scenariusze użycia

### 1️⃣ Pierwsze uruchomienie

```
User: Wybiera "2 posiedzenia", kliknie "Pobierz"
  ↓
api-handler: Sprawdza cache → PUSTY
  ↓
api-handler: Plan = pobierz wszystko (posłowie + 2 posiedzenia)
  ↓
API Fetcher: 
  - fetchDeputies() → 498 posłów (~1s)
  - fetchProceedings() → 65 posiedzeń (~1s)
  - fetchStatements(50) → ~289 wypowiedzi (~8s)
  - fetchStatements(51) → ~289 wypowiedzi (~8s)
  ↓
Normalizer:
  - loadDeputies(498)
  - normalizeAll(578) → 97.6% dopasowane (~0.5s)
  ↓
SQLite:
  - insertDeputies(498)
  - insertStatements(578)
  ↓
Cache:
  - saveCache({
      deputies: [...],
      proceedings: [...],
      fetchedSittings: [50, 51],
      range: 2,
      hasFetchedTranscripts: true
    })
  ↓
UI: ✅ Pobrano 578 wypowiedzi w ~18s
```

---

### 2️⃣ Kolejne uruchomienie (ten sam zakres)

```
User: Kliknię "Pobierz" ponownie (2 posiedzenia)
  ↓
api-handler: Sprawdza cache
  ↓
Cache: 
  - deputies ✅ (świeże, TTL 7 dni)
  - proceedings ✅ (świeże, TTL 1 dzień)
  - fetchedSittings: [50, 51] ✅
  - range: 2 ✅
  ↓
api-handler: Plan = skip API całkowicie!
  ↓
SQLite: 
  - query("SELECT * FROM statements WHERE sitting IN (50,51)")
  - 578 wypowiedzi z RAM
  ↓
UI: ✅ Pobrano 578 wypowiedzi w ~0.3s ⚡
```

---

### 3️⃣ Zwiększenie zakresu (incremental)

```
User: Zmienia na "3 posiedzenia"
  ↓
api-handler: Sprawdza cache
  ↓
Cache:
  - fetchedSittings: [50, 51]
  - range: 2 (mniej niż 3!)
  ↓
api-handler: Plan = pobierz TYLKO posiedzenie 49
  ↓
API Fetcher:
  - fetchStatements(49) → ~280 wypowiedzi (~8s)
  ↓
Normalizer:
  - normalizeAll(280) → 97.6%
  ↓
SQLite:
  - insertStatements(280)
  ↓
Cache:
  - updateCache({
      fetchedSittings: [49, 50, 51], ← DODANO 49
      range: 3
    })
  ↓
UI: ✅ Pobrano 858 wypowiedzi (280 nowych + 578 z cache)
```

---

### 4️⃣ Odświeżenie strony (F5)

```
User: F5
  ↓
SQLite: ❌ RESETUJE SIĘ (baza w RAM)
  ↓
Cache: ✅ Pozostaje (localStorage)
  ↓
User: Kliknię "Pobierz"
  ↓
api-handler: 
  - Cache mówi: "mamy [49,50,51]"
  - SQLite pusty
  ↓
api-handler: Pobiera [49,50,51] PONOWNIE z API
  ↓
(podobnie jak scenariusz 1, ale szybciej bo już normalizowane)
```

---

### 5️⃣ Wyczyść cache

```
User: Kliknię "🗑️ Wyczyść cache"
  ↓
localStorage.clear()
  ↓
Cache: ❌ PUSTY
SQLite: ⚠️ Jeszcze ma dane (do F5)
  ↓
User: F5
  ↓
SQLite: ❌ PUSTY
Cache: ❌ PUSTY
  ↓
System wraca do scenariusza 1 (pierwsze uruchomienie)
```

---

## Komponenty

### 1. api-handler.js (272 linie)
**Rola:** Główny koordynator

**Kluczowe funkcje:**
```javascript
startFetching(range, getTranscripts, getVotings)
  ├─ ensureDbInit() - inicjalizuj SQLite
  ├─ cache.getPlan() - co pobrać?
  ├─ apiFetcher.fetchX() - pobierz z API
  ├─ normalizer.normalizeAll() - dopasuj ID
  ├─ db.insertX() - zapisz do SQLite
  └─ cache.saveCache() - zapisz metadata
```

**Logika:**
- Sprawdza cache PRZED każdym pobieraniem
- Pobiera TYLKO brakujące dane
- Progress bar (0-100%)
- Szczegółowe logi
- Error handling (timeout, 429, validation)

---

### 2. modules/cache.js (141 linii)
**Rola:** Lekki cache metadanych

**Struktura danych:**
```javascript
{
  deputies: [{id, firstName, lastName, club}],      // ~30KB
  proceedings: [{number, dates}],                    // ~5KB
  fetchedSittings: [49, 50, 51],                    // ~0.1KB
  range: 3,                                          // zakres
  hasFetchedTranscripts: true,                       // flaga
  hasFetchedVotings: false,                          // flaga
  deputiesTimestamp: "2026-01-24T12:00:00Z",        // TTL
  proceedingsTimestamp: "2026-01-24T12:00:00Z",     // TTL
  timestamp: "2026-01-24T12:00:00Z"
}
```

**TTL (Time To Live):**
- Posłowie: 7 dni (rzadko się zmieniają)
- Posiedzenia: 1 dzień (często nowe)

**Kluczowe metody:**
```javascript
getPlan(apiFetcher, range, needTranscripts, needVotings)
  ↓
  Zwraca:
  {
    needDeputies: false,              // są w cache
    needProceedings: false,           // są w cache
    sittingsToFetch: [49],            // brakuje 49
    cachedDeputies: [...],
    cachedProceedings: [...]
  }
```

---

### 3. modules/database.js (181 linii)
**Rola:** SQLite w przeglądarce

**Technologia:** sql.js (SQLite compiled to WebAssembly)

**Schema:**
```sql
CREATE TABLE deputies (
    id INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    fullName TEXT,
    club TEXT,
    active BOOLEAN
);

CREATE TABLE statements (
    id TEXT PRIMARY KEY,
    institution TEXT,
    sitting INTEGER,
    date TEXT,
    speakerID INTEGER,
    speakerName TEXT,
    speakerRole TEXT,
    speakerClub TEXT,
    text TEXT,
    textLength INTEGER,
    wordCount INTEGER,
    matched BOOLEAN
);

CREATE INDEX idx_speaker ON statements(speakerID);
CREATE INDEX idx_date ON statements(date);
CREATE INDEX idx_club ON statements(speakerClub);
```

**⚠️ Ograniczenia:**
- Baza w **RAM** (nie persistent)
- Resetuje się przy **F5**
- Export: `db.export()` → Blob do pobrania

**API:**
```javascript
await db.init()                    // Ładuje sql.js + tworzy schema
await db.insertDeputies([...])     // Batch insert
await db.insertStatements([...])   // Batch insert
const rows = db.query(sql, params) // SELECT
const stats = db.getStats()        // Statystyki
const blob = db.export()           // Eksport .db
```

---

### 4. modules/normalizer.js (170 linii)
**Rola:** Dopasowanie mówcy do ID posła

**Algorytm:**
```
1. parseSpeaker(speakerRaw)
   Input:  "Sekretarz Poseł Joanna Wicha"
   Output: {
     role: "poseł",
     position: "Sekretarz Poseł...",
     name: "Joanna Wicha"
   }

2. findDeputyID(name)
   - Normalizuj nazwisko (bez diakrytyków, lowercase)
   - Szukaj exact match w deputiesMap
   - Fallback: częściowe dopasowanie nazwiska
   
3. normalizeStatement()
   - Dopasuj ID (97.6% sukces)
   - Dodaj: speakerID, speakerRole, speakerClub
   - Generuj unikalne ID wypowiedzi
```

**Wykrywane role:**
- `poseł`, `senator`
- `minister`, `wiceminister`, `premier`
- `marszałek`, `wicemarszałek`, `sekretarz`
- `prezydent`, `prokurator`, `przewodniczący`

---

### 5. modules/api-fetcher.js (262 linie)
**Rola:** Pobieranie z API Sejmu

**Kluczowe optymalizacje:**
```javascript
// 1. UTF-8 decode (polskie znaki)
const buffer = await response.arrayBuffer();
const decoder = new TextDecoder('utf-8');
const html = decoder.decode(buffer);

// 2. Parallel fetching (batches po 5)
for (let i = 0; i < nums.length; i += 5) {
    const batch = nums.slice(i, i + 5);
    const results = await Promise.all(
        batch.map(num => fetchTranscript(num))
    );
}

// 3. Probe co 10 (szybkie znajdowanie końca)
for (let probe = 10; probe < 300; probe += 10) {
    const html = await fetch(url);
    if (!html) break;
    maxNum = probe + 10;
}

// 4. Retry 3x + timeout 30s
for (let i = 0; i < 3; i++) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30000);
    try {
        return await fetch(url, { signal: controller.signal });
    } catch (e) {
        if (i === 2) throw e;
    }
}
```

**Wydajność:**
- Serial: ~200s dla 578 wypowiedzi
- Parallel (5x): ~15-20s dla 578 wypowiedzi
- **10-20× szybciej!**

---

## Przepływ danych - szczegóły

### localStorage (Cache)
```
Rozmiar: ~50-100KB
Trwałość: Do wyczyszczenia przeglądarki
Format: JSON string

Zawartość:
├─ deputies: Array<Deputy>          (~30KB)
├─ proceedings: Array<Proceeding>   (~5KB)
├─ fetchedSittings: number[]        (~0.1KB)
├─ range: number
├─ flags: boolean
└─ timestamps: ISO strings

Cel: Szybkie sprawdzenie "co już mamy"
```

### SQLite (Baza)
```
Rozmiar: 5-50MB
Trwałość: Do zamknięcia zakładki (RAM)
Format: SQLite binary (WebAssembly)

Zawartość:
├─ deputies: 498 rows
└─ statements: 578-10000+ rows

Cel: Pełne dane do analizy
```

### API (Zewnętrzne)
```
Źródło: api.sejm.gov.pl
Rate limit: ~100 req/min (nieoficjalnie)
Timeout: 30s per request
Retry: 3x

Endpoints:
├─ /sejm/term10/MP
├─ /sejm/term10/proceedings
├─ /sejm/term10/proceedings/{s}/{d}/transcripts/{n}
└─ /sejm/term10/votings/{s}

Cel: Tylko gdy brakuje danych
```

---

## Wydajność

### Benchmark (2 posiedzenia, 578 wypowiedzi)

| Scenariusz | Czas | Operacje |
|------------|------|----------|
| **Pierwsze pobranie** | ~18s | API (15s) + Normalizacja (0.5s) + SQLite (0.5s) + Cache (0.1s) |
| **Cache hit (pełny)** | ~0.3s | SQLite query only |
| **Incremental (1 nowe)** | ~10s | API (8s) + Normalizacja (0.2s) + SQLite (0.2s) + Cache (0.1s) |
| **Po F5 (re-fetch)** | ~18s | API (15s) + reszta (cache wie co pobrać) |

### Optymalizacje

1. **Parallel fetching (5x):** 10-20× szybciej
2. **Cache:** Skip API całkowicie
3. **Probe co 10:** Szybkie znajdowanie końca
4. **Batch insert:** SQLite zapisuje 500 rows/s
5. **Lightweight cache:** localStorage tylko 50KB

---

## Ograniczenia i TODO

### Aktualne ograniczenia

1. **SQLite non-persistent**
   - Resetuje się przy F5
   - Wymaga re-fetch z API
   - **TODO:** IndexedDB persistence

2. **Cache nie wie o SQLite**
   - Po `localStorage.clear()` pobiera ponownie
   - **TODO:** Sync cache ↔ SQLite

3. **Brak UI do przeglądania**
   - Dane w SQLite, ale nie widać
   - **TODO:** Tabela + wyszukiwarka

### Roadmap

**Faza 1 (DONE):**
- ✅ Inteligentny cache
- ✅ SQLite w przeglądarce
- ✅ Parallel fetching
- ✅ Normalizacja 97.6%

**Faza 2 (TODO - persistence):**
- [ ] IndexedDB dla SQLite
- [ ] Export/import .db
- [ ] Sync cache ↔ SQLite

**Faza 3 (TODO - UI):**
- [ ] Tabela wypowiedzi
- [ ] Wyszukiwarka
- [ ] Filtry (poseł, klub, data)
- [ ] Wykresy

---

## Przykłady użycia

### Konsola przeglądarki

```javascript
// Sprawdź cache
const cache = JSON.parse(localStorage.getItem('parliament_cache'));
console.log(cache.fetchedSittings); // [49, 50, 51]

// Wyczyść cache
localStorage.removeItem('parliament_cache');

// Eksportuj bazę SQLite
// (dostępne globalnie jako db po załadowaniu)
const blob = db.export();
const url = URL.createObjectURL(blob);
window.open(url); // Pobierz .db
```

### Queries SQL

```javascript
// Wszystkie wypowiedzi PiS
const pis = db.query(
    "SELECT * FROM statements WHERE speakerClub = 'PiS' ORDER BY date"
);

// Top 10 najdłuższych wypowiedzi
const longest = db.query(`
    SELECT speakerName, wordCount, LEFT(text, 100) 
    FROM statements 
    ORDER BY wordCount DESC 
    LIMIT 10
`);

// Statystyki klubów
const clubs = db.query(`
    SELECT speakerClub, COUNT(*) as count, AVG(wordCount) as avgWords
    FROM statements
    GROUP BY speakerClub
    ORDER BY count DESC
`);
```

---

**Wersja:** 1.0.0  
**Data:** 2026-01-24  
**Autor:** Michał Stankiewicz
