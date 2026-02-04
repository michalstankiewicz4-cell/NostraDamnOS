// Database v2.0 - Complete Schema for all 12 data types
// Nowa architektura: 12 tabel + metadata

export const db2 = {
    sql: null,
    database: null,
    
    async init() {
        console.log('[DB v2] Initializing...');
        
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
                const uint8Array = new Uint8Array(JSON.parse(savedDb));
                this.database = new this.sql.Database(uint8Array);
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
                id_posiedzenia INTEGER PRIMARY KEY,
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
                id_posiedzenia INTEGER,
                id_osoby TEXT,
                data TEXT,
                tekst TEXT,
                typ TEXT,           -- wystąpienie, pytanie, etc.
                FOREIGN KEY(id_posiedzenia) REFERENCES posiedzenia(id_posiedzenia),
                FOREIGN KEY(id_osoby) REFERENCES poslowie(id_osoby)
            );
            CREATE INDEX IF NOT EXISTS idx_wypowiedzi_posiedzenie ON wypowiedzi(id_posiedzenia);
            CREATE INDEX IF NOT EXISTS idx_wypowiedzi_osoba ON wypowiedzi(id_osoby);
            CREATE INDEX IF NOT EXISTS idx_wypowiedzi_data ON wypowiedzi(data);
            
            -- 4. Głosowania
            CREATE TABLE IF NOT EXISTS glosowania (
                id_glosowania TEXT PRIMARY KEY,
                id_posiedzenia INTEGER,
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
                glos TEXT,                      -- za/przeciw/wstrzymał/nieobecny
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
            
            -- 14. Metadata (cache, wersje, logi)
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
    
    // ===== UPSERT METHODS =====
    
    upsertPoslowie(data) {
        const stmt = this.database.prepare(`
            INSERT INTO poslowie (id_osoby, imie, nazwisko, klub, okreg, rola, kadencja, email, aktywny)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_osoby) DO UPDATE SET
                imie = excluded.imie,
                nazwisko = excluded.nazwisko,
                klub = excluded.klub,
                okreg = excluded.okreg,
                rola = excluded.rola,
                kadencja = excluded.kadencja,
                email = excluded.email,
                aktywny = excluded.aktywny
        `);
        
        data.forEach(row => {
            stmt.run([
                row.id_osoby,
                row.imie,
                row.nazwisko,
                row.klub,
                row.okreg,
                row.rola,
                row.kadencja,
                row.email,
                row.aktywny ?? 1
            ]);
        });
        
        stmt.free();
    },
    
    upsertPosiedzenia(data) {
        const stmt = this.database.prepare(`
            INSERT INTO posiedzenia (id_posiedzenia, numer, data_start, data_koniec, kadencja, typ)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_posiedzenie) DO UPDATE SET
                numer = excluded.numer,
                data_start = excluded.data_start,
                data_koniec = excluded.data_koniec,
                kadencja = excluded.kadencja,
                typ = excluded.typ
        `);
        
        data.forEach(row => {
            stmt.run([
                row.id_posiedzenia,
                row.numer,
                row.data_start,
                row.data_koniec,
                row.kadencja,
                row.typ
            ]);
        });
        
        stmt.free();
    },
    
    upsertWypowiedzi(data) {
        const stmt = this.database.prepare(`
            INSERT INTO wypowiedzi (id_wypowiedzi, id_posiedzenia, id_osoby, data, tekst, typ)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_wypowiedzi) DO UPDATE SET
                id_posiedzenia = excluded.id_posiedzenia,
                id_osoby = excluded.id_osoby,
                data = excluded.data,
                tekst = excluded.tekst,
                typ = excluded.typ
        `);
        
        data.forEach(row => {
            stmt.run([
                row.id_wypowiedzi,
                row.id_posiedzenia,
                row.id_osoby,
                row.data,
                row.tekst,
                row.typ
            ]);
        });
        
        stmt.free();
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
            'komisje_wypowiedzi', 'oswiadczenia_majatkowe', 'zapytania'
        ];
        
        tables.forEach(table => {
            const result = this.database.exec(`SELECT COUNT(*) as count FROM ${table}`);
            stats[table] = result[0]?.values[0][0] || 0;
        });
        
        return stats;
    },
    
    clearAll() {
        const tables = [
            'poslowie', 'posiedzenia', 'wypowiedzi', 'glosowania', 'glosy',
            'interpelacje', 'projekty_ustaw', 'komisje', 'komisje_posiedzenia',
            'komisje_wypowiedzi', 'oswiadczenia_majatkowe', 'zapytania', 'zapytania_odpowiedzi', 'metadata'
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
            const dataArray = Array.from(data);
            localStorage.setItem('nostradamnos_db', JSON.stringify(dataArray));
            
            const sizeKB = (data.length / 1024).toFixed(2);
            console.log(`[DB v2] 💾 Auto-saved to localStorage (${sizeKB} KB)`);
        } catch (err) {
            console.error('[DB v2] Failed to save to localStorage:', err);
        }
    },
    
    export() {
        return this.database.export();
    },
    
    import(data) {
        this.database = new this.sql.Database(data);
        console.log('[DB v2] Database imported');
    },
    
    upsertGlosowania(data) {
        const stmt = this.database.prepare(`
            INSERT INTO glosowania (id_glosowania, id_posiedzenia, numer, data, wynik, tytul, za, przeciw, wstrzymalo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_glosowania) DO UPDATE SET
                id_posiedzenia = excluded.id_posiedzenia,
                numer = excluded.numer,
                data = excluded.data,
                wynik = excluded.wynik,
                tytul = excluded.tytul,
                za = excluded.za,
                przeciw = excluded.przeciw,
                wstrzymalo = excluded.wstrzymalo
        `);
        
        data.forEach(row => {
            stmt.run([
                row.id_glosowania, row.id_posiedzenia, row.numer, row.data,
                row.wynik, row.tytul, row.za, row.przeciw, row.wstrzymalo
            ]);
        });
        
        stmt.free();
    },
    
    upsertGlosy(data) {
        const stmt = this.database.prepare(`
            INSERT INTO glosy (id_glosu, id_glosowania, id_osoby, glos)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id_glosu) DO UPDATE SET
                id_glosowania = excluded.id_glosowania,
                id_osoby = excluded.id_osoby,
                glos = excluded.glos
        `);
        
        data.forEach(row => {
            stmt.run([row.id_glosu, row.id_glosowania, row.id_osoby, row.glos]);
        });
        
        stmt.free();
    },
    
    upsertInterpelacje(data) {
        const stmt = this.database.prepare(`
            INSERT INTO interpelacje (id_interpelacji, id_osoby, data, tytul, tresc, status)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_interpelacji) DO UPDATE SET
                id_osoby = excluded.id_osoby,
                data = excluded.data,
                tytul = excluded.tytul,
                tresc = excluded.tresc,
                status = excluded.status
        `);
        
        data.forEach(row => {
            stmt.run([row.id_interpelacji, row.id_osoby, row.data, row.tytul, row.tresc, row.status]);
        });
        
        stmt.free();
    },
    
    upsertProjektyUstaw(data) {
        const stmt = this.database.prepare(`
            INSERT INTO projekty_ustaw (id_projektu, kadencja, data, tytul, status, opis)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_projektu) DO UPDATE SET
                kadencja = excluded.kadencja,
                data = excluded.data,
                tytul = excluded.tytul,
                status = excluded.status,
                opis = excluded.opis
        `);
        
        data.forEach(row => {
            stmt.run([row.id_projektu, row.kadencja, row.data, row.tytul, row.status, row.opis]);
        });
        
        stmt.free();
    },
    
    upsertKomisje(data) {
        const stmt = this.database.prepare(`
            INSERT INTO komisje (id_komisji, nazwa, skrot, typ, kadencja)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_komisji) DO UPDATE SET
                nazwa = excluded.nazwa,
                skrot = excluded.skrot,
                typ = excluded.typ,
                kadencja = excluded.kadencja
        `);
        
        data.forEach(row => {
            stmt.run([row.id_komisji, row.nazwa, row.skrot, row.typ, row.kadencja]);
        });
        
        stmt.free();
    },
    
    upsertKomisjePosiedzenia(data) {
        const stmt = this.database.prepare(`
            INSERT INTO komisje_posiedzenia (id_posiedzenia_komisji, id_komisji, numer, data, opis)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_posiedzenia_komisji) DO UPDATE SET
                id_komisji = excluded.id_komisji,
                numer = excluded.numer,
                data = excluded.data,
                opis = excluded.opis
        `);
        
        data.forEach(row => {
            stmt.run([row.id_posiedzenia_komisji, row.id_komisji, row.numer, row.data, row.opis]);
        });
        
        stmt.free();
    },
    
    upsertKomisjeWypowiedzi(data) {
        const stmt = this.database.prepare(`
            INSERT INTO komisje_wypowiedzi (id_wypowiedzi_komisji, id_posiedzenia_komisji, id_osoby, tekst, data, typ)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_wypowiedzi_komisji) DO UPDATE SET
                id_posiedzenia_komisji = excluded.id_posiedzenia_komisji,
                id_osoby = excluded.id_osoby,
                tekst = excluded.tekst,
                data = excluded.data,
                typ = excluded.typ
        `);
        
        data.forEach(row => {
            stmt.run([
                row.id_wypowiedzi_komisji, row.id_posiedzenia_komisji,
                row.id_osoby, row.tekst, row.data, row.typ
            ]);
        });
        
        stmt.free();
    },
    
    upsertOswiadczeniaMajatkowe(data) {
        const stmt = this.database.prepare(`
            INSERT INTO oswiadczenia_majatkowe (id_oswiadczenia, id_osoby, rok, tresc, data_zlozenia)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_oswiadczenia) DO UPDATE SET
                id_osoby = excluded.id_osoby,
                rok = excluded.rok,
                tresc = excluded.tresc,
                data_zlozenia = excluded.data_zlozenia
        `);
        
        data.forEach(row => {
            stmt.run([row.id_oswiadczenia, row.id_osoby, row.rok, row.tresc, row.data_zlozenia]);
        });
        
        stmt.free();
    },
    
    upsertZapytania(data) {
        const stmt = this.database.prepare(`
            INSERT INTO zapytania (term, num, title, receiptDate, lastModified, sentDate, from_mp_ids, to_ministries, answerDelayedDays)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(term, num) DO UPDATE SET
                title = excluded.title,
                lastModified = excluded.lastModified,
                sentDate = excluded.sentDate,
                from_mp_ids = excluded.from_mp_ids,
                to_ministries = excluded.to_ministries,
                answerDelayedDays = excluded.answerDelayedDays
        `);
        
        data.forEach(row => {
            stmt.run([
                row.term, row.num, row.title, row.receiptDate, row.lastModified,
                row.sentDate, row.from_mp_ids, row.to_ministries, row.answerDelayedDays
            ]);
        });
        
        stmt.free();
    },
    
    upsertZapytaniaOdpowiedzi(data) {
        const stmt = this.database.prepare(`
            INSERT INTO zapytania_odpowiedzi (zapytanie_term, zapytanie_num, key, from_author, receiptDate, lastModified, onlyAttachment, prolongation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(zapytanie_term, zapytanie_num, key) DO UPDATE SET
                from_author = excluded.from_author,
                lastModified = excluded.lastModified,
                onlyAttachment = excluded.onlyAttachment,
                prolongation = excluded.prolongation
        `);
        
        data.forEach(row => {
            stmt.run([
                row.zapytanie_term, row.zapytanie_num, row.key, row.from_author,
                row.receiptDate, row.lastModified, row.onlyAttachment, row.prolongation
            ]);
        });
        
        stmt.free();
    }
};
