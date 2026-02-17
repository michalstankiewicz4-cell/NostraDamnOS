// AI Chat Assistant - Client-side chat with database queries
// Supports: OpenAI, Anthropic Claude, Google Gemini, WebLLM (local)

import { db2 } from './database-v2.js';
import { WEBLLM_MODELS, initWebLLM, chatCompletion as webllmChatCompletion, isReady as webllmIsReady, getCurrentModel as webllmGetCurrentModel, isWebGPUAvailable } from './webllm.js';
import {
    getVaultMode, setVaultMode, hasStoredKey, isUnlocked, getKey,
    storeKey, unlock, lock, clearVault, changePin, onLock,
    migrateFromPlaintext
} from './key-vault.js';
import { trackEvent } from './analytics.js';

// State
const chatState = {
    isOpen: false,
    selectedModel: 'openai', // default model
    apiKey: '',
    messages: [],
    isProcessing: false,
    favoriteModels: [], // List of favorite model IDs
    showAllModels: true // Filter: true = all models, false = favorites only
};

// Model configurations
const MODEL_CONFIG = {
    openai: {
        name: 'OpenAI GPT-4',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4-turbo-preview',
        keyLink: 'https://platform.openai.com/api-keys',
        keyPlaceholder: 'sk-...',
        provider: 'openai'
    },
    claude: {
        name: 'Anthropic Claude',
        apiUrl: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-5-sonnet-20241022',
        keyLink: 'https://console.anthropic.com/settings/keys',
        keyPlaceholder: 'sk-ant-...',
        provider: 'claude'
    },
    'gemini-3-flash': {
        name: 'Gemini 3 Flash Preview',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
        model: 'gemini-3-flash-preview',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-3-pro': {
        name: 'Gemini 3 Pro Preview',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent',
        model: 'gemini-3-pro-preview',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        model: 'gemini-2.5-flash',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-2.5-flash-lite': {
        name: 'Gemini 2.5 Flash Lite',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        model: 'gemini-2.5-flash-lite',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-2.5-pro': {
        name: 'Gemini 2.5 Pro',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
        model: 'gemini-2.5-pro',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-2.0-flash': {
        name: 'Gemini 2.0 Flash',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        model: 'gemini-2.0-flash',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-2.0-flash-lite': {
        name: 'Gemini 2.0 Flash Lite',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
        model: 'gemini-2.0-flash-lite',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-exp-1206': {
        name: 'Gemini Exp 1206',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-exp-1206:generateContent',
        model: 'gemini-exp-1206',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-flash-latest': {
        name: 'Gemini Flash Latest',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
        model: 'gemini-flash-latest',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-pro-latest': {
        name: 'Gemini Pro Latest',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent',
        model: 'gemini-pro-latest',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-2.5-flash-image': {
        name: 'Gemini 2.5 Flash Image',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
        model: 'gemini-2.5-flash-image',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-3-pro-image': {
        name: 'Gemini 3 Pro Image Preview',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
        model: 'gemini-3-pro-image-preview',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-computer-use': {
        name: 'Gemini Computer Use Preview',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-computer-use-preview-10-2025:generateContent',
        model: 'gemini-2.5-computer-use-preview-10-2025',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'deep-research-pro': {
        name: 'Deep Research Pro Preview',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/deep-research-pro-preview-12-2025:generateContent',
        model: 'deep-research-pro-preview-12-2025',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemini-robotics': {
        name: 'Gemini Robotics 1.5 Preview',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-robotics-er-1.5-preview:generateContent',
        model: 'gemini-robotics-er-1.5-preview',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemma-12b': {
        name: 'Gemma 3 12B',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:generateContent',
        model: 'gemma-3-12b-it',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    },
    'gemma-27b': {
        name: 'Gemma 3 27B',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent',
        model: 'gemma-3-27b-it',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'AIza...',
        provider: 'gemini'
    }
};

// Dynamically add WebLLM local models to MODEL_CONFIG
WEBLLM_MODELS.forEach(m => {
    const key = `webllm-${m.id}`;
    MODEL_CONFIG[key] = {
        name: `🧠 ${m.name} (${m.size})`,
        apiUrl: '',
        model: m.id,
        keyLink: '',
        keyPlaceholder: 'Nie wymaga klucza API',
        provider: 'webllm',
        localSize: m.size,
        localCategory: m.category
    };
});

/**
 * Initialize AI Chat
 */
export function initAIChat() {
    console.log('[AI Chat] Initializing...');
    
    // Load saved preferences
    loadChatPreferences();
    
    // Setup event listeners
    setupChatEventListeners();
    
    // Rebuild model select with favorites
    rebuildModelSelect();
    
    // Update UI states
    updateModelUI();
    updateFavoriteButton();
    updateFavoritesList();
    
    // Initialize status lamps
    initStatusLamps();
    
    // Initialize Key Vault
    initKeyVault();
    
    console.log('[AI Chat] Initialized');
}

/**
 * Setup event listeners
 */
function setupChatEventListeners() {
    // Model selector
    const modelSelect = document.getElementById('aiModelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            chatState.selectedModel = e.target.value;
            updateModelUI();
            updateFavoriteButton();
            saveChatPreferences();
        });
    }
    
    // Toggle favorite button
    const toggleFavoriteBtn = document.getElementById('toggleFavoriteBtn');
    if (toggleFavoriteBtn) {
        toggleFavoriteBtn.addEventListener('click', () => {
            toggleFavorite(chatState.selectedModel);
            updateFavoriteButton();
        });
    }
    
    // Show all models checkbox
    const showAllCheckbox = document.getElementById('showAllModels');
    if (showAllCheckbox) {
        showAllCheckbox.addEventListener('change', (e) => {
            chatState.showAllModels = e.target.checked;
            rebuildModelSelect();
            saveChatPreferences();
        });
    }
    
    // API Key input — integracja z vault
    const apiKeyInput = document.getElementById('aiApiKey');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('change', (e) => {
            const newKey = e.target.value.trim();
            if (!newKey) return;
            chatState.apiKey = newKey;

            const mode = getVaultMode();
            if (mode === 'pin') {
                // Pokaż modal PINu do zaszyfrowania
                showPinModal('store', newKey);
            } else {
                // session / memory — zapisz bez PINu
                storeKey(newKey).then(() => {
                    updateVaultUI();
                    saveChatPreferencesWithoutKey();
                });
            }
        });
    }
    
    // Send button
    const sendBtn = document.getElementById('sendChatBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Check available models button
    const checkModelsBtn = document.getElementById('checkModelsBtn');
    if (checkModelsBtn) {
        console.log('[AI Chat] Check models button found, attaching listener');
        checkModelsBtn.addEventListener('click', checkAvailableModels);
    } else {
        console.warn('[AI Chat] Check models button NOT found');
    }
    
    // Enter key to send
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });
    }
}

/**
 * Update UI based on selected model
 */
function updateModelUI() {
    const config = MODEL_CONFIG[chatState.selectedModel];
    if (!config) return;
    
    const apiKeyLink = document.getElementById('apiKeyLink');
    const apiKeyInput = document.getElementById('aiApiKey');
    const apiKeyRow = document.getElementById('apiKeyRow');
    
    if (config.provider === 'webllm') {
        // Local model — hide API key row, show info
        if (apiKeyRow) apiKeyRow.style.display = 'none';
        if (apiKeyLink) {
            apiKeyLink.href = '#';
            apiKeyLink.textContent = `🧠 ${config.name} — model lokalny (WebGPU)`;
        }
    } else {
        // Cloud model — show API key row
        if (apiKeyRow) apiKeyRow.style.display = '';
        if (apiKeyLink) {
            apiKeyLink.href = config.keyLink;
            apiKeyLink.textContent = `Wygeneruj klucz dla ${config.name}`;
        }
        if (apiKeyInput) {
            apiKeyInput.placeholder = config.keyPlaceholder;
        }
    }
}

/**
 * Update favorite button visual state
 */
function updateFavoriteButton() {
    const toggleBtn = document.getElementById('toggleFavoriteBtn');
    if (!toggleBtn) return;
    
    const isFavorite = chatState.favoriteModels.includes(chatState.selectedModel);
    if (isFavorite) {
        toggleBtn.classList.add('active');
        toggleBtn.title = 'Usuń z ulubionych';
    } else {
        toggleBtn.classList.remove('active');
        toggleBtn.title = 'Dodaj do ulubionych';
    }
}

/**
 * Rebuild model select with favorites on top
 */
function rebuildModelSelect() {
    const modelSelect = document.getElementById('aiModelSelect');
    if (!modelSelect) return;
    
    const currentValue = modelSelect.value;
    modelSelect.innerHTML = '';
    
    // If showing only favorites and no favorites exist, show helpful message
    if (!chatState.showAllModels && chatState.favoriteModels.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Brak ulubionych - zaznacz "Pokaż wszystkie"';
        option.disabled = true;
        modelSelect.appendChild(option);
        return;
    }
    
    // Separate models into categories
    const favoriteModels = [];
    const openaiModel = [];
    const claudeModel = [];
    const geminiMain = [];
    const gemini20 = [];
    const geminiLatest = [];
    const geminiSpecial = [];
    const gemmaModels = [];
    const webllmModels = [];
    
    Object.keys(MODEL_CONFIG).forEach(key => {
        const config = MODEL_CONFIG[key];
        const isFavorite = chatState.favoriteModels.includes(key);
        
        // Skip non-favorites if filter is active
        if (!chatState.showAllModels && !isFavorite) {
            return;
        }
        
        const option = { value: key, text: config.name, isFavorite };
        
        if (isFavorite) {
            favoriteModels.push(option);
        } else if (config.provider === 'webllm') {
            webllmModels.push(option);
        } else if (key === 'openai') {
            openaiModel.push(option);
        } else if (key === 'claude') {
            claudeModel.push(option);
        } else if (['gemini-3-flash', 'gemini-3-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'].includes(key)) {
            geminiMain.push(option);
        } else if (['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-exp-1206'].includes(key)) {
            gemini20.push(option);
        } else if (['gemini-flash-latest', 'gemini-pro-latest'].includes(key)) {
            geminiLatest.push(option);
        } else if (key.startsWith('gemma')) {
            gemmaModels.push(option);
        } else {
            geminiSpecial.push(option);
        }
    });
    
    // Add favorites group if any
    if (favoriteModels.length > 0) {
        const favGroup = document.createElement('optgroup');
        favGroup.label = '⭐ Ulubione';
        favoriteModels.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            favGroup.appendChild(option);
        });
        modelSelect.appendChild(favGroup);
    }
    
    // Add other groups
    const addGroup = (label, options) => {
        if (options.length === 0) return;
        const group = document.createElement('optgroup');
        group.label = label;
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            group.appendChild(option);
        });
        modelSelect.appendChild(group);
    };
    
    openaiModel.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        modelSelect.appendChild(option);
    });
    
    claudeModel.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        modelSelect.appendChild(option);
    });
    
    addGroup('🔥 Gemini - Główne', geminiMain);
    addGroup('⚡ Gemini 2.0', gemini20);
    addGroup('📌 Latest', geminiLatest);
    addGroup('🎨 Image & Specjalne', geminiSpecial);
    addGroup('🤖 Gemma (Open Models)', gemmaModels);
    addGroup('🧠 Modele Lokalne (WebLLM)', webllmModels);
    
    // Restore selected value
    if (currentValue && MODEL_CONFIG[currentValue]) {
        modelSelect.value = currentValue;
    }
    
    // Update favorites UI
    updateFavoritesList();
}

/**
 * Update favorites list UI
 */
function updateFavoritesList() {
    const favList = document.getElementById('favoritesList');
    if (!favList) return;
    
    if (chatState.favoriteModels.length === 0) {
        favList.innerHTML = '<div class="favorites-empty">Brak ulubionych. Kliknij ⭐ obok modelu aby dodać.</div>';
        return;
    }
    
    favList.innerHTML = '';
    chatState.favoriteModels.forEach(modelKey => {
        const config = MODEL_CONFIG[modelKey];
        if (!config) return;
        
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <span class="favorite-name">${config.name}</span>
            <button class="favorite-remove" data-model="${modelKey}" title="Usuń z ulubionych">⭐</button>
        `;
        
        const removeBtn = item.querySelector('.favorite-remove');
        removeBtn.addEventListener('click', () => toggleFavorite(modelKey));
        
        favList.appendChild(item);
    });
}

/**
 * Toggle favorite status of a model
 */
function toggleFavorite(modelKey) {
    const index = chatState.favoriteModels.indexOf(modelKey);
    
    if (index > -1) {
        // Remove from favorites
        chatState.favoriteModels.splice(index, 1);
    } else {
        // Add to favorites
        chatState.favoriteModels.push(modelKey);
    }
    
    saveChatPreferences();
    rebuildModelSelect();
    updateFavoritesList();
    initStatusLamps(); // Refresh status lamps
}

// Export for global access
window.toggleFavorite = toggleFavorite;

/**
 * Check available Gemini models for the API key
 */
async function checkAvailableModels() {
    console.log('[AI Chat] checkAvailableModels() called');
    
    const apiKey = chatState.apiKey;
    
    if (!apiKey) {
        console.log('[AI Chat] No API key provided');
        addMessageToChat('system', '⚠️ Proszę najpierw podać klucz API');
        return;
    }
    
    if (!chatState.selectedModel.startsWith('gemini')) {
        console.log('[AI Chat] Selected model is not Gemini:', chatState.selectedModel);
        addMessageToChat('system', 'ℹ️ Ta funkcja działa tylko dla modeli Google Gemini');
        return;
    }
    
    console.log('[AI Chat] Checking models with API key');
    addMessageToChat('system', '🔍 Sprawdzam dostępne modele Gemini...');
    
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        
        if (!data.models || data.models.length === 0) {
            addMessageToChat('system', '❌ Brak dostępnych modeli');
            return;
        }
        
        // Filter only models that support generateContent
        const availableModels = data.models
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));
        
        let message = `✅ **Dostępne modele Gemini (${availableModels.length}):**\n\n`;
        availableModels.forEach(model => {
            message += `• ${model}\n`;
        });
        
        addMessageToChat('assistant', message);
        
        console.log('[AI Chat] Available Gemini models:', availableModels);
        
    } catch (error) {
        console.error('[AI Chat] Error checking models:', error);
        addMessageToChat('system', `❌ Błąd: ${error.message}`);
    }
}

/**
 * Send message to AI
 */
async function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    const selectedConfig = MODEL_CONFIG[chatState.selectedModel];
    if (!chatState.apiKey && selectedConfig?.provider !== 'webllm') {
        addMessageToChat('system', '⚠️ Proszę podać klucz API');
        return;
    }
    
    if (chatState.isProcessing) {
        return;
    }
    
    // Add user message
    addMessageToChat('user', message);
    trackEvent('ai_chat_message', { model: chatState.selectedModel, message_length: message.length });
    input.value = '';
    
    // Set processing state
    chatState.isProcessing = true;
    const sendBtn = document.getElementById('sendChatBtn');
    if (sendBtn) sendBtn.disabled = true;
    
    // Show typing indicator
    const typingId = addMessageToChat('assistant', '⏳ Przetwarzam zapytanie...');
    
    try {
        // Get database schema
        const schema = getDatabaseSchema();
        
        // Call AI API
        const response = await callAIModel(message, schema);
        
        // Remove typing indicator
        removeMessage(typingId);
        
        // Add AI response
        addMessageToChat('assistant', response);
        
    } catch (error) {
        console.error('[AI Chat] Error:', error);
        removeMessage(typingId);
        addMessageToChat('system', `❌ Błąd: ${error.message}`);
    } finally {
        chatState.isProcessing = false;
        if (sendBtn) sendBtn.disabled = false;
    }
}

/**
 * Call AI model API
 */
async function callAIModel(userMessage, schema) {
    const config = MODEL_CONFIG[chatState.selectedModel];
    
    const systemPrompt = `Jesteś asystentem AI do analizy danych parlamentarnych z polskiego Sejmu. 
Masz dostęp do lokalnej bazy danych SQLite z następującym schematem:

${schema}

Użytkownik zadaje pytania po polsku. Twoje zadanie:
1. Zrozum pytanie użytkownika
2. Wygeneruj odpowiednie zapytanie SQL do bazy danych
3. Wyjaśnij wyniki w przystępny sposób

Odpowiadaj zawsze po polsku. Jeśli generujesz SQL, umieść go w bloku kodu.`;

    let response;
    
    if (config.provider === 'webllm') {
        response = await callWebLLM(systemPrompt, userMessage, config);
    } else if (chatState.selectedModel === 'openai') {
        response = await callOpenAI(systemPrompt, userMessage, config);
    } else if (chatState.selectedModel === 'claude') {
        response = await callClaude(systemPrompt, userMessage, config);
    } else if (config.provider === 'gemini') {
        response = await callGemini(systemPrompt, userMessage, config);
    }
    
    // Check if response contains SQL query
    const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch) {
        const sql = sqlMatch[1].trim();
        console.log('[AI Chat] Executing SQL:', sql);
        
        // Walidacja: tylko SELECT jest dozwolony (bezpieczeństwo bazy)
        const sqlUpper = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().toUpperCase();
        const forbidden = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|ATTACH|DETACH|PRAGMA|REINDEX|VACUUM)\b/i;
        if (forbidden.test(sql.trim())) {
            console.warn('[AI Chat] Blocked dangerous SQL:', sql);
            response += '\n\n⛔ Zablokowano zapytanie SQL — dozwolone są tylko operacje odczytu (SELECT).';
        } else {
            try {
                const results = db2.database.exec(sql);
                const formattedResults = formatSQLResults(results);
                response += '\n\n**Wyniki zapytania:**\n' + formattedResults;
            } catch (error) {
                response += `\n\n❌ Błąd wykonania SQL: ${error.message}`;
            }
        }
    }
    
    return response;
}

/**
 * Call WebLLM (local model in browser)
 */
async function callWebLLM(systemPrompt, userMessage, config) {
    const modelId = config.model;

    // Check WebGPU availability
    if (!isWebGPUAvailable()) {
        throw new Error('WebGPU niedostępne. Potrzebujesz Chrome 113+ lub Edge 113+ z obsługą WebGPU.');
    }

    // Load model if not ready or different model selected
    if (!webllmIsReady() || webllmGetCurrentModel() !== modelId) {
        // Show loading progress in chat
        const loadingId = addMessageToChat('system', `⏳ Ładowanie modelu ${config.name}... (0%)`);
        
        try {
            await initWebLLM(modelId, (info) => {
                const pct = Math.round((info.progress || 0) * 100);
                const text = info.text || '';
                updateMessage(loadingId, `⏳ ${text} (${pct}%)`);
            });
            removeMessage(loadingId);
            addMessageToChat('system', `✅ Model ${config.name} załadowany i gotowy!`);
        } catch (error) {
            removeMessage(loadingId);
            throw new Error(`Nie udało się załadować modelu: ${error.message}`);
        }
    }

    // Call local model
    const result = await webllmChatCompletion(userMessage, systemPrompt, {
        temperature: 0.7,
        maxTokens: 2000
    });

    return result;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(systemPrompt, userMessage, config) {
    const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${chatState.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 2000
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Call Claude API
 */
async function callClaude(systemPrompt, userMessage, config) {
    const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': chatState.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: 2000,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage }
            ]
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    return data.content[0].text;
}

/**
 * Call Gemini API
 */
async function callGemini(systemPrompt, userMessage, config) {
    const url = `${config.apiUrl}?key=${chatState.apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\nUżytkownik: ${userMessage}`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

/**
 * Get database schema
 */
function getDatabaseSchema() {
    try {
        const tables = db2.database.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        
        let schema = '';
        if (tables.length > 0) {
            tables[0].values.forEach(([tableName]) => {
                const columns = db2.database.exec(`PRAGMA table_info(${tableName})`);
                schema += `\nTabela: ${tableName}\n`;
                if (columns.length > 0) {
                    columns[0].values.forEach(col => {
                        schema += `  - ${col[1]} (${col[2]})\n`;
                    });
                }
            });
        }
        
        return schema || 'Baza danych jest pusta';
    } catch (error) {
        return 'Nie można odczytać schematu bazy danych';
    }
}

/**
 * Format SQL results
 */
function formatSQLResults(results) {
    if (!results || results.length === 0) {
        return '(brak wyników)';
    }
    
    const result = results[0];
    let output = '```\n';
    
    // Header
    output += result.columns.join(' | ') + '\n';
    output += result.columns.map(() => '---').join(' | ') + '\n';
    
    // Rows (limit to 50)
    const rowsToShow = result.values.slice(0, 50);
    rowsToShow.forEach(row => {
        output += row.join(' | ') + '\n';
    });
    
    if (result.values.length > 50) {
        output += `\n... (${result.values.length - 50} więcej wierszy)\n`;
    }
    
    output += `\nLiczba wierszy: ${result.values.length}\n`;
    output += '```';
    
    return output;
}

/**
 * Add message to chat
 */
function addMessageToChat(role, content) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const messageId = 'msg-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = `chat-message chat-${role}`;
    
    const icon = role === 'user' ? '👤' : (role === 'assistant' ? '🤖' : 'ℹ️');
    messageDiv.innerHTML = `
        <div class="chat-message-icon">${icon}</div>
        <div class="chat-message-content">${formatMessage(content)}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Save to state
    chatState.messages.push({ role, content, id: messageId });
    
    return messageId;
}

/**
 * Remove message from chat
 */
function removeMessage(messageId) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) messageDiv.remove();
    
    chatState.messages = chatState.messages.filter(m => m.id !== messageId);
}

/**
 * Update message content in chat (for progress updates)
 */
function updateMessage(messageId, content) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) return;
    const contentEl = messageDiv.querySelector('.chat-message-content');
    if (contentEl) contentEl.innerHTML = formatMessage(content);
}

/**
 * Format message content
 */
function formatMessage(content) {
    // Simple markdown-like formatting
    let formatted = content;
    
    // Code blocks
    formatted = formatted.replace(/```sql\n([\s\S]*?)\n```/g, '<pre class="chat-code">$1</pre>');
    formatted = formatted.replace(/```\n([\s\S]*?)\n```/g, '<pre class="chat-code">$1</pre>');
    
    // Bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

/**
 * Save preferences to localStorage (BEZ klucza API — klucz w vault)
 */
function saveChatPreferences() {
    saveChatPreferencesWithoutKey();
}

function saveChatPreferencesWithoutKey() {
    localStorage.setItem('aiChat_model', chatState.selectedModel);
    localStorage.setItem('aiChat_favorites', JSON.stringify(chatState.favoriteModels));
    localStorage.setItem('aiChat_showAllModels', chatState.showAllModels.toString());
    // Klucz API NIE jest już zapisywany jako plaintext — obsługuje go key-vault.js
}

/**
 * Load preferences from localStorage
 */
function loadChatPreferences() {
    const savedModel = localStorage.getItem('aiChat_model');
    const savedFavorites = localStorage.getItem('aiChat_favorites');
    const savedShowAll = localStorage.getItem('aiChat_showAllModels');
    
    if (savedModel && MODEL_CONFIG[savedModel]) {
        chatState.selectedModel = savedModel;
        const modelSelect = document.getElementById('aiModelSelect');
        if (modelSelect) modelSelect.value = savedModel;
    }
    
    // Klucz z vault (jeśli odblokowany)
    if (isUnlocked()) {
        chatState.apiKey = getKey() || '';
        const apiKeyInput = document.getElementById('aiApiKey');
        if (apiKeyInput) apiKeyInput.value = chatState.apiKey;
    } else {
        // Migracja: stary plaintext klucz → vault (jednorazowo)
        const legacyKey = localStorage.getItem('aiChat_apiKey');
        if (legacyKey) {
            chatState.apiKey = legacyKey;
            const apiKeyInput = document.getElementById('aiApiKey');
            if (apiKeyInput) apiKeyInput.value = legacyKey;
            // Migracja zostanie dokończona przy initKeyVault
        }
    }
    
    if (savedShowAll !== null) {
        chatState.showAllModels = savedShowAll === 'true';
        const showAllCheckbox = document.getElementById('showAllModels');
        if (showAllCheckbox) showAllCheckbox.checked = chatState.showAllModels;
    }
    
    if (savedFavorites) {
        try {
            chatState.favoriteModels = JSON.parse(savedFavorites) || [];
        } catch (e) {
            chatState.favoriteModels = [];
        }
    }
    
    updateModelUI();
}

/**
 * Initialize status lamps for favorite models
 */
let pingCheckTimeout = null;
let isPinging = false;

function initStatusLamps() {
    const container = document.getElementById('aiStatusLamps');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create lamps only for favorite models
    if (chatState.favoriteModels.length === 0) {
        return;
    }
    
    chatState.favoriteModels.forEach(modelKey => {
        const config = MODEL_CONFIG[modelKey];
        if (!config) return;
        
        const lamp = document.createElement('div');
        lamp.className = 'status-lamp';
        lamp.id = `lamp-${modelKey}`;
        lamp.setAttribute('data-model', config.name);
        lamp.title = config.name;
        
        // Click to manually recheck
        lamp.addEventListener('click', () => {
            pingModelAPI(modelKey);
        });
        
        container.appendChild(lamp);
    });
    
    // Debounce ping checks - cancel previous timeout
    if (pingCheckTimeout) {
        clearTimeout(pingCheckTimeout);
    }
    
    // Wait a bit for page stabilization, then ping all models (only once)
    pingCheckTimeout = setTimeout(() => {
        if (!isPinging) {
            console.log('[AI Status] Starting API health checks...');
            checkAllFavoriteModels();
        }
    }, 2000);
}

/**
 * Check all favorite models status
 */
async function checkAllFavoriteModels() {
    if (isPinging) {
        console.log('[AI Status] Already checking, skipping...');
        return;
    }
    
    isPinging = true;
    
    for (const modelKey of chatState.favoriteModels) {
        await pingModelAPI(modelKey);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    isPinging = false;
}

/**
 * Ping a specific model API to check health
 */
async function pingModelAPI(modelKey) {
    const lamp = document.getElementById(`lamp-${modelKey}`);
    if (!lamp) return;
    
    const config = MODEL_CONFIG[modelKey];
    if (!config) return;
    
    // Set checking state
    lamp.className = 'status-lamp checking';
    if (window.clog) window.clog('yellow', `[AI Ping] → ${config.name} (${config.provider})...`);

    // WebLLM local models — check WebGPU availability
    if (config.provider === 'webllm') {
        if (isWebGPUAvailable()) {
            const isLoaded = webllmIsReady() && webllmGetCurrentModel() === config.model;
            lamp.className = isLoaded ? 'status-lamp success' : 'status-lamp warning';
            lamp.title = isLoaded ? `${config.name} — załadowany` : `${config.name} — WebGPU OK, model niezaładowany`;
            if (window.clog) window.clog('yellow', `[AI Ping] ← ${config.name}: ${isLoaded ? 'loaded' : 'WebGPU OK'}`);
        } else {
            lamp.className = 'status-lamp error';
            lamp.title = `${config.name} — WebGPU niedostępne`;
            if (window.clog) window.clog('yellow', `[AI Ping] ← ${config.name}: WebGPU unavailable`);
        }
        return;
    }

    try {
        // Test with a minimal request
        let response;

        if (config.provider === 'openai') {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${chatState.apiKey || 'test'}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 5
                })
            });
        } else if (config.provider === 'claude') {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': chatState.apiKey || 'test',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 5
                })
            });
        } else if (config.provider === 'gemini') {
            const apiKey = chatState.apiKey || 'test';
            const url = `${config.apiUrl}?key=${apiKey}`;
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'test' }]
                    }]
                })
            });
        }

        // Check response
        if (response && response.ok) {
            lamp.className = 'status-lamp success';
            if (window.clog) window.clog('yellow', `[AI Ping] ← ${config.name}: OK`);
        } else {
            if (response && (response.status === 401 || response.status === 403)) {
                lamp.className = 'status-lamp success';
                if (window.clog) window.clog('yellow', `[AI Ping] ← ${config.name}: OK (endpoint reachable, ${response.status})`);
            } else {
                lamp.className = 'status-lamp error';
                if (window.clog) window.clog('yellow', `[AI Ping] ← ${config.name}: Error (${response?.status || 'unknown'})`);
            }
        }
    } catch (error) {
        lamp.className = 'status-lamp error';
        if (window.clog) window.clog('yellow', `[AI Ping] ← ${config.name}: ${error.message}`);
    }
}

// Export for external access
window.recheckAIStatus = checkAllFavoriteModels;

/**
 * Programowo wyślij wiadomość do czatu AI z zewnętrznego modułu.
 * Przełącza na zakładkę AI Asystent, wypełnia pole i wysyła.
 * @param {string} message — treść wiadomości
 */
window.sendToAIChat = function(message) {
    if (!message || typeof message !== 'string') return;

    // Przełącz na zakładkę AI Asystent (sekcja 3)
    const navItem = document.querySelector('.nav-item[data-section="3"]');
    if (navItem) navItem.click();

    // Wypełnij pole i wyślij z małym opóźnieniem (żeby sekcja zdążyła się pokazać)
    setTimeout(() => {
        const input = document.getElementById('chatInput');
        if (input) {
            input.value = message;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        }
        // Wywołaj sendMessage
        sendMessage();
    }, 150);
};

// =====================================================
// KEY VAULT INTEGRATION
// =====================================================

/**
 * Inicjalizacja vault — UI, migracja, auto-unlock
 */
function initKeyVault() {
    console.log('[AI Chat] Initializing Key Vault...');

    // Ustaw tryb w select
    const modeSelect = document.getElementById('vaultMode');
    if (modeSelect) {
        modeSelect.value = getVaultMode();
        modeSelect.addEventListener('change', (e) => {
            setVaultMode(e.target.value);
            updateVaultUI();
            // Jeśli zmieniono na 'pin' i jest klucz w pamięci — zapytaj o PIN
            if (e.target.value === 'pin' && chatState.apiKey) {
                showPinModal('store', chatState.apiKey);
            }
        });
    }

    // Przycisk zablokuj
    const lockBtn = document.getElementById('vaultLockBtn');
    if (lockBtn) {
        lockBtn.addEventListener('click', () => {
            lock();
            chatState.apiKey = '';
            const inp = document.getElementById('aiApiKey');
            if (inp) inp.value = '';
            updateVaultUI();
        });
    }

    // Przycisk zmień PIN
    const changePinBtn = document.getElementById('vaultChangePinBtn');
    if (changePinBtn) {
        changePinBtn.addEventListener('click', () => {
            showPinModal('change');
        });
    }

    // Callback na auto-lock
    onLock(() => {
        chatState.apiKey = '';
        const inp = document.getElementById('aiApiKey');
        if (inp) inp.value = '';
        updateVaultUI();
        console.log('[AI Chat] Key auto-locked after inactivity');
    });

    // Migracja plaintext → vault
    const legacyKey = localStorage.getItem('aiChat_apiKey');
    if (legacyKey) {
        console.log('[AI Chat] Found legacy plaintext key, migrating...');
        chatState.apiKey = legacyKey;
        const inp = document.getElementById('aiApiKey');
        if (inp) inp.value = legacyKey;
        const mode = getVaultMode();
        if (mode === 'pin') {
            // Tryb PIN — pytaj o PIN do zaszyfrowania
            showPinModal('migrate', legacyKey);
            return;
        } else {
            // session/memory — ciche przeniesienie
            storeKey(legacyKey).then(() => {
                localStorage.removeItem('aiChat_apiKey');
                console.log('[KeyVault] Migrated legacy key to', mode);
                updateVaultUI();
            });
            return;
        }
    }

    // Jeśli vault ma klucz i tryb PIN — pokaż modal odblokowania
    if (hasStoredKey() && getVaultMode() === 'pin' && !isUnlocked()) {
        showPinModal('unlock');
    } else if (hasStoredKey() && getVaultMode() === 'session') {
        // session — od razu odblokuj
        unlock('').then(key => {
            chatState.apiKey = key;
            const inp = document.getElementById('aiApiKey');
            if (inp) inp.value = key;
            updateVaultUI();
        }).catch(() => {});
    }

    updateVaultUI();
}

/**
 * Aktualizuj UI vault (ikona, status, przyciski)
 */
function updateVaultUI() {
    const icon = document.getElementById('vaultLockIcon');
    const text = document.getElementById('vaultStatusText');
    const lockBtn = document.getElementById('vaultLockBtn');
    const changePinBtn = document.getElementById('vaultChangePinBtn');
    const mode = getVaultMode();
    const unlocked = isUnlocked();

    // Inline status (przy polu klucza w AI Asystencie)
    if (icon) icon.textContent = unlocked ? '🔓' : '🔒';
    if (text) {
        if (mode === 'pin') {
            text.textContent = unlocked ? 'AES-256 🔓' : 'AES-256 🔒';
        } else if (mode === 'session') {
            text.textContent = 'Sesja';
        } else {
            text.textContent = 'RAM';
        }
    }
    if (lockBtn) lockBtn.style.display = (mode === 'pin' && unlocked) ? '' : 'none';

    // Settings panel (Ustawienia > Bezpieczeństwo klucza API)
    if (changePinBtn) changePinBtn.style.display = (mode === 'pin' && hasStoredKey()) ? '' : 'none';
    const modeSelect = document.getElementById('vaultMode');
    if (modeSelect) modeSelect.value = mode;

    // Pokaż opis odpowiedniego trybu
    document.querySelectorAll('.vault-desc').forEach(el => {
        el.style.display = el.dataset.mode === mode ? '' : 'none';
    });
}

// =====================================================
// PIN MODAL
// =====================================================

let _pinModalResolve = null;
let _pinModalAction = '';
let _pinModalPayload = null;

/**
 * Pokaż modal PINu
 * @param {'store'|'unlock'|'change'|'migrate'} action
 * @param {string} payload — klucz API (dla store/migrate)
 */
function showPinModal(action, payload = null) {
    _pinModalAction = action;
    _pinModalPayload = payload;

    const modal = document.getElementById('pinModal');
    const title = document.getElementById('pinModalTitle');
    const desc = document.getElementById('pinModalDesc');
    const confirmGroup = document.getElementById('pinConfirmGroup');
    const errorEl = document.getElementById('pinError');
    const dontSaveCheck = document.getElementById('pinDontSave');
    const input1 = document.getElementById('pinInput1');
    const input2 = document.getElementById('pinInput2');
    const label1 = document.getElementById('pinLabel1');

    if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
    if (input1) input1.value = '';
    if (input2) input2.value = '';

    switch (action) {
        case 'store':
        case 'migrate':
            if (title) title.textContent = action === 'migrate' ? '🔄 Migracja klucza' : '🔐 Zabezpiecz klucz';
            if (desc) desc.textContent = action === 'migrate'
                ? 'Znaleziono niezaszyfrowany klucz. Ustaw PIN aby go zabezpieczyć.'
                : 'Ustaw 4–8 cyfrowy PIN aby zaszyfrować klucz API';
            if (label1) label1.textContent = 'Nowy PIN:';
            if (confirmGroup) confirmGroup.style.display = '';
            if (dontSaveCheck) dontSaveCheck.parentElement.style.display = '';
            break;
        case 'unlock':
            if (title) title.textContent = '🔑 Odblokuj klucz';
            if (desc) desc.textContent = 'Podaj PIN aby odszyfrować klucz API';
            if (label1) label1.textContent = 'PIN:';
            if (confirmGroup) confirmGroup.style.display = 'none';
            if (dontSaveCheck) dontSaveCheck.parentElement.style.display = 'none';
            break;
        case 'change':
            if (title) title.textContent = '🔄 Zmień PIN';
            if (desc) desc.textContent = 'Podaj stary PIN, następnie nowy';
            if (label1) label1.textContent = 'Stary PIN:';
            if (confirmGroup) confirmGroup.style.display = '';
            if (document.querySelector('#pinConfirmGroup label')) {
                document.querySelector('#pinConfirmGroup label').textContent = 'Nowy PIN:';
            }
            if (dontSaveCheck) dontSaveCheck.parentElement.style.display = 'none';
            break;
    }

    if (modal) modal.style.display = 'flex';
    if (input1) setTimeout(() => input1.focus(), 100);

    // Podepnij eventy
    const submitBtn = document.getElementById('pinSubmitBtn');
    const cancelBtn = document.getElementById('pinCancelBtn');

    // Usuń stare listenery
    const newSubmit = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newSubmit.addEventListener('click', handlePinSubmit);
    newCancel.addEventListener('click', () => {
        hidePinModal();
    });

    // Enter w inputach
    [input1, input2].forEach(inp => {
        if (inp) {
            inp.onkeydown = (e) => {
                if (e.key === 'Enter') handlePinSubmit();
            };
        }
    });
}

function hidePinModal() {
    const modal = document.getElementById('pinModal');
    if (modal) modal.style.display = 'none';
}

async function handlePinSubmit() {
    const input1 = document.getElementById('pinInput1');
    const input2 = document.getElementById('pinInput2');
    const errorEl = document.getElementById('pinError');
    const dontSaveCheck = document.getElementById('pinDontSave');

    const pin1 = input1?.value || '';
    const pin2 = input2?.value || '';

    try {
        switch (_pinModalAction) {
            case 'store':
            case 'migrate': {
                if (dontSaveCheck?.checked) {
                    // Tryb "nie zapamiętuj" → session
                    setVaultMode('session');
                    await storeKey(_pinModalPayload);
                    if (_pinModalAction === 'migrate') localStorage.removeItem('aiChat_apiKey');
                    hidePinModal();
                    updateVaultUI();
                    return;
                }
                if (pin1.length < 4) throw new Error('PIN musi mieć co najmniej 4 znaki');
                if (pin1 !== pin2) throw new Error('PINy się nie zgadzają');

                if (_pinModalAction === 'migrate') {
                    await migrateFromPlaintext(_pinModalPayload, pin1);
                } else {
                    await storeKey(_pinModalPayload, pin1);
                }
                chatState.apiKey = _pinModalPayload;
                saveChatPreferencesWithoutKey();
                hidePinModal();
                updateVaultUI();
                break;
            }
            case 'unlock': {
                if (!pin1) throw new Error('Podaj PIN');
                const key = await unlock(pin1);
                chatState.apiKey = key;
                const inp = document.getElementById('aiApiKey');
                if (inp) inp.value = key;
                hidePinModal();
                updateVaultUI();
                break;
            }
            case 'change': {
                if (!pin1) throw new Error('Podaj stary PIN');
                if (pin2.length < 4) throw new Error('Nowy PIN musi mieć co najmniej 4 znaki');
                await changePin(pin1, pin2);
                hidePinModal();
                updateVaultUI();
                break;
            }
        }
    } catch (e) {
        if (errorEl) {
            errorEl.textContent = e.message;
            errorEl.style.display = '';
        }
    }
}
