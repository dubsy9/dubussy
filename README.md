# Dubussy's Paradise

AI-powered web application built with Cloudflare Pages and Workers. Features customizable Ollama cloud models with vision support and access request system.

Includes a `/request` page for users to submit access requests that are sent to Discord via DM.

## Features

- **AI Chat Assistant** - Custom chat UI powered by Ollama Cloud API with multiple model selection
- **Vision Support** - Upload images (PNG, JPG, WEBP) for multimodal model interactions
- **Model Selection** - Choose from available Ollama cloud models via dropdown selector
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
- `/api/config` - GET endpoint for configuration (default model, API URL)
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
DEFAULT_MODEL=devstral-small-2:24b-cloud
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
    { "name": "qwen3.5:cloud", "description": "Qwen 3.5 - Alibaba's latest model", "size": "Cloud" },
    { "name": "nemotron-3-super:cloud", "description": "Nemotron 3 Super - NVIDIA's enterprise model", "size": "Cloud" },
    { "name": "mistral-large-3:675b-cloud", "description": "Mistral Large - Strong multilingual capabilities", "size": "Cloud" },
    { "name": "gemma3:27b-cloud", "description": "Gemma 3 - Google's lightweight performer", "size": "Cloud" }
  ]
}
```

### `GET /api/config`
Fetch server configuration.

**Response:**
```json
{
  "defaultModel": "devstral-small-2:24b-cloud",
  "apiUrl": "https://ollama.com"
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

### `GET /api/csrf-token`
Fetch CSRF token for form submissions.

**Response:**
```json
{
  "csrfToken": "base64_encoded_token"
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

- **Input Validation:** Message length limits, image size checks, model allowlist
- **CSRF Protection:** Token-based validation with IP binding and single-use tokens
- **Origin Verification:** Validates Origin/Referer headers to prevent CSRF
- **Rate Limiting:** Configurable limits per endpoint (10/min for chat, 3/min for submit)
- **Security Headers:** X-Content-Type-Options, X-Frame-Options, CSP, HSTS
- **Content Security Policy:** Strict CSP with `frame-ancestors 'none'`

## Customization

### Changing Default Model
Update `DEFAULT_MODEL` environment variable or modify worker configuration in `wrangler.jsonc`.

### Adding New Models
Models are curated in `src/index.js` `AVAILABLE_MODELS` array. Update the array to add new models:
```javascript
const AVAILABLE_MODELS = [
    { name: 'new-model:cloud', description: 'New model description', size: 'Cloud' },
];
```

### Model Selection
The frontend automatically populates the model selector from the `/api/models` endpoint. Selecting a model from the dropdown updates the model used for chat requests.