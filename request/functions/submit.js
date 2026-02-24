export default {
    async fetch(request, env, ctx) {
        if (request.method === 'POST') {
            try {
                const formData = await request.formData();
                const email = formData.get('email');

                if (!email) {
                    return new Response('Email is required', { status: 400 });
                }

                const discordApiBase = 'https://discord.com/api/v10';
                const botToken = env.DISCORD_BOT_TOKEN;
                const userId = env.DISCORD_USER_ID; 

                const createChannelResponse = await fetch(`${discordApiBase}/users/@me/channels`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ recipient_id: userId })
                });

                if (!createChannelResponse.ok) {
                    throw new Error('Failed to create DM channel');
                }

                const channelData = await createChannelResponse.json();
                const dmChannelId = channelData.id;

                const message = {
                    content: `New access request from: ${email}`
                };

                const sendMessageResponse = await fetch(`${discordApiBase}/channels/${dmChannelId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(message)
                });

                if (!sendMessageResponse.ok) {
                    throw new Error('Failed to send DM');
                }

                return Response.redirect('/thanks', 302);

            } catch (error) {
                console.error(error);
                return new Response('Error processing request', { status: 500 });
            }
        }

        return new Response('Method not allowed', { status: 405 });
    }
};