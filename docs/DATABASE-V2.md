# 🗄️ Database v2.0 - Complete Schema

## Architektura

**12 tabel relacyjnych** + metadata dla pełnego ETL pipeline:

```
poslowie (fundament)
    ↓
posiedzenia → wypowiedzi → glosowania → glosy
    ↓
interpelacje, projekty_ustaw, oswiadczenia_majatkowe
    ↓
komisje → komisje_posiedzenia → komisje_wypowiedzi
    ↓
metadata (cache, wersje, logi)
```

---

## Schema v2.0

### 1. **poslowie** (fundament - wszystko się odnosi do osób)

```sql
CREATE TABLE poslowie (
    id_osoby TEXT PRIMARY KEY,
    imie TEXT,
    nazwisko TEXT,
    klub TEXT,
    okreg INTEGER,
    rola TEXT,          -- poseł / senator
    kadencja INTEGER,
    email TEXT,
    aktywny INTEGER
);
```

**Indexes:**
- `idx_poslowie_kadencja`
- `idx_poslowie_klub`

---

### 2. **posiedzenia**

```sql
CREATE TABLE posiedzenia (
    id_posiedzenia INTEGER PRIMARY KEY,
    numer INTEGER,
    data_start TEXT,
    data_koniec TEXT,
    kadencja INTEGER,
    typ TEXT            -- sejm / senat
);
```

**Indexes:**
- `idx_posiedzenia_kadencja`
- `idx_posiedzenia_data`

---

### 3. **wypowiedzi**

```sql
CREATE TABLE wypowiedzi (
    id_wypowiedzi TEXT PRIMARY KEY,
    id_posiedzenia INTEGER,
    id_osoby TEXT,
    data TEXT,
    tekst TEXT,
    typ TEXT,
    FOREIGN KEY(id_posiedzenia) REFERENCES posiedzenia(id_posiedzenia),
    FOREIGN KEY(id_osoby) REFERENCES poslowie(id_osoby)
);
```

**Indexes:**
- `idx_wypowiedzi_posiedzenie`
- `idx_wypowiedzi_osoba`
- `idx_wypowiedzi_data`

---

### 4. **glosowania**

```sql
CREATE TABLE glosowania (
    id_glosowania TEXT PRIMARY KEY,
    id_posiedzenia INTEGER,
    numer INTEGER,
    data TEXT,
    wynik TEXT,         -- przyjęto/odrzucono
    tytul TEXT,
    za INTEGER,
    przeciw INTEGER,
    wstrzymalo INTEGER
);
```

---

### 5. **glosy** (indywidualne głosy posłów)

```sql
CREATE TABLE glosy (
    id_glosu TEXT PRIMARY KEY,      -- hash: id_glosowania + id_osoby
    id_glosowania TEXT,
    id_osoby TEXT,
    glos TEXT                       -- za/przeciw/wstrzymał/nieobecny
);
```

---

### 6. **interpelacje**

```sql
CREATE TABLE interpelacje (
    id_interpelacji TEXT PRIMARY KEY,
    id_osoby TEXT,
    data TEXT,
    tytul TEXT,
    tresc TEXT,
    status TEXT
);
```

---

### 7. **projekty_ustaw**

```sql
CREATE TABLE projekty_ustaw (
    id_projektu TEXT PRIMARY KEY,
    kadencja INTEGER,
    data TEXT,
    tytul TEXT,
    status TEXT,
    opis TEXT
);
```

---

### 8. **komisje**

```sql
CREATE TABLE komisje (
    id_komisji TEXT PRIMARY KEY,
    nazwa TEXT,
    skrot TEXT,
    typ TEXT,
    kadencja INTEGER
);
```

---

### 9. **komisje_posiedzenia**

```sql
CREATE TABLE komisje_posiedzenia (
    id_posiedzenia_komisji TEXT PRIMARY KEY,
    id_komisji TEXT,
    numer INTEGER,
    data TEXT,
    opis TEXT
);
```

---

### 10. **komisje_wypowiedzi**

```sql
CREATE TABLE komisje_wypowiedzi (
    id_wypowiedzi_komisji TEXT PRIMARY KEY,
    id_posiedzenia_komisji TEXT,
    id_osoby TEXT,
    tekst TEXT,
    data TEXT,
    typ TEXT
);
```

---

### 11. **oswiadczenia_majatkowe**

```sql
CREATE TABLE oswiadczenia_majatkowe (
    id_oswiadczenia TEXT PRIMARY KEY,
    id_osoby TEXT,
    rok INTEGER,
    tresc TEXT,
    data_zlozenia TEXT
);
```

---

### 12. **metadata** (cache, wersje, logi)

```sql
CREATE TABLE metadata (
    klucz TEXT PRIMARY KEY,
    wartosc TEXT,
    timestamp TEXT
);
```

**Przykładowe klucze:**
- `schema_version` → "2.0"
- `ostatnie_pobrane_posiedzenie` → "52"
- `data_ostatniego_pobrania` → ISO date
- `cache_size_kb` → "2450"

---

## API Usage

### Inicjalizacja

```javascript
import { db2 } from './modules/database-v2.js';

await db2.init();
```

### Dodawanie danych (UPSERT)

```javascript
// Posłowie
db2.upsertPoslowie([
    {
        id_osoby: 'ABC123',
        imie: 'Jan',
        nazwisko: 'Kowalski',
        klub: 'KO',
        okreg: 41,
        rola: 'poseł',
        kadencja: 10
    }
]);

// Wypowiedzi
db2.upsertWypowiedzi([
    {
        id_wypowiedzi: 'WYP_001',
        id_posiedzenia: 52,
        id_osoby: 'ABC123',
        data: '2025-01-20T10:00:00',
        tekst: 'Treść wypowiedzi...',
        typ: 'wystąpienie'
    }
]);

// Głosowania
db2.upsertGlosowania([...]);

// Komisje
db2.upsertKomisje([...]);

// etc. (11 metod upsert)
```

### Pobieranie danych (Query)

```javascript
// Wszyscy posłowie z kadencji 10
const poslowie = db2.getPoslowie({ kadencja: 10 });

// Wszystkie wypowiedzi z posiedzenia 52
const wypowiedzi = db2.getWypowiedzi({ id_posiedzenia: 52 });

// Wypowiedzi konkretnego posła (limit 100)
const wypowiedziPosla = db2.getWypowiedzi({ 
    id_osoby: 'ABC123',
    limit: 100
});

// Statystyki (liczniki wszystkich tabel)
const stats = db2.getStats();
// {
//   poslowie: 460,
//   posiedzenia: 52,
//   wypowiedzi: 15420,
//   glosowania: 1240,
//   ...
// }
```

### Metadata

```javascript
// Zapisz
db2.upsertMetadata('ostatnie_posiedzenie', '52');
db2.upsertMetadata('cache_version', '2.1');

// Odczytaj
const result = db2.database.exec(
    "SELECT wartosc FROM metadata WHERE klucz = 'ostatnie_posiedzenie'"
);
```

### Czyszczenie

```javascript
// Wyczyść wszystkie dane (zachowaj schema)
db2.clearAll();
```

### Export/Import

```javascript
// Export do binary
const data = db2.export();
localStorage.setItem('db_backup', JSON.stringify(Array.from(data)));

// Import z binary
const saved = JSON.parse(localStorage.getItem('db_backup'));
db2.import(new Uint8Array(saved));
```

---

## Benefits

✅ **Relacyjne** - foreign keys, indexes, joins  
✅ **UPSERT** - odporność na duplikaty  
✅ **Modularne** - każdy typ danych ma swoją tabelę  
✅ **Skalowalne** - indeksy na kluczowych kolumnach  
✅ **Zgodne z API** - struktura 1:1 z API Sejmu  
✅ **Metadata** - śledzenie cache, wersji, logów  
✅ **Zero dependencies** - tylko sql.js  

---

## Migration z v1.0

```javascript
// Stara baza (v1.0) - 1 tabela
const oldData = oldDb.getAll();

// Nowa baza (v2.0) - 12 tabel
await db2.init();

// Migruj posłów
db2.upsertPoslowie(oldData.filter(r => r.type === 'deputy'));

// Migruj wypowiedzi
db2.upsertWypowiedzi(oldData.filter(r => r.type === 'statement'));

// etc.
```

---

**Schema Version:** 2.0  
**Created:** 2026-01-24  
**Tables:** 12 + metadata  
**Indexes:** 20+  
**UPSERT Methods:** 11
