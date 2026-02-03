# Changelog

All notable changes to this project will be documented in this file.

## [2.1.1] - 2026-02-03

### Added

- Shortcut: Shift+P toggles database import/export buttons when the floating console is open

### Changed

- Database import/export buttons are hidden by default to avoid initial flicker
- README documentation section now lists all text docs with brief descriptions
- README now mentions the overall order/structure of text files
- Integration of zapytania pisemne (written questions) module into full ETL pipeline
- Added RODO support for zapytania module - 'email' field now included in RODO filter

### Fixed

- Fixed import of `applyRodo` function in zapytania normalizer (was using non-existent `applyRODOFilter`)
- Database schema updated to include zapytania and zapytania_odpowiedzi tables

---

## [2.1.0] - 2026-01-26

### Added - RODO Compliance & Console Improvements

**RODO Filter:**
- ✅ Checkbox "🔒 Filtr RODO" in ETL Panel sidebar
- ✅ `modules/rodo.js` - centralized filtering rules
- ✅ Removes sensitive data: email, phone, PESEL, addresses
- ✅ Works between Fetcher and Normalizer (clean architecture)
- ✅ Logged in console: "🛡️ RODO: removing sensitive fields..."
- ✅ Default: ENABLED (checkbox checked)

**Console Log Interceptor:**
- ✅ Global `console.log()` override - captures ALL logs
- ✅ Early logs buffered (before UI console exists)
- ✅ All logs visible in UI: geo.js, api-handler-v2.js, pipeline, etc.
- ✅ Format: `[HH:MM:SS] message`
- ✅ Auto-sync to both consoles (main + floating)

**Pipeline Fixes:**
- ✅ Removed stubs: `fetchPerSittingData()`, `fetchPerTermData()`
- ✅ Connected real `runFetcher()` - pipeline now fetches actual data
- ✅ Improved cache: reads `num ?? id ?? posiedzenie ?? number`
- ✅ Added `sittingsToFetch` support in fetcher

**UI Improvements:**
- ✅ Radio buttons for range mode: "Ostatnie X" vs "Zakres od-do"
- ✅ Floating console button (📋) - always accessible
- ✅ Empty favicon (no more 404 errors)
- ✅ Unified margins: all 12px (vertical spacing)
- ✅ Uniform form controls styling

### Changed

- ETL Panel now uses real fetcher (not stubs)
- RODO filter enabled by default
- Console captures all logs (not just pipeline)

### Fixed

- database-v2.js syntax error (missing object closure)
- Pipeline now actually fetches data from API
- Radio buttons `rangeMode` properly connected

### Security

- ⚠️ **Data Disclaimer:** System parses data automatically. 97.6% accuracy. Verify in official sources.
- 🔒 **RODO Compliant:** No sensitive data stored (email, phone, PESEL filtered by default)
- 🔒 **Empty Database:** Clean start, only public API data

---

## [2.0.0] - 2026-01-24

### Added - Complete ETL v2.0 System

**Pipeline v2.0:**
- Complete ETL orchestrator (UI → Fetcher → Normalizer → Database)
- `buildConfigFromUI()` - reads ETL Panel configuration
- Progress callbacks: `onProgress`, `onLog`, `onError`, `onComplete`
- Metadata tracking (last_fetch_date, config, stats)
- Full documentation: `docs/PIPELINE-V2.md`

**Fetcher v2.0:**
- 12 independent fetch modules (poslowie, wypowiedzi, glosowania, etc.)
- `safeFetch()` - retry logic + exponential backoff (3 attempts)
- Mode support: 'full' vs 'meta' (complete data vs IDs only)
- Range support: 'last N' vs 'custom' (from-to)
- Pure data pipeline - no database coupling
- Full documentation: `docs/FETCHER-V2.md`

**Normalizer v2.0:**
- 11 transform modules (poslowie, wypowiedzi, etc.)
- Field mapping (handles API variations: id vs id_osoby)
- UPSERT to database (prevents duplicates)
- Execution order respects dependencies
- Full documentation: `docs/NORMALIZER-V2.md`

**Database v2.0:**
- 12 tables with proper schema
- Foreign keys + indexes
- Metadata table for cache
- Complete documentation: `docs/DATABASE-V2.md`

**Incremental Cache:**
- Smart caching: tracks `last_posiedzenie`
- Only fetches new sittings (10-100× faster)
- Cache helpers: `getLastPosiedzenie()`, `setLastPosiedzenie()`
- `filterNewSittings()` - skips already-fetched data
- Full documentation: `docs/INCREMENTAL-CACHE.md`

**Dynamic Progress:**
- Accurate 0-100% progress tracking
- Adapts to workload (N sittings)
- Real-time logging with timestamps
- Example: 3 sittings = 15%→33%→51%→69% per sitting

**UI Improvements:**
- ETL Panel header: "📥 Import Danych z API Sejmu"
- Panel height reduced: 80vh → 50vh (no scroll needed)
- Clean layout without old API interface
- All emoji preserved (UTF-8 BOM)

### Changed

- Complete system rewrite from v1.0
- Modular architecture (12 fetcher + 11 normalizer modules)
- SQLite schema v2.0 (12 tables)

### Fixed

- UTF-8 encoding issues with emoji
- Event listeners check for element existence
- Panel height optimized for no scrolling

### Performance

- **First run:** ~2 minutes (100 sittings)
- **Subsequent (up to date):** ~1 second ⚡ (100× faster)
- **Subsequent (3 new):** ~10 seconds ⚡ (10× faster)

---

## [1.0.0] - 2026-01-20

### Added

- Initial release
- Basic API fetcher
- localStorage cache
- SQLite integration
- Simple UI

---

## Commits (2026-01-24)

- `e28f012` - fix: reduce ETL panel height to 50vh (no scroll)
- `ef696f7` - feat: add ETL section header + reduce panel height
- `60e95a1` - refactor: Clean UI - remove old API interface
- `378d0db` - feat: Incremental Cache + Dynamic Progress
- `baaba2a` - feat: Pipeline v2.0 - Complete ETL Integration
- `716e885` - feat: Normalizer v2.0 - 11 transform modules
- `ca1383a` - feat: Normalizer v2.0 with UPSERT methods
- `f8fef7d` - feat: Fetcher v2.0 - Modular architecture (12 modules)
