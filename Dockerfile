# Use Node.js 20 slim as base
FROM node:20-slim

# Install system dependencies (ffmpeg + python for AI tools)
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

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install ALL Node.js dependencies (including devDependencies needed for build)
RUN npm ci

# Copy all application source code
COPY . .

# ✅ BUILD THE FRONTEND (was missing — this creates /app/dist)
RUN npm run build

# Create persistent storage directories
RUN mkdir -p uploads outputs avatars

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the server (serves built dist/ + API routes)
CMD ["npm", "start"]
