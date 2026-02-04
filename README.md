# 🏛️ Parlament "puppy"
<sub>Oficjalna nazwa: Parlament "puppy" | Repo: NostraDamnOS | v2.1.1</sub>

<sub>Autor: Michał Stankiewicz | Współtwórcy: Claude Sonnet 4.5 & GitHub Copilot</sub>

<sub>📞 +48 797 486 355 | 🐙 [GitHub](https://github.com/michalstankiewicz4-cell)</sub>

[![Last Commit](https://img.shields.io/github/last-commit/michalstankiewicz4-cell/NostraDamnOS?label=Ostatnia%20aktualizacja&color=blue)](https://github.com/michalstankiewicz4-cell/NostraDamnOS/commits/main)

System do analizy wypowiedzi parlamentarnych z API Sejmu RP.

> ⚠️ **Dane orientacyjne**  
> System automatycznie parsuje wypowiedzi z API Sejmu. Dopasowanie mówców do posłów: 97.6%.  
> Wszystkie informacje należy weryfikować w oficjalnych źródłach.

> 🔒 **Prywatność i RODO**  
> Baza danych jest pusta przy pierwszym uruchomieniu. System pobiera tylko dane publiczne z API Sejmu.  
> **Brak danych osobowych:** bez adresów email, numerów telefonów, PESEL czy innych danych wrażliwych.  
> Wszystkie dane zgodne z zasadami ochrony danych osobowych. Projekt nie przetwarza danych osobowych w rozumieniu RODO. Dane pochodzą z oficjalnych źródeł publicznych. Dane są przetwarzane wyłącznie lokalnie.

---

## 🐶 O Projekcie

**Parlament "puppy"** to zaawansowany system monitorowania pracy parlamentu w czasie rzeczywistym, oparty na danych z oficjalnego API Sejmu.

**Kluczowe możliwości:**
- 🗳️ **Analiza głosowań** - pełne dane o głosowaniach, dyscyplinie klubowej, nieobecnościach
- 📊 **Profile posłów** - statystyki aktywności, zgodność z linią klubu, interpelacje, komisje
- 📜 **Monitoring legislacyjny** - śledzenie projektów ustaw, tempo prac, opóźnienia
- 📈 **Wizualizacje** - wykresy, mapy klubów, heatmapy zgodności, dashboard
- 🔔 **System alertów** - powiadomienia o nowych głosowaniach, drukach, interpelacjach
- 📚 **Analiza historyczna** - porównywanie kadencji, trendy, zmiany w zachowaniach
- 🤖 **AI asystent** - odpowiedzi na pytania o głosowania, generowanie raportów

---

## 🎯 Główne Funkcje

* **ETL v2.0 Pipeline** - kompletny system Extract-Transform-Load → [docs/PIPELINE-V2.md](docs/PIPELINE-V2.md)
* **🛡️ RODO Filter** - automatyczne usuwanie danych wrażliwych (domyślnie aktywny)
* **Incremental Cache** - pobiera tylko nowe dane (10× szybciej) → [docs/INCREMENTAL-CACHE.md](docs/INCREMENTAL-CACHE.md)
* **SQLite w przeglądarce** - pełna baza danych lokalnie (sql.js) → [docs/DATABASE-V2.md](docs/DATABASE-V2.md)
* **12 modułów API** - wypowiedzi, głosowania, interpelacje, komisje... → [docs/API-ENDPOINTS.md](docs/API-ENDPOINTS.md)
* **Dynamic Progress** - dokładny tracking 0-100%
* **📋 Console Interceptor** - wszystkie logi widoczne w UI
* **100% lokalne** - wszystko w przeglądarce, zero backend
* **AI lokalne** (plan) - WebLLM 4B, Transformers.js

---

## 🚀 Szybki Start

### Live Demo (GitHub Pages)

```
https://michalstankiewicz4-cell.github.io/NostraDamnOS/
```

**Workflow:**
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

* **sql.js** - SQLite w WebAssembly
* **Fetch API** - komunikacja z API Sejmu
* **ETL Pipeline** - modułowa architektura
* **HTML/CSS/JS** - zero frameworków, vanilla JavaScript

---

## 📚 Dokumentacja

### Podstawowa
| Plik | Opis |
|------|------|
| [README.md](README.md) | Ten plik - szybki start i przegląd projektu |
| [CHANGELOG.md](CHANGELOG.md) | Historia zmian i wersji projektu |
| [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) | Kontekst projektowy, założenia i cele |
| [LICENSE](LICENSE) | Licencja MIT |

### Architektura (/docs)
| Plik | Opis |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Przegląd architektury systemu, przepływ danych, scenariusze użycia |
| [docs/FILE-STRUCTURE.md](docs/FILE-STRUCTURE.md) | Pełna struktura katalogów i rola każdego pliku |
| [docs/DATABASE-V2.md](docs/DATABASE-V2.md) | Schemat bazy SQLite (13 tabel), foreign keys, indexes |
| [docs/API-ENDPOINTS.md](docs/API-ENDPOINTS.md) | Kompletna mapa endpointów API Sejmu (działające i niedziałające) |

### ETL Pipeline (/docs)
| Plik | Opis |
|------|------|
| [docs/PIPELINE-V2.md](docs/PIPELINE-V2.md) | Orkiestracja całego ETL, etapy przetwarzania, RODO Filter |
| [docs/FETCHER-V2.md](docs/FETCHER-V2.md) | Pobieranie danych z API (12 modułów), retry logic, safeFetch |
| [docs/NORMALIZER-V2.md](docs/NORMALIZER-V2.md) | Transformacje do rekordów SQL (12 modułów), mapowania |
| [docs/INCREMENTAL-CACHE.md](docs/INCREMENTAL-CACHE.md) | Mechanizm przyrostowego cache, wykrywanie zmian |

### Funkcje specjalne (/docs)
| Plik | Opis |
|------|------|
| [docs/GEO.md](docs/GEO.md) | Geolokalizacja - blokada dostępu spoza Europy |
| [docs/DATA-TYPES.json](docs/DATA-TYPES.json) | Definicje typów danych w formacie JSON |

---

## 🗺️ Roadmap

### ✅ Faza 1 - ETL System (DONE - 2026-01-24)
- [x] ETL v2.0 Pipeline
- [x] Fetcher v2.0 (12 modules)
- [x] Normalizer v2.0 (12 modules)
- [x] Database v2.0 (13 tables)
- [x] Incremental Cache
- [x] Dynamic Progress

### ✅ Faza 2.1 - RODO & UI (DONE - 2026-01-26)
- [x] 🛡️ RODO Filter (modules/rodo.js)
- [x] 📋 Console Log Interceptor
- [x] UI Improvements (radio buttons, floating console)

### 🚧 Faza 2 - AI Integration (IN PROGRESS)
- [ ] WebLLM 4B
- [ ] Transformers.js
- [ ] Sentiment analysis
- [ ] Topic detection
- [ ] Summarization

### ⚡ Faza 2.2 - Database Improvements (TODO)
- [ ] Rozszerzony filtr RODO (regex scanning)
- [ ] Sprawdzanie zmian API vs lokalna baza
- [ ] Przycisk "🔄 Aktualizuj bazę"
- [ ] Przycisk "🗑️ Wyczyść bazę"

### 📅 Faza 3 - Advanced Features (PLANNED)
- [ ] IndexedDB persistence
- [ ] Advanced queries UI
- [ ] Export .db / .csv
- [ ] Visualizations (charts, graphs)

---

## 🔗 Linki

* **Live:** [michalstankiewicz4-cell.github.io/NostraDamnOS](https://michalstankiewicz4-cell.github.io/NostraDamnOS/)
* **Repo:** [github.com/michalstankiewicz4-cell/NostraDamnOS](https://github.com/michalstankiewicz4-cell/NostraDamnOS)
* **API Sejmu:** [api.sejm.gov.pl](https://api.sejm.gov.pl/)

---

**Wersja:** 2.1.1  
**Data:** 2026-02-03  
**Status:** Production-ready ✅
