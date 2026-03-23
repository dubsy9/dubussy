const RATE_LIMIT_MAP = new Map();

// Constants for security validation
const MAX_IMAGE_SIZE_BASE64 = 5 * 1024 * 1024; // 5MB in base64
const MAX_MESSAGE_LENGTH = 4096;
const MAX_CONVERSATION_LENGTH = 50;
const VALID_IMAGE_PREFIXES = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,'];

// Static list of available cloud models - used for allowlist validation
const AVAILABLE_MODELS = [
    {name: 'devstral-small-2:24b-cloud', description: '', size: 'Cloud'},
    { name: 'qwen3.5:cloud', description: 'Qwen 3.5 - Alibaba\'s latest model', size: 'Cloud' },
    { name: 'nemotron-3-super:cloud', description: 'Nemotron 3 Super - NVIDIA\'s enterprise model', size: 'Cloud' },
    { name: 'mistral-large-3:675b-cloud', description: 'Mistral Large - Strong multilingual capabilities', size: 'Cloud' },
    { name: 'gemma3:27b-cloud', description: 'Gemma 3 - Google\'s lightweight performer', size: 'Cloud' },
];

// Default model is the first item in the available models array
const DEFAULT_MODEL = AVAILABLE_MODELS[0].name;

const ALLOWED_MODEL_NAMES = AVAILABLE_MODELS.map(m => m.name);

// Cleanup old rate limit entries periodically (every 100 calls)
function cleanupRateLimitMap() {
    const now = Date.now();
    if (RATE_LIMIT_MAP.size > 100 && Math.random() < 0.1) {
        for (const [key, record] of RATE_LIMIT_MAP) {
            if (now > record.resetTime) {
                RATE_LIMIT_MAP.delete(key);
            }
        }
    }
}

async function checkRateLimit(ip, action = 'chat') {
    const now = Date.now();
    // Different limits for different actions
    const limits = {
        'chat': { windowMs: 60_000, limit: 10 },
        'submit': { windowMs: 60_000, limit: 3 }, // Stricter limit for form submissions
    };
    
    const config = limits[action] || limits['chat'];
    const windowMs = config.windowMs;
    const limit = config.limit;
    
    cleanupRateLimitMap();
    
    const mapKey = `${ip}:${action}`;
    
    if (!RATE_LIMIT_MAP.has(mapKey)) {
        RATE_LIMIT_MAP.set(mapKey, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: limit - 1 };
    }
    
    const record = RATE_LIMIT_MAP.get(mapKey);
    
    if (now > record.resetTime) {
        RATE_LIMIT_MAP.set(mapKey, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: limit - 1 };
    }
    
    if (record.count >= limit) {
        return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
    }
    
    record.count++;
    return { allowed: true, remaining: limit - record.count };
}

// Security headers for all responses
function addSecurityHeaders(headers) {
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    return headers;
}

// Content Security Policy
const CSP_POLICY = "default-src 'self'; script-src 'self' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://ollama.com; form-action 'self'; base-uri 'self'; frame-ancestors 'none';";

function addCSPHeader(headers) {
    headers.set('Content-Security-Policy', CSP_POLICY);
    return headers;
}

// Validate and sanitize image data
function validateImageBase64(imageData) {
    if (!imageData || typeof imageData !== 'string') {
        return { valid: false, error: 'invalid_image_format' };
    }
    
    // Check if it starts with a valid data URI prefix
    const hasValidPrefix = VALID_IMAGE_PREFIXES.some(prefix => imageData.startsWith(prefix));
    if (!hasValidPrefix) {
        return { valid: false, error: 'invalid_image_format' };
    }
    
    // Check size
    if (imageData.length > MAX_IMAGE_SIZE_BASE64) {
        return { valid: false, error: 'image_too_large' };
    }
    
    // Basic validation that it's valid base64 after the prefix
    const base64Data = imageData.split(',')[1];
    if (!base64Data || !/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
        return { valid: false, error: 'invalid_base64' };
    }
    
    return { valid: true };
}

// Validate message content
function validateMessageContent(content) {
    if (typeof content === 'string') {
        if (content.length > MAX_MESSAGE_LENGTH) {
            return { valid: false, error: 'message_too_long' };
        }
        return { valid: true };
    }
    
    if (content && typeof content === 'object' && content.text) {
        if (content.text.length > MAX_MESSAGE_LENGTH) {
            return { valid: false, error: 'message_too_long' };
        }
        return { valid: true };
    }
    
    return { valid: false, error: 'invalid_message_format' };
}

// Validate model against allowlist
function validateModel(modelName) {
    if (!modelName || typeof modelName !== 'string') {
        return { valid: false, error: 'invalid_model' };
    }
    
    if (!ALLOWED_MODEL_NAMES.includes(modelName)) {
        return { valid: false, error: 'model_not_allowed' };
    }
    
    return { valid: true };
}

// Sanitize conversation history
function sanitizeConversationHistory(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return { valid: false, error: 'invalid_messages' };
    }
    
    if (messages.length > MAX_CONVERSATION_LENGTH) {
        return { valid: false, error: 'conversation_too_long' };
    }
    
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg || typeof msg !== 'object') {
            return { valid: false, error: 'invalid_message_format' };
        }
        
        if (!['user', 'assistant', 'system'].includes(msg.role)) {
            return { valid: false, error: 'invalid_role' };
        }
        
        const contentValidation = validateMessageContent(msg.content);
        if (!contentValidation.valid) {
            return { valid: false, error: contentValidation.error };
        }
    }
    
    return { valid: true };
}

// Security logging helper
function logSecurityEvent(event, details) {
    const timestamp = new Date().toISOString();
    console.log(`[SECURITY] ${timestamp} - ${event}:`, JSON.stringify({
        ...details,
        timestamp
    }));
}

// Validate origin header for CSRF protection
function validateOrigin(request) {
    const origin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');
    const host = request.headers.get('Host');
    
    // If we have an origin header, validate it
    if (origin) {
        try {
            const originUrl = new URL(origin);
            // Check if origin matches host (same site)
            if (originUrl.host !== host) {
                logSecurityEvent('ORIGIN_MISMATCH', { origin, host });
                return false;
            }
            return true;
        } catch (e) {
            logSecurityEvent('INVALID_ORIGIN', { origin });
            return false;
        }
    }
    
    // Fallback to Referer check if no Origin
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            if (refererUrl.host !== host) {
                logSecurityEvent('REFERER_MISMATCH', { referer, host });
                return false;
            }
            return true;
        } catch (e) {
            logSecurityEvent('INVALID_REFERER', { referer });
            return false;
        }
    }
    
    // No origin or referer - could be direct navigation or CSRF attempt
    // For API endpoints, we should require origin
    return false;
}

// Generate CSRF token from session
function generateCsrfToken(env, ip) {
    // Simple token generation using env secret and IP
    const secret = env.CSRF_SECRET || 'default-secret-change-me';
    const data = `${ip}-${secret}-${Date.now()}`;
    return btoa(unescape(encodeURIComponent(data)));
}

// Verify CSRF token
async function verifyCsrfToken(token, env, ip) {
    if (!token || typeof token !== 'string') {
        logSecurityEvent('CSRF_TOKEN_MISSING', { ip });
        return false;
    }
    try {
        // Verify format (basic check)
        if (token.length < 20 || token.length > 200) {
            logSecurityEvent('CSRF_TOKEN_INVALID_FORMAT', { ip, tokenLength: token.length });
            return false;
        }
        
        // Decode and verify structure
        const decoded = decodeURIComponent(escape(atob(token)));
        const parts = decoded.split('-');
        if (parts.length < 3) {
            logSecurityEvent('CSRF_TOKEN_INVALID_STRUCTURE', { ip });
            return false;
        }
        
        // Check timestamp (token valid for 15 minutes now)
        const tokenTime = parseInt(parts[2], 10);
        const now = Date.now();
        if (isNaN(tokenTime) || now - tokenTime > 900000) {
            logSecurityEvent('CSRF_TOKEN_EXPIRED', { ip, tokenAge: now - tokenTime });
            return false;
        }
        
        // Verify token exists in KV and IP matches
        const tokenKey = `csrf:${token}`;
        const storedData = await env.SITE_DATA.get(tokenKey);
        
        if (!storedData) {
            logSecurityEvent('CSRF_TOKEN_NOT_FOUND', { ip });
            return false; // Token not found or expired
        }
        
        const tokenData = JSON.parse(storedData);
        
        // IP binding check (strict mode)
        if (tokenData.ip !== ip) {
            logSecurityEvent('CSRF_IP_MISMATCH', { 
                storedIp: tokenData.ip, 
                requestIp: ip,
                timestamp: new Date(tokenData.createdAt).toISOString()
            });
            return false;
        }
        
        // Delete token after use (single-use)
        await env.SITE_DATA.delete(tokenKey);
        
        logSecurityEvent('CSRF_TOKEN_VALID', { ip });
        return true;
    } catch (e) {
        logSecurityEvent('CSRF_VERIFICATION_ERROR', { ip, error: e.message });
        return false;
    }
}

async function handleChatRequest(request, env, ip) {
    try {
        const data = await request.json();
        const { model, messages, image, stream } = data;

        // Validate model against allowlist
        const modelValidation = validateModel(model || DEFAULT_MODEL);
        if (!modelValidation.valid) {
            return new Response(JSON.stringify({ error: modelValidation.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const selectedModel = model || DEFAULT_MODEL;

        // Validate conversation history
        const historyValidation = sanitizeConversationHistory(messages);
        if (!historyValidation.valid) {
            return new Response(JSON.stringify({ error: historyValidation.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate image if provided
        if (image && typeof image === 'string' && image.length > 0) {
            const imageValidation = validateImageBase64(image);
            if (!imageValidation.valid) {
                return new Response(JSON.stringify({ error: imageValidation.error }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        const ollamaUrl = env.OLLAMA_API_URL || 'https://ollama.com';

        const ollamaRequest = {
            model: selectedModel,
            messages: messages,
            stream: stream === true
        };

        if (image && typeof image === 'string' && image.length > 0) {
            ollamaRequest.images = [image];
        }

        // Log request for security monitoring
        console.log('Chat request:', { ip, model: selectedModel, hasImage: !!image, messageCount: messages.length });

        if (stream === true) {
            // Streaming response - forward NDJSON directly
            const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.OLLAMA_TOKEN}`
                },
                body: JSON.stringify(ollamaRequest)
            });

            if (!ollamaResponse.ok) {
                console.error('Ollama API error:', ollamaResponse.status);
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
        const response = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OLLAMA_TOKEN}`
            },
            body: JSON.stringify(ollamaRequest)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Ollama error:', errorData);
            return new Response(JSON.stringify({ error: 'ollama_api_error' }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await response.json();

        return new Response(JSON.stringify({
            success: true,
            message: result.message?.content || ''
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
        // Return the curated list of available models
        return new Response(JSON.stringify({ 
            success: true,
            models: AVAILABLE_MODELS
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

async function handleCsrfTokenRequest(env, ip) {
    const token = generateCsrfToken(env, ip);
    
    // Store token in KV with 15 minute expiry (shorter = more secure)
    const tokenKey = `csrf:${token}`;
    const tokenData = JSON.stringify({ ip, createdAt: Date.now() });
    
    try {
        await env.SITE_DATA.put(tokenKey, tokenData, { expirationTtl: 900 });
    } catch (kvError) {
        console.error('KV storage error:', kvError);
        // Fallback: still return token but log the issue
    }
    
    return new Response(JSON.stringify({ csrfToken: token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function handleEmailSubmission(request, env, ip) {
    try {
        // Validate origin header to prevent certain types of CSRF attacks
        if (!validateOrigin(request)) {
            logSecurityEvent('SUBMIT_ORIGIN_VALIDATION_FAILED', { ip });
            return new Response(JSON.stringify({ error: 'invalid_origin' }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const data = await request.json();
        const email = data.email;
        const csrfToken = data.csrfToken;
        
        // Verify CSRF token (async KV lookup)
        if (!csrfToken || !(await verifyCsrfToken(csrfToken, env, ip))) {
            console.warn('CSRF validation failed for IP:', ip);
            return new Response(JSON.stringify({ error: 'invalid_csrf_token' }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Basic email validation
        if (!email || typeof email !== 'string') {
            return new Response(JSON.stringify({ error: 'email_required' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(JSON.stringify({ error: 'invalid_email_format' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Sanitize email (remove any potential XSS)
        const sanitizedEmail = email.replace(/[<>\"'&]/g, '');

        const discordApiBase = 'https://discord.com/api/v10';
        const botToken = env.DISCORD_BOT_TOKEN;
        const userId = env.DISCORD_USER_ID;

        // Validate required credentials
        if (!botToken || !userId) {
            console.error('Discord credentials not configured');
            return new Response(JSON.stringify({ error: 'service_not_configured' }), { 
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const createChannelResponse = await fetch(`${discordApiBase}/users/@me/channels`, {
            method: 'POST',
            headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: userId })
        });

        if (!createChannelResponse.ok) {
            console.error('Failed to create Discord channel:', createChannelResponse.status);
            throw new Error('Failed to create DM channel');
        }

        const channelData = await createChannelResponse.json();
        const dmChannelId = channelData.id;

        const sendMessageResponse = await fetch(`${discordApiBase}/channels/${dmChannelId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                content: `New access request from: ${sanitizedEmail}`,
                allowed_mentions: { parse: [] } // Disable mentions for security
            })
        });

        if (!sendMessageResponse.ok) {
            console.error('Failed to send Discord message:', sendMessageResponse.status);
            throw new Error('Failed to send DM');
        }

        // Log successful submission
        console.log('Email submission:', { ip, email: sanitizedEmail });

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Submission error:', error);
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
        
        // Get real IP from Cloudflare header, with fallback validation
        const ip = request.headers.get('CF-Connecting-IP');
        if (!ip) {
            console.warn('Missing CF-Connecting-IP header');
        }
        const clientIp = ip || 'unknown';

        // Handle OPTIONS for CORS preflight
        if (request.method === 'OPTIONS') {
            const headers = new Headers();
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'Content-Type');
            headers.set('Access-Control-Max-Age', '86400');
            addSecurityHeaders(headers);
            return new Response(null, { status: 204, headers });
        }

        // GET /api/corsf-token - Get CSRF token for form submissions
        if (path === '/api/csrf-token' && request.method === 'GET') {
            const response = await handleCsrfTokenRequest(env, clientIp);
            addSecurityHeaders(response.headers);
            addCSPHeader(response.headers);
            return response;
        }

        // POST /submit - Email submission with rate limiting and CSRF protection
        if (path === '/submit' && request.method === 'POST') {
            // Check rate limit for form submissions
            const rateLimitResult = await checkRateLimit(clientIp, 'submit');
            if (!rateLimitResult.allowed) {
                return new Response(JSON.stringify({ 
                    error: 'rate_limit_exceeded',
                    retryAfter: rateLimitResult.retryAfter 
                }), { 
                    status: 429,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Retry-After': String(rateLimitResult.retryAfter)
                    } 
                });
            }

            return handleEmailSubmission(request, env, clientIp);
        }

        // POST /api/chat - Chat endpoint with rate limiting
        if (path === '/api/chat' && request.method === 'POST') {
            // Check rate limit
            const rateLimitResult = await checkRateLimit(clientIp, 'chat');
            if (!rateLimitResult.allowed) {
                return new Response(JSON.stringify({ 
                    error: 'rate_limit_exceeded',
                    retryAfter: rateLimitResult.retryAfter 
                }), { 
                    status: 429,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Retry-After': String(rateLimitResult.retryAfter)
                    } 
                });
            }

            if (!env.OLLAMA_TOKEN) {
                return new Response(JSON.stringify({ error: 'ollama_not_configured' }), { 
                    status: 503,
                    headers: { 'Content-Type': 'application/json' } 
                });
            }

            const response = await handleChatRequest(request, env, clientIp);
            addSecurityHeaders(response.headers);
            addCSPHeader(response.headers);
            return response;
        }

        // GET /api/models - Models endpoint
        if (path === '/api/models' && request.method === 'GET') {
            if (!env.OLLAMA_TOKEN) {
                return new Response(JSON.stringify({ error: 'ollama_not_configured' }), { 
                    status: 503,
                    headers: { 'Content-Type': 'application/json' } 
                });
            }

            const response = await handleModelsRequest(env);
            addSecurityHeaders(response.headers);
            addCSPHeader(response.headers);
            return response;
        }

        // GET /api/config - Config endpoint
        if (path === '/api/config' && request.method === 'GET') {
            const response = new Response(JSON.stringify({
                defaultModel: DEFAULT_MODEL,
                apiUrl: env.OLLAMA_API_URL || null
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                }
            });
            addSecurityHeaders(response.headers);
            addCSPHeader(response.headers);
            return response;
        }

        // Serve static assets
        const response = await env.ASSETS.fetch(request);
        if (response.status === 200) {
            // Create a new mutable Headers object to avoid immutable headers issue
            const newHeaders = new Headers();
            // Copy content-type from original response
            const contentType = response.headers.get('content-type');
            if (contentType) {
                newHeaders.set('content-type', contentType);
            }
            addSecurityHeaders(newHeaders);
            addCSPHeader(newHeaders);
            return new Response(response.body, {
                status: response.status,
                headers: newHeaders
            });
        }
        return response;
    }
};