// modules/database.js
// SQLite w przeglądarce (sql.js)

export class Database {
    constructor() {
        this.db = null;
        this.SQL = null;
        this.ready = false;
    }

    // Załaduj sql.js z CDN
    async init() {
        if (this.ready) return;
        
        console.log('📦 Ładowanie sql.js...');
        
        // Sprawdź czy sql.js jest załadowany
        if (!window.initSqlJs) {
            throw new Error('sql.js nie został załadowany. Dodaj <script> w HTML.');
        }
        
        this.SQL = await window.initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });
        
        // Utwórz nową bazę (w pamięci)
        this.db = new this.SQL.Database();
        
        console.log('✅ sql.js załadowany');
        
        // Utwórz schema automatycznie
        this.createSchema();
        
        this.ready = true;
    }

    // Utwórz schema
    createSchema() {
        console.log('🏗️  Tworzenie schema...');
        
        // Tabela posłów
        this.db.run(`
            CREATE TABLE IF NOT EXISTS deputies (
                id INTEGER PRIMARY KEY,
                firstName TEXT,
                lastName TEXT,
                fullName TEXT,
                club TEXT,
                active BOOLEAN
            )
        `);
        
        // Tabela wypowiedzi
        this.db.run(`
            CREATE TABLE IF NOT EXISTS statements (
                id TEXT PRIMARY KEY,
                institution TEXT,
                sitting INTEGER,
                date TEXT,
                transcriptNum INTEGER,
                
                speakerID INTEGER,
                speakerName TEXT,
                speakerRole TEXT,
                speakerPosition TEXT,
                speakerClub TEXT,
                
                text TEXT,
                textLength INTEGER,
                wordCount INTEGER,
                
                matched BOOLEAN,
                speakerRaw TEXT,
                
                FOREIGN KEY (speakerID) REFERENCES deputies(id)
            )
        `);
        
        // Indeksy
        this.db.run('CREATE INDEX IF NOT EXISTS idx_speaker ON statements(speakerID)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_date ON statements(date)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_club ON statements(speakerClub)');
        
        console.log('✅ Schema utworzone');
    }

    // Wstaw posłów (batch)
    insertDeputies(deputies) {
        console.log(`💾 Zapisywanie ${deputies.length} posłów...`);
        
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO deputies (id, firstName, lastName, fullName, club, active)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        let inserted = 0;
        for (const dep of deputies) {
            stmt.run([
                dep.id,
                dep.firstName,
                dep.lastName || dep.secondName,
                `${dep.firstName} ${dep.lastName || dep.secondName}`.trim(),
                dep.club,
                dep.active ? 1 : 0
            ]);
            inserted++;
        }
        
        stmt.free();
        console.log(`✅ Zapisano ${inserted} posłów`);
    }

    // Wstaw wypowiedzi (batch)
    insertStatements(statements) {
        console.log(`💾 Zapisywanie ${statements.length} wypowiedzi...`);
        
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO statements (
                id, institution, sitting, date, transcriptNum,
                speakerID, speakerName, speakerRole, speakerPosition, speakerClub,
                text, textLength, wordCount, matched, speakerRaw
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let inserted = 0;
        for (const s of statements) {
            stmt.run([
                s.id, s.institution, s.sitting, s.date, s.transcriptNum,
                s.speakerID, s.speakerName, s.speakerRole, s.speakerPosition, s.speakerClub,
                s.text, s.textLength, s.wordCount, s.matched ? 1 : 0, s.speakerRaw
            ]);
            inserted++;
        }
        
        stmt.free();
        console.log(`✅ Zapisano ${inserted} wypowiedzi`);
    }

    // Zapytanie SQL
    query(sql, params = []) {
        const results = [];
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        
        stmt.free();
        return results;
    }

    // Statystyki
    getStats() {
        return {
            deputies: this.query('SELECT COUNT(*) as count FROM deputies')[0].count,
            statements: this.query('SELECT COUNT(*) as count FROM statements')[0].count,
            matched: this.query('SELECT COUNT(*) as count FROM statements WHERE matched = 1')[0].count,
            clubs: this.query('SELECT DISTINCT speakerClub FROM statements WHERE speakerClub IS NOT NULL').map(r => r.speakerClub)
        };
    }

    // Eksport bazy do pliku
    export() {
        const data = this.db.export();
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        return URL.createObjectURL(blob);
    }

    // Import bazy z pliku
    async import(arrayBuffer) {
        this.db = new this.SQL.Database(new Uint8Array(arrayBuffer));
        console.log('✅ Baza zaimportowana');
    }

    // Wyczyść bazę
    clear() {
        this.db.run('DELETE FROM statements');
        this.db.run('DELETE FROM deputies');
        console.log('🗑️  Baza wyczyszczona');
    }
}

export const db = new Database();
