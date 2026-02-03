// Integracja z Transformers.js dla analizy NLP
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Konfiguracja - używamy CDN dla modeli
env.allowLocalModels = false;

let sentimentPipeline = null;
let embeddingPipeline = null;

/**
 * Inicjalizacja modeli Transformers.js
 */
export async function initNLP() {
    console.log('🔧 Inicjalizacja Transformers.js...');
    
    try {
        // Ładowanie pipeline dla analizy nastrojów
        console.log('Ładowanie modelu sentiment...');
        sentimentPipeline = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
        
        // Ładowanie pipeline dla embeddingów
        console.log('Ładowanie modelu embeddings...');
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        
        console.log('✅ Transformers.js gotowy');
        return true;
    } catch (error) {
        console.error('❌ Błąd inicjalizacji Transformers.js:', error);
        throw error;
    }
}

/**
 * Analiza nastrojów wypowiedzi
 */
export async function analyzeSentiment(speeches) {
    console.log('📊 Analiza nastrojów...', speeches.length, 'wypowiedzi');
    
    if (!sentimentPipeline) {
        console.error('❌ sentimentPipeline is NULL!');
        throw new Error('Model sentiment nie jest załadowany!');
    }
    
    console.log('✅ Pipeline załadowany, rozpoczynam analizę...');
    const results = [];
    
    for (let i = 0; i < speeches.length; i++) {
        const speech = speeches[i];
        console.log(`Analizuję ${i+1}/${speeches.length}: ${speech.speaker}`);
        
        try {
            // Analiza nastrojów (limit 512 tokenów)
            const sentiment = await sentimentPipeline(speech.text.substring(0, 512));
            console.log(`Wynik dla ${speech.speaker}:`, sentiment);
            
            results.push({
                speaker: speech.speaker,
                party: speech.party,
                date: speech.date,
                sentiment: {
                    label: sentiment[0].label.toLowerCase(),
                    score: sentiment[0].score
                }
            });
        } catch (error) {
            console.error(`Błąd analizy dla ${speech.speaker}:`, error);
        }
    }
    
    console.log('✅ Analiza zakończona, wyników:', results.length);
    return results;
}

/**
 * Wykrywanie tematów w wypowiedziach
 */
export async function analyzeTopics(speeches) {
    console.log('🔍 Wykrywanie tematów...');
    
    // Mock - będzie zastąpione prawdziwą analizą
    const topics = [
        { topic: 'gospodarka', count: 45, speeches: [] },
        { topic: 'edukacja', count: 32, speeches: [] },
        { topic: 'zdrowie', count: 28, speeches: [] }
    ];
    
    return topics;
}

/**
 * Generowanie embeddingów dla wypowiedzi
 */
export async function generateEmbeddings(speeches) {
    console.log('🧮 Generowanie embeddingów...');
    
    if (!embeddingPipeline) {
        throw new Error('Model embeddings nie jest załadowany!');
    }
    
    const embeddings = [];
    
    for (const speech of speeches) {
        try {
            // Generowanie embeddingów
            const output = await embeddingPipeline(speech.text.substring(0, 512), {
                pooling: 'mean',
                normalize: true
            });
            
            embeddings.push({
                speaker: speech.speaker,
                embedding: Array.from(output.data)
            });
        } catch (error) {
            console.error(`Błąd generowania embeddingów dla ${speech.speaker}:`, error);
        }
    }
    
    return embeddings;
}

/**
 * Klasyfikacja tekstu
 */
export async function classifyText(text, labels) {
    console.log('🏷️ Klasyfikacja tekstu...');
    
    // Mock - będzie zastąpione prawdziwą klasyfikacją
    return {
        label: labels[0],
        score: 0.85
    };
}

/**
 * Podsumowanie tekstu
 */
export async function summarizeText(text, maxLength = 100) {
    console.log('📝 Podsumowanie tekstu...');
    
    // Mock - będzie zastąpione prawdziwym podsumowaniem
    return text.substring(0, maxLength) + '...';
}
