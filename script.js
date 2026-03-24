let currentModel = '';
let conversationHistory = [];
let currentImage = null;

const ERROR_MESSAGES = {
    invalid_request: 'Invalid request. Please try again.',
    message_content_required: 'Message could not be processed. Please try again.',
    ollama_api_error: 'AI service temporarily unavailable. Please try again in a moment.',
    internal_error: 'Something went wrong on our end. Please try again.',
    rate_limit_exceeded: 'Too many requests. Please wait a moment before trying again.',
    ollama_not_configured: 'AI service is not configured. Please contact support.',
    no_default_model: 'No default model configured. Please check configuration.',
};

function getErrorMessage(errorCode) {
    return ERROR_MESSAGES[errorCode] || 'Something went wrong. Please try again.';
}

async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Failed to fetch config');
        }
        return await response.json();
    } catch (error) {
        console.error('Config fetch error:', error);
        return { defaultModel: null, apiUrl: null };
    }
}

async function fetchModels() {
    try {
        const response = await fetch('/api/models');
        if (!response.ok) {
            throw new Error('Failed to fetch models');
        }
        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error('Models fetch error:', error);
        return [];
    }
}

function populateModelSelector(models, defaultModel) {
    const selector = document.getElementById('model-selector');
    if (!selector) return;

    // Clear existing options
    selector.innerHTML = '';

    if (!models || models.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        selector.appendChild(option);
        return;
    }

    // Add each model as an option (only show name, not description)
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        selector.appendChild(option);
    });

    // Set default model if provided, otherwise use first model
    // Ensure the model actually exists in the list
    let selectedModel = defaultModel;
    if (selectedModel && !models.some(m => m.name === selectedModel)) {
        selectedModel = null;
    }
    if (!selectedModel) {
        selectedModel = models[0].name;
    }
    currentModel = selectedModel;
    selector.value = currentModel;

    // Update description for the selected model
    updateModelDescription(models, currentModel);

    // Listen for changes
    selector.addEventListener('change', (e) => {
        currentModel = e.target.value;
        updateModelDescription(models, currentModel);
        console.log('Model changed to:', currentModel);
    });
}

function updateModelDescription(models, modelName) {
    const descriptionEl = document.getElementById('model-description');
    if (!descriptionEl) return;

    const model = models.find(m => m.name === modelName);
    if (model) {
        descriptionEl.textContent = model.description;
    } else {
        descriptionEl.textContent = '';
    }
}

async function initModel() {
    const [config, models] = await Promise.all([fetchConfig(), fetchModels()]);
    populateModelSelector(models, config.defaultModel);
    console.log('Loaded config:', config);
    console.log('Available models:', models);
}

async function sendMessage(message, imageBase64 = null) {
    const input = document.getElementById('chat-input');

    if (!message.trim() && !imageBase64) return;

    const userMessage = { role: 'user', content: message };
    conversationHistory.push(userMessage);

    appendMessageToChat('user', message, imageBase64);

    input.value = '';
    currentImage = null;
    toggleFilePreview(false);

    const loadingDiv = appendLoadingMessage();

    let thinkingContent = '';

    try {
        const payload = {
            model: currentModel,
            messages: conversationHistory,
            stream: true
        };

        if (imageBase64) {
            payload.image = imageBase64;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            removeMessage(loadingDiv);
            appendMessageToChat('bot', getErrorMessage(data.error), true);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botContent = '';
        let buffer = '';

        removeMessage(loadingDiv);

        // Create bot message shell for incremental updates
        const botDiv = document.createElement('div');
        botDiv.className = 'chat-message bot';
        botDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <span class="streaming-content"></span>
                <span class="message-time">${formatTime(new Date())}</span>
            </div>
        `;
        const contentSpan = botDiv.querySelector('.streaming-content');
        let thinkingSpan = null;
        document.getElementById('chat-container').appendChild(botDiv);
        document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const chunk = JSON.parse(line);
                    if (chunk.message && chunk.message.thinking) {
                        thinkingContent += chunk.message.thinking;
                        // Create thinking block only when first thinking content is received
                        if (!thinkingSpan) {
                            const thinkingDiv = document.createElement('div');
                            thinkingDiv.className = 'thinking-content';
                            contentSpan.parentNode.insertBefore(thinkingDiv, contentSpan);
                            thinkingSpan = thinkingDiv;
                        }
                        thinkingSpan.textContent = thinkingContent.trim();
                        document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
                    }
                    if (chunk.message && chunk.message.content) {
                        botContent += chunk.message.content;
                        contentSpan.textContent = botContent;
                        document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
                    }
                } catch (e) {
                    // Skip malformed JSON lines
                }
            }
        }

        // Final message
        if (botContent) {
            conversationHistory.push({ role: 'assistant', content: botContent });
            // Replace span with final escaped HTML
            contentSpan.outerHTML = escapeHtml(botContent);
        } else {
            // Remove empty bot message if no content was received
            removeMessage(botDiv);
        }

        // Handle done: true final chunk with any remaining buffer
        if (buffer.trim()) {
            try {
                const chunk = JSON.parse(buffer);
                if (chunk.message && chunk.message.content && !botContent.includes(chunk.message.content)) {
                    botContent += chunk.message.content;
                    contentSpan.textContent = botContent;
                }
            } catch (e) {
                // Ignore final parse error
            }
        }

    } catch (error) {
        console.error('Chat error:', error);
        removeMessage(loadingDiv);
        appendMessageToChat('bot', 'Connection error. Please check your internet and try again.', true);
    }
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function appendMessageToChat(role, content, isError = false) {
    const container = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    const avatar = role === 'user' ? '👤' : '🤖';
    const errorClass = isError ? ' error' : '';
    const time = formatTime(new Date());

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content${errorClass}">${escapeHtml(content)}<span class="message-time">${time}</span></div>
    `;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function appendLoadingMessage() {
    const container = document.getElementById('chat-container');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message bot loading';
    loadingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">Thinking...<span class="message-time">${formatTime(new Date())}</span></div>
    `;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
    return loadingDiv;
}

function removeMessage(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


function toggleFilePreview(show) {
    const attachBtn = document.getElementById('attach-btn');
    const sendBtn = document.getElementById('send-btn');
    
    if (attachBtn) {
        attachBtn.classList.toggle('active', show);
    }
    
    if (sendBtn) {
        sendBtn.style.opacity = show ? '1' : '0.5';
    }
}

async function handleFileSelect(file) {
    if (!file) return;
    
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (PNG, JPG, WEBP)');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImage = e.target.result;
        toggleFilePreview(true);
    };
    reader.readAsDataURL(file);
}

function clearChat() {
    conversationHistory = [];
    currentImage = null;
    const container = document.getElementById('chat-container');
    if (container) {
        container.innerHTML = '<div class="chat-message bot"><div class="message-avatar">🤖</div><div class="message-content">Chat cleared. How can I help you?<span class="message-time">' + formatTime(new Date()) + '</span></div></div>';
    }
    toggleFilePreview(false);
}

function setupEventListeners() {
    const fileInput = document.getElementById('file-input');
    const attachBtn = document.getElementById('attach-btn');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-btn');
    const chatInput = document.getElementById('chat-input');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');

    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearChat);
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFileSelect(e.target.files[0]);
        });
    }
    
    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            sendMessage(chatInput.value, currentImage);
        });
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(chatInput.value, currentImage);
            }
        });
        
        // Update send button opacity based on text content
        chatInput.addEventListener('input', () => {
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) {
                const hasContent = chatInput.value.trim().length > 0 || currentImage !== null;
                sendBtn.style.opacity = hasContent ? '1' : '0.5';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initModel();
    setupEventListeners();

    const container = document.getElementById('chat-container');
    if (container) {
        container.innerHTML = '<div class="chat-message bot"><div class="message-avatar">🤖</div><div class="message-content">Hello! I support vision with image uploads. How can I help you?<span class="message-time">' + formatTime(new Date()) + '</span></div></div>';
        // Scroll to bottom so new message appears at bottom
        container.scrollTop = container.scrollHeight;
    }
});
