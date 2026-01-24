# 📊 Katalog Danych

## ⚠️ Dane Wyczyszczone

Pliki JSONL w tym katalogu są **puste** (template).

### Dlaczego?

- **GitHub Pages** ma limit 100 MB
- Dane z API Sejmu mogą ważyć 20-50 MB
- Każdy użytkownik pobiera **tylko** dane których potrzebuje

---

## 🚀 Jak Pobrać Dane?

### Metoda 1: Aplikacja (ZALECANA)

1. Otwórz: https://michalstankiewicz4-cell.github.io/NostraDamnOS/
2. Kliknij: **📥 Pobierz dane z API**
3. Wybierz zakres (np. 2 posiedzenia)
4. Dane zapisują się w **przeglądarce** (localStorage + SQLite)

### Metoda 2: Skrypty Node.js (dla developerów)

```bash
# Pobierz RAW data z API
node scripts/fetch-sejm.js 10 5

# Normalizuj (dodaj memberID, role)
node scripts/normalize.js

# Wynik w /data/final/*.jsonl
```

---

## 📁 Struktura

```
/data
├── manifest.json          ← Opisuje puste pliki
│
├── /final                 ← Znormalizowane (PUSTE na GH)
│   ├── poslowie.jsonl
│   ├── wypowiedzi.jsonl
│   ├── glosowania.jsonl
│   └── glosy.jsonl
│
└── /sejm                  ← RAW z API (PUSTE na GH)
    ├── poslowie.jsonl
    ├── posiedzenia.jsonl
    ├── wypowiedzi.raw.jsonl
    ├── glosowania.jsonl
    └── glosy.jsonl
```

---

## 💡 Praca Lokalna

Jeśli chcesz pracować lokalnie z danymi:

```bash
# 1. Pobierz dane
node scripts/fetch-sejm.js 10 2
node scripts/normalize.js

# 2. Dane są w /data/ lokalnie
# 3. .gitignore ignoruje je (nie commituj!)

# 4. GitHub ma PUSTE pliki
# 5. Każdy dev pobiera sam
```

---

## 🗄️ Gdzie Są Dane Po Pobraniu?

**W aplikacji (przeglądarka):**
- **localStorage:** cache (~50-100 KB)
- **SQLite (RAM):** pełne dane (5-50 MB)
- **Resetuje się:** przy F5 (SQLite), wyczyść przeglądarkę (cache)

**W skryptach Node.js:**
- **/data/sejm/**: RAW z API
- **/data/final/**: Znormalizowane
- **Lokalnie:** git nie commituje (ignorowane)

---

## 📊 Przykładowe Rozmiary

| Zakres | Rozmiar | Czas pobierania |
|--------|---------|-----------------|
| 1 posiedzenie | ~300 KB | ~8-10s |
| 2 posiedzenia | ~600 KB | ~15-20s |
| 5 posiedzeń | ~1.5 MB | ~40-50s |
| 10 posiedzeń | ~3 MB | ~1.5-2 min |
| Cała kadencja (65) | ~20 MB | ~5-10 min ❌ |

---

**Pytania?** Zobacz [główny README](../README.md)
