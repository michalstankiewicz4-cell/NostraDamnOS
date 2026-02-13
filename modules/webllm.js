// Integracja z WebLLM (@mlc-ai/web-llm) dla lokalnego modelu AI w przeglądarce
// Wymaga WebGPU (Chrome 113+, Edge 113+)

let engine = null;
let isLoading = false;
let currentModel = null;

/**
 * Dostępne modele WebLLM (zoptymalizowane pod WebGPU)
 */
export const WEBLLM_MODELS = [
    { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M', size: '~200MB', category: 'nano' },
    { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', name: 'SmolLM2 1.7B', size: '~1GB', category: 'small' },
    { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B', size: '~700MB', category: 'small' },
    { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B', size: '~1.8GB', category: 'medium' },
    { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 Mini 3.8B', size: '~2.2GB', category: 'medium' },
    { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 2B', size: '~1.3GB', category: 'small' },
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 1.5B', size: '~1GB', category: 'small' }
];

/**
 * Sprawdź czy WebGPU jest dostępne
 */
export function isWebGPUAvailable() {
    return !!navigator.gpu;
}

/**
 * Inicjalizacja WebLLM — ładowanie modelu
 * @param {string} modelId — ID modelu z WEBLLM_MODELS
 * @param {Function} onProgress — callback(info: {progress: number, text: string})
 */
export async function initWebLLM(modelId = 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', onProgress = null) {
    console.log('🔧 Inicjalizacja WebLLM...');

    if (!isWebGPUAvailable()) {
        throw new Error('WebGPU niedostępne. Użyj Chrome 113+ lub Edge 113+.');
    }

    if (isLoading) {
        throw new Error('Model jest już ładowany. Poczekaj na zakończenie.');
    }

    isLoading = true;

    try {
        // Dynamiczny import @mlc-ai/web-llm
        const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');

        engine = await CreateMLCEngine(modelId, {
            initProgressCallback: (info) => {
                console.log(`[WebLLM] ${info.text || ''} (${Math.round((info.progress || 0) * 100)}%)`);
                if (onProgress) onProgress(info);
            }
        });

        currentModel = modelId;
        isLoading = false;
        console.log(`✅ WebLLM gotowy — model: ${modelId}`);
        return true;
    } catch (error) {
        isLoading = false;
        console.error('❌ Błąd inicjalizacji WebLLM:', error);
        throw error;
    }
}

/**
 * Czy silnik jest gotowy?
 */
export function isReady() {
    return !!engine;
}

/**
 * Pobierz aktualny model
 */
export function getCurrentModel() {
    return currentModel;
}

/**
 * Chat completion — wyślij prompt i uzyskaj odpowiedź
 * @param {string} userMessage — wiadomość użytkownika
 * @param {string} systemPrompt — opcjonalny system prompt
 * @param {Object} options — {temperature, maxTokens}
 * @returns {string} — odpowiedź modelu
 */
export async function chatCompletion(userMessage, systemPrompt = '', options = {}) {
    if (!engine) throw new Error('Model nie załadowany. Wywołaj initWebLLM() najpierw.');

    const { temperature = 0.5, maxTokens = 800 } = options;

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const reply = await engine.chat.completions.create({
        messages,
        temperature,
        max_tokens: maxTokens
    });

    return reply.choices[0]?.message?.content || '';
}

/**
 * Generowanie streszczenia wypowiedzi
 * @param {Array} speeches — [{speaker, text, date, party}]
 */
export async function generateSummary(speeches) {
    console.log('📝 Generowanie streszczeń...');

    if (!engine) throw new Error('Model nie załadowany');

    const excerpts = speeches.slice(0, 20).map(s =>
        `[${s.speaker || 'Mówca'}] ${(s.text || '').substring(0, 200)}`
    ).join('\n');

    const result = await chatCompletion(
        `Przeanalizuj poniższe wypowiedzi parlamentarne i napisz zwięzłe podsumowanie (max 200 słów) po polsku:\n\n${excerpts}`,
        'Jesteś ekspertem od podsumowywania debat parlamentarnych. Pisz zwięźle i merytorycznie po polsku.'
    );

    return [{ speaker: 'AI', date: new Date().toISOString(), summary: result }];
}

/**
 * Porównanie wypowiedzi różnych mówców
 * @param {Array} speeches — [{speaker, text, party}]
 */
export async function compareSpeeches(speeches) {
    console.log('🔄 Porównywanie wypowiedzi...');

    if (!engine) throw new Error('Model nie załadowany');

    const excerpts = speeches.slice(0, 10).map(s =>
        `[${s.speaker || 'Mówca'}, ${s.party || '?'}] ${(s.text || '').substring(0, 150)}`
    ).join('\n');

    const result = await chatCompletion(
        `Porównaj poniższe wypowiedzi parlamentarne. Wskaż podobieństwa, różnice i główne tematy. Odpowiedz po polsku w formacie JSON: {similarities: [...], differences: [...], topics: [...]}\n\n${excerpts}`,
        'Jesteś analitykiem parlamentarnym. Odpowiadaj w formacie JSON.'
    );

    try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { similarities: [], differences: [], topics: [], rawAnalysis: result };
    } catch {
        return { similarities: [], differences: [], topics: [], rawAnalysis: result };
    }
}

/**
 * Analiza argumentacji w wypowiedzi
 * @param {Object} speech — {text, speaker}
 */
export async function analyzeArgumentation(speech) {
    console.log('🎯 Analiza argumentacji...');

    if (!engine) throw new Error('Model nie załadowany');

    const result = await chatCompletion(
        `Przeanalizuj argumentację w poniższej wypowiedzi parlamentarnej. Zidentyfikuj twierdzenia, dowody i ewentualne błędy logiczne. Odpowiedz JSON: {claims: [...], evidence: [...], fallacies: [...]}\n\nWypowiedź: ${(speech.text || '').substring(0, 500)}`,
        'Jesteś ekspertem od analizy argumentacji i retoryki parlamentarnej. Odpowiadaj po polsku w JSON.'
    );

    try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { claims: [], evidence: [], fallacies: [], rawAnalysis: result };
    } catch {
        return { claims: [], evidence: [], fallacies: [], rawAnalysis: result };
    }
}

/**
 * Analiza retoryki
 * @param {Object} speech — {text, speaker}
 */
export async function analyzeRhetoric(speech) {
    console.log('🎭 Analiza retoryki...');

    if (!engine) throw new Error('Model nie załadowany');

    const result = await chatCompletion(
        `Przeanalizuj retorykę poniższej wypowiedzi. Określ ton, perswazyjność (0-1), użyte środki retoryczne. JSON: {devices: [...], tone: "...", persuasiveness: 0.X}\n\n${(speech.text || '').substring(0, 500)}`,
        'Jesteś ekspertem od retoryki politycznej. Odpowiadaj po polsku w JSON.'
    );

    try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { devices: [], tone: 'neutral', persuasiveness: 0.5, rawAnalysis: result };
    } catch {
        return { devices: [], tone: 'neutral', persuasiveness: 0.5, rawAnalysis: result };
    }
}

/**
 * Kontekstowa analiza wypowiedzi
 * @param {Object} speech — {text, speaker}
 * @param {Object} context — dodatkowy kontekst
 */
export async function analyzeContext(speech, context = {}) {
    console.log('🔍 Analiza kontekstu...');

    if (!engine) throw new Error('Model nie załadowany');

    const ctxStr = context.topic ? `Temat: ${context.topic}. ` : '';
    const result = await chatCompletion(
        `${ctxStr}Oceń poniższą wypowiedź parlamentarną pod kątem trafności, spójności i wniosków. JSON: {relevance: 0.X, coherence: 0.X, insights: [...]}\n\n${(speech.text || '').substring(0, 500)}`,
        'Jesteś analitykiem parlamentarnym. Odpowiadaj po polsku w JSON.'
    );

    try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { relevance: 0.5, coherence: 0.5, insights: [], rawAnalysis: result };
    } catch {
        return { relevance: 0.5, coherence: 0.5, insights: [], rawAnalysis: result };
    }
}

/**
 * Zwolnij zasoby silnika
 */
export async function unload() {
    if (engine) {
        try {
            await engine.unload?.();
        } catch { /* ignore */ }
        engine = null;
        currentModel = null;
        console.log('[WebLLM] Silnik zwolniony');
    }
}
