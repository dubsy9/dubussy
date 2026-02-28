import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

window.loadBot = async function (name, url, btnElement) {
    const container = document.getElementById('chat-container');

    let userMetadata = {};
    try {
        const response = await fetch('/cdn-cgi/access/get-identity');
        if (response.ok) {
            const data = await response.json();
            userMetadata = {
                userEmail: data.email,
            };
            console.log("Authenticated as:", data.email);
        }
    } catch (err) {
        console.warn("Could not fetch Cloudflare identity", err);
    }

    container.innerHTML = '';

    if (btnElement) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    createChat({
        webhookUrl: url,
        target: '#chat-container',
        mode: 'fullscreen',
        metadata: userMetadata,
        initialMessages: [
            'Hi there! 👋'
        ],
        i18n: {
            en: {
                title: '', 
                subtitle: '',
                inputPlaceholder: 'Send a message...'
            }
        },
        style: {
            width: '100%',
            height: '100%',
            position: 'relative',
            backgroundColor: 'transparent',
        }
    });
};

window.addEventListener('DOMContentLoaded', () => {
    loadBot(
        'General',
        'https://n8n.dubussy.com/webhook/243c0064-8477-47e9-802a-97f27c7550d7/chat',
        document.querySelector('.nav-item.active')
    );
});