# Use Node.js 20 slim as base
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    pkg-config \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Install Python AI dependencies (Whisper, TTS)
RUN pip3 install --no-cache-dir --break-system-packages \
    openai-whisper \
    TTS

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads outputs avatars

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
# Default Ollama URL for Docker (assuming host machine runs Ollama)
ENV OLLAMA_URL=http://host.docker.internal:11434/api/generate

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
