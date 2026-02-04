# 🏗️ Architektura Systemu

## Przegląd

System pobiera dane z API Sejmu bezpośrednio w przeglądarce, wykorzystując:
- **localStorage** - lekki cache metadanych (~50KB)
- **SQLite w RAM** - pełna baza danych (5-50MB, resetuje się przy F5)
- **Inteligentny fetching** - pobiera tylko brakujące dane

---

## Diagram przepływu danych (v2.1)

```
┌─────────────────────┐
│   UI (ETL Panel)    │
│  • Wybierz zakres   │
│  • Checkbox RODO ✅ │
│  • Kliknij przycisk │
└──────────┬──────────┘
           │
           ▼
┌───────────────────────────────────┐
│      Pipeline v2.0                │
│  1. Sprawdź cache (incremental)   │
│  2. Wywołaj Fetcher               │
│  3. 🛡️ RODO Filter (opcjonalnie)  │
│  4. Wywołaj Normalizer            │
│  5. Zapisz do SQLite              │
└─────┬─────────────────────────┬───┘
      │                         │
      ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│  Metadata    │      │   Fetcher v2.0   │
│  (SQLite)    │      │  • 12 modułów    │
│              │      │  • safeFetch()   │
│ • last_pos   │      │  • Retry 3x      │
│ • last_update│      │  • Timeout 30s   │
│ • config     │      │                  │
│   ~1KB       │      │ api.sejm.gov.pl  │
└──────┬───────┘      └────────┬─────────┘
       │                       │
       │                       ▼
       │              ┌─────────────────┐
       │              │  🛡️ RODO Filter │
       │              │  • Usuwa email  │
       │              │  • Usuwa telefon│
       │              │  • Usuwa PESEL  │
       │              │  • Usuwa adresy │
       │              └────────┬────────┘
       │                       │
       │                       ▼
       │              ┌─────────────────┐
      │              │  Normalizer v2.0│
      │              │  • 12 modułów   │
       │              │  • UPSERT       │
       │              │  • Clean data   │
       │              └────────┬────────┘
       │                       │
       └───────┬───────────────┘
               ▼
      ┌────────────────┐
      │   SQLite DB    │
      │   (sql.js)     │
      │                │
      │ • 13 tabel     │
      │ • Foreign keys │
      │ • Indexes      │
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

### 1. pipeline.js (ETL orchestrator)
**Rola:** Główny koordynator ETL v2.0

**Kluczowe funkcje:**
```javascript
runPipeline(config, callbacks)
  ├─ ensureDbInit() - inicjalizuj SQLite (db2)
  ├─ getCachedSittings() - sprawdź incremental cache
  ├─ runFetcher() - pobierz z API
  ├─ applyRodo() - usuń dane wrażliwe
  ├─ runNormalizer() - UPSERT do DB
  └─ updateCacheMetadata() - zapisz metadata
```

**Logika:**
- Sprawdza cache PRZED pobieraniem
- Pobiera TYLKO brakujące dane
- Progress bar (0-100%)
- Szczegółowe logi
- Error handling (timeout, 429, validation)

---

### 2. api-handler-v2.js (UI integration)
**Rola:** Łączy UI z Pipeline (config, callbacks, stan)

**Kluczowe funkcje:**
```javascript
buildConfigFromUI()
updateETLSummary(config)
runPipeline(config, callbacks)
```

**Logika:**
- Buduje config z UI
- Rejestruje callbacki progresu/logów
- Zapisuje ostatnią konfigurację w localStorage

---

### 3. pipeline.js (cache helpers)
**Rola:** Lekki cache metadanych (incremental)

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
getCachedSittings(db)
  ↓
  Zwraca:
  {
    last_posiedzenie: 51,
    max_posiedzenie: 52,
    sittingsToFetch: [52]
  }
```

---

### 4. modules/database-v2.js
**Rola:** SQLite w przeglądarce

**Technologia:** sql.js (SQLite compiled to WebAssembly)

**Schema:**
```sql
CREATE TABLE poslowie (...);
CREATE TABLE wypowiedzi (...);
CREATE TABLE glosowania (...);
-- + 10 innych tabel (w tym zapytania, zapytania_odpowiedzi)
```

**⚠️ Ograniczenia:**
- Baza w **RAM** (nie persistent)
- Resetuje się przy **F5**
- Export: `db.export()` → Blob do pobrania

**API:**
```javascript
await db2.init()                    // Ładuje sql.js + tworzy schema
db2.upsertPoslowie([...])           // UPSERT
db2.upsertWypowiedzi([...])         // UPSERT
const rows = db2.query(sql, params) // SELECT
const stats = db2.getStats()        // Statystyki
const blob = db2.export()           // Eksport .db
```

---

### 5. normalizer/normalizer.js
**Rola:** Transform raw → SQL + UPSERT (12 modułów)

**Algorytm:**
```
1. normalize*(raw)
  - Mapowanie pól API → SQL
  - Walidacja + domyślne wartości
2. save*(db, records)
  - UPSERT do bazy
  - Logi ilości zapisanych rekordów
```

**Wykrywane role:**
- `poseł`, `senator`
- `minister`, `wiceminister`, `premier`
- `marszałek`, `wicemarszałek`, `sekretarz`
- `prezydent`, `prokurator`, `przewodniczący`

---

### 6. fetcher/fetcher.js
**Rola:** Pobieranie z API Sejmu (12 modułów)

**Główne elementy:**
```javascript
// Safe fetch (retry + backoff)
export async function safeFetch(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

// Orkiestracja modułów
export async function runFetcher(config) {
  // uruchamia moduły: poslowie, posiedzenia, wypowiedzi, ...
}
```

---

## Przepływ danych - szczegóły

### Metadata (SQLite + localStorage snapshot)
```
Rozmiar: ~1-5KB
Trwałość: w SQLite + auto-save do localStorage
Format: tabela metadata

Zawartość:
├─ last_posiedzenie: number
├─ last_update: ISO string
├─ last_fetch_config: JSON
└─ last_fetch_stats: JSON

Cel: Szybkie sprawdzenie "co już mamy"
```

### SQLite (Baza)
```
Rozmiar: 5-50MB
Trwałość: Do zamknięcia zakładki (RAM)
Format: SQLite binary (WebAssembly)

Zawartość:
├─ poslowie: 498 rows
├─ posiedzenia: 50-100+ rows
└─ wypowiedzi: 578-10000+ rows

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
