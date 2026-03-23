# Dubussy's Paradise

AI-powered web application built with Cloudflare Pages and Workers. Features customizable Ollama cloud models with vision support and access request system.

Includes a `/request` page for users to submit access requests that are sent to Discord via DM.

## Features

- **AI Chat Assistant** - Custom chat UI powered by Ollama Cloud API with multiple model selection
- **Vision Support** - Upload images (PNG, JPG, WEBP) for multimodal model interactions
- **Model Selection** - Choose from available Ollama cloud models via dropdown selector
- **Conditional Thinking Display** - Thinking block only shown when model provides reasoning content
- **Rate Limiting** - 10 requests per minute per IP for `/api/chat`, 3 per minute for `/submit`
- **Request System** - Email submission form with CSRF protection that sends notifications to Discord
- **Security** - Comprehensive security headers, input validation, and origin verification
- **Static Site** - HTML/CSS/JS frontend served via Cloudflare Pages

## Tech Stack

- Cloudflare Pages (static asset hosting)
- Cloudflare Workers (API endpoints and form handling)
- Ollama Cloud API (AI models)
- Vanilla JavaScript

## Architecture

### Frontend
- Single-page application with sidebar navigation
- Custom chat interface (no external chat framework)
- Model selector dropdown for Ollama models
- File upload for vision models (5MB limit, image types only)
- Streaming responses with thinking content display

### Backend (Cloudflare Worker)
- `/api/chat` - POST endpoint for AI chat conversations
- `/api/models` - GET endpoint to fetch available Ollama models
- `/api/csrf-token` - GET endpoint for CSRF token generation
- `/submit` - POST endpoint for access requests (sends to Discord)

### Additional Pages
- `/request` - Access request form with email submission
- `/thanks` - Confirmation page after submitting request

## Environment Variables (Configure in Cloudflare Dashboard)

Required:
```env
OLLAMA_API_URL=https://ollama.com
OLLAMA_TOKEN=your_ollama_cloud_api_key
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_USER_ID=your_user_id
CSRF_SECRET=your_csrf_secret_key
```

Optional:
- `SITE_DATA` - KV namespace binding ID (configured in wrangler.jsonc)

## Deployment

This project uses Cloudflare Pages with a single Cloudflare Worker (configured via `wrangler.jsonc` with `run_worker_first: true`). No manual build step required.

1. Push changes to main branch
2. Cloudflare Pages automatically rebuilds and deploys
3. Configure environment variables in Cloudflare Dashboard
4. The Worker handles `/api/*` routes automatically; static assets are served for all other routes

## Getting Started

1. Fork/clone this repository
2. Create a Cloudflare Pages project
3. Connect to your Git repository
4. Configure environment variables in project settings
5. Configure Ollama Cloud API key and Discord credentials

## API Endpoints

### `GET /api/models`
Fetch list of available Ollama models.

**Response:**
```json
{
  "success": true,
  "models": [
    { "name": "devstral-small-2:24b-cloud", "description": "Small and effective model", "size": "Cloud" },
    { "name": "qwen3.5:cloud", "description": "Alibaba's latest model", "size": "Cloud" },
    { "name": "nemotron-3-super:cloud", "description": "NVIDIA's enterprise model", "size": "Cloud" },
    { "name": "mistral-large-3:675b-cloud", "description": "Strong multilingual capabilities", "size": "Cloud" },
    { "name": "gemma3:27b-cloud", "description": "Google's lightweight performer", "size": "Cloud" }
  ]
}
```

### `GET /api/csrf-token`
Fetch CSRF token for form submissions.

**Response:**
```json
{
  "csrfToken": "base64_encoded_token"
}
```

### `POST /api/chat`
Send message to Ollama model.

**Request Body:**
```json
{
  "model": "devstral-small-2:24b-cloud",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "image": "base64_encoded_image_string",
  "stream": true
}
```

**Response (streaming):**
```
{"message":{"thinking":"I'm analyzing this request..."}}
{"message":{"content":"Hello! How can I help you today?"}}
{"done":true,"total_duration":1234567890}
```

**Response (non-streaming):**
```json
{
  "success": true,
  "message": "Hello! How can I help you today?"
}
```

### `POST /submit`
Submit access request email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "csrfToken": "csrf_token_here"
}
```

**Response:**
```json
{
  "success": true
}
```

## File Upload Support

- Maximum file size: 5MB
- Supported formats: PNG, JPG, WEBP
- Images are converted to base64 and sent with the chat request
- Vision-capable models will process images in the conversation

## Security Features

- **Input Validation:** Message length limits (4096 chars), image size checks (5MB), model allowlist
- **CSRF Protection:** Token-based validation with IP binding and single-use tokens
- **Origin Verification:** Validates Origin/Referer headers to prevent CSRF
- **Rate Limiting:** Configurable limits per endpoint (10/min for chat, 3/min for submit)
- **Security Headers:** X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- **Content Security Policy:** Strict CSP with `frame-ancestors 'none'`
- **IP-based Rate Limiting:** Tracks requests per IP address with automatic cleanup
- **Single-use CSRF Tokens:** Tokens are deleted after use for enhanced security

## Customization

### Changing Default Model
Update the `AVAILABLE_MODELS` array in `src/index.js` and set the first model as the default, or modify the `DEFAULT_MODEL` constant.

### Adding New Models
Models are curated in `src/index.js` `AVAILABLE_MODELS` array. Update the array to add new models:
```javascript
const AVAILABLE_MODELS = [
    { name: 'new-model:cloud', description: 'New model description', size: 'Cloud' },
];
```

### Model Selection
The frontend automatically populates the model selector from the `/api/models` endpoint. Selecting a model from the dropdown updates the model used for chat requests.

## Configuration

The `wrangler.jsonc` file contains the main configuration:
```json
{
  "name": "dubussy",
  "main": "src/index.js",
  "compatibility_date": "2024-04-01",
  "assets": {
    "directory": "./",
    "binding": "ASSETS",
    "run_worker_first": true
  },
  "kv_namespaces": [
    {
      "binding": "SITE_DATA",
      "id": "your_kv_namespace_id"
    }
  ]
}
```

## Development

For local development, you can use Wrangler CLI:
```bash
npm install -g wrangler
wrangler dev
```

## Security Best Practices

1. Always use HTTPS in production
2. Keep your `CSRF_SECRET`, `OLLAMA_TOKEN`, and `DISCORD_BOT_TOKEN` secure
3. Monitor your Cloudflare Worker logs for security events
4. Regularly update your model allowlist in `src/index.js`
5. Consider implementing additional rate limiting for production use