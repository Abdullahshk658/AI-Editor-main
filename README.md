# VINCI AI Video Editor

VINCI is a video editing app with Gemini-powered edit understanding and local media processing. Natural-language edit requests and metadata analysis run through Google Gemini, while FFmpeg-based trimming, filters, crops, speed changes, and exports stay on your machine.

## Core Principles
- Gemini handles command parsing and creative metadata analysis.
- FFmpeg processing, uploads, exports, and temporary storage remain local.
- Hardware acceleration is detected automatically for NVIDIA, AMD, Intel, and software fallback paths.
- Rule-based fallbacks still work if the Gemini API is unavailable.

## AI Stack
- Google Gemini API for edit command parsing and metadata summaries
- OpenAI Whisper for local speech-to-text
- Coqui TTS for offline text-to-speech
- Wav2Lip for self-hosted lip sync
- FFmpeg for hardware-accelerated media processing

## Requirements
- Node.js 20+
- Python 3.10+
- FFmpeg available on your system
- A Gemini API key from Google AI Studio

## Setup
1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and add your Gemini API key:

```bash
cp .env.example .env
```

Set:

```bash
GEMINI_API_KEY=your_google_ai_studio_api_key
```

Optional model overrides:

```bash
GEMINI_MODEL=gemini-3.1-flash
GEMINI_FALLBACK_MODEL=gemini-3-flash-preview
```

3. Start the app:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Hardware Acceleration
VINCI automatically chooses the best available encoder:
- NVIDIA: `h264_nvenc`
- AMD: `h264_amf`
- Intel: `h264_qsv`
- Fallback: `libx264`

## Privacy Notes
- Media files stay in local `uploads/` and `outputs/` folders.
- Gemini is used only for instruction generation and metadata analysis.
- Temporary files are cleaned up automatically.

## License
MIT
