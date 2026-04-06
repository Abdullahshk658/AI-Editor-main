# VINCI AI Video Editor - Deployment Guide

This guide outlines how to deploy the VINCI AI Video Editor for production use.

## 🚀 Local Deployment (Docker)

The easiest way to run VINCI is using Docker.

### Prerequisites
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Steps
1. **Clone the repository** (if you haven't already).
2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   SUPABASE_URL=your_supabase_url (optional)
   SUPABASE_ANON_KEY=your_supabase_key (optional)
   ```
3. **Build and Start**:
   ```bash
   docker-compose up --build -d
   ```
4. **Access the App**:
   Open your browser and navigate to `http://localhost:3000`.

---

## 🪟 Windows Local Setup (Non-Docker)

If you prefer to run it directly on Windows:

### 1. Install FFmpeg
- Download from [ffmpeg.org](https://ffmpeg.org/download.html).
- Add the `bin` folder to your system's `PATH`.
- Verify: `ffmpeg -version` in CMD.

### 2. Install Python & AI Models
- Install [Python 3.10+](https://www.python.org/).
- Install dependencies:
  ```bash
  pip install openai-whisper TTS
  ```

### 3. Install Node.js
- Install [Node.js 20+](https://nodejs.org/).
- Run:
  ```bash
  npm install
  npm run dev
  ```

---

## ☁️ Online Deployment (Cloud)

### Render / Railway / Fly.io
1. Connect your GitHub repository.
2. Set the build command: `npm run build`.
3. Set the start command: `npm start`.
4. Add your `GEMINI_API_KEY` to the environment variables.
5. Ensure the platform supports FFmpeg (most do via buildpacks).

### VPS (Ubuntu/Debian)
1. Install Docker and Docker Compose.
2. Follow the **Local Deployment (Docker)** steps above.
3. Use Nginx as a reverse proxy for SSL (Port 443 -> 3000).

---

## 🛠️ Troubleshooting

- **FFmpeg not found**: Ensure FFmpeg is installed and in your PATH.
- **AI Models failing**: Check if Python is installed and `whisper` is accessible from the command line.
- **Upload limits**: If deploying behind a proxy (like Nginx), ensure `client_max_body_size` is set high enough (e.g., `500M`).
