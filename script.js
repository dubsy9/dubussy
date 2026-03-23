let currentModel = '';
let conversationHistory = [];
let currentImage = null;

const MODEL_DEFAULT = window.DEFAULT_MODEL || 'llama-3.2-1b-instruct';

async function fetchModels() {
    const selector = document.getElementById('model-selector');
    
    if (!selector) return;
    
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        
        if (data.success && data.models.length > 0) {
            selector.innerHTML = data.models
                .map((m, i) => `<option value="${m.name}" ${i === 0 ? 'selected' : ''}>${m.name}</option>`)
                .join('');
            currentModel = data.models[0].name;
        } else {
            selector.innerHTML = '<option value="">No models available</option>';
        }
    } catch (error) {
        console.error('Failed to fetch models:', error);
        selector.innerHTML = '<option value="">Error loading models</option>';
    }
}

async function sendMessage(message, imageBase64 = null) {
    const container = document.getElementById('chat-container');
    const input = document.getElementById('chat-input');
    
    if (!message.trim() && !imageBase64) return;
    
    const userMessage = { role: 'user', content: message };
    conversationHistory.push(userMessage);
    
    appendMessageToChat('user', message, imageBase64);
    
    input.value = '';
    currentImage = null;
    toggleFilePreview(false);
    
    const loadingDiv = appendLoadingMessage();
    
    try {
        const payload = {
            model: currentModel,
            messages: conversationHistory
        };
        
        if (imageBase64) {
            payload.image = imageBase64;
        }
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            const botMessage = { role: 'assistant', content: data.message };
            conversationHistory.push(botMessage);
            
            removeMessage(loadingDiv);
            appendMessageToChat('bot', data.message);
        } else {
            removeMessage(loadingDiv);
            appendMessageToChat('bot', `Error: ${data.error || 'Something went wrong'}`, true);
        }
    } catch (error) {
        console.error('Chat error:', error);
        removeMessage(loadingDiv);
        appendMessageToChat('bot', 'Connection error. Please try again.', true);
    }
}

function appendMessageToChat(role, content, isError = false) {
    const container = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const avatar = role === 'user' ? '👤' : '🤖';
    const errorClass = isError ? ' error' : '';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content${errorClass}">${escapeHtml(content)}</div>
    `;
    
    container.appendChild(messageDiv);
    scrollToBottom();
}

function appendLoadingMessage() {
    const container = document.getElementById('chat-container');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message bot loading';
    loadingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">Thinking...</div>
    `;
    container.appendChild(loadingDiv);
    scrollToBottom();
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

function scrollToBottom() {
    const container = document.getElementById('chat-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function toggleFilePreview(show) {
    const btn = document.getElementById('send-btn');
    if (!btn) return;
    
    if (show) {
        btn.style.opacity = '1';
    } else {
        btn.style.opacity = '0.5';
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

function setupEventListeners() {
    const modelSelector = document.getElementById('model-selector');
    const fileInput = document.getElementById('file-input');
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (modelSelector) {
        modelSelector.addEventListener('change', (e) => {
            currentModel = e.target.value;
            conversationHistory = [];
            const container = document.getElementById('chat-container');
            if (container) {
                container.innerHTML = '<div class="chat-message bot"><div class="message-avatar">🤖</div><div class="message-content">Model changed. Conversation reset.</div></div>';
            }
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFileSelect(e.target.files[0]);
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
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchModels();
    setupEventListeners();
    
    const container = document.getElementById('chat-container');
    if (container) {
        container.innerHTML = '<div class="chat-message bot"><div class="message-avatar">🤖</div><div class="message-content">Hello! Select a model to get started. I support vision/models with image uploads.</div></div>';
    }
});
