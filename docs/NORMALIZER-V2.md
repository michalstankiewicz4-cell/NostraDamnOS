# 🔄 Normalizer v2.0

## Philosophy

**Transform raw → SQL + UPSERT**

- ✅ Receives raw JSON from Fetcher
- ✅ Maps to SQL schema
- ✅ Executes UPSERT
- ❌ Does NOT fetch data
- ❌ Does NOT know UI

---

## Usage

```javascript
import { runNormalizer } from './normalizer/normalizer.js';
import { db2 } from './modules/database-v2.js';

// Get raw data from fetcher
const raw = await runFetcher(config);

// Normalize + save to database
await runNormalizer(db2, raw);
```

---

## Modules (11 total)

1. **poslowie.js** - Deputies/Senators
2. **posiedzenia.js** - Parliamentary sittings
3. **wypowiedzi.js** - Statements
4. **glosowania.js** - Votings
5. **glosy.js** - Individual votes
6. **interpelacje.js** - Interpellations
7. **projekty_ustaw.js** - Bills
8. **komisje.js** - Committees
9. **komisje_posiedzenia.js** - Committee sittings
10. **komisje_wypowiedzi.js** - Committee statements
11. **oswiadczenia.js** - Financial disclosures

---

## Pattern

Each module has 2 functions:

### normalize*(raw)
```javascript
// Transform API JSON → SQL-ready records
export function normalizePoslowie(raw) {
    return raw.map(p => ({
        id_osoby: p.id,
        imie: p.imie,
        nazwisko: p.nazwisko,
        // ... map all fields
    }));
}
```

### save*(db, records)
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
}
```

---

## Benefits

✅ **Modular** - each table independent  
✅ **UPSERT** - no duplicates  
✅ **Testable** - mock fetcher/db  
✅ **Clean** - single responsibility  

---

**Version:** 2.0  
**Modules:** 11 (4 complete, 7 TODO)
