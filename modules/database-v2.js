// Database v2.0 - Complete Schema for all 12 data types
// Nowa architektura: 12 tabel + metadata

export const db2 = {
    sql: null,
    database: null,
    
    async init() {
        console.log('[DB v2] Initializing...');
        
        // Zamknij starą bazę, jeśli istnieje (zapobiega wyciekowi pamięci WASM)
        if (this.database) {
            try { this.database.close(); } catch (e) { /* ignore */ }
            this.database = null;
        }
        
        if (!window.initSqlJs) {
            throw new Error('sql.js not loaded');
        }
        
        this.sql = await window.initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });
        
        // Try to load from localStorage first
        const savedDb = localStorage.getItem('nostradamnos_db');
        if (savedDb) {
            try {
                let uint8Array;
                if (savedDb.startsWith('[')) {
                    // Stary format: JSON array — kompatybilność wsteczna
                    uint8Array = new Uint8Array(JSON.parse(savedDb));
                } else {
                    // Nowy format: base64
                    const binaryStr = atob(savedDb);
                    uint8Array = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) {
                        uint8Array[i] = binaryStr.charCodeAt(i);
                    }
                }
                this.database = new this.sql.Database(uint8Array);
                this.migrateSchema();
                console.log('[DB v2] ✅ Loaded from localStorage');
                return this;
            } catch (err) {
                console.warn('[DB v2] Failed to load from localStorage:', err);
            }
        }
        
        // If no saved data, create new database
        this.database = new this.sql.Database();
        await this.createSchema();
        
        console.log('[DB v2] ✅ Initialized with complete schema');
        return this;
    },
    
    async createSchema() {
        const schema = `
            -- 1. Posłowie/Senatorowie (fundament - wszystko się odnosi do osób)
            CREATE TABLE IF NOT EXISTS poslowie (
                id_osoby TEXT PRIMARY KEY,
                imie TEXT,
                nazwisko TEXT,
                klub TEXT,
                okreg INTEGER,
                rola TEXT,          -- poseł / senator
                kadencja INTEGER,
                email TEXT,
                aktywny INTEGER DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_poslowie_kadencja ON poslowie(kadencja);
            CREATE INDEX IF NOT EXISTS idx_poslowie_klub ON poslowie(klub);
            
            -- 2. Posiedzenia
            CREATE TABLE IF NOT EXISTS posiedzenia (
                id_posiedzenia TEXT PRIMARY KEY,
                numer INTEGER,
                data_start TEXT,
                data_koniec TEXT,
                kadencja INTEGER,
                typ TEXT            -- sejm / senat
            );
            CREATE INDEX IF NOT EXISTS idx_posiedzenia_kadencja ON posiedzenia(kadencja);
            CREATE INDEX IF NOT EXISTS idx_posiedzenia_data ON posiedzenia(data_start);
            
            -- 3. Wypowiedzi
            CREATE TABLE IF NOT EXISTS wypowiedzi (
                id_wypowiedzi TEXT PRIMARY KEY,
                id_posiedzenia TEXT,
                id_osoby TEXT,
                data TEXT,
                tekst TEXT,
                typ TEXT,           -- wystąpienie, pytanie, etc.
                mowca TEXT,
                FOREIGN KEY(id_posiedzenia) REFERENCES posiedzenia(id_posiedzenia),
                FOREIGN KEY(id_osoby) REFERENCES poslowie(id_osoby)
            );
            CREATE INDEX IF NOT EXISTS idx_wypowiedzi_posiedzenie ON wypowiedzi(id_posiedzenia);
            CREATE INDEX IF NOT EXISTS idx_wypowiedzi_osoba ON wypowiedzi(id_osoby);
            CREATE INDEX IF NOT EXISTS idx_wypowiedzi_data ON wypowiedzi(data);
            
            -- 4. Głosowania
            CREATE TABLE IF NOT EXISTS glosowania (
                id_glosowania TEXT PRIMARY KEY,
                id_posiedzenia TEXT,
                numer INTEGER,
                data TEXT,
                wynik TEXT,         -- przyjęto/odrzucono
                tytul TEXT,
                za INTEGER,
                przeciw INTEGER,
                wstrzymalo INTEGER,
                FOREIGN KEY(id_posiedzenia) REFERENCES posiedzenia(id_posiedzenia)
            );
            CREATE INDEX IF NOT EXISTS idx_glosowania_posiedzenie ON glosowania(id_posiedzenia);
            CREATE INDEX IF NOT EXISTS idx_glosowania_data ON glosowania(data);
            
            -- 5. Głosy indywidualne
            CREATE TABLE IF NOT EXISTS glosy (
                id_glosu TEXT PRIMARY KEY,      -- hash: id_glosowania + id_osoby
                id_glosowania TEXT,
                id_osoby TEXT,
                glos TEXT,                      -- YES/NO/ABSTAIN/ABSENT/VOTE_VALID
                FOREIGN KEY(id_glosowania) REFERENCES glosowania(id_glosowania),
                FOREIGN KEY(id_osoby) REFERENCES poslowie(id_osoby)
            );
            CREATE INDEX IF NOT EXISTS idx_glosy_glosowanie ON glosy(id_glosowania);
            CREATE INDEX IF NOT EXISTS idx_glosy_osoba ON glosy(id_osoby);
            
            -- 6. Interpelacje
            CREATE TABLE IF NOT EXISTS interpelacje (
                id_interpelacji TEXT PRIMARY KEY,
                id_osoby TEXT,
                data TEXT,
                tytul TEXT,
                tresc TEXT,
                status TEXT,
                FOREIGN KEY(id_osoby) REFERENCES poslowie(id_osoby)
            );
            CREATE INDEX IF NOT EXISTS idx_interpelacje_osoba ON interpelacje(id_osoby);
            CREATE INDEX IF NOT EXISTS idx_interpelacje_data ON interpelacje(data);
            
            -- 7. Projekty ustaw
            CREATE TABLE IF NOT EXISTS projekty_ustaw (
                id_projektu TEXT PRIMARY KEY,
                kadencja INTEGER,
                data TEXT,
                tytul TEXT,
                status TEXT,
                opis TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_projekty_kadencja ON projekty_ustaw(kadencja);
            CREATE INDEX IF NOT EXISTS idx_projekty_status ON projekty_ustaw(status);
            
            -- 8. Komisje
            CREATE TABLE IF NOT EXISTS komisje (
                id_komisji TEXT PRIMARY KEY,
                nazwa TEXT,
                skrot TEXT,
                typ TEXT,
                kadencja INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_komisje_kadencja ON komisje(kadencja);
            
            -- 9. Posiedzenia komisji
            CREATE TABLE IF NOT EXISTS komisje_posiedzenia (
                id_posiedzenia_komisji TEXT PRIMARY KEY,
                id_komisji TEXT,
                numer INTEGER,
                data TEXT,
                opis TEXT,
                FOREIGN KEY(id_komisji) REFERENCES komisje(id_komisji)
            );
            CREATE INDEX IF NOT EXISTS idx_kom_posiedz_komisja ON komisje_posiedzenia(id_komisji);
            CREATE INDEX IF NOT EXISTS idx_kom_posiedz_data ON komisje_posiedzenia(data);
            
            -- 10. Wypowiedzi w komisjach
            CREATE TABLE IF NOT EXISTS komisje_wypowiedzi (
                id_wypowiedzi_komisji TEXT PRIMARY KEY,
                id_posiedzenia_komisji TEXT,
                id_osoby TEXT,
                tekst TEXT,
                data TEXT,
                typ TEXT,
                FOREIGN KEY(id_posiedzenia_komisji) REFERENCES komisje_posiedzenia(id_posiedzenia_komisji),
                FOREIGN KEY(id_osoby) REFERENCES poslowie(id_osoby)
            );
            CREATE INDEX IF NOT EXISTS idx_kom_wypow_posiedz ON komisje_wypowiedzi(id_posiedzenia_komisji);
            CREATE INDEX IF NOT EXISTS idx_kom_wypow_osoba ON komisje_wypowiedzi(id_osoby);
            
            -- 11. Oświadczenia majątkowe
            CREATE TABLE IF NOT EXISTS oswiadczenia_majatkowe (
                id_oswiadczenia TEXT PRIMARY KEY,
                id_osoby TEXT,
                rok INTEGER,
                tresc TEXT,
                data_zlozenia TEXT,
                FOREIGN KEY(id_osoby) REFERENCES poslowie(id_osoby)
            );
            CREATE INDEX IF NOT EXISTS idx_oswiadcz_osoba ON oswiadczenia_majatkowe(id_osoby);
            CREATE INDEX IF NOT EXISTS idx_oswiadcz_rok ON oswiadczenia_majatkowe(rok);
            
            -- 12. Zapytania pisemne
            CREATE TABLE IF NOT EXISTS zapytania (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                term INTEGER NOT NULL,
                num INTEGER NOT NULL,
                title TEXT,
                receiptDate TEXT,
                lastModified TEXT,
                sentDate TEXT,
                from_mp_ids TEXT,
                to_ministries TEXT,
                answerDelayedDays INTEGER DEFAULT 0,
                UNIQUE(term, num)
            );
            CREATE INDEX IF NOT EXISTS idx_zapytania_term ON zapytania(term);
            CREATE INDEX IF NOT EXISTS idx_zapytania_receiptDate ON zapytania(receiptDate);
            CREATE INDEX IF NOT EXISTS idx_zapytania_lastModified ON zapytania(lastModified);
            CREATE INDEX IF NOT EXISTS idx_zapytania_delayed ON zapytania(answerDelayedDays);
            
            -- 13. Odpowiedzi na zapytania pisemne
            CREATE TABLE IF NOT EXISTS zapytania_odpowiedzi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zapytanie_term INTEGER NOT NULL,
                zapytanie_num INTEGER NOT NULL,
                key TEXT NOT NULL,
                from_author TEXT,
                receiptDate TEXT,
                lastModified TEXT,
                onlyAttachment INTEGER DEFAULT 0,
                prolongation INTEGER DEFAULT 0,
                UNIQUE(zapytanie_term, zapytanie_num, key)
            );
            CREATE INDEX IF NOT EXISTS idx_zapytania_odpowiedzi_zapytanie ON zapytania_odpowiedzi(zapytanie_term, zapytanie_num);
            
            -- 14. Ustawy (akty prawne ELI)
            CREATE TABLE IF NOT EXISTS ustawy (
                id_ustawy TEXT PRIMARY KEY,
                publisher TEXT,
                year INTEGER,
                pos INTEGER,
                title TEXT,
                type TEXT,
                status TEXT,
                promulgation TEXT,
                entry_into_force TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_ustawy_year ON ustawy(year);
            CREATE INDEX IF NOT EXISTS idx_ustawy_type ON ustawy(type);
            CREATE INDEX IF NOT EXISTS idx_ustawy_status ON ustawy(status);

            -- 15. Metadata (cache, wersje, logi)
            CREATE TABLE IF NOT EXISTS metadata (
                klucz TEXT PRIMARY KEY,
                wartosc TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        this.database.run(schema);
        
        // Set initial metadata
        this.upsertMetadata('schema_version', '2.0');
        this.upsertMetadata('created_at', new Date().toISOString());
        
        console.log('[DB v2] Schema created - 13 tables + metadata + indexes');
    },
    
    migrateSchema() {
        try {
            // Sprawdź czy kolumna mowca istnieje w wypowiedzi
            const tableInfo = this.database.exec("PRAGMA table_info(wypowiedzi)");
            if (tableInfo.length) {
                const columns = tableInfo[0].values.map(row => row[1]);
                if (!columns.includes('mowca')) {
                    this.database.run("ALTER TABLE wypowiedzi ADD COLUMN mowca TEXT");
                    console.log('[DB v2] Migration: added mowca column to wypowiedzi');
                }
            }

            // ── Migracja id_posiedzenia INTEGER → TEXT (kadencja prefix) ──
            // Stare bazy miały id_posiedzenia INTEGER PRIMARY KEY w tabeli posiedzenia.
            // Nowy format: "kadencja_numer" (TEXT). SQLite nie pozwala na ALTER COLUMN,
            // więc trzeba odtworzyć tabelę.
            this._migratePosiedzeniaPK();

            // Dodaj brakujące tabele (dodane w późniejszych wersjach schematu)
            this.database.run(`
                CREATE TABLE IF NOT EXISTS zapytania_odpowiedzi (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    zapytanie_term INTEGER NOT NULL,
                    zapytanie_num INTEGER NOT NULL,
                    key TEXT NOT NULL,
                    from_author TEXT,
                    receiptDate TEXT,
                    lastModified TEXT,
                    onlyAttachment INTEGER DEFAULT 0,
                    prolongation INTEGER DEFAULT 0,
                    UNIQUE(zapytanie_term, zapytanie_num, key)
                );
                CREATE INDEX IF NOT EXISTS idx_zapytania_odpowiedzi_zapytanie ON zapytania_odpowiedzi(zapytanie_term, zapytanie_num);

                CREATE TABLE IF NOT EXISTS ustawy (
                    id_ustawy TEXT PRIMARY KEY,
                    publisher TEXT,
                    year INTEGER,
                    pos INTEGER,
                    title TEXT,
                    type TEXT,
                    status TEXT,
                    promulgation TEXT,
                    entry_into_force TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_ustawy_year ON ustawy(year);
                CREATE INDEX IF NOT EXISTS idx_ustawy_type ON ustawy(type);
                CREATE INDEX IF NOT EXISTS idx_ustawy_status ON ustawy(status);
            `);
            console.log('[DB v2] Migration: ensured ustawy + zapytania_odpowiedzi tables exist');

            // Resolve wypowiedzi.id_osoby from mowca text ↔ poslowie names
            this.resolveWypowiedziSpeakers();
        } catch (err) {
            console.warn('[DB v2] Migration error:', err);
        }
    },

    /**
     * Migracja tabeli posiedzenia: INTEGER PRIMARY KEY → TEXT PRIMARY KEY
     * Konwertuje stare ID (np. 5) na nowy format "kadencja_numer" (np. "10_5").
     * Aktualizuje też FK w wypowiedzi i glosowania.
     */
    _migratePosiedzeniaPK() {
        // Sprawdź aktualny typ kolumny id_posiedzenia
        const info = this.database.exec("PRAGMA table_info(posiedzenia)");
        if (!info.length) return; // tabela nie istnieje — createSchema ją stworzy

        // Kolumny: [cid, name, type, notnull, dflt_value, pk]
        const idCol = info[0].values.find(row => row[1] === 'id_posiedzenia');
        if (!idCol) return;

        const colType = (idCol[2] || '').toUpperCase();
        // Jeśli już TEXT — nie trzeba migrować
        if (colType === 'TEXT') return;

        console.log('[DB v2] Migration: posiedzenia.id_posiedzenia INTEGER → TEXT...');

        this.database.run('BEGIN TRANSACTION');
        try {
            // 1. Odtwórz tabelę z TEXT PRIMARY KEY
            this.database.run(`
                CREATE TABLE posiedzenia_new (
                    id_posiedzenia TEXT PRIMARY KEY,
                    numer INTEGER,
                    data_start TEXT,
                    data_koniec TEXT,
                    kadencja INTEGER,
                    typ TEXT
                )
            `);

            // 2. Kopiuj dane, konwertując ID: kadencja_staryId
            this.database.run(`
                INSERT INTO posiedzenia_new (id_posiedzenia, numer, data_start, data_koniec, kadencja, typ)
                SELECT CAST(COALESCE(kadencja, 10) AS TEXT) || '_' || CAST(id_posiedzenia AS TEXT),
                       numer, data_start, data_koniec, kadencja, typ
                FROM posiedzenia
            `);

            // 3. Zaktualizuj FK w wypowiedzi (id_posiedzenia)
            this.database.run(`
                UPDATE wypowiedzi
                SET id_posiedzenia = (
                    SELECT CAST(COALESCE(p.kadencja, 10) AS TEXT) || '_' || CAST(p.id_posiedzenia AS TEXT)
                    FROM posiedzenia p
                    WHERE CAST(p.id_posiedzenia AS TEXT) = CAST(wypowiedzi.id_posiedzenia AS TEXT)
                )
                WHERE EXISTS (
                    SELECT 1 FROM posiedzenia p
                    WHERE CAST(p.id_posiedzenia AS TEXT) = CAST(wypowiedzi.id_posiedzenia AS TEXT)
                )
            `);

            // 4. Zaktualizuj FK w glosowania (id_posiedzenia)
            this.database.run(`
                UPDATE glosowania
                SET id_posiedzenia = (
                    SELECT CAST(COALESCE(p.kadencja, 10) AS TEXT) || '_' || CAST(p.id_posiedzenia AS TEXT)
                    FROM posiedzenia p
                    WHERE CAST(p.id_posiedzenia AS TEXT) = CAST(glosowania.id_posiedzenia AS TEXT)
                )
                WHERE EXISTS (
                    SELECT 1 FROM posiedzenia p
                    WHERE CAST(p.id_posiedzenia AS TEXT) = CAST(glosowania.id_posiedzenia AS TEXT)
                )
            `);

            // 5. Zamień tabele
            this.database.run('DROP TABLE posiedzenia');
            this.database.run('ALTER TABLE posiedzenia_new RENAME TO posiedzenia');

            // 6. Odtwórz indeksy
            this.database.run('CREATE INDEX IF NOT EXISTS idx_posiedzenia_kadencja ON posiedzenia(kadencja)');
            this.database.run('CREATE INDEX IF NOT EXISTS idx_posiedzenia_data ON posiedzenia(data_start)');

            this.database.run('COMMIT');

            const countRes = this.database.exec('SELECT COUNT(*) FROM posiedzenia');
            const cnt = countRes.length ? countRes[0].values[0][0] : 0;
            console.log(`[DB v2] Migration: posiedzenia → TEXT PK complete (${cnt} rows migrated)`);
        } catch (e) {
            try { this.database.run('ROLLBACK'); } catch (_) {}
            console.error('[DB v2] Migration posiedzenia PK failed:', e);
            throw e;
        }
    },

    /**
     * Match wypowiedzi.mowca text to poslowie.id_osoby
     * by checking if both imie AND nazwisko appear in mowca string.
     * Runs on init (for cached data) and after each wypowiedzi save.
     */
    resolveWypowiedziSpeakers() {
        try {
            const updated = this.database.exec(`
                UPDATE wypowiedzi
                SET id_osoby = (
                    SELECT p.id_osoby
                    FROM poslowie p
                    WHERE wypowiedzi.mowca LIKE '%' || p.nazwisko || '%'
                      AND wypowiedzi.mowca LIKE '%' || p.imie || '%'
                    LIMIT 1
                )
                WHERE id_osoby IS NULL
                  AND mowca IS NOT NULL
                  AND mowca != ''
            `);
            const countResult = this.database.exec(
                "SELECT changes() as cnt"
            );
            const cnt = countResult.length ? countResult[0].values[0][0] : 0;
            if (cnt > 0) {
                console.log(`[DB v2] Resolved ${cnt} wypowiedzi speakers → id_osoby`);
            }
        } catch (err) {
            console.warn('[DB v2] resolveWypowiedziSpeakers error:', err);
        }
    },

    // ===== CHUNKED UPSERT HELPER =====

    async chunkedUpsert(sql, data, rowMapper, opts = {}) {
        const { chunkSize = 500, signal } = opts;
        if (!data?.length) return;
        const stmt = this.database.prepare(sql);
        for (let i = 0; i < data.length; i += chunkSize) {
            if (signal?.aborted) { stmt.free(); throw new DOMException('Aborted', 'AbortError'); }
            this.database.run('BEGIN TRANSACTION');
            try {
                const end = Math.min(i + chunkSize, data.length);
                for (let j = i; j < end; j++) stmt.run(rowMapper(data[j]));
                this.database.run('COMMIT');
            } catch (e) {
                try { this.database.run('ROLLBACK'); } catch (_) {}
                stmt.free();
                throw e;
            }
            await new Promise(r => setTimeout(r, 0));
        }
        stmt.free();
    },

    // ===== UPSERT METHODS =====

    async upsertPoslowie(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO poslowie (id_osoby, imie, nazwisko, klub, okreg, rola, kadencja, email, aktywny)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_osoby) DO UPDATE SET
                imie = excluded.imie, nazwisko = excluded.nazwisko,
                klub = excluded.klub, okreg = excluded.okreg,
                rola = excluded.rola, kadencja = excluded.kadencja,
                email = excluded.email, aktywny = excluded.aktywny
        `, data, row => [
            row.id_osoby, row.imie, row.nazwisko, row.klub,
            row.okreg, row.rola, row.kadencja, row.email, row.aktywny ?? 1
        ], opts);
    },

    async upsertPosiedzenia(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO posiedzenia (id_posiedzenia, numer, data_start, data_koniec, kadencja, typ)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_posiedzenia) DO UPDATE SET
                numer = excluded.numer, data_start = excluded.data_start,
                data_koniec = excluded.data_koniec, kadencja = excluded.kadencja,
                typ = excluded.typ
        `, data, row => [
            row.id_posiedzenia, row.numer, row.data_start,
            row.data_koniec, row.kadencja, row.typ
        ], opts);
    },

    async upsertWypowiedzi(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO wypowiedzi (id_wypowiedzi, id_posiedzenia, id_osoby, data, tekst, typ, mowca)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_wypowiedzi) DO UPDATE SET
                id_posiedzenia = excluded.id_posiedzenia, id_osoby = excluded.id_osoby,
                data = excluded.data, tekst = excluded.tekst,
                typ = excluded.typ, mowca = excluded.mowca
        `, data, row => [
            row.id_wypowiedzi, row.id_posiedzenia, row.id_osoby,
            row.data, row.tekst, row.typ, row.mowca || null
        ], opts);
    },
    
    // ... (pozostałe upsert metody podobnie)
    
    upsertMetadata(klucz, wartosc) {
        this.database.run(`
            INSERT INTO metadata (klucz, wartosc, timestamp)
            VALUES (?, ?, ?)
            ON CONFLICT(klucz) DO UPDATE SET
                wartosc = excluded.wartosc,
                timestamp = excluded.timestamp
        `, [klucz, wartosc, new Date().toISOString()]);
    },
    
    getMetadata(klucz) {
        try {
            const stmt = this.database.prepare('SELECT wartosc FROM metadata WHERE klucz = ?');
            stmt.bind([klucz]);
            let val = null;
            if (stmt.step()) val = stmt.get()[0];
            stmt.free();
            return val;
        } catch { return null; }
    },

    // ===== QUERY METHODS =====
    
    getPoslowie(filters = {}) {
        let sql = 'SELECT * FROM poslowie WHERE 1=1';
        const params = [];
        
        if (filters.kadencja) {
            sql += ' AND kadencja = ?';
            params.push(filters.kadencja);
        }
        
        if (filters.klub) {
            sql += ' AND klub = ?';
            params.push(filters.klub);
        }
        
        const stmt = this.database.prepare(sql);
        stmt.bind(params);
        
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        
        return results;
    },
    
    getWypowiedzi(filters = {}) {
        let sql = `
            SELECT w.*, p.imie, p.nazwisko, p.klub
            FROM wypowiedzi w
            LEFT JOIN poslowie p ON w.id_osoby = p.id_osoby
            WHERE 1=1
        `;
        const params = [];
        
        if (filters.id_posiedzenia) {
            sql += ' AND w.id_posiedzenia = ?';
            params.push(filters.id_posiedzenia);
        }
        
        if (filters.id_osoby) {
            sql += ' AND w.id_osoby = ?';
            params.push(filters.id_osoby);
        }
        
        sql += ' ORDER BY w.data DESC';
        
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }
        
        const stmt = this.database.prepare(sql);
        stmt.bind(params);
        
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        
        return results;
    },
    
    getStats() {
        const stats = {};
        
        const tables = [
            'poslowie', 'posiedzenia', 'wypowiedzi', 'glosowania', 'glosy',
            'interpelacje', 'projekty_ustaw', 'komisje', 'komisje_posiedzenia',
            'komisje_wypowiedzi', 'oswiadczenia_majatkowe', 'zapytania',
            'zapytania_odpowiedzi', 'ustawy'
        ];

        tables.forEach(table => {
            try {
                const result = this.database.exec(`SELECT COUNT(*) as count FROM ${table}`);
                stats[table] = result[0]?.values[0][0] || 0;
            } catch {
                stats[table] = 0;
            }
        });
        
        return stats;
    },
    
    clearAll() {
        const tables = [
            'poslowie', 'posiedzenia', 'wypowiedzi', 'glosowania', 'glosy',
            'interpelacje', 'projekty_ustaw', 'komisje', 'komisje_posiedzenia',
            'komisje_wypowiedzi', 'oswiadczenia_majatkowe', 'zapytania', 'zapytania_odpowiedzi', 'ustawy', 'metadata'
        ];
        
        tables.forEach(table => {
            this.database.run(`DELETE FROM ${table}`);
        });
        
        console.log('[DB v2] All data cleared');
        this.saveToLocalStorage(); // Auto-save after clear
    },
    
    saveToLocalStorage() {
        try {
            if (!this.database) {
                console.warn('[DB v2] Cannot save - database not initialized');
                return;
            }

            const data = this.database.export();
            
            // Koduj jako base64 (1.33x overhead zamiast 5x z JSON array)
            const chunkSize = 8192;
            let binaryStr = '';
            for (let i = 0; i < data.length; i += chunkSize) {
                binaryStr += String.fromCharCode.apply(null, data.subarray(i, i + chunkSize));
            }
            const base64 = btoa(binaryStr);

            const sizeMB = (base64.length / (1024 * 1024)).toFixed(2);

            // localStorage limit ~5MB — sprawdź przed zapisem
            if (base64.length > 4.5 * 1024 * 1024) {
                console.warn(`[DB v2] Database too large for localStorage (${sizeMB} MB). Data is available in memory but won't persist after refresh.`);
                this._persistFailed = true;
                return;
            }

            localStorage.setItem('nostradamnos_db', base64);
            this._persistFailed = false;

            console.log(`[DB v2] 💾 Auto-saved to localStorage (${sizeMB} MB, base64)`);
        } catch (err) {
            if (err.name === 'QuotaExceededError' || err.code === 22) {
                const data = this.database.export();
                const sizeMB = (data.length / (1024 * 1024)).toFixed(2);
                console.warn(`[DB v2] localStorage quota exceeded (${sizeMB} MB). Data is available in memory but won't persist after refresh.`);
                this._persistFailed = true;
            } else {
                console.error('[DB v2] Failed to save to localStorage:', err);
            }
        }
    },
    
    export() {
        return this.database.export();
    },
    
    import(data) {
        // Zamknij starą bazę przed importem (zapobiega wyciekowi pamięci WASM)
        if (this.database) {
            try { this.database.close(); } catch (e) { /* ignore */ }
        }
        this.database = new this.sql.Database(data);
        console.log('[DB v2] Database imported');
    },
    
    async upsertGlosowania(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO glosowania (id_glosowania, id_posiedzenia, numer, data, wynik, tytul, za, przeciw, wstrzymalo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_glosowania) DO UPDATE SET
                id_posiedzenia = excluded.id_posiedzenia, numer = excluded.numer,
                data = excluded.data, wynik = excluded.wynik, tytul = excluded.tytul,
                za = excluded.za, przeciw = excluded.przeciw, wstrzymalo = excluded.wstrzymalo
        `, data, row => [
            row.id_glosowania, row.id_posiedzenia, row.numer, row.data,
            row.wynik, row.tytul, row.za, row.przeciw, row.wstrzymalo
        ], opts);
    },

    async upsertGlosy(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO glosy (id_glosu, id_glosowania, id_osoby, glos)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id_glosu) DO UPDATE SET
                id_glosowania = excluded.id_glosowania,
                id_osoby = excluded.id_osoby, glos = excluded.glos
        `, data, row => [row.id_glosu, row.id_glosowania, row.id_osoby, row.glos], opts);
    },

    async upsertInterpelacje(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO interpelacje (id_interpelacji, id_osoby, data, tytul, tresc, status)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_interpelacji) DO UPDATE SET
                id_osoby = excluded.id_osoby, data = excluded.data,
                tytul = excluded.tytul, tresc = excluded.tresc, status = excluded.status
        `, data, row => [
            row.id_interpelacji, row.id_osoby, row.data, row.tytul, row.tresc, row.status
        ], opts);
    },

    async upsertProjektyUstaw(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO projekty_ustaw (id_projektu, kadencja, data, tytul, status, opis)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_projektu) DO UPDATE SET
                kadencja = excluded.kadencja, data = excluded.data,
                tytul = excluded.tytul, status = excluded.status, opis = excluded.opis
        `, data, row => [
            row.id_projektu, row.kadencja, row.data, row.tytul, row.status, row.opis
        ], opts);
    },

    async upsertKomisje(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO komisje (id_komisji, nazwa, skrot, typ, kadencja)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_komisji) DO UPDATE SET
                nazwa = excluded.nazwa, skrot = excluded.skrot,
                typ = excluded.typ, kadencja = excluded.kadencja
        `, data, row => [
            row.id_komisji, row.nazwa, row.skrot, row.typ, row.kadencja
        ], opts);
    },

    async upsertKomisjePosiedzenia(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO komisje_posiedzenia (id_posiedzenia_komisji, id_komisji, numer, data, opis)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_posiedzenia_komisji) DO UPDATE SET
                id_komisji = excluded.id_komisji, numer = excluded.numer,
                data = excluded.data, opis = excluded.opis
        `, data, row => [
            row.id_posiedzenia_komisji, row.id_komisji, row.numer, row.data, row.opis
        ], opts);
    },

    async upsertKomisjeWypowiedzi(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO komisje_wypowiedzi (id_wypowiedzi_komisji, id_posiedzenia_komisji, id_osoby, tekst, data, typ)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_wypowiedzi_komisji) DO UPDATE SET
                id_posiedzenia_komisji = excluded.id_posiedzenia_komisji,
                id_osoby = excluded.id_osoby, tekst = excluded.tekst,
                data = excluded.data, typ = excluded.typ
        `, data, row => [
            row.id_wypowiedzi_komisji, row.id_posiedzenia_komisji,
            row.id_osoby, row.tekst, row.data, row.typ
        ], opts);
    },

    async upsertOswiadczeniaMajatkowe(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO oswiadczenia_majatkowe (id_oswiadczenia, id_osoby, rok, tresc, data_zlozenia)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_oswiadczenia) DO UPDATE SET
                id_osoby = excluded.id_osoby, rok = excluded.rok,
                tresc = excluded.tresc, data_zlozenia = excluded.data_zlozenia
        `, data, row => [
            row.id_oswiadczenia, row.id_osoby, row.rok, row.tresc, row.data_zlozenia
        ], opts);
    },

    async upsertZapytania(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO zapytania (term, num, title, receiptDate, lastModified, sentDate, from_mp_ids, to_ministries, answerDelayedDays)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(term, num) DO UPDATE SET
                title = excluded.title, lastModified = excluded.lastModified,
                sentDate = excluded.sentDate, from_mp_ids = excluded.from_mp_ids,
                to_ministries = excluded.to_ministries, answerDelayedDays = excluded.answerDelayedDays
        `, data, row => [
            row.term, row.num, row.title, row.receiptDate, row.lastModified,
            row.sentDate, row.from_mp_ids, row.to_ministries, row.answerDelayedDays
        ], opts);
    },

    async upsertZapytaniaOdpowiedzi(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO zapytania_odpowiedzi (zapytanie_term, zapytanie_num, key, from_author, receiptDate, lastModified, onlyAttachment, prolongation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(zapytanie_term, zapytanie_num, key) DO UPDATE SET
                from_author = excluded.from_author, lastModified = excluded.lastModified,
                onlyAttachment = excluded.onlyAttachment, prolongation = excluded.prolongation
        `, data, row => [
            row.zapytanie_term, row.zapytanie_num, row.key, row.from_author,
            row.receiptDate, row.lastModified, row.onlyAttachment, row.prolongation
        ], opts);
    },

    async upsertUstawy(data, opts = {}) {
        await this.chunkedUpsert(`
            INSERT INTO ustawy (id_ustawy, publisher, year, pos, title, type, status, promulgation, entry_into_force)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_ustawy) DO UPDATE SET
                title = excluded.title, type = excluded.type,
                status = excluded.status, promulgation = excluded.promulgation,
                entry_into_force = excluded.entry_into_force
        `, data, row => [
            row.id_ustawy, row.publisher, row.year, row.pos,
            row.title, row.type, row.status, row.promulgation, row.entry_into_force
        ], opts);
    }
};
