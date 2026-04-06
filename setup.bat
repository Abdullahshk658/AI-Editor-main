@echo off
setlocal enabledelayedexpansion

:: VINCI AI Video Editor - Windows Setup Script
echo 🎨 Starting VINCI AI Local Setup...

:: 1. Check for FFmpeg
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ FFmpeg not found. Please install it from https://ffmpeg.org/download.html and add to PATH.
    pause
    exit /b 1
) else (
    echo ✅ FFmpeg is already installed.
)

:: 2. Setup Python Environment
echo 🐍 Setting up Python virtual environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found. Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)
python -m venv venv
call venv\Scripts\activate
pip install --upgrade pip
pip install openai-whisper TTS

:: 3. Install Node Dependencies
echo 📦 Installing Node.js dependencies...
npm install

:: 4. Local LLM Suggestion
echo 💡 Suggestion: Install Ollama (https://ollama.com) for the best local AI experience.
echo    Once installed, run: ollama run llama3

:: 5. Create Directories
if not exist uploads mkdir uploads
if not exist outputs mkdir outputs
if not exist avatars mkdir avatars

echo ✨ Setup complete! Run 'npm run dev' to start VINCI.
pause
