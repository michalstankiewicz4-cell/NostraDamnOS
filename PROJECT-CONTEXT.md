# 🏛️ Analiza Parlamentarna - Kontekst Projektu

**Data utworzenia:** 2026-01-24  
**Wersja:** 2.1.0  
**Status:** Production-ready ✅

---

## ⚠️ WAŻNE DISCLAIMERY

### 📊 Dane Orientacyjne
System automatycznie parsuje wypowiedzi z API Sejmu.  
**Dopasowanie mówców do posłów: 97.6%**  
Wszystkie informacje należy weryfikować w oficjalnych źródłach.

### 🔒 RODO i Prywatność
- **Baza jest pusta** przy pierwszym uruchomieniu
- System pobiera **tylko dane publiczne** z API Sejmu
- **Brak danych osobowych:** bez adresów email, numerów telefonów, PESEL
- **Filtr RODO domyślnie AKTYWNY** - usuwa dane wrażliwe
- Wszystkie dane zgodne z zasadami ochrony danych osobowych

---

## 🚨 Zasady Pracy (KRYTYCZNE)

### Workflow
- ❌ **Nigdy nie wprowadzaj własnych pomysłów bez pytania**
- ✅ **Zawsze pytaj przed zmianami**
- 🖥️ **Pracujemy na lokalnym modelu**
- 💾 **Na lokalnym trzymamy też bazę**
- 🧪 **Na GH wysyłamy TYLKO działający projekt po testach i za zgodą**
- 🚫 **NIE wysyłamy cache, danych na GH**

### Pliki do pominięcia (ETL/DB)
Tych formatów **NIE** używamy przy ściąganiu, formatowaniu i bazie danych:
- PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX
- RTF, ODT/ODS/ODP
- ZIP/RAR/7z, ISO, BIN

---

## 📍 Lokalizacje

### Lokalne Repozytorium
```
C:\Users\micha\source\repos\NostraDamnOS
```

### GitHub Repository
```
https://github.com/michalstankiewicz4-cell/NostraDamnOS
```

### Live Demo (GitHub Pages)
```
https://michalstankiewicz4-cell.github.io/NostraDamnOS/
```

### Lokalny Serwer (development)
```
http://localhost:8766
```
**Uruchomienie:**
```bash
cd C:\Users\micha\source\repos\NostraDamnOS
npx http-server -p 8766
```

---

## 🎯 Stan Projektu

### ✅ Zaimplementowane (v2.1.0)

**ETL Pipeline v2.0:**
- Complete orchestration (UI → Fetcher → Normalizer → Database)
- 12 modułów fetch (poslowie, wypowiedzi, głosowania, interpelacje, komisje...)
- 11 modułów transform (normalizacja + UPSERT)
- Incremental cache (10× szybciej przy kolejnych pobraniach)
- Dynamic progress (0-100%)
- **RODO Filter** - usuwa dane wrażliwe (email, telefon, PESEL, adresy)

**Database v2.0:**
- 12 tabel SQLite (in-memory)
- Foreign keys + indexes
- UPSERT methods (no duplicates)

**UI:**
- ETL Panel z checkboxami (12 typów danych)
- Header: "📥 Import Danych z API Sejmu"
- Panel height: 50vh (no scroll)
- Progress bar + detailed logs
- **Floating console** (📋) - dostępna zawsze
- **Console log interceptor** - przechwytuje WSZYSTKIE logi
- **Checkbox "🔒 Filtr RODO"** - domyślnie aktywny
- Radio buttons: "Ostatnie X" vs "Zakres od-do"
- Geolocation: tylko Europa (timezone check)

### 🚧 W trakcie (Faza 2)

**AI Integration:**
- WebLLM 4B - model lokalny w przeglądarce
- Transformers.js - sentiment, topics, embeddings
- Analysis features: sentiment, topics, summarization, comparison

### 📅 Planowane (Faza 3)

- IndexedDB persistence (zamiast in-memory SQLite)
- Query Builder UI
- Export (.db, .csv, JSON)
- Visualizations (charts, network graphs, heatmaps)

---

## 🗄️ Architektura Danych

### Baza Danych (SQLite)
- **Typ:** In-memory (sql.js WebAssembly)
- **Persistent:** ❌ NIE (resetuje przy F5)
- **Lokalizacja:** RAM przeglądarki
- **Rozmiar:** ~5-50 MB (zależnie od zakresu)

### Cache (localStorage)
- **Typ:** localStorage (metadata)
- **Persistent:** ✅ TAK
- **Lokalizacja:** localStorage przeglądarki
- **Rozmiar:** ~50-100 KB
- **Co przechowuje:**
  - last_posiedzenie (incremental fetch)
  - fetchedSittings (lista pobranych)
  - timestamps

### Dane JSONL (legacy)
- **Lokalizacja:** `/data/sejm/`, `/data/final/`
- **Status:** Opcjonalne, legacy
- **Na GitHubie:** ✅ TAK
- **Używane:** ❌ NIE (system pobiera z API na żywo)

---

## 🔧 Kluczowe Pliki

### Entry Points
```
index.html          - UI (ETL Panel)
app.js              - Ładowanie AI models (plan)
api-handler-v2.js   - UI integration, callbacks
```

### ETL System
```
pipeline.js                    - Complete orchestrator
etl-bridge.js                  - UI ↔ Pipeline bridge

/fetcher/fetcher.js            - Fetch orchestrator
/fetcher/modules/*.js          - 12 modułów fetch

/normalizer/normalizer.js      - Transform orchestrator  
/normalizer/modules/*.js       - 11 modułów transform
```

### Database & Utilities
```
/modules/database-v2.js        - SQLite wrapper (12 tabel)
/modules/geo.js                - Geolocation (Europa only)
/modules/cache.js              - localStorage cache (legacy)
/modules/utils.js              - Helpers
```

### AI (planned)
```
/modules/nlp.js                - Transformers.js
/modules/webllm.js             - WebLLM 4B
```

---

## 📊 Performance Metrics

### Pierwsze pobranie (cold start)
- **2 posiedzenia:** ~15-20s, ~700 KB
- **10 posiedzeń:** ~1 min, ~3 MB
- **100 posiedzeń:** ~2 min, ~30 MB

### Kolejne pobrania (warm cache)
- **Up to date:** ~1s ⚡ (100× szybciej)
- **3 nowe posiedzenia:** ~10s ⚡ (10× szybciej)

### Limity API Sejmu
- Rate limit: ~100 req/min
- Retry logic: 3 attempts, exponential backoff
- safeFetch() handles all errors

---

## 🔑 Kluczowe Koncepty

### Incremental Cache
System zapamiętuje `last_posiedzenie` i pobiera tylko nowsze:
```
1. Sprawdź: getLastPosiedzenie() 
2. Pobierz: tylko posiedzenia > last
3. Zapisz: setLastPosiedzenie(newest)
```

### Dynamic Progress
Progress adaptuje się do workloadu:
```
N sittings → każde = ~70/N %
Example: 3 sittings = 15%→33%→51%→69% per sitting
```

### Mode Support
- **meta:** Tylko IDs (szybkie, małe)
- **full:** Pełne dane (wolne, duże)

### Range Support
- **last N:** Ostatnie X posiedzeń
- **custom:** Od-do (date range)

---

## 📝 Dokumentacja

### README & Guides
```
README.md           - Quick start, overview
CHANGELOG.md        - Historia zmian v1.0 → v2.0
```

### Technical Docs
```
docs/FILE-STRUCTURE.md      - Co robi każdy plik
docs/ARCHITECTURE.md        - System overview
docs/PIPELINE-V2.md         - ETL orchestration
docs/FETCHER-V2.md          - 12 fetch modules
docs/NORMALIZER-V2.md       - 11 transform modules
docs/DATABASE-V2.md         - Schema (12 tables)
docs/INCREMENTAL-CACHE.md   - Smart caching
docs/GEO.md                 - Geolocation
docs/TODO-DATA.md           - Roadmap
```

---

## 🔄 Workflow Deployment

### Lokalne zmiany → GitHub
```bash
cd C:\Users\micha\source\repos\analiza-parlamentarna-BACKUP

# Dodaj zmiany
git add .
git commit -m "opis zmian"

# Wyślij na GitHub
git push origin main

# GitHub Pages automatycznie aktualizuje live demo
```

### GitHub Pages (automatyczne)
- **Trigger:** Push do `main`
- **Build:** Automatyczny
- **Deploy:** ~1-2 minuty
- **URL:** https://michalstankiewicz4-cell.github.io/NostraDamnOS/

---

## 🛠️ Development Tools

### Utility Scripts (zachowane)
```
fix-height.js       - Szybka zmiana CSS height
```

### Usuniętych Debug Files (17)
```
❌ 65vh), add-header.ps1, app-debug.js
❌ final-fix.js, fix-header*.js, fix-utf8.ps1
❌ api-handler.js (old v1)
❌ modules/database*.bak, *.temp, normalizer.js (old v1)
```

---

## 🚨 Ważne Uwagi

### SQLite Non-Persistent
⚠️ **UWAGA:** Baza SQLite resetuje się przy F5!
- Dane znikają po odświeżeniu strony
- Cache (localStorage) zostaje
- System automatycznie pobiera z cache lub API

### Geolocation Restriction
⚠️ **UWAGA:** Aplikacja działa TYLKO w Europie!
- Sprawdzanie przez timezone
- `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Jeśli poza Europą → blokada

### GitHub Pages Limitations
⚠️ **UWAGA:** GitHub Pages = static hosting tylko!
- Brak backend
- Brak persistent storage
- Wszystko działa w przeglądarce (100% client-side)

---

## 📧 Kontakt & Support

**GitHub Issues:**
```
https://github.com/michalstankiewicz4-cell/NostraDamnOS/issues
```

**API Sejmu Documentation:**
```
https://api.sejm.gov.pl/
```

---

## 🎯 Next Session Context

Gdy wracasz do projektu:

1. **Sprawdź status:**
   ```bash
   cd C:\Users\micha\source\repos\analiza-parlamentarna-BACKUP
   git status
   git log --oneline -5
   ```

2. **Uruchom lokalnie:**
   ```bash
   npx http-server -p 8766
   # http://localhost:8766
   ```

3. **Sprawdź co w trakcie:**
   - Faza 2: AI Integration (WebLLM + Transformers.js)
   - TODO: docs/TODO-DATA.md

4. **Przeczytaj:**
   - docs/FILE-STRUCTURE.md - co robi każdy plik
   - docs/PIPELINE-V2.md - jak działa ETL

---

**Ostatnia aktualizacja:** 2026-01-24  
**Ostatni commit:** 9fb2c28 (docs: add FILE-STRUCTURE.md)  
**Branch:** main  
**Status:** ✅ Clean, synchronized, production-ready
