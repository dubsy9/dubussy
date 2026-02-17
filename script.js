import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

window.loadBot = async function (name, url, btnElement) {
    const container = document.getElementById('chat-container');

    // 1. Fetch Cloudflare Identity
    let userMetadata = {};
    try {
        const response = await fetch('/cdn-cgi/access/get-identity');
        if (response.ok) {
            const data = await response.json();
            userMetadata = {
                userEmail: data.email,
                userName: data.name
            };
            console.log("Authenticated as:", data.email);
        }
    } catch (err) {
        console.warn("Could not fetch Cloudflare identity", err);
    }

    // Clear old chat
    container.innerHTML = '';

    // Update UI buttons
    if (btnElement) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    // 2. Initialize Chat
    createChat({
        webhookUrl: url,
        target: '#chat-container',
        mode: 'fullscreen', // Fills the #chat-container div
        metadata: userMetadata,
        showWelcomeScreen: false, // Set to TRUE if you want the big "Hi!" box
        initialMessages: [
            `Hello! I'm ${name}. How can I help you?`
        ],
        i18n: {
            en: {
                title: '', // Empty title to hide header text
                subtitle: '', // Empty subtitle
                inputPlaceholder: 'Send a message...'
            }
        },
        // These style overrides help inject CSS variables directly into the shadow DOM
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
        'https://n8n.dubussy.com/webhook/f070f65e-7066-4e43-87fa-eb8a5d92d886/chat',
        document.querySelector('.nav-item.active')
    );
});