<script type="module">
    import {createChat} from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';
    window.loadBot = function(name, url, btnElement) {
            const container = document.getElementById('chat-container');
    container.innerHTML = '';
    if(btnElement) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
            }
    createChat({
        webhookUrl: url,
    target: '#chat-container',
    mode: 'fullscreen',
    showWelcomeScreen: true,
    initialMessages: [`Hi! I'm ${name}. What's on your mind?`],
    i18n: {en: {title: name, subtitle: 'Online' } },
            });
        };
    loadBot('Basic Bitch', 'https://n8n.dubussy.com/webhook/3d3a3ef1-80b4-4e08-9c7a-29ddd483e41f/chat');
</script>