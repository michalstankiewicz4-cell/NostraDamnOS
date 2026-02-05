// AI Chat Assistant - Client-side chat with database queries
// Supports: OpenAI, Anthropic Claude, Google Gemini

import { db2 } from './database-v2.js';

// State
const chatState = {
    isOpen: false,
    selectedModel: 'openai', // 'openai', 'claude', 'gemini'
    apiKey: '',
    messages: [],
    isProcessing: false
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
    gemini: {
        name: 'Google Gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        model: 'gemini-pro',
        keyLink: 'https://makersuite.google.com/app/apikey',
        keyPlaceholder: 'AIza...'
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
    } else if (chatState.selectedModel === 'gemini') {
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
}

/**
 * Load preferences from localStorage
 */
function loadChatPreferences() {
    const savedModel = localStorage.getItem('aiChat_model');
    const savedKey = localStorage.getItem('aiChat_apiKey');
    
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
    
    updateModelUI();
}

// Export for global access
window.toggleAIChat = toggleChatWindow;
