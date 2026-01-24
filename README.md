# 🏛️ Analiza Parlamentarna

System do analizy wypowiedzi parlamentarnych z API Sejmu RP.

> ⚠️ **Dane orientacyjne**  
> System automatycznie parsuje wypowiedzi z API Sejmu. Dopasowanie mówców do posłów: 97.6%.  
> Wszystkie informacje należy weryfikować w oficjalnych źródłach.

---

## 🎯 Funkcje

* **ETL v2.0 Pipeline** - kompletny system Extract-Transform-Load
* **Incremental Cache** - pobiera tylko nowe dane (10× szybciej)
* **SQLite w przeglądarce** - pełna baza danych lokalnie (sql.js)
* **12 typów danych** - wypowiedzi, głosowania, interpelacje, komisje...
* **Dynamic Progress** - dokładny tracking 0-100%
* **100% lokalne** - wszystko w przeglądarce, zero backend
* **AI lokalne** (plan) - WebLLM 4B, Transformers.js

---

## 🏗️ Architektura v2.0

### Przepływ danych
```
UI (ETL Panel)
    ↓
Pipeline v2.0
    ↓
Fetcher v2.0 (12 modules) → Raw JSON
    ↓
Normalizer v2.0 (11 modules) → SQL Records
    ↓
Database v2.0 (12 tables + indexes)
```

### Komponenty

**Fetcher v2.0:**
- 12 modułów (poslowie, wypowiedzi, glosowania...)
- safeFetch z retry + exponential backoff
- Modes: 'full' vs 'meta'
- Ranges: 'last N' vs 'custom'

**Normalizer v2.0:**
- 11 modułów transformujących
- Field mapping (id vs id_osoby)
- UPSERT do bazy (no duplicates)
- Dependency order maintained

**Pipeline v2.0:**
- Complete orchestration
- Incremental cache (tracks last_posiedzenie)
- Dynamic progress (0-100%)
- UI callbacks (onProgress, onLog, onError)

---

## 📊 Dane z API Sejmu

**12 typów danych:**
1. Posłowie/Senatorowie
2. Posiedzenia
3. Wypowiedzi
4. Głosowania
5. Głosy indywidualne
6. Interpelacje
7. Projekty ustaw
8. Komisje
9. Posiedzenia komisji
10. Wypowiedzi komisji
11. Oświadczenia majątkowe
12. Metadata (cache)

**Wydajność:**
- Pierwsze pobieranie: ~2 min (100 posiedzeń)
- Kolejne (up to date): ~1s ⚡ (100× szybciej)
- Nowe (3 posiedzenia): ~10s ⚡ (10× szybciej)

---

## 📁 Struktura Projektu v2.0

```
/
├── index.html              ← UI z ETL Panel
├── style.css               ← ETL Panel height: 50vh
├── app.js                  ← AI models loader
├── api-handler-v2.js       ← UI integration
├── etl-bridge.js           ← ETL Panel bridge
│
├── /fetcher
│   ├── fetcher.js          ← Orchestrator + safeFetch
│   └── /modules            ← 12 fetch modules
│       ├── poslowie.js
│       ├── wypowiedzi.js
│       └── ... (10 more)
│
├── /normalizer
│   ├── normalizer.js       ← Orchestrator
│   └── /modules            ← 11 transform modules
│       ├── poslowie.js
│       ├── wypowiedzi.js
│       └── ... (9 more)
│
├── pipeline.js             ← Complete ETL orchestrator
│
├── /modules
│   ├── database-v2.js      ← SQLite (12 tables)
│   ├── nlp.js              ← Transformers.js (plan)
│   └── webllm.js           ← WebLLM (plan)
│
└── /docs
    ├── FETCHER-V2.md
    ├── NORMALIZER-V2.md
    ├── PIPELINE-V2.md
    ├── INCREMENTAL-CACHE.md
    └── DATABASE-V2.md
```

---

## 🚀 Użycie

### Live Demo (GitHub Pages)

```
https://michalstankiewicz4-cell.github.io/NostraDamnOS/
```

**ETL Panel workflow:**
1. Wybierz instytucję (Sejm/Senat)
2. Wybierz kadencję (7-10)
3. Wybierz zakres (ostatnie X posiedzeń)
4. Zaznacz typy danych (wypowiedzi, głosowania...)
5. Kliknij "📥 Pobierz dane z API"
6. Obserwuj progress (0-100%)

### Lokalnie

```bash
git clone https://github.com/michalstankiewicz4-cell/NostraDamnOS.git
cd NostraDamnOS

# Node.js
npx http-server -p 8766

# Python
python -m http.server 8766

# http://localhost:8766
```

---

## 🧰 Technologie

**Frontend:**
- sql.js - SQLite w WebAssembly
- Fetch API - API Sejmu
- ETL Pipeline - modular architecture
- HTML/CSS/JS - zero frameworków

**Backend (opcjonalny):**
- Node.js 18+ - development scripts

---

## ⚠️ Ograniczenia

1. **SQLite non-persistent** - resetuje się przy F5
2. **Cache w metadata table** - persistent w SQLite
3. **Geolokalizacja** - tylko Europa (timezone check)

---

## 🗺️ Roadmap

### ✅ Faza 1 (DONE - 2026-01-24)
- [x] ETL v2.0 Pipeline
- [x] Fetcher v2.0 (12 modules)
- [x] Normalizer v2.0 (11 modules)
- [x] Database v2.0 (12 tables)
- [x] Incremental Cache
- [x] Dynamic Progress
- [x] UI Integration

### 🚧 Faza 2 (IN PROGRESS)
- [ ] AI Models Integration
  - [ ] WebLLM 4B
  - [ ] Transformers.js
- [ ] Analysis Features
  - [ ] Sentiment analysis
  - [ ] Topic detection
  - [ ] Summarization
  - [ ] Comparison

### 📅 Faza 3 (PLANNED)
- [ ] IndexedDB persistence
- [ ] Advanced queries UI
- [ ] Export .db / .csv
- [ ] Visualizations

---

## 📚 Dokumentacja

**Core:**
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System overview
- [DATABASE-V2.md](docs/DATABASE-V2.md) - Schema (12 tables)

**ETL Pipeline:**
- [PIPELINE-V2.md](docs/PIPELINE-V2.md) - Complete orchestration
- [FETCHER-V2.md](docs/FETCHER-V2.md) - Data fetching (12 modules)
- [NORMALIZER-V2.md](docs/NORMALIZER-V2.md) - Transformation (11 modules)
- [INCREMENTAL-CACHE.md](docs/INCREMENTAL-CACHE.md) - Smart caching

**Features:**
- [GEO.md](docs/GEO.md) - Geolocation (Europe only)

---

## 📝 Licencja

MIT License

---

## 🔗 Linki

* **Live:** [michalstankiewicz4-cell.github.io/NostraDamnOS](https://michalstankiewicz4-cell.github.io/NostraDamnOS/)
* **Repo:** [github.com/michalstankiewicz4-cell/NostraDamnOS](https://github.com/michalstankiewicz4-cell/NostraDamnOS)
* **API Sejmu:** [api.sejm.gov.pl](https://api.sejm.gov.pl/)

---

**Wersja:** 2.0.0  
**Data:** 2026-01-24  
**Status:** Production-ready ETL system ✅
