# 🚰 Fetcher v2.0 - Pure Data Pipeline

## Philosophy

**Fetcher = Czysta rura**

- ✅ Pobiera surowe dane z API
- ✅ Zwraca JSON
- ❌ NIE dotyka bazy
- ❌ NIE formatuje danych
- ❌ NIE robi UPSERT
- ❌ NIE łączy tabel
- ❌ NIE zajmuje się RODO - to robi Pipeline

---

## 🔒 RODO Filter

**Ważne:** Fetcher **NIE** filtruje danych wrażliwych.

**Dlaczego?**
- Fetcher jest czystą rurą - pobiera RAW data z API
- Filtrowanie RODO = odpowiedzialność Pipeline
- Separation of concerns - każdy moduł ma swoją rolę

**Przepływ danych z RODO:**
```
Fetcher → raw data (z email, telefon, PESEL) →
Pipeline → 🛡️ RODO Filter (usuwa wrażliwe) →
Normalizer → filtered data →
Database (bez danych wrażliwych)
```

**Implementacja:**
```javascript
// Pipeline v2.0
const raw = await runFetcher(config);  // Fetcher: RAW data

if (config.rodoFilter) {
    processedRaw = applyRodo(raw);  // Pipeline: RODO filter
}

const stats = await runNormalizer(db2, processedRaw);  // Normalizer: czyste dane
```

Zobacz: `modules/rodo.js`, `pipeline.js`

---

## Architecture

```
UI Config → Fetcher → Raw JSON → Normalizer → Database
```

**12 niezależnych modułów:**
```
/fetcher
  fetcher.js             ← orchestrator + safeFetch
  /modules
    poslowie.js
    posiedzenia.js
    wypowiedzi.js
    glosowania.js
    glosy.js
    interpelacje.js
    projekty_ustaw.js
    komisje.js
    komisje_posiedzenia.js
    komisje_wypowiedzi.js
    oswiadczenia.js
    zapytania.js
```

---

## Usage

### Basic

```javascript
import { runFetcher } from './fetcher/fetcher.js';

const config = {
    kadencja: 10,
    typ: 'sejm',
    mode: 'full',  // or 'meta'
    rangeMode: 'last',
    rangeCount: 2,
    modules: ['poslowie', 'posiedzenia', 'wypowiedzi']
};

const data = await runFetcher(config);
// {
//   poslowie: [...],
//   posiedzenia: [...],
//   wypowiedzi: [...]
// }
```

### With Range

```javascript
const config = {
    kadencja: 10,
    rangeMode: 'custom',
    rangeFrom: 50,
    rangeTo: 52,
    modules: ['wypowiedzi', 'glosowania']
};
```

### Metadata Only

```javascript
const config = {
    mode: 'meta',  // only IDs, dates, basic fields
    modules: ['wypowiedzi']
};
```

---

## Modules

### 1. poslowie.js
```javascript
fetchPoslowie({ kadencja, typ })
→ Array of deputies/senators
```

### 2. posiedzenia.js
```javascript
fetchPosiedzenia({ kadencja, typ })
→ Array of parliamentary sittings
```

### 3. wypowiedzi.js
```javascript
fetchWypowiedzi(config)
→ Array of statements from sittings
• Supports mode: 'meta' for light data
• Uses getSittingNumbers() for range
```

### 4. glosowania.js
```javascript
fetchGlosowania(config)
→ Array of votings from sittings
```

### 5. glosy.js
```javascript
fetchGlosy({ glosowania, typ })
→ Array of individual votes
• Requires glosowania array
• Limited to 100 votings for safety
```

### 6. interpelacje.js
```javascript
fetchInterpelacje({ kadencja, typ })
→ Array of interpellations
```

### 7. projekty_ustaw.js
```javascript
fetchProjektyUstaw({ kadencja, typ })
→ Array of bills
```

### 8. komisje.js
```javascript
fetchKomisje({ kadencja, typ })
→ Array of committees
```

### 9. komisje_posiedzenia.js
```javascript
fetchKomisjePosiedzenia({ komisje, selectedCommittees, typ })
→ Array of committee sittings
• Filters by selectedCommittees
• 'all' fetches all committees
```

### 10. komisje_wypowiedzi.js
```javascript
fetchKomisjeWypowiedzi({ posiedzenia_komisji, mode, typ })
→ Array of committee statements
• Limited to 50 sittings for safety
```

### 11. oswiadczenia.js
```javascript
fetchOswiadczenia({ poslowie, typ })
→ Array of financial disclosures
• Limited to 100 deputies for safety
```

### 12. zapytania.js
```javascript
fetchZapytania({ kadencja, typ })
→ Array of written questions
```

---

## Error Handling

### safeFetch (retry + backoff)

```javascript
safeFetch(url)
• 3 attempts
• Exponential backoff: 500ms, 1000ms, 1500ms
• Throws after 3 failures
```

**Example:**
```javascript
try {
    const data = await safeFetch(url);
} catch (e) {
    console.error('API unreachable:', e.message);
}
```

---

## Config Object

```javascript
{
    kadencja: 10,              // required
    typ: 'sejm',               // 'sejm' | 'senat'
    mode: 'full',              // 'full' | 'meta'
    
    // Range mode
    rangeMode: 'last',         // 'last' | 'custom'
    rangeCount: 2,             // for 'last' mode
    rangeFrom: 50,             // for 'custom' mode
    rangeTo: 52,               // for 'custom' mode
    
    // Modules to fetch
    modules: [
        'poslowie',
        'posiedzenia',
        'wypowiedzi',
        'glosowania',
        'glosy',
        'interpelacje',
        'projekty_ustaw',
        'komisje',
        'komisje_posiedzenia',
        'komisje_wypowiedzi',
        'oswiadczenia',
        'zapytania'
    ],
    
    // Committee filter (optional)
    selectedCommittees: ['all'] // or ['FIN', 'EDU', ...]
}
```

---

## Helper Functions

### getSittingNumbers()
```javascript
getSittingNumbers(posiedzenia, config)
→ Array of sitting numbers based on range config

// Last 2
config = { rangeMode: 'last', rangeCount: 2 }
→ [51, 52]

// Custom range
config = { rangeMode: 'custom', rangeFrom: 50, rangeTo: 52 }
→ [50, 51, 52]
```

---

## Output Structure

```javascript
{
    poslowie: [
        { id: 'ABC', imie: 'Jan', nazwisko: 'Kowalski', ... }
    ],
    posiedzenia: [
        { num: 52, data_start: '2025-01-20', ... }
    ],
    wypowiedzi: [
        { id: 'WYP001', id_posiedzenia: 52, tekst: '...', ... }
    ],
    glosowania: [...],
    glosy: [...],
    interpelacje: [...],
    projekty_ustaw: [...],
    komisje: [...],
    komisje_posiedzenia: [...],
    komisje_wypowiedzi: [...],
    oswiadczenia: [...]
}
```

---

## Benefits

✅ **Modularne** - każdy moduł niezależny  
✅ **Testowalne** - łatwo mockować API  
✅ **Odporne** - retry + backoff  
✅ **Czytelne** - jeden moduł = jeden endpoint  
✅ **Skalowalne** - łatwo dodać nowe moduły  
✅ **Zgodne z UI** - obsługa wszystkich opcji  

---

## Next Step: Normalizer

Fetcher zwraca surowe dane → **Normalizer** formatuje i zapisuje do bazy.

**Separation of concerns:**
- Fetcher: GET from API
- Normalizer: TRANSFORM + UPSERT to DB

---

**Version:** 2.0  
**Modules:** 12  
**Dependencies:** 0 (tylko fetch)  
**Lines:** ~200 total
