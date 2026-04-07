import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { exec, execSync } from 'child_process';
import util from 'util';
import { GoogleGenAI, Type, type Schema } from '@google/genai';

const execPromise = util.promisify(exec);

// --- Logger ---
const logger = {
  info: (msg: string, ...args: any[]) => {
    const log = `[INFO] ${new Date().toISOString()} - ${msg}`;
    console.log(log, ...args);
    // In a real app, we could write to a file or a logging service here
  },
  error: (msg: string, ...args: any[]) => {
    const log = `[ERROR] ${new Date().toISOString()} - ${msg}`;
    console.error(log, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    const log = `[WARN] ${new Date().toISOString()} - ${msg}`;
    console.warn(log, ...args);
  },
  debug: (msg: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      const log = `[DEBUG] ${new Date().toISOString()} - ${msg}`;
      console.log(log, ...args);
    }
  }
};

const SUPPORTED_FILTERS = [
  'grayscale',
  'sepia',
  'vivid',
  'cinematic',
  'blur',
  'sharpen',
  'vignette',
  'brightness',
  'contrast',
  'saturation'
] as const;

type SupportedFilter = typeof SUPPORTED_FILTERS[number];

type AICommand =
  | { action: 'trim'; params: { start: number; duration: number } }
  | { action: 'filter'; params: { type: SupportedFilter; value?: number } }
  | { action: 'speed'; params: { factor: number } }
  | { action: 'crop'; params: { ratio: '9:16' } }
  | { action: 'enhance_audio'; params: { normalize: boolean; denoise?: boolean } };

interface AIParseResponse {
  commands: AICommand[];
  interpretation: string;
}

interface ContentAnalysis {
  suggestions: string[];
  tags: string[];
  summary: string;
}

// --- Gemini Setup ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash';
const GEMINI_MODEL_CANDIDATES = Array.from(new Set([
  GEMINI_MODEL,
  process.env.GEMINI_FALLBACK_MODEL?.trim(),
  'gemini-3-flash-preview',
  'gemini-2.5-flash'
].filter((model): model is string => Boolean(model))));

const gemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const AI_COMMAND_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: 'Structured video editing instructions parsed from a natural language request.',
  required: ['commands', 'interpretation'],
  propertyOrdering: ['commands', 'interpretation'],
  properties: {
    commands: {
      type: Type.ARRAY,
      description: 'Ordered list of editing commands to execute.',
      items: {
        type: Type.OBJECT,
        required: ['action', 'params'],
        propertyOrdering: ['action', 'params'],
        properties: {
          action: {
            type: Type.STRING,
            enum: ['trim', 'filter', 'speed', 'crop', 'enhance_audio']
          },
          params: {
            type: Type.OBJECT,
            nullable: false,
            properties: {
              start: { type: Type.NUMBER, minimum: 0 },
              duration: { type: Type.NUMBER, minimum: 0.1 },
              type: { type: Type.STRING, enum: [...SUPPORTED_FILTERS] },
              value: { type: Type.NUMBER },
              factor: { type: Type.NUMBER, minimum: 0.5, maximum: 2 },
              ratio: { type: Type.STRING, enum: ['9:16'] },
              normalize: { type: Type.BOOLEAN },
              denoise: { type: Type.BOOLEAN }
            }
          }
        }
      }
    },
    interpretation: {
      type: Type.STRING,
      description: 'A short, plain-English explanation of what will be applied.'
    }
  }
};

const CONTENT_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: 'Creator-friendly metadata analysis for an uploaded media file.',
  required: ['suggestions', 'tags', 'summary'],
  propertyOrdering: ['summary', 'suggestions', 'tags'],
  properties: {
    summary: {
      type: Type.STRING,
      description: 'One concise but creative sentence describing the uploaded media.'
    },
    suggestions: {
      type: Type.ARRAY,
      description: 'Exactly 3 practical editing ideas based only on the provided metadata.',
      minItems: '3',
      maxItems: '3',
      items: { type: Type.STRING }
    },
    tags: {
      type: Type.ARRAY,
      description: 'Exactly 5 short relevant tags without the # symbol.',
      minItems: '5',
      maxItems: '5',
      items: { type: Type.STRING }
    }
  }
};

function parseJsonResponse<T>(raw: string | undefined): T | null {
  if (!raw) return null;

  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function isSupportedFilter(value: string): value is SupportedFilter {
  return SUPPORTED_FILTERS.includes(value as SupportedFilter);
}

function normalizeCommandList(rawCommands: unknown): AICommand[] {
  if (!Array.isArray(rawCommands)) return [];

  return rawCommands.reduce<AICommand[]>((commands, rawCommand) => {
    if (!rawCommand || typeof rawCommand !== 'object') return commands;

    const command = rawCommand as Record<string, any>;
    const action = String(command.action || '').toLowerCase().replace(/\s+/g, '_');
    const params = command.params && typeof command.params === 'object' ? command.params : {};

    switch (action) {
      case 'trim':
      case 'range_trim': {
        const start = Number(params.start ?? 0);
        const duration = Number(params.duration ?? (Number(params.end) - start));
        if (!Number.isFinite(start) || !Number.isFinite(duration) || start < 0 || duration <= 0) {
          return commands;
        }
        commands.push({ action: 'trim', params: { start, duration } });
        return commands;
      }
      case 'filter':
      case 'filters': {
        const type = String(params.type || '').toLowerCase();
        if (!isSupportedFilter(type)) return commands;

        const normalizedParams: { type: SupportedFilter; value?: number } = { type };
        if (params.value !== undefined) {
          const value = Number(params.value);
          if (Number.isFinite(value)) normalizedParams.value = value;
        }

        commands.push({ action: 'filter', params: normalizedParams });
        return commands;
      }
      case 'speed': {
        const factor = Number(params.factor);
        if (!Number.isFinite(factor) || factor < 0.5 || factor > 2) return commands;
        commands.push({ action: 'speed', params: { factor } });
        return commands;
      }
      case 'crop':
      case 'vertical_crop': {
        const ratio = String(params.ratio || '9:16');
        if (ratio !== '9:16') return commands;
        commands.push({ action: 'crop', params: { ratio: '9:16' } });
        return commands;
      }
      case 'enhance_audio': {
        const normalize = params.normalize !== false;
        const denoise = params.denoise !== false;
        commands.push({ action: 'enhance_audio', params: { normalize, denoise } });
        return commands;
      }
      default:
        return commands;
    }
  }, []);
}

function normalizeStringList(rawValue: unknown, fallback: string[], maxItems: number, stripHashes = false) {
  if (!Array.isArray(rawValue)) return fallback;

  const items = rawValue
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .map((item) => stripHashes ? item.replace(/^#+/, '') : item)
    .filter(Boolean);

  return items.length > 0 ? Array.from(new Set(items)).slice(0, maxItems) : fallback;
}

function buildInterpretation(commands: AICommand[]): string {
  if (commands.length === 0) {
    return "I've analyzed your request but couldn't find specific editing actions. Try commands like 'trim first 5s' or 'apply cinematic filter'.";
  }

  const labels = commands.map((command) => {
    switch (command.action) {
      case 'trim':
        return command.params.start > 0
          ? `trim ${command.params.start}s to ${command.params.start + command.params.duration}s`
          : `trim first ${command.params.duration}s`;
      case 'filter':
        return `${command.params.type} filter`;
      case 'speed':
        return `${command.params.factor}x speed`;
      case 'crop':
        return 'vertical crop (9:16)';
      case 'enhance_audio':
        return 'audio enhancement';
    }
  });

  return `I've analyzed your request and will apply: ${labels.join(', ')}.`;
}

function buildFallbackAnalysis(fileInfo: any): ContentAnalysis {
  const duration = Number(fileInfo.metadata.duration || 0);
  const safeDuration = Number.isFinite(duration) ? Math.round(duration * 10) / 10 : 0;

  return {
    suggestions: [
      safeDuration > 30 ? 'Trim the intro for better retention' : 'Tighten the opening hook',
      fileInfo.metadata.audioCodec !== 'none' ? 'Enhance audio clarity' : 'Add captions or text overlays for context',
      fileInfo.metadata.resolution === '1080x1920' ? 'Lean into a vertical-first storytelling style' : 'Add a cinematic color grade'
    ],
    tags: ['video', 'edit', 'creative', fileInfo.metadata.audioCodec !== 'none' ? 'audio' : 'silent', 'vinci'],
    summary: `A ${safeDuration || 'short'}s ${fileInfo.metadata.resolution} ${fileInfo.metadata.codec} clip titled "${fileInfo.name}".`
  };
}

function normalizeContentAnalysis(rawAnalysis: unknown, fallback: ContentAnalysis): ContentAnalysis {
  const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis as Record<string, unknown> : {};

  const summary = typeof analysis.summary === 'string' && analysis.summary.trim()
    ? analysis.summary.trim()
    : fallback.summary;

  return {
    summary,
    suggestions: normalizeStringList(analysis.suggestions, fallback.suggestions, 3),
    tags: normalizeStringList(analysis.tags, fallback.tags, 5, true)
  };
}

async function callGeminiForJson<T>(prompt: string, schema: Schema, options?: {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<T | null> {
  if (!gemini) {
    logger.warn('Gemini API key not configured. Using rule-based fallback.');
    return null;
  }

  for (const model of GEMINI_MODEL_CANDIDATES) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: options?.systemInstruction,
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxOutputTokens ?? 1024,
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });

      const parsed = parseJsonResponse<T>(response.text);
      if (parsed) {
        logger.info(`Gemini response received using model ${model}`);
        return parsed;
      }

      logger.warn(`Gemini returned non-JSON content for model ${model}.`);
    } catch (error) {
      logger.warn(`Gemini request failed for model ${model}.`, error);
    }
  }

  return null;
}

// --- Hardware Acceleration Detection ---
const getHardwareAccel = () => {
  try {
    const encoders = execSync('ffmpeg -encoders').toString();
    if (encoders.includes('h264_nvenc')) return 'h264_nvenc'; // NVIDIA
    if (encoders.includes('h264_amf')) return 'h264_amf'; // AMD
    if (encoders.includes('h264_qsv')) return 'h264_qsv'; // Intel
    if (encoders.includes('h264_v4l2m2m')) return 'h264_v4l2m2m'; // Raspberry Pi
    return 'libx264'; // Software fallback
  } catch (e) {
    return 'libx264';
  }
};

const HW_ENCODER = getHardwareAccel();

// Set FFmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: {
    trustProxy: false, // Suppress the trust proxy validation error
    xForwardedForHeader: false, // Suppress the X-Forwarded-For validation error
  },
});

// Middleware
app.use(express.json());
app.use('/api/', limiter);

// Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Setup storage for uploads
const uploadDir = path.join(process.cwd(), 'uploads');
const outputDir = path.join(process.cwd(), 'outputs');
const avatarDir = path.join(process.cwd(), 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

// --- AI Command Fallback Logic ---

/**
 * Hybrid NLP Parser: Converts user prompts into structured video editing commands.
 * Uses a combination of regex and keyword matching for zero-cost, local execution.
 */
const parseAICommandLocally = (prompt: string): AICommand[] => {
  const commands: AICommand[] = [];
  const p = prompt.toLowerCase();

  // Trim detection: "cut from 5s to 10s", "trim first 5 seconds", "remove first 5s"
  const trimMatch = p.match(/(?:trim|cut|remove|keep)\s+(?:the\s+)?(?:first\s+)?(\d+)\s*(?:s|sec|seconds)/i);
  if (trimMatch) {
    commands.push({ action: 'trim', params: { start: 0, duration: parseInt(trimMatch[1]) } });
  }

  // Range trim: "trim from 10 to 20", "cut between 5 and 15"
  const rangeMatch = p.match(/(?:trim|cut)\s+(?:from\s+)?(\d+)\s*(?:s|sec)?\s*(?:to|and|until)\s+(\d+)\s*(?:s|sec)?/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    commands.push({ action: 'trim', params: { start, duration: end - start } });
  }

  // Filter detection
  const filterMap: Record<string, SupportedFilter> = {
    'grayscale': 'grayscale',
    'black and white': 'grayscale',
    'sepia': 'sepia',
    'vivid': 'vivid',
    'cinematic': 'cinematic',
    'blur': 'blur',
    'sharpen': 'sharpen',
    'vignette': 'vignette',
    'noir': 'grayscale',
    'vintage': 'cinematic',
    'brighten': 'brightness',
    'contrast': 'contrast',
    'saturation': 'saturation'
  };
  
  Object.keys(filterMap).forEach(key => {
    if (p.includes(key)) {
      commands.push({ action: 'filter', params: { type: filterMap[key] } });
    }
  });

  // Speed detection: "2x speed", "double speed", "slow motion", "half speed"
  if (p.includes('2x') || p.includes('double speed') || p.includes('faster')) {
    commands.push({ action: 'speed', params: { factor: 2 } });
  } else if (p.includes('slow motion') || p.includes('half speed') || p.includes('slower')) {
    commands.push({ action: 'speed', params: { factor: 0.5 } });
  }

  // Crop/Reels detection
  if (p.includes('reel') || p.includes('tiktok') || p.includes('9:16') || p.includes('vertical') || p.includes('shorts')) {
    commands.push({ action: 'crop', params: { ratio: '9:16' } });
  }

  // Audio enhancement
  if (p.includes('audio') || p.includes('voice') || p.includes('denoise') || p.includes('normalize') || p.includes('clean up sound')) {
    commands.push({ action: 'enhance_audio', params: { normalize: true, denoise: true } });
  }

  return commands;
};

async function parseAICommandWithGemini(prompt: string): Promise<AIParseResponse | null> {
  const llmResponse = await callGeminiForJson<{ commands?: unknown; interpretation?: unknown }>(
    `Parse this natural-language video editing request into the supported JSON command format.

User request: "${prompt}"

Rules:
- Supported actions are trim, filter, speed, crop, and enhance_audio.
- For range trims like "cut from 10s to 25s", use action "trim" with params {"start": 10, "duration": 15}.
- For any reels, TikTok, Shorts, 9:16, or vertical crop request, use action "crop" with params {"ratio": "9:16"}.
- Filter types must be one of: ${SUPPORTED_FILTERS.join(', ')}.
- Speed factor must stay between 0.5 and 2.
- If nothing actionable is requested, return {"commands": [], "interpretation": "..."}.
- Return only JSON that matches the schema.`,
    AI_COMMAND_SCHEMA,
    {
      systemInstruction: 'You are a video editing command parser. Return strict JSON only, with no markdown or commentary.',
      temperature: 0.1,
      maxOutputTokens: 512
    }
  );

  if (!llmResponse) return null;

  const commands = normalizeCommandList(llmResponse.commands);
  const interpretation = typeof llmResponse.interpretation === 'string' && llmResponse.interpretation.trim()
    ? llmResponse.interpretation.trim()
    : buildInterpretation(commands);

  return { commands, interpretation };
}

/**
 * Local Coqui TTS: Generates speech using Coqui TTS CLI.
 */
const generateSpeechLocally = async (text: string, outputPath: string): Promise<void> => {
  logger.info(`Running local Coqui TTS for: ${text}`);
  try {
    await execPromise(`tts --text "${text}" --model_name "tts_models/en/ljspeech/vits" --out_path "${outputPath}"`);
  } catch (error) {
    logger.error('Coqui TTS Error:', error);
    fs.writeFileSync(outputPath, Buffer.from([]));
  }
};

/**
 * Local Wav2Lip: Real lip-sync processing using Wav2Lip CLI.
 */
const runLipSyncLocally = async (videoPath: string, audioPath: string, outputPath: string): Promise<void> => {
  logger.info(`Running local Wav2Lip for ${videoPath} and ${audioPath}`);
  try {
    const wav2lipDir = process.env.WAV2LIP_DIR || '/app/Wav2Lip';
    const checkpoint = process.env.WAV2LIP_CHECKPOINT || 'checkpoints/wav2lip_gan.pth';
    await execPromise(`python3 ${wav2lipDir}/inference.py --checkpoint_path ${checkpoint} --face "${videoPath}" --audio "${audioPath}" --outfile "${outputPath}"`);
  } catch (error) {
    logger.error('Wav2Lip Error:', error);
    fs.copyFileSync(videoPath, outputPath);
  }
};

// Caching
const aiCache = new Map<string, AIParseResponse>();

// --- Auto Cleanup of Temporary Files ---
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Every hour
const MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours

const cleanupFiles = (dir: string) => {
  if (!fs.existsSync(dir)) return;
  fs.readdir(dir, (err, files) => {
    if (err) return logger.error(`Cleanup error in ${dir}:`, err);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(dir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > MAX_FILE_AGE) {
          fs.unlink(filePath, err => {
            if (err) logger.error(`Failed to delete ${filePath}:`, err);
            else logger.info(`Deleted old file: ${filePath}`);
          });
        }
      });
    });
  });
};

setInterval(() => {
  cleanupFiles(uploadDir);
  cleanupFiles(outputDir);
  cleanupFiles(avatarDir);
}, CLEANUP_INTERVAL);

// --- Job tracking ---
interface Job {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  type: string;
  createdAt: string;
}
const jobs = new Map<string, Job>();

type TimelineAspectRatio = '16:9' | '9:16';

interface TimelineClipInput {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  offset: number;
  track: number;
  type: 'video' | 'audio' | 'text';
  effects?: Array<{
    type?: string;
    value?: number;
    name?: string;
  }>;
}

interface TimelineAssetInput {
  id: string;
  url?: string;
  name?: string;
  type?: 'video' | 'audio' | 'image';
}

const probeMedia = (filePath: string) => new Promise<any>((resolve, reject) => {
  ffmpeg.ffprobe(filePath, (err, data) => {
    if (err) reject(err);
    else resolve(data);
  });
});

const getAspectAwareVideoFilter = (aspectRatio: TimelineAspectRatio) => {
  if (aspectRatio === '9:16') {
    return "crop='if(gt(a,9/16),ih*9/16,iw)':'if(gt(a,9/16),ih,iw*16/9)':'(iw-ow)/2':'(ih-oh)/2',scale=1080:1920,setsar=1";
  }

  return 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1';
};

const getLowMemoryVideoOutputOptions = () => {
  if (HW_ENCODER === 'h264_nvenc') {
    return [`-c:v ${HW_ENCODER}`, '-preset p1', '-cq 23'];
  }

  if (HW_ENCODER === 'h264_amf') {
    return [`-c:v ${HW_ENCODER}`, '-quality speed', '-qp_i 23', '-qp_p 23'];
  }

  if (HW_ENCODER === 'h264_qsv') {
    return [`-c:v ${HW_ENCODER}`, '-preset veryfast', '-global_quality 23'];
  }

  if (HW_ENCODER === 'h264_v4l2m2m') {
    return [`-c:v ${HW_ENCODER}`, '-q:v 23'];
  }

  return [`-c:v ${HW_ENCODER}`, '-preset superfast', '-crf 23'];
};

const getCanvasSize = (aspectRatio: TimelineAspectRatio) => (
  aspectRatio === '9:16'
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 }
);

const getClipEffectValue = (effects: TimelineClipInput['effects'], effectType: string, fallback: number) => {
  const effect = effects?.find((item) => item.type === effectType);
  const value = Number(effect?.value);
  return Number.isFinite(value) ? value : fallback;
};

const getClipFilterValue = (effects: TimelineClipInput['effects']) => {
  const effect = effects?.find((item) => item.type === 'filter');
  return typeof effect?.name === 'string' ? effect.name : null;
};

const getNamedVideoFilter = (filterName: string | null) => {
  switch (filterName) {
    case 'grayscale':
      return 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3';
    case 'sepia':
      return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
    case 'vivid':
      return 'eq=contrast=1.2:saturation=1.3:brightness=0.02';
    case 'cinematic':
      return 'curves=preset=vintage,format=yuv420p';
    case 'blur':
      return 'boxblur=10:1';
    case 'sharpen':
      return 'unsharp=3:3:1.5:3:3:0.5';
    case 'vignette':
      return 'vignette=PI/4';
    case 'brightness':
      return 'eq=brightness=0.05';
    case 'contrast':
      return 'eq=contrast=1.1';
    case 'saturation':
      return 'eq=saturation=1.2';
    default:
      return null;
  }
};

const buildClipVideoFilterChain = (clip: TimelineClipInput, aspectRatio: TimelineAspectRatio) => {
  const trimStart = Math.max(0, Number(clip.offset || 0));
  const trimDuration = Math.max(0.1, Number(clip.duration || 0));
  const trimEnd = trimStart + trimDuration;
  const scalePercent = Math.max(10, getClipEffectValue(clip.effects, 'scale', 100));
  const opacityPercent = Math.min(100, Math.max(0, getClipEffectValue(clip.effects, 'opacity', 100)));
  const scaleFactor = scalePercent / 100;
  const opacity = opacityPercent / 100;
  const namedFilter = getNamedVideoFilter(getClipFilterValue(clip.effects));
  const filters = [
    `trim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)}`,
    'setpts=PTS-STARTPTS'
  ];

  if (namedFilter) filters.push(namedFilter);

  filters.push(getAspectAwareVideoFilter(aspectRatio));

  if (Math.abs(scaleFactor - 1) > 0.001) {
    filters.push(`scale='trunc(iw*${scaleFactor.toFixed(3)}/2)*2':'trunc(ih*${scaleFactor.toFixed(3)}/2)*2'`);
  }

  filters.push('format=rgba');

  if (opacity < 0.999) {
    filters.push(`colorchannelmixer=aa=${opacity.toFixed(3)}`);
  }

  filters.push(`setpts=PTS+${Math.max(0, clip.startTime).toFixed(3)}/TB`);

  return filters.join(',');
};

const buildClipAudioFilterChain = (clip: TimelineClipInput) => {
  const trimStart = Math.max(0, Number(clip.offset || 0));
  const trimDuration = Math.max(0.1, Number(clip.duration || 0));
  const trimEnd = trimStart + trimDuration;
  const delayMs = Math.max(0, Math.round(Number(clip.startTime || 0) * 1000));

  return {
    duration: trimDuration,
    filter: [
      `atrim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)}`,
      'asetpts=PTS-STARTPTS',
      'aresample=48000',
      `adelay=${delayMs}|${delayMs}`
    ].join(',')
  };
};

const resolveAssetPath = (asset: TimelineAssetInput) => {
  const candidates: string[] = [];

  if (asset.url) {
    const fileName = path.basename(asset.url);
    if (asset.url.startsWith('/uploads/')) candidates.push(path.join(uploadDir, fileName));
    if (asset.url.startsWith('/outputs/')) candidates.push(path.join(outputDir, fileName));
    if (asset.url.startsWith('/avatars/')) candidates.push(path.join(avatarDir, fileName));
  }

  candidates.push(
    path.join(uploadDir, asset.id),
    path.join(outputDir, asset.id),
    path.join(avatarDir, asset.id)
  );

  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error(`Unable to resolve source media for asset ${asset.id}`);
  }

  return filePath;
};

const runTimelineRender = async (
  timeline: TimelineClipInput[],
  assets: TimelineAssetInput[],
  outputPath: string,
  options: { aspectRatio: TimelineAspectRatio; jobId: string }
) => {
  const orderedClips = [...timeline]
    .filter((clip) => clip.type !== 'text' && Number(clip.duration) > 0)
    .sort((a, b) => a.track - b.track || a.startTime - b.startTime);

  if (orderedClips.length === 0) {
    throw new Error('Timeline is empty');
  }

  const masterDuration = Math.max(...orderedClips.map((clip) => clip.startTime + clip.duration), 0.1);
  const canvas = getCanvasSize(options.aspectRatio);

  const resolvedClips = await Promise.all(orderedClips.map(async (clip) => {
    const asset = assets.find((item) => item.id === clip.assetId);
    if (!asset) {
      throw new Error(`Missing asset for clip ${clip.id}`);
    }

    const sourcePath = resolveAssetPath(asset);
    const metadata = await probeMedia(sourcePath);
    const hasVideo = metadata.streams?.some((stream: any) => stream.codec_type === 'video');
    const hasAudio = metadata.streams?.some((stream: any) => stream.codec_type === 'audio');

    if (!hasVideo && !hasAudio) {
      throw new Error(`Clip ${clip.id} does not have a supported media stream`);
    }

    return { clip, sourcePath, hasAudio, hasVideo };
  }));

  return new Promise((resolve, reject) => {
    const ff = ffmpeg();
    const complexFilters: string[] = [];
    const audioLabels: string[] = [];
    const videoLabels: string[] = [];

    resolvedClips.forEach(({ sourcePath }) => {
      ff.input(sourcePath);
    });

    complexFilters.push(`color=c=black:s=${canvas.width}x${canvas.height}:r=30:d=${masterDuration.toFixed(3)}[base0]`);

    resolvedClips.forEach(({ clip, hasAudio, hasVideo }, index) => {
      if (hasVideo) {
        complexFilters.push(`[${index}:v:0]${buildClipVideoFilterChain(clip, options.aspectRatio)}[v${index}]`);
        videoLabels.push(`[v${index}]`);
      }

      const audioFilter = buildClipAudioFilterChain(clip);

      if (hasAudio) {
        complexFilters.push(`[${index}:a:0]${audioFilter.filter}[a${index}]`);
      } else {
        const delayMs = Math.max(0, Math.round(Number(clip.startTime || 0) * 1000));
        complexFilters.push(`anullsrc=r=48000:cl=stereo:d=${audioFilter.duration.toFixed(3)},adelay=${delayMs}|${delayMs}[a${index}]`);
      }

      audioLabels.push(`[a${index}]`);
    });

    if (videoLabels.length === 0) {
      complexFilters.push('[base0]format=yuv420p[vout]');
    } else {
      let baseLabel = 'base0';
      videoLabels.forEach((videoLabel, index) => {
        const nextLabel = index === videoLabels.length - 1 ? 'vout' : `base${index + 1}`;
        complexFilters.push(`[${baseLabel}]${videoLabel}overlay=(W-w)/2:(H-h)/2:eof_action=pass:shortest=0[${nextLabel}]`);
        baseLabel = nextLabel;
      });
      if (baseLabel !== 'vout') {
        complexFilters.push(`[${baseLabel}]format=yuv420p[vout]`);
      }
    }

    if (audioLabels.length === 0) {
      complexFilters.push(`anullsrc=r=48000:cl=stereo:d=${masterDuration.toFixed(3)}[aout]`);
    } else {
      complexFilters.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=0:dropout_transition=3,alimiter=limit=0.95,aresample=48000[aout]`);
    }

    const filterComplex = complexFilters.join(';');

    ff.complexFilter(filterComplex)
      .outputOptions([
        '-map [vout]',
        '-map [aout]',
        ...getLowMemoryVideoOutputOptions(),
        '-c:a aac',
        '-b:a 192k',
        '-ar 48000',
        `-t ${masterDuration.toFixed(3)}`,
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-threads 1'
      ])
      .on('start', (commandLine) => {
        logger.info(`Starting timeline render ${options.jobId}: ${commandLine}`);
      })
      .on('progress', (progress) => {
        const job = jobs.get(options.jobId);
        if (job) {
          jobs.set(options.jobId, { ...job, progress: Math.min(99, progress.percent || 0) });
        }
      })
      .on('end', () => {
        logger.info(`Timeline render completed: ${options.jobId}`);
        resolve(outputPath);
      })
      .on('error', (error) => {
        logger.error(`Timeline render failed: ${options.jobId}`, error);
        reject(error);
      })
      .save(outputPath);
  });
};

// Optimized FFmpeg Helper
const runFFmpeg = (inputPath: string, outputPath: string, options: any) => {
  return new Promise((resolve, reject) => {
    logger.info(`Starting FFmpeg job for ${inputPath} -> ${outputPath}`);
    
    let ff = ffmpeg(inputPath);

    // Collect all filters
    let videoFilters: string[] = [];
    let audioFilters: string[] = [];

    // Apply Presets
    if (options.preset === 'youtube') {
      ff = ff.size('1920x1080').aspect('16:9');
    } else if (options.preset === 'shorts') {
      ff = ff.size('1080x1920').aspect('9:16');
    }

    ff = ff.outputOptions([
        ...getLowMemoryVideoOutputOptions(),
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-threads 1'
      ]);

    // Audio Enhancement
    if (options.enhanceVoice) {
      audioFilters.push('highpass=f=150', 'lowpass=f=4000', 'afftdn');
    }
    if (options.normalizeAudio) {
      audioFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    }

    if (options.trim) {
      // Use output-side trim filter instead of input seek (-ss before -i)
      // Input seek conflicts with video filter chains in fluent-ffmpeg
      const trimStart = Number(options.trim.start) || 0;
      const trimDuration = Number(options.trim.duration);
      videoFilters.unshift(`trim=start=${trimStart}:duration=${trimDuration},setpts=PTS-STARTPTS`);
      audioFilters.unshift(`atrim=start=${trimStart}:duration=${trimDuration},asetpts=PTS-STARTPTS`);
    }

    if (options.crop) {
      videoFilters.push('crop=ih*9/16:ih');
    }

    // Video Filters
    if (options.filters) {
      options.filters.forEach((f: any) => {
        if (f.type === 'grayscale') videoFilters.push('colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3');
        if (f.type === 'noise_reduction') videoFilters.push('hqdn3d=1.5:1.5:6:6');
        if (f.type === 'vignette') videoFilters.push('vignette=PI/4');
        if (f.type === 'brightness') videoFilters.push(`eq=brightness=${f.value || 0.05}`);
        if (f.type === 'contrast') videoFilters.push(`eq=contrast=${f.value || 1.1}`);
        if (f.type === 'saturation') videoFilters.push(`eq=saturation=${f.value || 1.2}`);
        if (f.type === 'sepia') videoFilters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
        if (f.type === 'sharpen') videoFilters.push('unsharp=3:3:1.5:3:3:0.5');
        if (f.type === 'blur') videoFilters.push('boxblur=10:1');
        if (f.type === 'cinematic') videoFilters.push('curves=preset=vintage,format=yuv420p');
        if (f.type === 'vivid') videoFilters.push('eq=contrast=1.2:saturation=1.3:brightness=0.02');
      });
    }

    if (options.speed) {
      videoFilters.push(`setpts=${1/options.speed}*PTS`);
      audioFilters.push(`atempo=${options.speed}`);
    }

    if (videoFilters.length > 0) ff = ff.videoFilters(videoFilters);
    if (audioFilters.length > 0) ff = ff.audioFilters(audioFilters);

    ff.on('progress', (progress) => {
      if (options.jobId) {
        const job = jobs.get(options.jobId);
        if (job) jobs.set(options.jobId, { ...job, progress: Math.min(99, progress.percent || 0) });
      }
    })
    .on('end', () => {
      logger.info(`FFmpeg job completed: ${options.jobId}`);
      resolve(outputPath);
    })
    .on('error', (err) => {
      logger.error(`FFmpeg job failed: ${options.jobId}`, err);
      reject(err);
    })
    .save(outputPath);
  });
};

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(), 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.post('/api/upload', upload.single('video'), async (req: any, res) => {
  logger.info('Upload request received');
  if (!req.file) {
    logger.error('No file in request');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const filePath = req.file.path;
  const fileName = req.file.filename;

  try {
    // 1. Deep Metadata Extraction using ffprobe
    const metadata = await new Promise<any>((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
    const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');

    const fileInfo = {
      id: fileName,
      url: `/uploads/${fileName}`,
      name: req.file.originalname,
      size: req.file.size,
      type: 'video',
      metadata: {
        resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown',
        fps: videoStream ? (() => {
          try {
            const [num, den] = videoStream.r_frame_rate.split('/');
            return (parseInt(num) / parseInt(den)).toFixed(2);
          } catch {
            return 'unknown';
          }
        })() : 'unknown',
        codec: videoStream ? videoStream.codec_name : 'unknown',
        duration: metadata.format.duration,
        audioCodec: audioStream ? audioStream.codec_name : 'none',
        bitrate: metadata.format.bit_rate
      }
    };

    logger.info(`File uploaded and analyzed: ${fileName}`, fileInfo.metadata);

    const fallbackAnalysis = buildFallbackAnalysis(fileInfo);
    contentAnalyses.set(fileInfo.id, fallbackAnalysis);

    // 2. Smart Content Analysis (background task using Gemini)
    analyzeContentWithGemini(fileInfo, fallbackAnalysis).catch(err => logger.error('Gemini Analysis Error:', err));

    res.json(fileInfo);
  } catch (error) {
    logger.error('Upload/Analysis Error:', error);
    // Cleanup file if analysis fails critically
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: 'Failed to process uploaded file metadata' });
  }
});

/**
 * Uses Gemini or heuristics to analyze video context and suggest edits.
 */
async function analyzeContentWithGemini(fileInfo: any, fallbackAnalysis: ContentAnalysis) {
  try {
    const metadataForGemini = {
      name: fileInfo.name,
      resolution: fileInfo.metadata.resolution,
      fps: fileInfo.metadata.fps,
      codec: fileInfo.metadata.codec,
      durationSeconds: fileInfo.metadata.duration,
      audioCodec: fileInfo.metadata.audioCodec,
      bitrate: fileInfo.metadata.bitrate
    };

    const analysisResponse = await callGeminiForJson<ContentAnalysis>(
      `You are analyzing ffprobe metadata for an uploaded media file. Use only the metadata provided below.

Metadata:
${JSON.stringify(metadataForGemini, null, 2)}

Return:
- A creative one-sentence summary grounded in the metadata.
- Exactly 3 editing suggestions that make sense for this asset.
- Exactly 5 short relevant tags without hash prefixes.

Return only JSON that matches the requested schema.`,
      CONTENT_ANALYSIS_SCHEMA,
      {
        systemInstruction: 'You are a creative video strategist. Be concise, grounded, and practical. Return strict JSON only.',
        temperature: 0.7,
        maxOutputTokens: 512
      }
    );

    const analysis = normalizeContentAnalysis(analysisResponse, fallbackAnalysis);
    contentAnalyses.set(fileInfo.id, analysis);
    logger.info(`Smart analysis completed for ${fileInfo.id}`);
  } catch (error) {
    contentAnalyses.set(fileInfo.id, fallbackAnalysis);
    logger.error('Gemini Analysis Error:', error);
  }
}

const contentAnalyses = new Map<string, ContentAnalysis>();

app.get('/api/analysis/:id', (req, res) => {
  const analysis = contentAnalyses.get(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  res.json(analysis);
});

app.post('/api/ai/parse-command', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (aiCache.has(prompt)) {
    return res.json(aiCache.get(prompt));
  }

  try {
    const geminiResponse = await parseAICommandWithGemini(prompt);
    const commands = geminiResponse?.commands ?? parseAICommandLocally(prompt);
    const interpretation = geminiResponse?.interpretation || buildInterpretation(commands);

    const response: AIParseResponse = { commands, interpretation };
    aiCache.set(prompt, response);
    res.json(response);
  } catch (error) {
    logger.error('Gemini Parse Error:', error);

    const commands = parseAICommandLocally(prompt);
    const response: AIParseResponse = {
      commands,
      interpretation: buildInterpretation(commands)
    };

    aiCache.set(prompt, response);
    res.json(response);
  }
});

app.post('/api/process', async (req, res) => {
  try {
    const { inputId, commands, preset, timeline, assets, aspectRatio, settings } = req.body;
    
    if (!inputId || !commands) {
      return res.status(400).json({ error: 'Missing inputId or commands' });
    }

    const jobId = uuidv4();
    const outputExtension = settings?.format === 'mov' ? 'mov' : 'mp4';
    const outputId = `${uuidv4()}.${outputExtension}`;
    const outputPath = path.join(outputDir, outputId);
    const isTimelineExport = Array.isArray(timeline) && timeline.length > 0 && Array.isArray(assets) && assets.length > 0;

    jobs.set(jobId, { 
      id: jobId, 
      status: 'processing', 
      progress: 0, 
      type: isTimelineExport ? 'timeline_export' : 'video_edit',
      createdAt: new Date().toISOString()
    });

    if (isTimelineExport) {
      const exportAspectRatio: TimelineAspectRatio = aspectRatio === '9:16' || preset === 'shorts' ? '9:16' : '16:9';

      runTimelineRender(timeline, assets, outputPath, { aspectRatio: exportAspectRatio, jobId })
        .then(() => {
          const job = jobs.get(jobId);
          if (job) {
            jobs.set(jobId, {
              ...job,
              status: 'completed',
              progress: 100,
              result: {
                url: `/outputs/${outputId}`,
                id: outputId,
                downloadUrl: `/api/download/${outputId}`
              }
            });
            logger.info(`Timeline export ${jobId} completed successfully.`);
          }
        })
        .catch((err) => {
          const job = jobs.get(jobId);
          if (job) {
            jobs.set(jobId, { ...job, status: 'failed', progress: 0, error: err.message });
            logger.error(`Timeline export ${jobId} failed:`, err);
          }
        });

      return res.json({ jobId });
    }

    let inputPath: string;
    try {
      inputPath = resolveAssetPath({ id: inputId });
    } catch {
      return res.status(404).json({ error: 'Input file not found' });
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    // Process commands into runFFmpeg options
    const options: any = { jobId, preset, filters: [], enhanceVoice: false, normalizeAudio: true };
    commands.forEach((cmd: any) => {
      switch (cmd.action) {
        case 'trim': options.trim = cmd.params; break;
        case 'speed': options.speed = cmd.params.factor; break;
        case 'filter': options.filters.push(cmd.params); break;
        case 'crop': options.crop = true; break;
        case 'noise_reduction':
          options.filters.push({ type: 'noise_reduction' });
          options.enhanceVoice = true;
          break;
        case 'enhance_audio': options.normalizeAudio = true; break;
        case 'color_correct':
          options.filters.push({ type: 'brightness', value: cmd.params?.brightness || 0.05 });
          options.filters.push({ type: 'contrast', value: cmd.params?.contrast || 1.1 });
          options.filters.push({ type: 'saturation', value: cmd.params?.saturation || 1.2 });
          break;
      }
    });

    // Run FFmpeg asynchronously
    runFFmpeg(inputPath, outputPath, options)
      .then(() => {
        const job = jobs.get(jobId);
        if (job) {
          jobs.set(jobId, { 
            ...job, 
            status: 'completed', 
            progress: 100, 
            result: { 
              url: `/outputs/${outputId}`, 
              id: outputId,
              downloadUrl: `/api/download/${outputId}` 
            } 
          });
          logger.info(`Job ${jobId} completed successfully.`);
        }
      })
      .catch((err) => {
        const job = jobs.get(jobId);
        if (job) {
          jobs.set(jobId, { ...job, status: 'failed', progress: 0, error: err.message });
          logger.error(`Job ${jobId} failed:`, err);
        }
      });

    res.json({ jobId });
  } catch (error) {
    logger.error('Process API Error:', error);
    res.status(500).json({ error: 'Internal server error during process initiation' });
  }
});

app.get('/api/download/:id', (req, res) => {
  const filePath = path.join(outputDir, req.params.id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath, `vinci-export-${req.params.id}`);
});

app.get('/api/job/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.post('/api/ai/generate-script', async (req, res) => {
  const { topic } = req.body;
  // Local rule-based script generation
  const script = {
    title: `Viral ${topic} Short`,
    scenes: [
      { time: "0:00", visual: "Hook: Fast-paced intro", text: `Did you know this about ${topic}?` },
      { time: "0:05", visual: "Main content: Key fact", text: "Here is the most interesting part." },
      { time: "0:12", visual: "Call to action", text: `Follow for more ${topic} content!` }
    ]
  };
  res.json(script);
});

app.post('/api/ai/monetize', async (_req, res) => {
  // Local rule-based monetization pack
  res.json({
    titles: ["Mind-Blowing Facts", "You Won't Believe This", "The Secret to Success"],
    description: "Check out this amazing video! #viral #trending #videoediting",
    tags: ["viral", "video", "edit", "ai", "vinci"]
  });
});

app.post('/api/ai/generate-reels', async (req, res) => {
  try {
    const { inputId } = req.body;
    if (!inputId) return res.status(400).json({ error: 'Missing inputId' });

    const inputPath = path.join(uploadDir, inputId);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Source video not found' });

    const jobId = uuidv4();
    const outputId = `reel-${uuidv4()}.mp4`;
    const outputPath = path.join(outputDir, outputId);

    jobs.set(jobId, { 
      id: jobId, 
      status: 'processing', 
      progress: 0, 
      type: 'reel_generation',
      createdAt: new Date().toISOString()
    });

    // AI Reel Logic: 
    // 1. Find highlights (placeholder logic: take first 15s)
    // 2. Crop to 9:16
    // 3. Add background music (optional)
    const options = {
      jobId,
      trim: { start: 0, duration: 15 },
      crop: true, // 9:16 crop
      filters: [{ type: 'vivid' }],
      normalizeAudio: true
    };

    runFFmpeg(inputPath, outputPath, options)
      .then(() => {
        const job = jobs.get(jobId);
        if (job) {
          jobs.set(jobId, { 
            ...job, 
            status: 'completed', 
            progress: 100, 
            result: { url: `/outputs/${outputId}`, id: outputId } 
          });
        }
      })
      .catch(err => {
        const job = jobs.get(jobId);
        if (job) jobs.set(jobId, { ...job, status: 'failed', error: err.message });
      });

    res.json({ jobId });
  } catch (error) {
    logger.error('Generate Reels Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/ai/generate-avatar', async (req, res) => {
  const { text } = req.body;
  try {
    // 1. Image Generation (Placeholder for local Stable Diffusion CLI)
    const imageId = uuidv4();
    const imagePath = path.join(avatarDir, `${imageId}.png`);
    
    // In a real setup: await execPromise(`python3 sd_inference.py --prompt "${prompt}" --output "${imagePath}"`);
    // For now, we use a default avatar if it exists, or a placeholder
    const defaultAvatar = path.join(process.cwd(), 'public', 'default-avatar.png');
    if (fs.existsSync(defaultAvatar)) {
      fs.copyFileSync(defaultAvatar, imagePath);
    } else {
      // Create a simple 1x1 pixel PNG placeholder if default doesn't exist
      const placeholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(imagePath, placeholder);
    }

    // 2. Local TTS
    const audioId = uuidv4();
    const audioPath = path.join(avatarDir, `${audioId}.wav`);
    await generateSpeechLocally(text, audioPath);

    // 3. Local Lip Sync (Wav2Lip)
    const outputId = `avatar-${uuidv4()}.mp4`;
    const outputPath = path.join(outputDir, outputId);
    await runLipSyncLocally(imagePath, audioPath, outputPath);

    res.json({
      imageUrl: `/avatars/${imageId}.png`,
      audioUrl: `/avatars/${audioId}.wav`,
      videoUrl: `/outputs/${outputId}`
    });
  } catch (error) {
    logger.error('Local Avatar Error:', error);
    res.status(500).json({ error: 'Failed to generate local AI avatar' });
  }
});

// Serve static files
app.use('/uploads', express.static(uploadDir));
app.use('/outputs', express.static(outputDir));
app.use('/avatars', express.static(avatarDir));

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vinci AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
