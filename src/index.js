const RATE_LIMIT_MAP = new Map();

async function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 10;
    
    // Cleanup old entries periodically (every 100 calls)
    if (RATE_LIMIT_MAP.size > 100 && Math.random() < 0.1) {
        for (const [key, record] of RATE_LIMIT_MAP) {
            if (now > record.resetTime) {
                RATE_LIMIT_MAP.delete(key);
            }
        }
    }
    
    if (!RATE_LIMIT_MAP.has(ip)) {
        RATE_LIMIT_MAP.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }
    
    const record = RATE_LIMIT_MAP.get(ip);
    
    if (now > record.resetTime) {
        RATE_LIMIT_MAP.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }
    
    if (record.count >= limit) {
        return false;
    }
    
    record.count++;
    return true;
}

async function handleChatRequest(request, env) {
    try {
        const data = await request.json();
        const { model, messages, image, stream } = data;

        // Use provided model or fall back to DEFAULT_MODEL env var
        const selectedModel = model || env.DEFAULT_MODEL;

        if (!selectedModel) {
            return new Response(JSON.stringify({ error: 'no_model_specified' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'invalid_request' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const latestMessage = messages[messages.length - 1];
        if (!latestMessage.content || (typeof latestMessage.content !== 'string' && !latestMessage.content.text)) {
            return new Response(JSON.stringify({ error: 'message_content_required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const ollamaUrl = env.OLLAMA_API_URL || 'https://api.ollama.com/v1';

        const ollamaRequest = {
            model: selectedModel,
            messages: messages,
            stream: stream === true
        };

        if (image && typeof image === 'string' && image.length > 0) {
            ollamaRequest.images = [image];
        }

        if (stream === true) {
            // Streaming response - forward NDJSON directly
            const ollamaResponse = await fetch(`${ollamaUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.OLLAMA_TOKEN}`
                },
                body: JSON.stringify(ollamaRequest)
            });

            if (!ollamaResponse.ok) {
                return new Response(JSON.stringify({ error: 'ollama_api_error' }), {
                    status: 502,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(ollamaResponse.body, {
                headers: {
                    'Content-Type': 'application/x-ndjson',
                    'Transfer-Encoding': 'chunked'
                }
            });
        }

        // Non-streaming response
        const response = await fetch(`${ollamaUrl}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OLLAMA_TOKEN}`
            },
            body: JSON.stringify(ollamaRequest)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return new Response(JSON.stringify({ error: 'ollama_api_error' }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await response.json();

        return new Response(JSON.stringify({
            success: true,
            message: result.message.content
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Chat error:', error);
        return new Response(JSON.stringify({ error: 'internal_error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleModelsRequest(env) {
    try {
        const ollamaUrl = env.OLLAMA_API_URL || 'https://api.ollama.com/v1';
        
        const response = await fetch(`${ollamaUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${env.OLLAMA_TOKEN}`
            }
        });

        if (!response.ok) {
            return new Response(JSON.stringify({ error: 'models_fetch_failed' }), { 
                status: 502,
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const result = await response.json();
        
        return new Response(JSON.stringify({ 
            success: true,
            models: result.models || []
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Models fetch error:', error);
        return new Response(JSON.stringify({ error: 'internal_error' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

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
                return new Response(JSON.stringify({ error: 'internal_error' }), { 
                    status: 500,
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
        }

        if (path === '/api/chat' && request.method === 'POST') {
            if (!(await checkRateLimit(ip))) {
                return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { 
                    status: 429,
                    headers: { 'Content-Type': 'application/json' } 
                });
            }

            if (!env.OLLAMA_TOKEN) {
                return new Response(JSON.stringify({ error: 'ollama_not_configured' }), { 
                    status: 503,
                    headers: { 'Content-Type': 'application/json' } 
                });
            }

            return handleChatRequest(request, env);
        }

        if (path === '/api/models' && request.method === 'GET') {
            if (!env.OLLAMA_TOKEN) {
                return new Response(JSON.stringify({ error: 'ollama_not_configured' }), { 
                    status: 503,
                    headers: { 'Content-Type': 'application/json' } 
                });
            }

            return handleModelsRequest(env);
        }

        if (path === '/api/config' && request.method === 'GET') {
            return new Response(JSON.stringify({
                defaultModel: env.DEFAULT_MODEL || null,
                apiUrl: env.OLLAMA_API_URL || null
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                }
            });
        }

        return env.ASSETS.fetch(request);
    }
};
