# 🚀 VINCI AI Editor — Deployment Guide

## What Changed (Bug Fixes Applied)

| File | Fix |
|------|-----|
| `Dockerfile` | Added `RUN npm run build` — was missing, production had no `dist/` folder |
| `vite.config.ts` | Added dev-mode proxy so `/api` routes work during local development |
| `index.html` | Updated title from "My Google AI Studio App" to "VINCI — AI Video Editor" |
| `.env.example` | Corrected Gemini model names (`gemini-2.5-flash` instead of nonexistent `gemini-3.1-flash`) |
| `render.yaml` | New file — one-click Render deployment blueprint |

---

## 🌐 Deploy to Render (Recommended — Free Tier Available)

Render supports Docker natively, persistent disks, and FFmpeg — everything VINCI needs.

### Step 1 — Push the fixed files to your GitHub repo

```bash
# Clone your repo
git clone https://github.com/Abdullahshk658/AI-Editor-main.git
cd AI-Editor-main

# Replace these files with the ones from this deployment package:
# - Dockerfile
# - render.yaml
# - vite.config.ts
# - index.html
# - .env.example

git add .
git commit -m "fix: add render.yaml, fix Dockerfile build step, fix vite proxy"
git push origin main
```

### Step 2 — Deploy on Render

1. Go to **[dashboard.render.com](https://dashboard.render.com)** → New → **Blueprint**
2. Connect your GitHub account and select `Abdullahshk658/AI-Editor-main`
3. Render detects `render.yaml` automatically
4. Click **Apply** — it will ask you to fill in `GEMINI_API_KEY`

> Get a free Gemini API key at: **https://aistudio.google.com**

### Step 3 — Add Your API Key

In Render Dashboard → `vinci-ai-editor` service → **Environment**:

```
GEMINI_API_KEY = AIza...your_key_here
```

### Step 4 — Wait for Build (~5-8 minutes)

Render builds the Docker image, runs `npm run build`, then starts the server.

Your app will be live at: `https://vinci-ai-editor.onrender.com`

---

## 🗄️ Database (Supabase)

The app **does not currently use Supabase** — all data is in-memory or on disk.

If you want to add it later (for user auth, project storage, etc):

1. Create a new Supabase project at **[supabase.com](https://supabase.com)**
2. Add to Render environment variables:
   ```
   SUPABASE_URL = https://your-project.supabase.co
   SUPABASE_ANON_KEY = your-anon-key
   ```

---

## 💻 Local Development

```bash
# 1. Clone
git clone https://github.com/Abdullahshk658/AI-Editor-main.git
cd AI-Editor-main

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 4. Start dev server (Express + Vite HMR together)
npm run dev

# App runs at http://localhost:3000
```

---

## 🐳 Local Docker

```bash
docker build -t vinci-ai .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key vinci-ai
```

---

## ⚙️ Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | — | Google AI Studio API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Primary AI model |
| `GEMINI_FALLBACK_MODEL` | No | `gemini-2.0-flash` | Fallback model |
| `NODE_ENV` | No | `development` | Set to `production` on Render |
| `PORT` | No | `3000` | Server port |

---

## 🩺 Health Check

Once deployed, verify at:
```
GET https://vinci-ai-editor.onrender.com/api/health
```
Should return:
```json
{ "status": "ok", "uptime": 42, "env": "production" }
```
