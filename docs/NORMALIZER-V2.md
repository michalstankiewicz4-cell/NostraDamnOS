# 🔄 Normalizer v2.0 - Complete

## Philosophy

**Transform raw → SQL + UPSERT**

- ✅ Receives raw JSON from Fetcher
- ✅ Maps to SQL schema v2.0
- ✅ Executes UPSERT (no duplicates)
- ✅ Works with RODO-filtered data
- ❌ Does NOT fetch data
- ❌ Does NOT know UI
- ❌ Does NOT filter RODO - receives already clean data

---

## 🔒 RODO & Data Privacy

**Ważne:** Normalizer dostaje już **przefiltrowane** dane z Pipeline.

**Przepływ:**
```
Pipeline:
  1. raw = await runFetcher(config)
  2. if (config.rodoFilter) {
       processedRaw = applyRodo(raw)  ← RODO filtering
     }
  3. stats = await runNormalizer(db2, processedRaw)  ← Normalizer

Normalizer:
  - Otrzymuje: processedRaw (bez email, telefon, PESEL)
  - Transformuje: raw → SQL records
  - Zapisuje: UPSERT do bazy (bez danych wrażliwych)
```

**Co to oznacza:**
- ✅ Normalizer **nie musi** się martwić o RODO
- ✅ Dane wrażliwe już usunięte przez Pipeline
- ✅ Baza zawiera tylko bezpieczne dane
- ✅ Separation of concerns - każdy moduł ma swoją rolę

**Przykład:**
```javascript
// Pipeline (pipeline.js)
const raw = await runFetcher(config);
// raw.poslowie[0] = { id: 1, imie: "Jan", telefon: "123456789", ... }

if (config.rodoFilter) {
    processedRaw = applyRodo(raw);  // modules/rodo.js
    // processedRaw.poslowie[0] = { id: 1, imie: "Jan" }  ← telefon usunięty!
}

const stats = await runNormalizer(db2, processedRaw);
// Normalizer zapisuje do bazy BEZ telefonu
```

Zobacz: `modules/rodo.js`, `pipeline.js`

---

## Usage

```javascript
import { runNormalizer } from './normalizer/normalizer.js';
import { db2 } from './modules/database-v2.js';

// Get raw data from fetcher
const raw = await runFetcher(config);

// Normalize + save to database
const stats = await runNormalizer(db2, raw);
// {
//   poslowie: 460,
//   wypowiedzi: 5240,
//   glosowania: 320,
//   ...
// }
```

---

## Complete Modules (11/11) ✅

1. **poslowie.js** - Deputies/Senators
2. **posiedzenia.js** - Parliamentary sittings
3. **wypowiedzi.js** - Statements
4. **glosowania.js** - Votings
5. **glosy.js** - Individual votes
6. **interpelacje.js** - Interpellations ✅ NEW
7. **projekty_ustaw.js** - Bills ✅ NEW
8. **komisje.js** - Committees ✅ NEW
9. **komisje_posiedzenia.js** - Committee sittings ✅ NEW
10. **komisje_wypowiedzi.js** - Committee statements ✅ NEW
11. **oswiadczenia_majatkowe.js** - Financial disclosures ✅ NEW

---

## Pattern

Each module has 2 functions:

### 1. normalize*(raw)
```javascript
// Transform API JSON → SQL-ready records
export function normalizePoslowie(raw) {
    return raw.map(p => ({
        id_osoby: p.id,
        imie: p.imie,
        nazwisko: p.nazwisko,
        klub: p.klub,
        okreg: p.okreg || null,
        rola: p.rola || 'poseł',
        kadencja: p.kadencja
    }));
}
```

**Field mapping:**
- Handles API field name variations (e.g., `id` vs `id_osoby`)
- Provides defaults for optional fields
- Cleans and validates data

### 2. save*(db, records)
```javascript
// UPSERT to database
export function savePoslowie(db, records) {
    const stmt = db.database.prepare(`
        INSERT INTO poslowie (...) VALUES (...)
        ON CONFLICT(...) DO UPDATE SET ...
    `);
    
    for (const r of records) {
        stmt.run([...values]);
    }
    
    stmt.free();
    console.log(\`[Normalizer] Saved \${records.length} poslowie\`);
}
```

**UPSERT pattern:**
- `INSERT` new records
- `ON CONFLICT` update existing
- No duplicates guaranteed
- Logs count of saved records

---

## Field Mappings

### poslowie
```
API → DB
id → id_osoby
imie → imie
nazwisko → nazwisko
klub → klub
okreg → okreg
rola → rola (default: 'poseł')
kadencja → kadencja
```

### wypowiedzi
```
API → DB
id → id_wypowiedzi
id_posiedzenia/posiedzenie → id_posiedzenia
id_osoby/posel → id_osoby
data → data
tekst/tresc → tekst
typ → typ (default: 'wystąpienie')
```

### glosowania
```
API → DB
id → id_glosowania
id_posiedzenia → id_posiedzenia
numer → numer
data → data
wynik → wynik
tytul → tytul
za → za (default: 0)
przeciw → przeciw (default: 0)
wstrzymalo → wstrzymalo (default: 0)
```

*(Similar mappings for all 11 modules)*

---

## Pipeline Flow

```
1. Fetcher → Raw JSON
      ↓
2. Normalizer → normalize*()
      ↓
3. SQL-ready records
      ↓
4. Normalizer → save*()
      ↓
5. Database UPSERT
      ↓
6. Stats returned
```

---

## Order of Execution

**Critical:** Modules execute in dependency order:

1. **poslowie** (foundation - no deps)
2. **posiedzenia** (no deps)
3. **wypowiedzi** (needs: poslowie, posiedzenia)
4. **glosowania** (needs: posiedzenia)
5. **glosy** (needs: glosowania, poslowie)
6. **interpelacje** (needs: poslowie)
7. **projekty_ustaw** (no deps)
8. **komisje** (no deps)
9. **komisje_posiedzenia** (needs: komisje)
10. **komisje_wypowiedzi** (needs: komisje_posiedzenia, poslowie)
11. **oswiadczenia_majatkowe** (needs: poslowie)

---

## Error Handling

Each module:
- ✅ Validates required fields
- ✅ Provides defaults for optional fields
- ✅ Logs save count
- ✅ Uses prepared statements (SQL injection safe)
- ✅ Frees statements after use

---

## Stats Output

```javascript
const stats = await runNormalizer(db2, raw);
// {
//   poslowie: 460,
//   posiedzenia: 52,
//   wypowiedzi: 5240,
//   glosowania: 320,
//   glosy: 14750,
//   interpelacje: 842,
//   projekty_ustaw: 356,
//   komisje: 28,
//   komisje_posiedzenia: 145,
//   komisje_wypowiedzi: 2340,
//   oswiadczenia_majatkowe: 460
// }
```

---

## Benefits

✅ **Complete** - all 11 data types  
✅ **Modular** - each table independent  
✅ **UPSERT** - no duplicates  
✅ **Testable** - mock fetcher/db  
✅ **Clean** - single responsibility  
✅ **Robust** - handles API variations  
✅ **Fast** - prepared statements  

---

## Integration

```javascript
// Full ETL Pipeline
import { runFetcher } from './fetcher/fetcher.js';
import { runNormalizer } from './normalizer/normalizer.js';
import { db2 } from './modules/database-v2.js';

// 1. Init database
await db2.init();

// 2. Fetch raw data
const config = { kadencja: 10, modules: ['poslowie', 'wypowiedzi'] };
const raw = await runFetcher(config);

// 3. Normalize + save
const stats = await runNormalizer(db2, raw);

// 4. Query
const poslowie = db2.getPoslowie({ kadencja: 10 });
```

---

**Version:** 2.0  
**Status:** ✅ Complete (11/11 modules)  
**Lines:** ~400 total  
**Dependencies:** database-v2.js
