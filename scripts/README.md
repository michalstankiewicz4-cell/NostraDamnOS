# 📜 Skrypty pobierania danych

## 🎯 Architektura 3-skryptowa

```
1. fetch-sejm.js    → /data/sejm/*.raw.jsonl     (RAW data)
2. fetch-senat.js   → /data/senat/*.raw.jsonl    (RAW data, TODO)
3. normalize.js     → /data/final/*.jsonl        (Znormalizowane + memberID + role)
```

---

## 📋 Przepływ danych

```
API Sejmu
    ↓
[fetch-sejm.js]  → wypowiedzi.raw.jsonl (speakerRaw, bez memberID)
    ↓
[normalize.js]   → wypowiedzi.jsonl (memberID, role, position)
    ↓
Frontend (data-loader.js)
```

---

## 🔧 Skrypty

### 1️⃣ `fetch-sejm.js` - Pobieranie danych Sejmu

**Użycie:**
```bash
node scripts/fetch-sejm.js [kadencja] [max_posiedzeń]

# Przykłady:
node scripts/fetch-sejm.js 10 1    # Kadencja 10, 1 posiedzenie
node scripts/fetch-sejm.js 10 5    # Kadencja 10, 5 posiedzeń
node scripts/fetch-sejm.js 10 50   # Kadencja 10, wszystkie posiedzenia
```

**Co robi:**
- ✅ Pobiera posłów → `poslowie.jsonl`
- ✅ Pobiera posiedzenia → `posiedzenia.jsonl`
- ✅ Pobiera **WSZYSTKIE wypowiedzi** z HTML → `wypowiedzi.raw.jsonl`
  - **Split po `<h2 class="mowca">`** - pobiera wszystkie wypowiedzi z transkryptu!
- ✅ Pobiera głosowania → `glosowania.jsonl`
- ✅ Pobiera głosy → `glosy.jsonl`

**Struktura wypowiedzi RAW:**
```json
{
  "institution": "sejm",
  "sitting": 1,
  "date": "2023-11-13",
  "transcriptNum": 1,
  "speakerRaw": "Poseł Jan Kowalski",
  "text": "..."
}
```

**Output:** `/data/sejm/`

---

### 2️⃣ `fetch-senat.js` - Pobieranie danych Senatu (TODO)

**Status:** ⚠️ Szkielet - wymaga dokumentacji API Senatu

**Użycie:**
```bash
node scripts/fetch-senat.js [kadencja] [max_posiedzeń]
```

**TODO:**
- [ ] Znaleźć dokumentację API Senatu
- [ ] Zaimplementować `fetchSenators()`
- [ ] Zaimplementować `fetchProceedings()`
- [ ] Zaimplementować `fetchAllStatements()`
- [ ] Zaimplementować `fetchAllVotings()`

**Output:** `/data/senat/` (gdy gotowe)

---

### 3️⃣ `normalize.js` - Normalizacja i łączenie danych

**Użycie:**
```bash
node scripts/normalize.js
```

**Co robi:**
1. ✅ Wczytuje RAW data z `/data/sejm/` i `/data/senat/`
2. ✅ **Dopasowuje memberID** (matching po nazwisku + imieniu)
3. ✅ **Wykrywa role:**
   - `poseł`, `senator`, `minister`, `marszałek`, `wicemarszałek`
   - `prezydent`, `premier`, `wiceminister`, `ekspert`, `gość`
4. ✅ **Wykrywa position** (pełny tytuł, np. "Minister Zdrowia")
5. ✅ Łączy Sejm + Senat w jeden plik

**Struktura znormalizowana:**
```json
{
  "institution": "sejm",
  "sitting": 1,
  "date": "2023-11-13",
  "transcriptNum": 1,
  "speaker": "Poseł Jan Kowalski",
  "memberID": 123,
  "role": "poseł",
  "position": null,
  "text": "..."
}
```

**Output:** `/data/final/`

**Statystyki:**
```
📊 Dopasowanie (sejm): matched=2204, unmatched=58, rate=97.4%
```

---

## 📊 Przykładowy workflow

### Pobranie danych z 5 posiedzeń:

```bash
# 1. Pobierz RAW data z Sejmu
node scripts/fetch-sejm.js 10 5
# Tworzy: /data/sejm/*.jsonl, /data/sejm/wypowiedzi.raw.jsonl

# 2. (Opcjonalnie) Pobierz Senat (gdy gotowe)
# node scripts/fetch-senat.js 11 5

# 3. Normalizuj (dodaj memberID, role, position)
node scripts/normalize.js
# Tworzy: /data/final/wypowiedzi.jsonl (z memberID!)

# 4. Wynik: /data/final/ zawiera czyste dane gotowe do użycia
```

---

## 🗂️ Struktura katalogów

```
/data
  /sejm              ← RAW data (fetch-sejm.js)
    poslowie.jsonl
    posiedzenia.jsonl
    wypowiedzi.raw.jsonl  ← speakerRaw, bez memberID
    glosowania.jsonl
    glosy.jsonl

  /senat             ← RAW data (fetch-senat.js, TODO)
    senatorowie.jsonl
    posiedzenia.jsonl
    wypowiedzi.raw.jsonl
    glosowania.jsonl
    glosy.jsonl

  /final             ← Znormalizowane (normalize.js)
    poslowie.jsonl
    senatorowie.jsonl
    wypowiedzi.jsonl      ← memberID + role + position!
    glosowania.jsonl
    glosy.jsonl

  manifest.json      ← Lista plików (wskazuje na /final/)
```

---

## 🔄 Migracja ze starych skryptów

**Stare skrypty (backup):**
- `fetch-sejm-data.OLD.js` - poprzednia wersja (tylko 1 wypowiedź/transcript)
- `fix-wypowiedzi-memberid.OLD.js` - standalone matching

**Różnice:**
| Feature | Stary | Nowy |
|---------|-------|------|
| Wypowiedzi/transcript | ❌ Tylko 1 | ✅ Wszystkie |
| memberID | ✅ Inline | ✅ W normalize.js |
| Role detection | ❌ Brak | ✅ Tak |
| Senat | ❌ Brak | ✅ Gotowy (TODO API) |

---

## ⚙️ Konfiguracja

### Delay między requestami

W `fetch-sejm.js` i `fetch-senat.js`:
```javascript
const DELAY_MS = 400; // 400ms między requestami
```

**Dlaczego:** API Sejmu nie lubi zbyt wielu requestów naraz.

### Limit 404

W `fetchStatementsForDay()`:
```javascript
while (notFound < 3 && num < 300) {
  // 3 kolejne 404 = koniec dnia
  // max 300 transkryptów/dzień
}
```

---

## 🐛 Znane problemy

### 1. Brak API Senatu
**Problem:** `fetch-senat.js` to szkielet, brak dokumentacji API.

**Rozwiązanie:** Trzeba znaleźć oficjalną dokumentację API Senatu lub web scraping.

### 2. Wykrywanie ról
**Status:** ✅ ROZWIĄZANE - 100% wypowiedzi ma rozpoznaną rolę!

**Rozpoznawane role:**
- poseł (530), wiceminister (31), minister (10), premier (2), prokurator (2), przewodniczący (1), prezydent (1)

**Nierozpoznane:** 0 (brak nieznanych ról)


---

## 📝 Historia zmian

- **2025-01-23**: Nowa architektura 3-skryptowa
- **2025-01-23**: Backup starych skryptów (`.OLD.js`)
- **2025-01-23**: Split parsing HTML - pobiera wszystkie wypowiedzi!
