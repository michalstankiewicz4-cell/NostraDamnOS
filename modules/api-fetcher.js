// modules/api-fetcher.js
// Pobieranie danych z API Sejmu z polskimi znakami

export class APIFetcher {
    constructor() {
        this.baseURL = 'https://api.sejm.gov.pl';
        this.delay = 100; // Szybsze pobieranie (batching)
        this.maxRetries = 3;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Fetch z wymuszonym UTF-8 + timeout + rate limiting
    async fetchWithRetry(url, retries = this.maxRetries, returnHTML = false, timeoutMs = 30000) {
        for (let i = 0; i < retries; i++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        // 404 jest normalny (koniec dnia) - nie logujemy
                        return null;
                    } // Normalny brak danych
                    
                    if (response.status === 429) {
                        console.warn(`⚠️ Rate limit (429) - czekam 5s...`);
                        await this.sleep(5000);
                        continue; // Retry bez liczenia
                    }
                    
                    if (response.status >= 500) {
                        throw new Error(`Serwer niedostępny (${response.status})`);
                    }
                    
                    throw new Error(`HTTP ${response.status}`);
                }
                
                if (returnHTML) {
                    const buffer = await response.arrayBuffer();
                    const decoder = new TextDecoder('utf-8');
                    return decoder.decode(buffer);
                }
                
                return await response.json();
                
            } catch (error) {
                clearTimeout(timeoutId);
                
                // Friendly error messages
                if (error.name === 'AbortError') {
                    if (i === retries - 1) {
                        throw new Error(`Przekroczono czas oczekiwania (${timeoutMs/1000}s)`);
                    }
                    console.warn(`⏱️ Timeout - próba ${i+1}/${retries}`);
                } else if (error.message.includes('Failed to fetch')) {
                    throw new Error('Brak połączenia z internetem lub problem CORS');
                } else {
                    if (i === retries - 1) throw error;
                    console.warn(`⚠️ ${error.message} - próba ${i+1}/${retries}`);
                }
                
                await this.sleep(this.delay * 2);
            }
        }
    }


    async fetchDeputies(term = 10) {
        return await this.fetchWithRetry(`${this.baseURL}/sejm/term${term}/MP`) || [];
    }

    async fetchProceedings(term = 10) {
        return await this.fetchWithRetry(`${this.baseURL}/sejm/term${term}/proceedings`) || [];
    }

    // Pobierz stenogramy dla posiedzenia
    async fetchTranscripts(institution, term, sitting, date) {
        const statements = [];
        let notFound = 0;
        
        // Szybkie probe co 10 żeby znaleźć koniec
        let maxNum = 10;
        for (let probe = 10; probe < 300; probe += 10) {
            const url = `${this.baseURL}/${institution}/term${term}/proceedings/${sitting}/${date}/transcripts/${probe}`;
            const html = await this.fetchWithRetry(url, 1, true);
            if (!html) break;
            maxNum = probe + 10;
        }
        
        // Pobierz wszystkie równolegle (batches po 5)
        const nums = Array.from({ length: maxNum }, (_, i) => i + 1);
        const batchSize = 5;
        
        for (let i = 0; i < nums.length; i += batchSize) {
            const batch = nums.slice(i, i + batchSize);
            
            const results = await Promise.all(batch.map(async num => {
                const url = `${this.baseURL}/${institution}/term${term}/proceedings/${sitting}/${date}/transcripts/${num}`;
                const html = await this.fetchWithRetry(url, this.maxRetries, true);
                if (!html) return null;
                return this.parseTranscriptHTML(html, sitting, date, num);
            }));
            
            const valid = results.filter(r => r !== null).flat();
            statements.push(...valid);
            
            if (valid.length === 0 && i > 20) break;
            await this.sleep(100);
        }
        
        return statements;
    }
    
    // Alias dla kompatybilności
    async fetchStatements(term, sitting) {
        // Pobierz info o posiedzeniu żeby dostać daty
        const proceedings = await this.fetchProceedings(term);
        const proc = proceedings.find(p => p.number === sitting);
        if (!proc || !proc.dates || proc.dates.length === 0) {
            return [];
        }
        
        const allStatements = [];
        for (const date of proc.dates) {
            const statements = await this.fetchTranscripts('sejm', term, sitting, date);
            allStatements.push(...statements);
        }
        return allStatements;
    }

    parseTranscriptHTML(html, sitting, date, transcriptNum) {
        const statements = [];
        if (!html) return statements;
        
        const parts = html.split(/<h2 class="mowca">/);
        for (let i = 1; i < parts.length; i++) {
            const speakerMatch = parts[i].match(/^(.*?):<\/h2>/);
            if (!speakerMatch) continue;
            
            const textMatch = parts[i].match(/<\/h2>([\s\S]*?)$/);
            if (!textMatch) continue;
            
            const text = textMatch[1].trim().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            
            if (text && text.length > 10) {
                statements.push({
                    institution: 'sejm',
                    sitting,
                    date,
                    transcriptNum,
                    speakerRaw: speakerMatch[1].trim(),
                    text
                });
            }
        }
        return statements;
    }

    // Pobierz wszystkie stenogramy dla N posiedzeń
    async fetchAllTranscripts(term, maxProceedings, onProgress) {
        const proceedings = await this.fetchProceedings(term);
        const today = new Date().toISOString().split('T')[0];
        
        // Tylko zakończone
        const completed = proceedings.filter(p => 
            p.number > 0 && 
            p.dates && 
            p.dates.length > 0 && 
            p.dates[p.dates.length - 1] <= today
        );
        
        const sorted = completed.sort((a, b) => b.number - a.number);
        const limited = sorted.slice(0, maxProceedings);
        
        const allStatements = [];
        
        for (const proc of limited) {
            for (const date of proc.dates) {
                if (onProgress) {
                    onProgress({ type: 'proceeding', sitting: proc.number, date });
                }
                
                const statements = await this.fetchTranscripts('sejm', term, proc.number, date);
                allStatements.push(...statements);
            }
        }
        
        return allStatements;
    }

    // Pobierz głosowania
    async fetchVotings(term, sitting) {
        return await this.fetchWithRetry(`${this.baseURL}/sejm/term${term}/votings/${sitting}`) || [];
    }

    async fetchAllVotings(term, maxProceedings) {
        const proceedings = await this.fetchProceedings(term);
        const today = new Date().toISOString().split('T')[0];
        
        const completed = proceedings.filter(p => 
            p.number > 0 && 
            p.dates && 
            p.dates[p.dates.length - 1] <= today
        );
        
        const sorted = completed.sort((a, b) => b.number - a.number);
        const limited = sorted.slice(0, maxProceedings);
        
        const allVotings = [];
        
        for (const proc of limited) {
            const votings = await this.fetchVotings(term, proc.number);
            allVotings.push(...votings.map(v => ({ ...v, sitting: proc.number })));
            await this.sleep(this.delay);
        }
        
        return allVotings;
    }
}

export const apiFetcher = new APIFetcher();
