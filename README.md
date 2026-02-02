# 🏛️ Analiza Parlamentarna

<sub>Created by Michał Stankiewicz, Claude Sonnet 4.5 & Copilot</sub>  
[![Last Commit](https://img.shields.io/github/last-commit/michalstankiewicz4-cell/NostraDamnOS?label=Ostatnia%20aktualizacja&color=blue)](https://github.com/michalstankiewicz4-cell/NostraDamnOS/commits/main) | [📋 Commits](https://github.com/michalstankiewicz4-cell/NostraDamnOS/commits/main)

System do analizy wypowiedzi parlamentarnych z API Sejmu RP.

> ⚠️ **Dane orientacyjne**  
> System automatycznie parsuje wypowiedzi z API Sejmu. Dopasowanie mówców do posłów: 97.6%.  
> Wszystkie informacje należy weryfikować w oficjalnych źródłach.

> 🔒 **Prywatność i RODO**  
> Baza danych jest pusta przy pierwszym uruchomieniu. System pobiera tylko dane publiczne z API Sejmu.  
> **Brak danych osobowych:** bez adresów email, numerów telefonów, PESEL czy innych danych wrażliwych.  
> Wszystkie dane zgodne z zasadami ochrony danych osobowych. Projekt nie przetwarza danych osobowych w rozumieniu RODO. Dane pochodzą z oficjalnych źródeł publicznych. Dane są przetwarzane wyłącznie lokalnie.

---

Amatorski darmowy projekt - Parlament "puppy"

Parlament puppy to zaawansowany, w pełni zautomatyzowany system monitorowania pracy parlamentu, który działa w czasie rzeczywistym i opiera się wyłącznie na danych udostępnianych przez oficjalne API Sejmu. System śledzi każde głosowanie, analizuje frekwencję posłów, wykrywa nieobecności oraz monitoruje dyscyplinę klubową. Dzięki temu potrafi wskazać zarówno posłów głosujących zgodnie z linią ugrupowania, jak i tych, którzy się wyłamują. Obserwuje również zmiany w zachowaniach parlamentarzystów, tworząc dynamiczny obraz pracy izby — dokładnie tak, jak robią to profesjonalne narzędzia typu „parliament watchdog”.

Dzięki pełnemu dostępowi do danych o głosowaniach system potrafi analizować relacje między klubami i wykrywać nieformalne koalicje. Pokazuje, które ugrupowania głosują razem, gdzie pojawiają się rozłamy oraz jakie są faktyczne linie podziału politycznego. To poziom analizy, który zwykle wymaga pracy politologów i analityków legislacyjnych, a tutaj jest generowany automatycznie.

Parlament puppy tworzy również szczegółowe profile posłów. Na podstawie danych z API system analizuje aktywność parlamentarzystów, ich udział w głosowaniach, zgodność z linią klubu, zaangażowanie w proces legislacyjny, liczbę interpelacji oraz pracę w komisjach. Dzięki temu każdy poseł otrzymuje przejrzysty zestaw statystyk, przypominający sportowe profile zawodników — z jasnym obrazem mocnych i słabych stron.

System obejmuje także pełną analizę ustaw i procesów legislacyjnych. Korzystając z danych o drukach, procesach i interpelacjach, śledzi drogę każdej ustawy, analizuje tempo prac, wykrywa opóźnienia i bada aktywność komisji. Pozwala również określić, kto jest autorem projektu, kto go popiera i jak przebiegała cała ścieżka legislacyjna. To fundament profesjonalnego monitoringu legislacyjnego.

Wszystkie dane mogą być prezentowane w formie przejrzystych wizualizacji i dashboardów. System generuje wykresy głosowań, mapy klubów, heatmapy zgodności, osie czasu prac legislacyjnych oraz zestawienia aktywności posłów. Tak przygotowane materiały nadają się do raportów, prezentacji oraz integracji z narzędziami analitycznymi, takimi jak Power BI, Grafana czy Tableau — i nie wymagają żadnych plików multimedialnych.

Parlament puppy może również działać jako system alertów. Użytkownik może otrzymywać powiadomienia o nowych głosowaniach, drukach, interpelacjach czy zmianach w klubach. Dzięki temu system pełni funkcję monitoringu parlamentu w czasie rzeczywistym, pozwalając reagować na bieżące wydarzenia bez konieczności ręcznego śledzenia stron sejmowych.

Ponieważ system obsługuje wiele kadencji, możliwa jest analiza historyczna. Parlament puppy porównuje kadencje, bada trendy, analizuje zmiany w zachowaniach klubów i posłów oraz śledzi ewolucję procesu legislacyjnego. To narzędzie, które umożliwia prowadzenie badań na poziomie naukowym, z pełnym kontekstem historycznym.

Projekt jest również niezwykle wartościowy dla dziennikarzy i organizacji watchdogowych. Może służyć jako źródło danych, narzędzie do fact‑checkingu oraz wsparcie w analizie decyzji politycznych. Ułatwia szybkie sprawdzanie faktów i przygotowywanie materiałów analitycznych.

Dla obywateli system oferuje prosty dostęp do informacji o pracy parlamentu. Umożliwia wyszukiwanie głosowań, przeglądanie profili posłów, analizę zgodności z obietnicami wyborczymi oraz sprawdzanie, jak głosował konkretny przedstawiciel danego okręgu. To narzędzie wzmacniające obywatelską kontrolę nad władzą.

Najbardziej zaawansowanym elementem Parlament puppy jest silnik AI‑asystenta parlamentarnego. Dzięki danym z API potrafi odpowiadać na pytania o głosowania, analizować trendy, tłumaczyć proces legislacyjny, generować raporty i udzielać odpowiedzi na pytania typu „kto głosował przeciw?”, „kto najczęściej opuszcza głosowania?” czy „jak zmieniała się frekwencja klubu X?”. To pełnoprawny asystent analityczny, który udostępnia wiedzę o parlamencie w sposób szybki, intuicyjny i dostępny dla każdego.

## 🎯 Funkcje

* **ETL v2.0 Pipeline** - kompletny system Extract-Transform-Load
* **🛡️ RODO Filter** - automatyczne usuwanie danych wrażliwych (domyślnie aktywny)
* **Incremental Cache** - pobiera tylko nowe dane (10× szybciej)
* **SQLite w przeglądarce** - pełna baza danych lokalnie (sql.js)
* **12 typów danych** - wypowiedzi, głosowania, interpelacje, komisje...
* **Dynamic Progress** - dokładny tracking 0-100%
* **📋 Console Interceptor** - wszystkie logi widoczne w UI
* **100% lokalne** - wszystko w przeglądarce, zero backend
* **AI lokalne** (plan) - WebLLM 4B, Transformers.js

---

## 🔒 RODO i Bezpieczeństwo

### Filtr RODO (domyślnie AKTYWNY ✅)

System automatycznie usuwa dane wrażliwe przed zapisem do bazy:

**Usuwane pola:**
- `poslowie`: telefon, adres, PESEL, email_domowy
- `interpelacje`: adres
- `oswiadczenia`: adres_zamieszkania

**Kontrola:**
- Checkbox "🔒 Filtr RODO" w ETL Panel
- Domyślnie: WŁĄCZONY
- Możliwość wyłączenia dla celów badawczych

**Implementacja:**
```javascript
// modules/rodo.js
export const RODO_RULES = {
    poslowie: ['telefon', 'adres', 'pesel', 'email_domowy'],
    // ...
};

// Pipeline automatycznie aplikuje filtr
if (config.rodoFilter) {
    processedRaw = applyRodo(raw);
}
```

**Rozszerzanie:**
Edytuj `modules/rodo.js` aby dodać kolejne moduły/pola do filtrowania.

---

## 🏗️ Architektura v2.0

### Przepływ danych
```
UI (ETL Panel) + Checkbox RODO
    ↓
Pipeline v2.0
    ↓
Fetcher v2.0 (12 modules) → Raw JSON
    ↓
🛡️ RODO Filter (optional) → Filtered JSON
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

**Pełna dokumentacja:** [docs/FILE-STRUCTURE.md](docs/FILE-STRUCTURE.md) - szczegółowy opis każdego pliku

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

### ✅ Faza 2.1 (DONE - 2026-01-26)
- [x] 🛡️ RODO Filter (modules/rodo.js)
- [x] 📋 Console Log Interceptor
- [x] Pipeline Fixes (real fetcher integration)
- [x] UI Improvements (radio buttons, floating console)
- [x] Documentation Updates

### 🚧 Faza 2 (IN PROGRESS)
- [ ] AI Models Integration
  - [ ] WebLLM 4B
  - [ ] Transformers.js
- [ ] Analysis Features
  - [ ] Sentiment analysis
  - [ ] Topic detection
  - [ ] Summarization
  - [ ] Comparison

### ⚡ Faza 2.2 (TODO - Database & RODO Improvements)
- [ ] **A) Rozszerzony filtr RODO** - regex scanning email/telefon/PESEL w treściach
- [ ] **B) Sprawdzanie zmian w bazie** - detect changes API vs lokalna baza
- [ ] **C) Przycisk "🔄 Aktualizuj bazę"** - pobierz tylko delty
- [ ] **D) Przycisk "🗑️ Wyczyść bazę"** - usuń dane + cache
- [ ] Dokumentacja: zaktualizować FETCHER-V2.md i NORMALIZER-V2.md

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
