#!/bin/bash

# VINCI AI Video Editor - Linux/Mac Setup Script
echo "🎨 Starting VINCI AI Local Setup..."

# 1. Check for FFmpeg
if ! command -v ffmpeg &> /dev/null
then
    echo "❌ FFmpeg not found. Installing..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install ffmpeg
    fi
else
    echo "✅ FFmpeg is already installed."
fi

# 2. Setup Python Environment
echo "🐍 Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install openai-whisper TTS

# 3. Install Node Dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# 4. Local LLM Suggestion
if ! command -v ollama &> /dev/null
then
    echo "💡 Suggestion: Install Ollama (https://ollama.com) for the best local AI experience."
    echo "   Once installed, run: ollama run llama3"
fi

# 5. Create Directories
mkdir -p uploads outputs avatars

echo "✨ Setup complete! Run 'npm run dev' to start VINCI."
