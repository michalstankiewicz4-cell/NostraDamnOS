# 🔄 Pipeline v2.0 - Complete ETL Integration

## Overview

**Full ETL Pipeline:** UI → Fetcher → Normalizer → Database

Complete integration of all v2.0 components into a single, streamlined data pipeline.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              ETL Panel (UI)                 │
│  - Institution, Term, Range                 │
│  - Data types selection                     │
│  - Mode (full/meta)                         │
└─────────────────┬───────────────────────────┘
                  │ buildConfigFromUI()
                  ↓
┌─────────────────────────────────────────────┐
│           Pipeline Orchestrator             │
│  - Validates config                         │
│  - Manages workflow                         │
│  - Reports progress                         │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
┌──────────────┐    ┌──────────────┐
│   Fetcher    │    │  Database    │
│  12 modules  │    │  12 tables   │
└──────┬───────┘    └──────┬───────┘
       │ Raw JSON          │
       ↓                   ↓
┌─────────────────────────────┐
│      Normalizer             │
│   normalize() + save()      │
│      11 modules             │
└─────────────────────────────┘
                  │
                  ↓ UPSERT
         ┌────────────────┐
         │  SQLite DB     │
         │  Persistent    │
         └────────────────┘
```

---

## Usage

### From ETL Panel UI

```javascript
// User clicks "Pobierz dane z API"
// → api-handler-v2.js handles click
// → buildConfigFromUI() creates config
// → runPipeline(config) executes ETL
```

### Programmatic

```javascript
import { runPipeline } from './pipeline.js';

const config = {
    typ: 'sejm',
    kadencja: 10,
    mode: 'full',
    rangeMode: 'last',
    rangeCount: 2,
    modules: ['poslowie', 'wypowiedzi', 'glosowania']
};

const result = await runPipeline(config, {
    onProgress: (percent, text) => {
        console.log(`${percent}%: ${text}`);
    },
    onLog: (message) => {
        console.log(message);
    },
    onComplete: (result) => {
        console.log('Done:', result.stats);
    }
});
```

---

## Config Object

```javascript
{
    // Required
    typ: 'sejm',              // 'sejm' | 'senat'
    kadencja: 10,             // 7-10
    mode: 'full',             // 'full' | 'meta'
    rangeMode: 'last',        // 'last' | 'custom'
    rangeCount: 2,            // for 'last' mode
    modules: [...],           // array of module names
    
    // Optional
    rangeFrom: 50,            // for 'custom' mode
    rangeTo: 52,              // for 'custom' mode
    selectedCommittees: [...] // for committee data
}
```

---

## buildConfigFromUI()

Reads ETL Panel form and builds config object:

```javascript
const config = buildConfigFromUI();
// {
//   typ: 'sejm',
//   kadencja: 10,
//   mode: 'full',
//   rangeMode: 'last',
//   rangeCount: 2,
//   modules: ['poslowie', 'posiedzenia', 'wypowiedzi']
// }
```

**Auto-includes:**
- Always: `poslowie`, `posiedzenia` (foundation)
- Conditional: based on checkboxes

---

## Callbacks

### onProgress(percent, text)
```javascript
onProgress: (percent, text) => {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = text;
}
```

**Called at:**
- 10% - Initializing database
- 20% - Fetching data
- 60% - Data fetched
- 70% - Normalizing data
- 90% - Updating metadata
- 100% - Complete

### onLog(message)
```javascript
onLog: (message) => {
    console.log(message);
    // or append to UI log
}
```

**Example messages:**
- "📦 Initializing database..."
- "⬇️ Fetching data from API..."
- "✅ Fetched 5240 records from 3 modules"
- "🧹 Normalizing and saving to database..."
- "✅ Pipeline complete"

### onError(error)
```javascript
onError: (error) => {
    console.error(error);
    alert(`Error: ${error.message}`);
}
```

### onComplete(result)
```javascript
onComplete: (result) => {
    // result = {
    //   success: true,
    //   stats: { poslowie: 460, wypowiedzi: 5240, ... },
    //   fetchedCount: 5700,
    //   timestamp: '2026-01-24T14:30:00.000Z'
    // }
}
```

---

## Pipeline Flow

### Step 1: Initialize Database (10%)
```javascript
if (!db2.database) {
    await db2.init();
}
```

### Step 2: Fetch Raw Data (20-60%)
```javascript
const raw = await runFetcher(config);
// {
//   poslowie: [...],
//   wypowiedzi: [...],
//   glosowania: [...]
// }
```

### Step 3: Normalize + Save (70-90%)
```javascript
const stats = await runNormalizer(db2, raw);
// {
//   poslowie: 460,
//   wypowiedzi: 5240,
//   glosowania: 320
// }
```

### Step 4: Update Metadata (90%)
```javascript
db2.upsertMetadata('last_fetch_date', timestamp);
db2.upsertMetadata('last_fetch_config', JSON.stringify(config));
db2.upsertMetadata('last_fetch_stats', JSON.stringify(stats));
```

### Step 5: Complete (100%)
```javascript
return {
    success: true,
    stats,
    fetchedCount,
    timestamp
};
```

---

## Error Handling

**Try-catch wrapper:**
```javascript
try {
    // ... pipeline steps
    return { success: true, ... };
} catch (error) {
    console.error('[Pipeline] Error:', error);
    onError(error);
    return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
    };
}
```

**Errors propagate from:**
- Fetcher (API errors, network errors)
- Normalizer (data validation errors)
- Database (SQL errors)

---

## Integration Files

### pipeline.js
- `runPipeline(config, callbacks)` - main orchestrator
- `buildConfigFromUI()` - reads ETL Panel form

### api-handler-v2.js
- Handles ETL Panel button clicks
- Manages UI updates (progress, logs, status)
- Calls `runPipeline()` with callbacks

### etl-bridge.js
- Syncs ETL Panel ↔ old UI form
- Real-time estimate updates
- Button click forwarding

---

## Example: Full Integration

```javascript
// User fills ETL Panel:
// - Sejm, kadencja 10
// - Last 2 sittings
// - Wypowiedzi + Głosowania

// User clicks "Pobierz"
// ↓

// etl-bridge.js forwards click to etlFetchBtn
// ↓

// api-handler-v2.js handles click:
const config = buildConfigFromUI();
// {
//   typ: 'sejm',
//   kadencja: 10,
//   rangeMode: 'last',
//   rangeCount: 2,
//   modules: ['poslowie', 'posiedzenia', 'wypowiedzi', 'glosowania']
// }

await runPipeline(config, {
    onProgress: (pct, txt) => { /* update UI */ },
    onLog: (msg) => { /* append to logs */ },
    onComplete: (result) => { /* show stats */ }
});

// ↓ Fetcher runs (12 modules)
// ↓ Normalizer runs (11 modules)
// ↓ Database saves (12 tables)
// ✅ Done!
```

---

## Benefits

✅ **End-to-end** - complete ETL in one call  
✅ **Modular** - each component independent  
✅ **Progress tracking** - real-time UI updates  
✅ **Error handling** - try-catch at every level  
✅ **Metadata** - tracks all fetches  
✅ **Callbacks** - flexible UI integration  
✅ **Config-driven** - declarative, not imperative  

---

**Version:** 2.0  
**Components:** Pipeline + Fetcher + Normalizer + Database  
**Status:** ✅ Complete integration
