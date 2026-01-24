// modules/normalizer.js
// Normalizacja danych z API do struktury gotowej na SQLite

export class DataNormalizer {
    constructor() {
        this.deputiesMap = new Map(); // ID → dane posła
        this.stats = {
            normalized: 0,
            unmatched: 0,
            errors: []
        };
    }

    // Załaduj mapę posłów (ID → dane)
    loadDeputies(deputies) {
        this.deputiesMap.clear();
        deputies.forEach(dep => {
            const fullName = `${dep.firstName} ${dep.lastName}`.trim();
            this.deputiesMap.set(dep.id, {
                id: dep.id,
                firstName: dep.firstName,
                lastName: dep.lastName,
                fullName,
                club: dep.club,
                active: dep.active
            });
        });
        console.log(`✅ Załadowano ${this.deputiesMap.size} posłów do normalizacji`);
    }

    // Wyciągnij dane mówcy z surowego tekstu
    parseSpeaker(speakerRaw) {
        if (!speakerRaw) return null;
        
        const text = speakerRaw.trim();
        
        // Wzorce:
        // "Poseł Jan Kowalski"
        // "Marszałek Senior Poseł Jan Kowalski"
        // "Sekretarz Poseł Jan Kowalski"
        // "Wicemarszałek Poseł Jan Kowalski"
        
        let role = null;
        let position = null;
        let name = text;
        
        // Wyciągnij pozycję (Marszałek, Sekretarz, etc)
        const positionMatch = text.match(/^(Marszałek|Wicemarszałek|Sekretarz|Marszałek Senior)\s+/);
        if (positionMatch) {
            position = positionMatch[1];
            name = text.replace(positionMatch[0], '');
        }
        
        // Wyciągnij rolę (Poseł, Senator)
        const roleMatch = name.match(/^(Poseł|Senator|Pose[łl]|Wiceminister|Minister|Prezes|Rzecznik)\s+/i);
        if (roleMatch) {
            role = roleMatch[1].toLowerCase().replace('pose', 'poseł');
            name = name.replace(roleMatch[0], '');
        }
        
        // Wyczyść nazwisko
        name = name.replace(/:\s*$/, '').trim();
        
        return { role, position, name };
    }

    // Znajdź ID posła po nazwisku
    findDeputyID(name) {
        if (!name) return null;
        
        // Normalizuj nazwisko (bez diakrytyków, lowercase)
        const normalized = name.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        
        // Szukaj dokładnego dopasowania
        for (const [id, deputy] of this.deputiesMap) {
            const deputyNormalized = deputy.fullName.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            
            if (deputyNormalized === normalized) {
                return id;
            }
            
            // Sprawdź samo nazwisko
            const lastNameNorm = deputy.lastName.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            
            if (normalized.includes(lastNameNorm) || lastNameNorm.includes(normalized)) {
                return id;
            }
        }
        
        return null;
    }

    // Normalizuj pojedynczą wypowiedź
    normalizeStatement(statement, deputies) {
        const parsed = this.parseSpeaker(statement.speakerRaw);
        
        const deputyID = parsed ? this.findDeputyID(parsed.name) : null;
        const deputy = deputyID ? this.deputiesMap.get(deputyID) : null;
        
        if (!deputyID) {
            this.stats.unmatched++;
        } else {
            this.stats.normalized++;
        }
        
        return {
            // ID unikalne
            id: `${statement.institution}_${statement.sitting}_${statement.date}_${statement.transcriptNum}`,
            
            // Dane podstawowe
            institution: statement.institution,
            sitting: statement.sitting,
            date: statement.date,
            transcriptNum: statement.transcriptNum,
            
            // Znormalizowane dane mówcy
            speakerID: deputyID,
            speakerName: deputy ? deputy.fullName : (parsed ? parsed.name : statement.speakerRaw),
            speakerRole: parsed ? parsed.role : null,
            speakerPosition: parsed ? parsed.position : null,
            speakerClub: deputy ? deputy.club : null,
            
            // Tekst
            text: statement.text,
            textLength: statement.text.length,
            wordCount: statement.text.split(/\s+/).length,
            
            // Metadane
            speakerRaw: statement.speakerRaw,
            matched: !!deputyID
        };
    }

    // Normalizuj wszystkie wypowiedzi
    normalizeAll(statements) {
        this.stats = { normalized: 0, unmatched: 0, errors: [] };
        
        const normalized = statements.map(stmt => {
            try {
                return this.normalizeStatement(stmt);
            } catch (error) {
                this.stats.errors.push({ statement: stmt, error: error.message });
                return null;
            }
        }).filter(Boolean);
        
        console.log(`
📊 Normalizacja zakończona:
   ✅ Dopasowano: ${this.stats.normalized}
   ⚠️  Niedopasowane: ${this.stats.unmatched}
   ❌ Błędy: ${this.stats.errors.length}
        `);
        
        return normalized;
    }

    // Resetuj statystyki
    reset() {
        this.stats = { normalized: 0, unmatched: 0, errors: [] };
    }
}

export const normalizer = new DataNormalizer();
