export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/submit' && request.method === 'POST') {
            try {
            const data = await request.json();
            const email = data.email;
            
            if (!email) {
                return new Response(JSON.stringify({ error: 'email_required' }), { status: 400 });
            }

            const discordApiBase = 'https://discord.com/api/v10';
            const botToken = env.DISCORD_BOT_TOKEN;
            const userId = env.DISCORD_USER_ID;

            const createChannelResponse = await fetch(`${discordApiBase}/users/@me/channels`, {
                method: 'POST',
                headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_id: userId })
            });

            if (!createChannelResponse.ok) throw new Error('Failed to create DM channel');

            const channelData = await createChannelResponse.json();
            const dmChannelId = channelData.id;

            const sendMessageResponse = await fetch(`${discordApiBase}/channels/${dmChannelId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `New access request from: ${email}` })
            });

            if (!sendMessageResponse.ok) throw new Error('Failed to send DM');

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error(error);
            return new Response(JSON.stringify({ error: error.message }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        }

        return env.ASSETS.fetch(request);
    }
};
