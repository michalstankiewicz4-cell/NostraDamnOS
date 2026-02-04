# 📁 Struktura Projektu

Kompletny przewodnik po plikach w repozytorium NostraDamnOS.

---

## 📂 Root Directory

### Pliki główne aplikacji

| Plik | Opis | Używany przez |
|------|------|---------------|
| **index.html** | Główny plik HTML, UI aplikacji z ETL Panel | Przeglądarka |
| **style.css** | Style CSS, ETL Panel height: 50vh | index.html |

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

*(Brak narzędzi legacy w repo)*

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
| **zapytania.js** | `/sejm/term{X}/writtenQuestions` | Zapytania pisemne |

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

### /normalizer/modules (12 modułów)

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
| **zapytania.js** | `normalizeZapytania()`, `saveZapytania()` | `zapytania` + `zapytania_odpowiedzi` |

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

**Przeznaczenie:** Moduły wspomagające, database, AI, utilities, RODO

| Plik | Opis | Eksportuje |
|------|------|-----------|
| **database-v2.js** | SQLite wrapper, 13 tabel + metadata + indexes | `db2` object |
| **rodo.js** | 🛡️ Filtr danych wrażliwych (email, telefon, PESEL) | `applyRodo(raw)`, `RODO_RULES` |
| **geo.js** | Geolokalizacja (tylko Europa), timezone check | `enforceEuropeOnly()` |
| **nlp.js** | Transformers.js integration (plan) | `initNLP()`, `analyzeSentiment()` |
| **webllm.js** | WebLLM 4B integration (plan) | `initWebLLM()`, `generateSummary()` |
| **api-fetcher.js** | Legacy fetcher v1 (opcjonalny) | `fetchData()` |
| **db-buttons.js** | Helpers dla przycisków DB (UI) | `bindDbButtons()` |

### rodo.js szczegóły 🔒

**Przeznaczenie:** Usuwa dane wrażliwe z raw data przed zapisem do bazy

**Struktura:**
```javascript
export const RODO_RULES = {
    poslowie: ['telefon', 'adres', 'pesel', 'email_domowy'],
    interpelacje: ['adres'],
    oswiadczenia: ['adres_zamieszkania']
};

export function applyRodo(raw, rules = RODO_RULES) {
    // Iteruje po modułach i usuwa pola z RODO_RULES
    return cleaned;
}
```

**Użycie w Pipeline:**
```javascript
if (config.rodoFilter) {
    processedRaw = applyRodo(raw);
}
const stats = await runNormalizer(db2, processedRaw);
```

### database-v2.js szczegóły

**Struktura:**
```javascript
export const db2 = {
    sql: null,
    database: null,
    
    // Inicjalizacja
    async init()
    async createSchema()
    
    // UPSERT methods (13x)
    upsertPoslowie(data)
    upsertPosiedzenia(data)
    upsertWypowiedzi(data)
    // ... (10 more)
    
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

**13 tabel + metadata:**
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
12. `zapytania` - Zapytania pisemne
13. `zapytania_odpowiedzi` - Odpowiedzi na zapytania
14. `metadata` - Cache + metadane

---

## 📂 /docs

**Przeznaczenie:** Dokumentacja techniczna

| Plik | Opis | Dla kogo |
|------|------|----------|
| **ARCHITECTURE.md** | Przegląd architektury systemu | Developers |
| **DATABASE-V2.md** | Schema bazy (tabele + indexes) | Developers |
| **FETCHER-V2.md** | Dokumentacja modułów fetch | Developers |
| **NORMALIZER-V2.md** | Dokumentacja modułów transform | Developers |
| **PIPELINE-V2.md** | Orchestration, callbacks, flow | Developers |
| **INCREMENTAL-CACHE.md** | Smart caching (10× faster) | Developers |
| **GEO.md** | Geolocation restriction (Europa) | Developers |
| **DATA-TYPES.json** | Definicje typów danych | Developers |

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
- **.gitignore** - co ignorować

---

**Wersja:** 2.0.0  
**Data:** 2026-01-24  
**Status:** Production-ready ✅
