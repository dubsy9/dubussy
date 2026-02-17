import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

window.loadBot = function (name, url, btnElement) {
    const container = document.getElementById('chat-container');

    container.innerHTML = '';

    if (btnElement) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    createChat({
        webhookUrl: url,
        target: '#chat-container',
        mode: 'fullscreen',
        showWelcomeScreen: true,
        initialMessages: [`Hi! I'm the ${name} assistant. How can I help you today?`],
        i18n: {
            en: {
                title: name,
                subtitle: 'Online',
                getStarted: 'New Conversation',
                inputPlaceholder: 'Type your message...'
            }
        }
    });
};

window.addEventListener('DOMContentLoaded', () => {
    loadBot(
        'General',
        'https://n8n.dubussy.com/webhook/f070f65e-7066-4e43-87fa-eb8a5d92d886/chat',
        document.querySelector('.nav-item.active')
    );
});