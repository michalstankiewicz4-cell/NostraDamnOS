// AI Chat Assistant - Client-side chat with database queries
// Supports: OpenAI, Anthropic Claude, Google Gemini

import { db2 } from './database-v2.js';

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
        keyPlaceholder: 'sk-...'
    },
    claude: {
        name: 'Anthropic Claude',
        apiUrl: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-5-sonnet-20241022',
        keyLink: 'https://console.anthropic.com/settings/keys',
        keyPlaceholder: 'sk-ant-...'
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
    
    console.log('[AI Chat] Initialized');
}

/**
 * Toggle chat window
 */
export function toggleChatWindow() {
    const chatWindow = document.getElementById('aiChatWindow');
    if (!chatWindow) return;
    
    chatState.isOpen = !chatState.isOpen;
    chatWindow.style.display = chatState.isOpen ? 'flex' : 'none';
    
    if (chatState.isOpen) {
        // Focus on input
        const input = document.getElementById('chatInput');
        if (input) input.focus();
    }
}

/**
 * Setup event listeners
 */
function setupChatEventListeners() {
    // Toggle button
    const toggleBtn = document.getElementById('aiChatBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleChatWindow);
    }
    
    // Close button
    const closeBtn = document.getElementById('closeChatBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', toggleChatWindow);
    }
    
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
    
    // API Key input
    const apiKeyInput = document.getElementById('aiApiKey');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', (e) => {
            chatState.apiKey = e.target.value;
            saveChatPreferences();
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
    const apiKeyLink = document.getElementById('apiKeyLink');
    const apiKeyInput = document.getElementById('aiApiKey');
    
    if (apiKeyLink) {
        apiKeyLink.href = config.keyLink;
        apiKeyLink.textContent = `Wygeneruj klucz dla ${config.name}`;
    }
    
    if (apiKeyInput) {
        apiKeyInput.placeholder = config.keyPlaceholder;
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
    
    if (!chatState.apiKey) {
        addMessageToChat('system', '⚠️ Proszę podać klucz API');
        return;
    }
    
    if (chatState.isProcessing) {
        return;
    }
    
    // Add user message
    addMessageToChat('user', message);
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
    
    if (chatState.selectedModel === 'openai') {
        response = await callOpenAI(systemPrompt, userMessage, config);
    } else if (chatState.selectedModel === 'claude') {
        response = await callClaude(systemPrompt, userMessage, config);
    } else if (config.provider === 'gemini') {
        response = await callGemini(systemPrompt, userMessage, config);
    }
    
    // Check if response contains SQL query
    const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch) {
        const sql = sqlMatch[1];
        console.log('[AI Chat] Executing SQL:', sql);
        
        try {
            const results = db2.database.exec(sql);
            const formattedResults = formatSQLResults(results);
            response += '\n\n**Wyniki zapytania:**\n' + formattedResults;
        } catch (error) {
            response += `\n\n❌ Błąd wykonania SQL: ${error.message}`;
        }
    }
    
    return response;
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
 * Save preferences to localStorage
 */
function saveChatPreferences() {
    localStorage.setItem('aiChat_model', chatState.selectedModel);
    localStorage.setItem('aiChat_apiKey', chatState.apiKey);
    localStorage.setItem('aiChat_favorites', JSON.stringify(chatState.favoriteModels));
    localStorage.setItem('aiChat_showAllModels', chatState.showAllModels.toString());
}

/**
 * Load preferences from localStorage
 */
function loadChatPreferences() {
    const savedModel = localStorage.getItem('aiChat_model');
    const savedKey = localStorage.getItem('aiChat_apiKey');
    const savedFavorites = localStorage.getItem('aiChat_favorites');
    const savedShowAll = localStorage.getItem('aiChat_showAllModels');
    
    if (savedModel && MODEL_CONFIG[savedModel]) {
        chatState.selectedModel = savedModel;
        const modelSelect = document.getElementById('aiModelSelect');
        if (modelSelect) modelSelect.value = savedModel;
    }
    
    if (savedKey) {
        chatState.apiKey = savedKey;
        const apiKeyInput = document.getElementById('aiApiKey');
        if (apiKeyInput) apiKeyInput.value = savedKey;
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

// Export for global access
window.toggleAIChat = toggleChatWindow;
