# 🏛️ Analiza Parlamentarna

System do analizy wypowiedzi parlamentarnych z API Sejmu RP.

> ⚠️ **Dane orientacyjne**  
> System automatycznie parsuje wypowiedzi z API Sejmu. Dopasowanie mówców do posłów: 97.6%.  
> Wszystkie informacje należy weryfikować w oficjalnych źródłach.

---

## 🎯 Funkcje

* **API Sejmu** - pobieranie danych bezpośrednio w przeglądarce
* **Inteligentny cache** - pamięta co pobrano, pobiera tylko nowe dane
* **SQLite w przeglądarce** - pełna baza danych lokalnie (sql.js)
* **Normalizacja** - automatyczne dopasowanie posłów (97.6%)
* **Parallel fetching** - 10-20× szybsze pobieranie
* **100% lokalne** - wszystko w przeglądarce, zero backend
* **AI lokalne** (plan) - WebLLM 4B, Transformers.js

---

## 🏗️ Architektura

### Przepływ danych
```
UI → api-handler → Cache (sprawdź) → API Fetcher (jeśli brak)
                      ↓                      ↓
                   SQLite ← Normalizer ← [dane surowe]
```

### Przechowywanie
- **localStorage** (~50-100KB) - metadane cache
- **SQLite w RAM** (5-50MB) - pełne dane
- **Resetuje się przy F5** - SQLite w pamięci

---

## 📊 Dane z API Sejmu

**Endpoints:**
- Posłowie: `https://api.sejm.gov.pl/sejm/term10/MP`
- Posiedzenia: `https://api.sejm.gov.pl/sejm/term10/proceedings`
- Wypowiedzi: `https://api.sejm.gov.pl/sejm/term10/proceedings/{sitting}/{date}/transcripts/{num}`
- Głosowania: `https://api.sejm.gov.pl/sejm/term10/votings/{sitting}`

**Wydajność:**
- Pierwsze pobieranie: ~15-20s (2 posiedzenia, ~578 wypowiedzi)
- Kolejne: ~0.3s (wszystko z cache)
- Nowe posiedzenie: ~10s (tylko 1 z API)

---

## 📁 Struktura Projektu

```
/
├── index.html              ← UI
├── api-handler.js          ← Logika pobierania
├── style.css
│
├── /modules
│   ├── api-fetcher.js      ← API Sejmu
│   ├── cache.js            ← localStorage cache
│   ├── database.js         ← SQLite
│   ├── normalizer.js       ← Dopasowanie ID
│   ├── nlp.js              ← Transformers.js (plan)
│   └── webllm.js           ← WebLLM (plan)
│
├── /data                   ← Legacy JSONL (opcjonalne)
├── /scripts                ← Node.js (opcjonalne)
└── /docs
    └── ARCHITECTURE.md
```

---

## 🚀 Użycie

### Przeglądarka (GitHub Pages)

```
https://michalstankiewicz4-cell.github.io/NostraDamnOS/
```

1. Wybierz zakres (1-10 posiedzeń)
2. Zaznacz "Wypowiedzi" i/lub "Głosowania"
3. Kliknij "Pobierz dane z API"

### Lokalnie

```bash
git clone https://github.com/michalstankiewicz4-cell/NostraDamnOS.git
cd NostraDamnOS

python -m http.server 8766
# http://localhost:8766
```

---

## 🧰 Technologie

**Frontend:**
- sql.js - SQLite w WebAssembly
- Fetch API - pobieranie z API
- localStorage - cache metadanych
- HTML/CSS/JS - zero frameworków

**Backend (opcjonalny):**
- Node.js 18+ - skrypty do pobierania JSONL

---

## ⚠️ Ograniczenia

1. **SQLite non-persistent** - resetuje się przy F5
2. **Cache niezależny** - po `localStorage.clear()` pobiera ponownie
3. **Matching 97.6%** - 2.4% wypowiedzi bez dopasowania do posła

---

## 🗺️ Roadmap

### ✅ Faza 1 (DONE)
- [x] API fetcher + cache
- [x] SQLite w przeglądarce
- [x] Normalizacja 97.6%

### 🚧 Faza 2 (TODO)
- [ ] IndexedDB persistence
- [ ] UI do przeglądania danych
- [ ] Eksport .db

### 📅 Faza 3 (PLAN)
- [ ] WebLLM + Transformers.js
- [ ] Analiza nastrojów
- [ ] Wykrywanie tematów

---

## 📝 Licencja

MIT License

---

## 🔗 Linki

* **Live:** [michalstankiewicz4-cell.github.io/NostraDamnOS](https://michalstankiewicz4-cell.github.io/NostraDamnOS/)
* **Repo:** [github.com/michalstankiewicz4-cell/NostraDamnOS](https://github.com/michalstankiewicz4-cell/NostraDamnOS)
* **API Sejmu:** [api.sejm.gov.pl](https://api.sejm.gov.pl/)

---

**Wersja:** 1.0.0  
**Data:** 2026-01-24
