export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/submit' && request.method === 'POST') {
            try {
                const formData = await request.formData();
                const email = formData.get('email');
                if (!email) {
                    return Response.redirect('/request?error=email_required', 302);
                }
                const discordApiBase = 'https://discord.com/api/v10';
                const botToken = env.DISCORD_BOT_TOKEN;  // Your secret
                const userId = env.DISCORD_USER_ID;      // Optional var if needed
                const createChannelResponse = await fetch(`${discordApiBase}/users/@me/channels`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipient_id: userId })
                });
                if (!createChannelResponse.ok) {
                    throw new Error('Failed to create DM channel');
                }
                const channelData = await createChannelResponse.json();
                const dmChannelId = channelData.id;
                const message = { content: `New access request from: ${email}` };
                const sendMessageResponse = await fetch(`${discordApiBase}/channels/${dmChannelId}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(message)
                });
                if (!sendMessageResponse.ok) {
                    throw new Error('Failed to send DM');
                }
                return Response.redirect('/thanks', 302);  // Redirect on success
            } catch (error) {
                console.error(error);
                return Response.redirect('/request?error=processing_failed', 302);
            }
        }

        // Serve static assets for other paths (e.g., /request, /thanks)
        return env.ASSETS.fetch(request);
    }
};