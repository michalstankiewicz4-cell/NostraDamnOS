# 📁 Struktura Projektu

Kompletny przewodnik po plikach w repozytorium NostraDamnOS.

---

## 📂 Root Directory

### Pliki główne aplikacji

| Plik | Opis | Używany przez |
|------|------|---------------|
| **index.html** | Główny plik HTML, UI aplikacji z ETL Panel | Przeglądarka |
| **style.css** | Style CSS, ETL Panel height: 50vh | index.html |
| **app.js** | Główna logika aplikacji, ładowanie modeli AI | index.html |

### ETL System v2.0

| Plik | Opis | Używany przez |
|------|------|---------------|
| **pipeline.js** | Complete ETL orchestrator (UI → Fetcher → Normalizer → DB) | api-handler-v2.js |
| **api-handler-v2.js** | UI integration, callbacks dla ETL Panel | index.html |
| **etl-bridge.js** | Bridge między UI a Pipeline | index.html |

### Dokumentacja

| Plik | Opis |
|------|------|
| **README.md** | Dokumentacja główna, quick start, features |
| **CHANGELOG.md** | Historia zmian, release notes |
| **.gitignore** | Pliki ignorowane przez Git (data/*, *.db) |

### Narzędzia

| Plik | Opis | Kiedy używać |
|------|------|--------------|
| **fix-height.js** | Utility do szybkiej zmiany wysokości CSS | Gdy trzeba zmienić max-height w style.css |

### Legacy/Mockup

| Plik | Opis |
|------|------|
| **mockup-formularz.html** | Mockup formularza ETL (design reference) |

---

## 📂 /fetcher

**Przeznaczenie:** Pobieranie surowych danych z API Sejmu

| Plik | Opis | Eksportuje |
|------|------|-----------|
| **fetcher.js** | Orchestrator + safeFetch (retry + backoff) | `runFetcher(config)` |

### /fetcher/modules (12 modułów)

| Moduł | Endpoint API | Zwraca |
|-------|--------------|--------|
| **poslowie.js** | `/sejm/poslowie/{kadencja}` | Lista posłów/senatorów |
| **posiedzenia.js** | `/sejm/term{X}/proceedings` | Lista posiedzeń |
| **wypowiedzi.js** | `/sejm/term{X}/proceedings/{sitting}/{date}/transcripts/{num}` | Stenogramy |
| **glosowania.js** | `/sejm/term{X}/votings/{sitting}` | Lista głosowań |
| **glosy.js** | `/sejm/term{X}/votings/{sitting}/{voting}` | Głosy indywidualne |
| **interpelacje.js** | `/sejm/term{X}/interpellations` | Interpelacje |
| **projekty_ustaw.js** | `/sejm/term{X}/prints` | Projekty ustaw (druki) |
| **komisje.js** | `/sejm/term{X}/committees` | Lista komisji |
| **komisje_posiedzenia.js** | `/sejm/term{X}/committees/{code}/sittings` | Posiedzenia komisji |
| **komisje_wypowiedzi.js** | `/sejm/term{X}/committees/{code}/sittings/{num}/statements` | Wypowiedzi w komisjach |
| **oswiadczenia.js** | `/sejm/term{X}/MP/{id}/assets` | Oświadczenia majątkowe |

**Pattern każdego modułu:**
```javascript
export async function fetchModuleName({ kadencja, ... }) {
    const url = `https://api.sejm.gov.pl/...`;
    return await safeFetch(url);
}
```

---

## 📂 /normalizer

**Przeznaczenie:** Transformacja raw JSON → SQL records + zapis do bazy

| Plik | Opis | Eksportuje |
|------|------|-----------|
| **normalizer.js** | Orchestrator, kolejność wykonania | `runNormalizer(db, rawData)` |

### /normalizer/modules (11 modułów)

| Moduł | Funkcje | Tabela docelowa |
|-------|---------|-----------------|
| **poslowie.js** | `normalizePoslowie()`, `savePoslowie()` | `poslowie` |
| **posiedzenia.js** | `normalizePosiedzenia()`, `savePosiedzenia()` | `posiedzenia` |
| **wypowiedzi.js** | `normalizeWypowiedzi()`, `saveWypowiedzi()` | `wypowiedzi` |
| **glosowania.js** | `normalizeGlosowania()`, `saveGlosowania()` | `glosowania` |
| **glosy.js** | `normalizeGlosy()`, `saveGlosy()` | `glosy` |
| **interpelacje.js** | `normalizeInterpelacje()`, `saveInterpelacje()` | `interpelacje` |
| **projekty_ustaw.js** | `normalizeProjektyUstaw()`, `saveProjektyUstaw()` | `projekty_ustaw` |
| **komisje.js** | `normalizeKomisje()`, `saveKomisje()` | `komisje` |
| **komisje_posiedzenia.js** | `normalizeKomisjePosiedzenia()`, `saveKomisjePosiedzenia()` | `komisje_posiedzenia` |
| **komisje_wypowiedzi.js** | `normalizeKomisjeWypowiedzi()`, `saveKomisjeWypowiedzi()` | `komisje_wypowiedzi` |
| **oswiadczenia_majatkowe.js** | `normalizeOswiadczenia()`, `saveOswiadczenia()` | `oswiadczenia_majatkowe` |

**Pattern każdego modułu:**
```javascript
// 1. Transform
export function normalizeModuleName(raw) {
    return raw.map(item => ({ ...mapped }));
}

// 2. Save (UPSERT)
export function saveModuleName(db, records) {
    const stmt = db.prepare('INSERT ... ON CONFLICT DO UPDATE');
    records.forEach(r => stmt.run([...]));
    stmt.free();
}
```

---

## 📂 /modules

**Przeznaczenie:** Moduły wspomagające, database, AI, utilities

| Plik | Opis | Eksportuje |
|------|------|-----------|
| **database-v2.js** | SQLite wrapper, 12 tabel + indexes | `db2` object |
| **geo.js** | Geolokalizacja (tylko Europa), timezone check | `enforceEuropeOnly()` |
| **nlp.js** | Transformers.js integration (plan) | `initNLP()`, `analyzeSentiment()` |
| **webllm.js** | WebLLM 4B integration (plan) | `initWebLLM()`, `generateSummary()` |
| **utils.js** | Utilities (parseJSONL, countWords) | Various helpers |
| **api-fetcher.js** | Legacy fetcher v1 (opcjonalny) | `fetchData()` |
| **cache.js** | Legacy localStorage cache (opcjonalny) | Cache helpers |
| **data-loader.js** | Legacy JSONL loader (opcjonalny) | `loadAll()` |

### database-v2.js szczegóły

**Struktura:**
```javascript
export const db2 = {
    sql: null,
    database: null,
    
    // Inicjalizacja
    async init()
    async createSchema()
    
    // UPSERT methods (11x)
    upsertPoslowie(data)
    upsertPosiedzenia(data)
    upsertWypowiedzi(data)
    // ... (8 more)
    
    // Query methods
    getPoslowie(filters)
    getWypowiedzi(filters)
    getStats()
    
    // Utils
    clearAll()
    upsertMetadata(key, value)
    export()
    import(data)
}
```

**12 tabel:**
1. `poslowie` - Posłowie/Senatorowie
2. `posiedzenia` - Posiedzenia
3. `wypowiedzi` - Wypowiedzi plenarne
4. `glosowania` - Głosowania
5. `glosy` - Głosy indywidualne
6. `interpelacje` - Interpelacje
7. `projekty_ustaw` - Projekty ustaw
8. `komisje` - Komisje
9. `komisje_posiedzenia` - Posiedzenia komisji
10. `komisje_wypowiedzi` - Wypowiedzi w komisjach
11. `oswiadczenia_majatkowe` - Oświadczenia majątkowe
12. `metadata` - Cache + metadane

---

## 📂 /docs

**Przeznaczenie:** Dokumentacja techniczna

| Plik | Opis | Dla kogo |
|------|------|----------|
| **ARCHITECTURE.md** | Przegląd architektury systemu | Developers |
| **DATABASE-V2.md** | Schema 12 tabel, indexes, queries | Developers |
| **FETCHER-V2.md** | Dokumentacja 12 modułów fetch | Developers |
| **NORMALIZER-V2.md** | Dokumentacja 11 modułów transform | Developers |
| **PIPELINE-V2.md** | Orchestration, callbacks, flow | Developers |
| **INCREMENTAL-CACHE.md** | Smart caching (10× faster) | Developers |
| **GEO.md** | Geolocation restriction (Europa) | Developers |
| **DATA-STRUCTURE-V2.md** | Struktura danych z API | Developers |
| **TESTING.md** | Testing strategy | Developers |
| **TODO-DATA.md** | Roadmap, status, future features | Everyone |
| **UI-MOCKUP-*.txt** | UI mockups (design reference) | Designers |

---

## 📂 /data

**Przeznaczenie:** Dane JSONL (legacy, opcjonalne)

**Struktura:**
```
/data
├── manifest.json         # Manifest v1
├── manifest-v2.json      # Manifest v2
├── README.md             # Instrukcje
├── /sejm                 # Raw data z API
│   ├── poslowie.jsonl
│   ├── posiedzenia.jsonl
│   ├── wypowiedzi.raw.jsonl
│   ├── glosowania.jsonl
│   └── glosy.jsonl
└── /final                # Processed data
    ├── poslowie.jsonl
    ├── wypowiedzi.jsonl
    ├── glosowania.jsonl
    └── glosy.jsonl
```

**Uwaga:** Te pliki NIE są w repozytorium (.gitignore). System pobiera dane z API na żywo.

---

## 📂 /scripts

**Przeznaczenie:** Node.js scripts (opcjonalne, development)

Skrypty do pobierania danych lokalnie przez Node.js zamiast przeglądarki.

---

## 🔄 Przepływ danych

```
┌─────────────────┐
│   index.html    │ ← Użytkownik klika "Pobierz"
│   (ETL Panel)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ api-handler-v2  │ ← buildConfigFromUI()
│  + etl-bridge   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   pipeline.js   │ ← runPipeline(config, callbacks)
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌─────────┐
│Fetcher │ │Database │
│(12 mod)│ │  v2.0   │
└───┬────┘ └────┬────┘
    │ Raw JSON  │
    ↓           ↓
┌──────────────┐
│ Normalizer   │ ← Transform + UPSERT
│  (11 mod)    │
└──────┬───────┘
       │
       ↓
    SQLite ✅
```

---

## 🎯 Kluczowe punkty

### Dla użytkowników:
- **index.html** - otwórz w przeglądarce
- **README.md** - instrukcje użycia

### Dla developerów:
- **pipeline.js** - punkt wejścia ETL
- **/fetcher** - pobieranie danych
- **/normalizer** - transformacja
- **/modules/database-v2.js** - baza danych
- **/docs** - pełna dokumentacja

### Dla maintainerów:
- **CHANGELOG.md** - historia zmian
- **fix-height.js** - narzędzie do CSS
- **.gitignore** - co ignorować

---

**Wersja:** 2.0.0  
**Data:** 2026-01-24  
**Status:** Production-ready ✅
