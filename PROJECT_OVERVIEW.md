# Dubussy's Paradise — Project Overview

## What It Is

**Dubussy's Paradise** is an AI-powered web application that provides a chat interface to Ollama cloud models. It features a polished dark-themed chat UI, model selection across multiple Ollama cloud models, image upload for vision-capable models, and an invite/request system that notifies the admin via Discord DM.

## Project Structure

```
dubussy/
├── index.html            # Main chat SPA (single-page application)
├── script.js             # Frontend chat logic (model loading, messaging, streaming, file upload)
├── style.css             # Dark theme styles with responsive/mobile support
├── src/
│   └── index.js          # Cloudflare Worker — all API endpoints and security logic
├── request/
│   ├── index.html        # Access request form page
│   ├── script.js         # CSRF token fetch + form submission
│   └── style.css         # Request page styles
├── thanks/
│   └── index.html        # Post-submission confirmation page
├── artifacts/
│   ├── dubussy-logo.jpg  # Site logo
│   └── dubussy-fav.jpg   # Favicon
├── _headers              # Cloudflare Pages security headers configuration
├── wrangler.jsonc         # Cloudflare Workers/Pages configuration
└── README.md             # Existing README
```

## Architecture

### Frontend (Static SPA)
- **Vanilla HTML/CSS/JS** — no frameworks, no build step
- Sidebar with model selector dropdown and collapsible navigation
- Chat interface with streaming response support (NDJSON from Ollama API)
- Image upload (PNG, JPG, WEBP up to 5MB) for vision-capable models
- Conditional "thinking" block display when models emit reasoning content
- Responsive design with iOS-specific handling (safe areas, keyboard, viewport)

### Backend (Cloudflare Worker — `src/index.js`)
A single Worker handles all API routes (`run_worker_first: true`):

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Proxy to Ollama cloud API (streaming & non-streaming) |
| `/api/models` | GET | Return curated list of available cloud models |
| `/api/config` | GET | Return default model and API URL config |
| `/api/csrf-token` | GET | Generate + store single-use CSRF token in KV |
| `/submit` | POST | Submit access request email → Discord DM via bot API |

### Additional Pages
- `/request` — Email submission form with CSRF-protected JSON POST
- `/thanks` — Confirmation page after successful request submission

## Available Models

Curated in `src/index.js`:
- `devstral-small-2:24b-cloud` — Small and effective model (default)
- `qwen3.5:cloud` — Alibaba's latest model
- `nemotron-3-super:cloud` — NVIDIA's enterprise model
- `mistral-large-3:675b-cloud` — Strong multilingual capabilities
- `gemma3:27b-cloud` — Google's lightweight performer

## Security Features

- **Rate limiting** — 10 req/min per IP for chat, 3 req/min for submit
- **CSRF protection** — Single-use tokens stored in Cloudflare KV with IP binding and 15-min expiry
- **Origin/Referer validation** — Prevents cross-origin request attacks
- **Input validation** — Message length caps, model allowlist, image type/size checks, email format validation
- **Security headers** — CSP, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS
- **XSS sanitization** — HTML escaping on all user content displayed in chat

## Tech Stack

- **Cloudflare Pages** — static asset hosting
- **Cloudflare Workers** — API endpoints and form handling
- **Cloudflare KV** — CSRF token storage
- **Ollama Cloud API** — AI model inference
- **Discord Bot API** — access request notifications
- **Vanilla JavaScript** — no frontend framework

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `OLLAMA_API_URL` | Yes | Ollama API base URL (default: `https://ollama.com`) |
| `OLLAMA_TOKEN` | Yes | Ollama cloud API key |
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token for DM notifications |
| `DISCORD_USER_ID` | Yes | Discord user ID to receive DM notifications |
| `CSRF_SECRET` | Yes | Secret key for CSRF token generation |

## Deployment

Deployed via Cloudflare Pages with Git integration. Pushing to `main` triggers automatic deployment. No build step required — the Worker and static assets are served directly.