# Dubussy's Paradise

AI-powered web application built with Cloudflare Pages and Workers. Features customizable Ollama cloud models with vision support and access request system.

## Features

- **AI Chat Assistant** - Custom chat UI powered by Ollama Cloud API with multiple model selection
- **Vision Support** - Upload images (PNG, JPG, WEBP) for multimodal model interactions
- **Model Selection** - Choose from available Ollama cloud models via dropdown selector
- **Rate Limiting** - 10 requests per minute per IP for `/api/chat` endpoint
- **Request System** - Email submission form that sends notifications to Discord
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

### Backend (Cloudflare Worker)
- `/api/chat` - POST endpoint for AI chat conversations
- `/api/models` - GET endpoint to fetch available Ollama models
- `/submit` - POST endpoint for access requests (sends to Discord)

### Environment Variables (Configure in Cloudflare Dashboard)
```env
OLLAMA_API_URL=https://api.ollama.com/v1
OLLAMA_API_KEY=your_ollama_cloud_api_key
DEFAULT_MODEL=llama-3.2-1b-instruct
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_USER_ID=your_user_id
```

## Deployment

This project uses Cloudflare Pages automated deployments. No manual build step required.

1. Push changes to main branch
2. Cloudflare Pages automatically rebuilds and deploys
3. Configure environment variables in Cloudflare Dashboard
4. Configure Worker routes in Cloudflare Dashboard:
   - Route `/api/models` and `/api/chat` to the worker

## Getting Started

1. Fork/clone this repository
2. Create a Cloudflare Pages project
3. Connect to your Git repository
4. Configure environment variables in project settings
5. Set up Worker binding for `/api/*` routes
6. Deploy and configure Ollama Cloud API key

## API Endpoints

### `GET /api/models`
Fetch list of available Ollama models.

**Response:**
```json
{
  "success": true,
  "models": [
    { "name": "llama-3.2-1b-instruct" },
    { "name": "llama-3.2-3b-instruct" },
    { "name": "qwen2.5-vl:14b" }
  ]
}
```

### `POST /api/chat`
Send message to Ollama model.

**Request Body:**
```json
{
  "model": "llama-3.2-1b-instruct",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "image": "base64_encoded_image_string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Hello! How can I help you today?"
}
```

## File Upload Support

- Maximum file size: 5MB
- Supported formats: PNG, JPG, WEBP
- Images are converted to base64 and sent with the chat request
- Vision-capable models will process images in the conversation

## Customization

### Changing Default Model
Update `DEFAULT_MODEL` environment variable or modify line in `script.js`:
```javascript
const MODEL_DEFAULT = window.DEFAULT_MODEL || 'your_model_name';
```

### Adding New Models
Models are fetched dynamically from Ollama Cloud API. No code changes needed.

## License

MIT
