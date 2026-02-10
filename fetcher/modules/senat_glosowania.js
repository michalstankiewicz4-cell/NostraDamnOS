// Fetcher: Senat glosowania (XML catalog + CSV files)
// Źródło: https://www.senat.gov.pl/gfx/senat/glosowania_wyniki/senat.xml

import { safeFetchText } from '../fetcher.js';

const SENAT_XML_URL = 'https://www.senat.gov.pl/gfx/senat/glosowania_wyniki/senat.xml';

// Mapowanie kadencji wyświetlanej → ścieżki w URL
const SENAT_KADENCJA_MAP = {
    11: 'kadencja_10'  // XI kadencja (2023-obecnie) → URL uses "kadencja_10"
};

/**
 * Główna funkcja: pobiera dane głosowań Senatu z XML+CSV.
 * Zwraca { posiedzenia, glosowania, glosy, poslowie_senat }
 */
export async function fetchSenatGlosowania(config, onProgress) {
    const { kadencja = 11 } = config;
    const kadencjaPath = SENAT_KADENCJA_MAP[kadencja];

    if (!kadencjaPath) {
        console.warn(`[Senat] Brak danych dla kadencji ${kadencja}`);
        return { posiedzenia: [], glosowania: [], glosy: [], poslowie_senat: [] };
    }

    // 1. Pobierz i parsuj katalog XML
    const xmlText = await safeFetchText(SENAT_XML_URL);
    if (!xmlText) throw new Error('Nie udało się pobrać katalogu XML Senatu');

    const resources = parseSenatXml(xmlText, kadencjaPath);
    console.log(`[Senat] Znaleziono ${resources.length} zasobów CSV`);

    // 2. Grupuj po posiedzeniu
    const grouped = groupResources(resources);

    // 3. Filtruj wg zakresu użytkownika
    const filtered = filterByRange(grouped, config);
    console.log(`[Senat] Posiedzenia do pobrania: ${[...filtered.keys()].join(', ')}`);

    // 4. Pobierz CSV-ki i sparsuj dane
    return await fetchAllCsvs(filtered, onProgress);
}

// ===== XML PARSING =====

function parseSenatXml(xmlText, kadencjaPath) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const resources = [];

    for (const res of doc.querySelectorAll('resource[status="published"]')) {
        const url = res.querySelector('url')?.textContent?.trim();
        const extIdent = res.querySelector('extIdent')?.textContent?.trim();
        const titleEl = res.querySelector('title > polish') || res.querySelector('title');
        const descEl = res.querySelector('description > polish') || res.querySelector('description');

        if (!url || !url.includes(kadencjaPath)) continue;
        if (!url.endsWith('_imie.csv')) continue; // Tylko głosy indywidualne

        const ids = parseResourceIds(url) || parseResourceIds(extIdent);
        if (!ids) continue;

        resources.push({
            url,
            extIdent: extIdent || '',
            title: titleEl?.textContent?.trim() || '',
            description: descEl?.textContent?.trim() || '',
            _ids: ids
        });
    }

    return resources;
}

function parseResourceIds(str) {
    if (!str) return null;

    // Wzorzec URL: Posiedzenie_1_dzien_1_glosowanie_1_...
    const m1 = str.match(/Posiedzenie_(\d+)_dzien_(\d+)_glosowanie_(\d+)/i);
    if (m1) return { posiedzenie: +m1[1], dzien: +m1[2], glosowanie: +m1[3] };

    // Wzorzec extIdent: k_10_pos_1_dz_1_glos_1_imie
    const m2 = str.match(/pos_(\d+)_dz_(\d+)_glos_(\d+)/i);
    if (m2) return { posiedzenie: +m2[1], dzien: +m2[2], glosowanie: +m2[3] };

    return null;
}

// ===== GROUPING & FILTERING =====

function groupResources(resources) {
    const grouped = new Map();
    for (const res of resources) {
        const num = res._ids.posiedzenie;
        if (!grouped.has(num)) grouped.set(num, []);
        grouped.get(num).push(res);
    }
    return grouped;
}

function filterByRange(grouped, config) {
    let nums = [...grouped.keys()].sort((a, b) => a - b);

    if (config.rangeMode === 'last') {
        nums = nums.slice(-(config.rangeCount || 2));
    } else if (config.rangeMode === 'custom') {
        nums = nums.filter(n => n >= (config.rangeFrom || 1) && n <= (config.rangeTo || 999));
    }

    const filtered = new Map();
    for (const n of nums) {
        if (grouped.has(n)) filtered.set(n, grouped.get(n));
    }
    return filtered;
}

// ===== CSV FETCHING & PARSING =====

async function fetchAllCsvs(grouped, onProgress) {
    const posiedzenia = [];
    const glosowania = [];
    const glosy = [];
    const senatorNames = new Map(); // nazwa → syntetyczne ID

    const allResources = [];
    for (const [posNum, resources] of grouped) {
        posiedzenia.push({ number: posNum, dates: [] });
        for (const r of resources) allResources.push(r);
    }

    let fetched = 0;
    const total = allResources.length;
    const BATCH = 5;

    for (let i = 0; i < allResources.length; i += BATCH) {
        const batch = allResources.slice(i, i + BATCH);

        await Promise.all(batch.map(async (res) => {
            const csvText = await safeFetchText(res.url);
            if (!csvText) return;

            const parsed = parseImeCsv(csvText, res);
            if (!parsed) return;

            glosowania.push(parsed.glosowanie);

            for (const vote of parsed.glosy) {
                if (!senatorNames.has(vote._name)) {
                    senatorNames.set(vote._name, generateSenatorId(vote._name));
                }
                vote.id_osoby = senatorNames.get(vote._name);
                vote.id_glosu = `${vote.id_glosowania}_${vote.id_osoby}`;
                glosy.push(vote);
            }
        }));

        fetched += batch.length;
        if (onProgress) {
            onProgress(Math.round((fetched / total) * 100), `Senat CSV ${fetched}/${total}`);
        }
    }

    // Zbuduj rekordy senatorów
    const poslowie_senat = [];
    for (const [name, id] of senatorNames) {
        const parts = name.trim().split(/\s+/);
        const lastName = parts.pop() || name;
        const firstName = parts.join(' ') || '';
        poslowie_senat.push({
            id, firstName, lastName, club: null, active: true
        });
    }

    console.log(`[Senat] Gotowe: ${glosowania.length} głosowań, ${glosy.length} głosów, ${poslowie_senat.length} senatorów`);
    return { posiedzenia, glosowania, glosy, poslowie_senat };
}

function parseImeCsv(csvText, resource) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 4) return null;

    const ids = resource._ids;
    const glosowanieId = `senat_${ids.posiedzenie}_${ids.dzien}_${ids.glosowanie}`;

    // Linia 0: tytuł głosowania
    const title = lines[0].replace(/^"?(.*?)"?$/, '$1');

    // Linia 1: podsumowanie "głosowało : 100, za: 51, przeciw: 48, wstrzymało się: 1"
    const summary = parseSummaryLine(lines[1]);

    const wynik = summary.za > summary.przeciw ? 'przyjęto' : 'odrzucono';

    const glosowanie = {
        id_glosowania: glosowanieId,
        sitting: ids.posiedzenie,
        votingNumber: ids.glosowanie,
        date: null,
        topic: title,
        description: resource.description || title,
        yes: summary.za,
        no: summary.przeciw,
        abstain: summary.wstrzymalo,
        wynik
    };

    // Znajdź początek danych (po nagłówku "Senator,Głos")
    let dataStart = 2;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        if (/^Senator\s*[,;]\s*G[lł]os/i.test(lines[i])) {
            dataStart = i + 1;
            break;
        }
    }

    const glosy = [];
    for (let i = dataStart; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < 2) continue;

        const name = parts[0].trim();
        const vote = parts[1].trim().toLowerCase();
        if (!name || !vote) continue;

        glosy.push({
            _name: name,
            id_glosowania: glosowanieId,
            id_osoby: null, // zostanie uzupełnione w fetchAllCsvs
            id_glosu: null,
            glos: mapVoteValue(vote)
        });
    }

    return { glosowanie, glosy };
}

function parseSummaryLine(line) {
    const result = { za: 0, przeciw: 0, wstrzymalo: 0 };

    const zaMatch = line.match(/za\s*:\s*(\d+)/i);
    const przMatch = line.match(/przeciw\s*:\s*(\d+)/i);
    const wstMatch = line.match(/wstrzyma[lł][oa]\s*(si[eę])?\s*:\s*(\d+)/i);

    if (zaMatch) result.za = parseInt(zaMatch[1]);
    if (przMatch) result.przeciw = parseInt(przMatch[1]);
    if (wstMatch) result.wstrzymalo = parseInt(wstMatch[2] || wstMatch[1]);

    return result;
}

function mapVoteValue(vote) {
    const v = vote.toLowerCase().trim();
    if (v === 'za') return 'za';
    if (v === 'przeciw') return 'przeciw';
    if (v.startsWith('wstrzyma')) return 'wstrzymał się';
    if (v.includes('nieobecn') || v.includes('nie g')) return 'nieobecny';
    return v;
}

function generateSenatorId(name) {
    const normalized = name.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
        hash |= 0;
    }
    return `S${Math.abs(hash)}`;
}
