// Moduł do automatycznego ładowania danych z JSONL
// Działa zarówno lokalnie jak i na GitHub Pages

export class DataLoader {
    constructor(baseUrl = './data') {
        this.baseUrl = baseUrl;
        this.manifest = null;
        this.data = {};
    }

    /**
     * Wczytuje manifest z listą dostępnych plików
     */
    async loadManifest() {
        try {
            const response = await fetch(`${this.baseUrl}/manifest.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.manifest = await response.json();
            console.log('✅ Manifest loaded:', this.manifest);
            return this.manifest;
        } catch (error) {
            console.error('❌ Failed to load manifest:', error);
            throw error;
        }
    }

    /**
     * Parsuje plik JSONL na array obiektów
     */
    parseJSONL(text) {
        return text
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
    }

    /**
     * Wczytuje pojedynczy plik JSONL
     */
    async loadFile(filename) {
        try {
            console.log(`📥 Loading ${filename}...`);
            
            // Sprawdź czy manifest maścieżkę
            let filepath = filename;
            if (this.manifest && this.manifest.files) {
                const fileInfo = this.manifest.files.find(f => f.name === filename);
                if (fileInfo && fileInfo.path) {
                    filepath = fileInfo.path;
                    console.log(`  → Using path from manifest: ${filepath}`);
                }
            }
            
            const response = await fetch(`${this.baseUrl}/${filepath}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            const data = this.parseJSONL(text);
            
            console.log(`✅ Loaded ${filename}: ${data.length} records`);
            return data;
        } catch (error) {
            console.error(`❌ Failed to load ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Wczytuje wszystkie pliki z manifestu
     */
    async loadAll(onProgress = null) {
        if (!this.manifest) {
            await this.loadManifest();
        }

        const files = this.manifest.files;
        const total = files.length;
        let loaded = 0;

        for (const file of files) {
            try {
                this.data[file.type] = await this.loadFile(file.name);
                loaded++;
                
                if (onProgress) {
                    onProgress({
                        current: loaded,
                        total: total,
                        file: file.name,
                        type: file.type,
                        progress: (loaded / total) * 100
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Skipping ${file.name}:`, error.message);
            }
        }

        console.log('✅ All data loaded:', Object.keys(this.data));
        return this.data;
    }

    /**
     * Zwraca załadowane dane
     */
    getData() {
        return this.data;
    }

    /**
     * Zwraca konkretny typ danych
     */
    get(type) {
        return this.data[type] || null;
    }

    /**
     * Sprawdza czy dane są załadowane
     */
    isLoaded(type = null) {
        if (type) {
            return !!this.data[type];
        }
        return Object.keys(this.data).length > 0;
    }

    /**
     * Znajduje posła po ID
     */
    findPoseł(id) {
        if (!this.data.poslowie) return null;
        return this.data.poslowie.find(p => p.id === id);
    }

    /**
     * Znajduje wypowiedzi posła
     */
    findWypowiedzi(memberID) {
        if (!this.data.wypowiedzi) return [];
        return this.data.wypowiedzi.filter(w => w.memberID === memberID);
    }

    /**
     * Znajduje głosy posła
     */
    findGłosy(mp) {
        if (!this.data.glosy) return [];
        return this.data.glosy.filter(g => g.MP === mp);
    }

    /**
     * Statystyki danych
     */
    getStats() {
        const stats = {};
        for (const [type, data] of Object.entries(this.data)) {
            stats[type] = {
                count: data.length,
                loaded: true
            };
        }
        return stats;
    }
}

// Eksportuj singleton dla łatwego użycia
export const dataLoader = new DataLoader();
