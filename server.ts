import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import { execFile } from 'child_process';
import util from 'util';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const execFilePromise = util.promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));

// Directories for original videos, uploads, audio cache, and dubbed outputs
const videosDir = path.resolve(process.cwd(), 'public/videos');
const uploadsDir = path.resolve(process.cwd(), 'uploads');
const dubbedVideosDir = path.resolve(process.cwd(), 'dubbed-videos');

if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dubbedVideosDir)) fs.mkdirSync(dubbedVideosDir, { recursive: true });

// Hardened static serving for untrusted media: never sniff types, never allow
// active content to execute on this origin (AUDIT F02).
function untrustedStatic(root: string) {
  return express.static(root, {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    },
  });
}
app.use('/videos', untrustedStatic(videosDir));
app.use('/dubbed-videos', untrustedStatic(dubbedVideosDir));
app.use('/uploads', untrustedStatic(uploadsDir));

// --- Safe opaque resource names (AUDIT F01) ---------------------------------
// Client-supplied identifiers must never contain separators or traversal
// sequences. Server-generated names only: letters, digits, dot, underscore,
// hyphen; first character alphanumeric; max 128 chars.
const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function isSafeName(name: unknown): name is string {
  return typeof name === 'string' && SAFE_NAME_RE.test(name) && !name.includes('..');
}
/** Resolve `name` strictly inside `baseDir`, or null if unsafe/escaping. */
function resolveContained(baseDir: string, name: string): string | null {
  if (!isSafeName(name)) return null;
  const base = path.resolve(baseDir);
  const candidate = path.resolve(base, name);
  if (!candidate.startsWith(base + path.sep)) return null;
  return candidate;
}

// --- Request bounds (AUDIT F04 interim mitigation) --------------------------
// Full bounded/streaming media work is TASK-020/022/028. Until then these
// finite schema limits reject the pathological inputs that caused unbounded
// synchronous allocation. 7200 s at 24 kHz mono s16 = ~345 MB per buffer —
// high, but finite; larger work must use the durable job pipeline.
const MAX_STITCH_SECONDS = 7200;
const MAX_TIMELINE_SEGMENTS = 1000;
interface TimelineSegmentInput {
  id: string;
  start: number;
  end: number;
}
function validateTimeline(
  segments: unknown,
  totalDurationSeconds: unknown,
): { ok: true; segments: TimelineSegmentInput[]; totalDurationSeconds: number } | { ok: false; error: string } {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { ok: false, error: 'segments array is required' };
  }
  if (segments.length > MAX_TIMELINE_SEGMENTS) {
    return { ok: false, error: `segments exceeds ${MAX_TIMELINE_SEGMENTS} items` };
  }
  const duration = totalDurationSeconds;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration > MAX_STITCH_SECONDS) {
    return { ok: false, error: `totalDurationSeconds must be a finite number in (0, ${MAX_STITCH_SECONDS}]` };
  }
  const out: TimelineSegmentInput[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as Record<string, unknown>;
    const id = seg?.id;
    const start = seg?.start;
    const end = seg?.end;
    if (!isSafeName(id)) {
      return { ok: false, error: `segments[${i}].id is invalid` };
    }
    if (
      typeof start !== 'number' || typeof end !== 'number' ||
      !Number.isFinite(start) || !Number.isFinite(end) ||
      start < 0 || end < start || end > duration + 3600
    ) {
      return { ok: false, error: `segments[${i}] timestamps are out of range` };
    }
    out.push({ id, start, end });
  }
  return { ok: true, segments: out, totalDurationSeconds: duration };
}

// --- Upload validation (AUDIT F02) ------------------------------------------
// Extensions are derived from sniffed container magic, never from the client.
const VIDEO_MAGIC: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  // ISO-BMFF (mp4/mov/m4v): 'ftyp' at byte offset 4
  { ext: '.mp4', test: (b) => b.length >= 12 && b.subarray(4, 8).toString('latin1') === 'ftyp' },
  // EBML (webm/mkv)
  { ext: '.webm', test: (b) => b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  // AVI: RIFF....AVI
  { ext: '.avi', test: (b) => b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'AVI ' },
];
function sniffVideoExt(head: Buffer): string | null {
  for (const { ext, test } of VIDEO_MAGIC) {
    if (test(head)) return ext;
  }
  return null;
}

// Multer storage for user original video uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, _file, cb) => {
    // Server-generated opaque name; real extension is appended after sniffing.
    cb(null, `orig_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.bin`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB interim cap; resumable large upload is TASK-009/039
});

// Initialize Google GenAI client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Split long-form manhwa marathon into 15-30 min arcs
 */
app.post('/api/gemini/chunk-marathon', async (req, res) => {
  try {
    const { title, totalDurationMinutes = 600, customChapters = [] } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const prompt = `
You are an expert anime and manhwa YouTube recap producer.
A user has an ultra-long manhwa recap marathon video:
Title: "${title || 'I Became The Undefeated Monarch in 100 Days'}"
Total Duration: ${totalDurationMinutes} minutes (approx ${(totalDurationMinutes / 60).toFixed(1)} hours).
Provided Chapter Notes: ${JSON.stringify(customChapters)}

Split this ultra-long marathon video into episodic 15 to 30-minute story arcs suitable for YouTube binge-watching and episodic Urdu dubbing.
Each arc should have:
1. arcNumber: integer (1, 2, 3...)
2. title: Catchy YouTube episode title (e.g. "Arc 1: The Weakest Hunter's Awakening")
3. titleUrdu: Catchy Urdu title (e.g. "حصہ 1: سب سے کمزور ہنٹر کی بیداری")
4. startMinute: integer
5. endMinute: integer
6. durationMinutes: integer (between 15 and 30 minutes)
7. cliffhangerHook: The dramatic ending hook for the episode (English)
8. cliffhangerHookUrdu: The dramatic ending hook in conversational Urdu
9. pacing: "fast-paced" | "action-heavy" | "emotional-lore" | "boss-fight"
10. chaptersCovered: string (e.g. "Chapters 1 - 15")

Partition the entire duration from 0 to ${totalDurationMinutes} minutes into 8 to 15 cohesive arcs.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            arcs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  arcNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  titleUrdu: { type: Type.STRING },
                  startMinute: { type: Type.INTEGER },
                  endMinute: { type: Type.INTEGER },
                  durationMinutes: { type: Type.INTEGER },
                  cliffhangerHook: { type: Type.STRING },
                  cliffhangerHookUrdu: { type: Type.STRING },
                  pacing: { type: Type.STRING },
                  chaptersCovered: { type: Type.STRING },
                },
                required: [
                  'arcNumber',
                  'title',
                  'titleUrdu',
                  'startMinute',
                  'endMinute',
                  'durationMinutes',
                  'cliffhangerHook',
                  'cliffhangerHookUrdu',
                  'pacing',
                  'chaptersCovered',
                ],
              },
            },
          },
          required: ['arcs'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"arcs":[]}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error chunking marathon:', error);
    res.status(500).json({ error: error.message || 'Failed to partition marathon arcs' });
  }
});

/**
 * Adapt English Manhwa recap transcript into Conversational Urdu YouTube style
 */
app.post('/api/gemini/translate-recap', async (req, res) => {
  try {
    const { segments, arcContext = '', characterNames = [] } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'segments array is required' });
    }

    const prompt = `
You are the top Urdu/Hindi Anime & Manhwa YouTube recap narrator (famous for captivating storytelling in conversational Urdu).
Transform the following English manhwa recap transcript into conversational spoken Urdu for a YouTube voiceover.

CRITICAL TONE RULES:
1. USE NATURAL CONVERSATIONAL URDU (popular YouTube recap style):
   - Use recap hooks and storytelling transitions: "Kahani shuru hoti hai...", "Humara main character...", "Lekin achanak...", "Ab aage dekhiye...", "Yeh sun kar wo dang reh gaya!", "Usne socha bhi nahi tha...".
   - Avoid overly formal/bookish Arabic-Persian archaic words. Use words ordinary viewers understand and love.
   - Maintain fast-paced, breathless anime recap narration rhythm.
2. Provide TRIPLE representation for every segment:
   - "urduText": Proper Urdu Nastaliq script.
   - "romanUrduText": Roman Urdu Latin script (e.g. "Humara hero achanak uthta hai aur dekhta hai ke system screen saamne hai...").
   - "toneDirective": Vocal emotion instruction for the voice actor or TTS (e.g. "Dramatic Whisper", "High Tension Battle", "Suspenseful Hook", "Astonished").
   - "recapPacing": Estimated reading pace ("fast", "normal", "slow").

Arc Context: ${arcContext}
Character Names: ${characterNames.join(', ')}

English Segments to Adapt:
${JSON.stringify(segments, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            adaptedSegments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  englishText: { type: Type.STRING },
                  urduText: { type: Type.STRING },
                  romanUrduText: { type: Type.STRING },
                  toneDirective: { type: Type.STRING },
                  recapPacing: { type: Type.STRING },
                },
                required: ['id', 'start', 'end', 'englishText', 'urduText', 'romanUrduText', 'toneDirective'],
              },
            },
          },
          required: ['adaptedSegments'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"adaptedSegments":[]}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error translating recap:', error);
    res.status(500).json({ error: error.message || 'Failed to adapt recap script' });
  }
});

import crypto from 'crypto';

const audioCacheDir = path.resolve(process.cwd(), 'audio-cache');
if (!fs.existsSync(audioCacheDir)) {
  fs.mkdirSync(audioCacheDir, { recursive: true });
}

function getAudioCacheKey(text: string, voice = 'Zephyr') {
  const norm = (text || '').trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(`${voice}:${norm}`).digest('hex');
}

// Demo placeholder-tone generation and preset-dialogue maps were removed from
// the production server in TASK-005 (AUDIT F07/F09/F10): narration artifacts
// may only come from explicit TTS requests; tones are never presented as speech.
// Fixture generation lives in the standalone dev script pre-cache.ts only.

// Read-only audio artifact access (AUDIT F07). GET and HEAD never synthesize,
// never write, and never fall back to placeholder audio. Speech is produced
// only through the explicit POST /api/gemini/tts job below.
app.get('/audio-cache/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = resolveContained(audioCacheDir, filename);
  if (!filePath) {
    return res.status(400).json({ error: 'Invalid artifact name' });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ error: 'Audio artifact not found' });
  }
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return fs.createReadStream(filePath).pipe(res);
});

app.get('/api/cached-audio-list', (req, res) => {
  try {
    const files = fs.readdirSync(audioCacheDir).filter((f) => f.endsWith('.wav'));
    res.json({ files });
  } catch {
    res.json({ files: [] });
  }
});

/**
 * Generate High-Fidelity Urdu Voiceover with Gemini TTS (gemini-3.8-flash-lite-tts)
 */
app.post('/api/gemini/tts', async (req, res) => {
  try {
    const { text, segmentId, voiceName = 'Zephyr', toneStyle = 'Excited, dramatic anime recap narrator with high tension and energy' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const validVoices = ['Zephyr', 'Fenrir', 'Kore', 'Puck', 'Charon'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Zephyr';

    if (segmentId !== undefined && !isSafeName(segmentId)) {
      return res.status(400).json({ error: 'Invalid segmentId' });
    }
    if (text.length > 10000) {
      return res.status(400).json({ error: 'text exceeds 10000 characters' });
    }

    // 1. Check disk cache first!
    const cacheKey = getAudioCacheKey(text, chosenVoice);
    const keyFile = resolveContained(audioCacheDir, `${cacheKey}.wav`)!;
    const idFile = segmentId ? resolveContained(audioCacheDir, `${segmentId}.wav`) : null;
    const resolvedUrl = `/audio-cache/${segmentId ? `${segmentId}.wav` : `${cacheKey}.wav`}`;

    if (idFile && fs.existsSync(idFile)) {
      const buffer = fs.readFileSync(idFile);
      return res.json({
        audioUrl: resolvedUrl,
        audioBase64: buffer.toString('base64'),
        mimeType: 'audio/wav',
        voice: chosenVoice,
        fromCache: true,
      });
    }

    if (fs.existsSync(keyFile)) {
      const buffer = fs.readFileSync(keyFile);
      if (idFile) fs.writeFileSync(idFile, buffer);
      return res.json({
        audioUrl: resolvedUrl,
        audioBase64: buffer.toString('base64'),
        mimeType: 'audio/wav',
        voice: chosenVoice,
        fromCache: true,
      });
    }

    if (!apiKey) {
      // Honest failure: no credentials means no speech. Never substitute a
      // placeholder tone for narration (AUDIT F07/F09).
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    // Call gemini-3.8-flash-lite-tts unary
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text,
              speechMetadata: {
                style: toneStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(502).json({ error: 'No audio data returned from Gemini TTS model.' });
    }

    // Save to disk cache
    const buf = Buffer.from(base64Audio, 'base64');
    fs.writeFileSync(keyFile, buf);
    if (idFile) {
      fs.writeFileSync(idFile, buf);
    }

    res.json({
      audioUrl: resolvedUrl,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voice: chosenVoice,
      fromCache: false,
    });
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    res.status(502).json({ error: 'TTS provider request failed; no audio was produced.' });
  }
});

/**
 * Batch synthesize all segments in an arc
 */
app.post('/api/gemini/batch-tts', async (req, res) => {
  try {
    const { segments = [], voiceName = 'Zephyr', toneStyle = 'Dramatic conversational Urdu YouTube manhwa recap host' } = req.body;

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'segments array is required' });
    }
    if (segments.length > 1000) {
      return res.status(400).json({ error: 'segments exceeds 1000 items; use the durable job pipeline for larger batches' });
    }
    if (!apiKey) {
      // Honest missing-key failure up front: no partial fake results (AUDIT F09).
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const validVoices = ['Zephyr', 'Fenrir', 'Kore', 'Puck', 'Charon'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Zephyr';

    const results: Array<{ id: string; audioUrl: string | null; audioGenerated: boolean; error?: string }> = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segId = seg.id;
      if (!isSafeName(segId)) {
        results.push({ id: String(segId ?? `index-${i}`), audioUrl: null, audioGenerated: false, error: 'invalid-id' });
        continue;
      }
      const text = seg.urduText || seg.romanUrduText;
      if (!text || typeof text !== 'string') {
        results.push({ id: segId, audioUrl: null, audioGenerated: false, error: 'no-text' });
        continue;
      }
      if (text.length > 10000) {
        results.push({ id: segId, audioUrl: null, audioGenerated: false, error: 'text-too-long' });
        continue;
      }

      const cacheKey = getAudioCacheKey(text, chosenVoice);
      const idFile = resolveContained(audioCacheDir, `${segId}.wav`)!;
      const keyFile = resolveContained(audioCacheDir, `${cacheKey}.wav`)!;
      const audioUrl = `/audio-cache/${segId}.wav`;

      if (fs.existsSync(idFile)) {
        results.push({ id: segId, audioUrl, audioGenerated: true });
        continue;
      }
      if (fs.existsSync(keyFile)) {
        fs.writeFileSync(idFile, fs.readFileSync(keyFile));
        results.push({ id: segId, audioUrl, audioGenerated: true });
        continue;
      }

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text, speechMetadata: { style: toneStyle } }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: chosenVoice } },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const buf = Buffer.from(base64Audio, 'base64');
          fs.writeFileSync(keyFile, buf);
          fs.writeFileSync(idFile, buf);
          results.push({ id: segId, audioUrl, audioGenerated: true });
          continue;
        }
        results.push({ id: segId, audioUrl: null, audioGenerated: false, error: 'provider-returned-no-audio' });
      } catch (err: any) {
        console.warn(`Batch TTS item ${segId} warning:`, err.message);
        // Failed or partial generation stays visibly failed (AUDIT F09).
        results.push({ id: segId, audioUrl: null, audioGenerated: false, error: 'provider-error' });
      }
    }

    const failed = results.filter((r) => !r.audioGenerated).length;
    res.json({ results, complete: failed === 0, failedCount: failed });
  } catch (error: any) {
    console.error('Error in batch TTS:', error);
    res.status(502).json({ error: 'Batch TTS synthesis failed; see results for per-item state.' });
  }
});

/**
 * Stitch all segments into a master continuous WAV audio track
 */
app.post('/api/gemini/stitch-master-audio', (req, res) => {
  try {
    const { segments = [], totalDurationSeconds = 120, arcId = 'arc-1', allowPartial = false } = req.body;

    const checked = validateTimeline(segments, totalDurationSeconds);
    if (!checked.ok) {
      return res.status(400).json({ error: checked.error });
    }
    if (!isSafeName(arcId)) {
      return res.status(400).json({ error: 'Invalid arcId' });
    }
    const timeline = checked.segments;
    const duration = checked.totalDurationSeconds;

    const sampleRate = 24000;
    const bytesPerSample = 2; // 16-bit
    const totalSamples = Math.ceil(duration * sampleRate);
    const pcmDataSize = totalSamples * bytesPerSample;

    // Allocate silence buffer for entire arc
    const masterPcm = Buffer.alloc(pcmDataSize);

    // Merge each segment; missing artifacts are recorded, never silently
    // replaced with silence presented as success (AUDIT F09).
    const missingSegments: string[] = [];
    for (const seg of timeline) {
      const segFile = resolveContained(audioCacheDir, `${seg.id}.wav`)!;
      if (!fs.existsSync(segFile)) {
        missingSegments.push(seg.id);
        continue;
      }
      const segWav = fs.readFileSync(segFile);
      if (segWav.length > 44) {
        const segPcm = segWav.subarray(44);
        const startSample = Math.floor((seg.start || 0) * sampleRate);
        const startByte = startSample * bytesPerSample;

        if (startByte < masterPcm.length) {
          const copyLen = Math.min(segPcm.length, masterPcm.length - startByte);
          segPcm.copy(masterPcm, startByte, 0, copyLen);
        }
      }
    }

    if (missingSegments.length > 0 && !allowPartial) {
      return res.status(409).json({
        error: 'Missing segment audio; refusing to render silence as complete narration. Generate the missing segments or pass allowPartial:true to accept explicit gaps.',
        missingSegments,
      });
    }

    // Build master WAV with RIFF header
    const masterWav = Buffer.alloc(44 + pcmDataSize);
    masterWav.write('RIFF', 0);
    masterWav.writeUInt32LE(36 + pcmDataSize, 4);
    masterWav.write('WAVE', 8);
    masterWav.write('fmt ', 12);
    masterWav.writeUInt32LE(16, 16);
    masterWav.writeUInt16LE(1, 20); // PCM
    masterWav.writeUInt16LE(1, 22); // Mono
    masterWav.writeUInt32LE(sampleRate, 24);
    masterWav.writeUInt32LE(sampleRate * bytesPerSample, 28);
    masterWav.writeUInt16LE(bytesPerSample, 32);
    masterWav.writeUInt16LE(16, 34);
    masterWav.write('data', 36);
    masterWav.writeUInt32LE(pcmDataSize, 40);
    masterPcm.copy(masterWav, 44);

    const masterFilename = `master_${arcId}_${Date.now()}.wav`;
    const masterPath = resolveContained(audioCacheDir, masterFilename)!;
    fs.writeFileSync(masterPath, masterWav);

    res.json({
      masterAudioUrl: `/audio-cache/${masterFilename}`,
      durationSeconds: duration,
      fileSizeBytes: masterWav.length,
      partial: missingSegments.length > 0,
      missingSegments,
    });
  } catch (error: any) {
    console.error('Error stitching audio:', error);
    res.status(500).json({ error: 'Failed to stitch master audio' });
  }
});

/**
 * Upload an original manhwa video file for dubbing (MP4, WebM, MKV, MOV)
 */
app.post('/api/upload-video', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }
  // Validate actual media container (AUDIT F02): extension comes from sniffed
  // magic bytes, never from the client. Non-video/active content is deleted.
  const tmpPath = req.file.path;
  try {
    const fd = fs.openSync(tmpPath, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    const ext = sniffVideoExt(head);
    if (!ext || req.file.size < 16) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'Rejected: file is not a recognized video container (mp4/mov/webm/mkv/avi).' });
    }
    const baseName = path.basename(req.file.filename, '.bin');
    const finalName = `${baseName}${ext}`;
    const finalPath = resolveContained(uploadsDir, finalName)!;
    fs.renameSync(tmpPath, finalPath);
    res.json({
      success: true,
      videoUrl: `/uploads/${finalName}`,
      filename: finalName,
      originalname: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    console.error('Upload validation error:', err);
    try { fs.unlinkSync(tmpPath); } catch { /* already removed */ }
    return res.status(400).json({ error: 'Upload validation failed; file was discarded.' });
  }
});

// Multer failures (e.g. size limit) must fail honestly as JSON (AUDIT F04/F02).
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Upload exceeds the 500 MB interim limit; large resumable transfer is TASK-009/039.' });
  }
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ error: `Upload rejected: ${err.code}` });
  }
  return next(err);
});

/**
 * List available original videos (built-in sample and user uploads)
 */
app.get('/api/available-videos', (req, res) => {
  try {
    const samplePath = path.join(videosDir, 'sample-manhwa-original.mp4');
    const hasSample = fs.existsSync(samplePath);
    const uploadedFiles = fs.existsSync(uploadsDir)
      ? fs.readdirSync(uploadsDir).filter((f) => /\.(mp4|webm|mkv|mov)$/i.test(f))
      : [];
    const dubbedFiles = fs.existsSync(dubbedVideosDir)
      ? fs.readdirSync(dubbedVideosDir).filter((f) => /\.(mp4|webm)$/i.test(f))
      : [];

    res.json({
      sample: hasSample
        ? {
            videoUrl: '/videos/sample-manhwa-original.mp4',
            title: 'Sample Manhwa Recap Original Video (Solo Leveling Episode 1)',
            durationSeconds: 105,
          }
        : null,
      uploads: uploadedFiles.map((f) => ({
        videoUrl: `/uploads/${f}`,
        filename: f,
      })),
      recentDubbed: dubbedFiles.map((f) => ({
        dubbedVideoUrl: `/dubbed-videos/${f}`,
        filename: f,
      })),
    });
  } catch (err: any) {
    res.json({ error: err.message, uploads: [], recentDubbed: [] });
  }
});

/**
 * Studio Quality Dubbing Engine:
 * Combines Original Video + Synced Spoken Urdu Audio using FFmpeg
 */
app.post('/api/dub-video-studio', async (req, res) => {
  try {
    const {
      videoSource = 'sample',
      uploadedVideoUrl,
      arcId = 'arc-1',
      segments = [],
      totalDurationSeconds = 105,
      allowPartial = false,
    } = req.body;

    const checked = validateTimeline(segments, totalDurationSeconds);
    if (!checked.ok) {
      return res.status(400).json({ error: checked.error });
    }
    if (!isSafeName(arcId)) {
      return res.status(400).json({ error: 'Invalid arcId' });
    }
    const timeline = checked.segments;
    const duration = checked.totalDurationSeconds;

    // 1. Resolve original video file path. Never silently substitute the
    //    sample video for an invalid upload reference (AUDIT F12).
    let inputVideoPath: string;
    if (videoSource === 'sample') {
      inputVideoPath = path.join(videosDir, 'sample-manhwa-original.mp4');
    } else if (videoSource === 'uploaded') {
      const uploadName = typeof uploadedVideoUrl === 'string' ? path.posix.basename(uploadedVideoUrl.replace(/^\/+/, '')) : '';
      const candidatePath = resolveContained(uploadsDir, uploadName);
      if (!candidatePath || !fs.existsSync(candidatePath)) {
        return res.status(400).json({ error: 'Invalid or missing uploaded video reference; refusing to substitute sample footage.' });
      }
      inputVideoPath = candidatePath;
    } else {
      return res.status(400).json({ error: "videoSource must be 'sample' or 'uploaded'" });
    }

    if (!fs.existsSync(inputVideoPath)) {
      return res.status(404).json({ error: 'Original video not found' });
    }

    // 2. Stitch master continuous Urdu WAV track
    const sampleRate = 24000;
    const bytesPerSample = 2; // 16-bit
    const totalSamples = Math.ceil(duration * sampleRate);
    const pcmDataSize = totalSamples * bytesPerSample;
    const masterPcm = Buffer.alloc(pcmDataSize);

    const missingSegments: string[] = [];
    for (const seg of timeline) {
      const segFile = resolveContained(audioCacheDir, `${seg.id}.wav`)!;
      if (!fs.existsSync(segFile)) {
        missingSegments.push(seg.id);
        continue;
      }
      const segWav = fs.readFileSync(segFile);
      if (segWav.length > 44) {
        const segPcm = segWav.subarray(44);
        const startSample = Math.floor((seg.start || 0) * sampleRate);
        const startByte = startSample * bytesPerSample;

        if (startByte < masterPcm.length) {
          const copyLen = Math.min(segPcm.length, masterPcm.length - startByte);
          segPcm.copy(masterPcm, startByte, 0, copyLen);
        }
      }
    }

    if (missingSegments.length > 0 && !allowPartial) {
      return res.status(409).json({
        error: 'Missing segment audio; refusing to mux silence as complete narration. Generate the missing segments or pass allowPartial:true to accept explicit gaps.',
        missingSegments,
      });
    }

    // Build master WAV with RIFF header
    const masterWav = Buffer.alloc(44 + pcmDataSize);
    masterWav.write('RIFF', 0);
    masterWav.writeUInt32LE(36 + pcmDataSize, 4);
    masterWav.write('WAVE', 8);
    masterWav.write('fmt ', 12);
    masterWav.writeUInt32LE(16, 16);
    masterWav.writeUInt16LE(1, 20); // PCM
    masterWav.writeUInt16LE(1, 22); // Mono
    masterWav.writeUInt32LE(sampleRate, 24);
    masterWav.writeUInt32LE(sampleRate * bytesPerSample, 28);
    masterWav.writeUInt16LE(bytesPerSample, 32);
    masterWav.writeUInt16LE(16, 34);
    masterWav.write('data', 36);
    masterWav.writeUInt32LE(pcmDataSize, 40);
    masterPcm.copy(masterWav, 44);

    const masterAudioFilename = `master_${arcId}_${Date.now()}.wav`;
    const masterAudioPath = resolveContained(audioCacheDir, masterAudioFilename)!;
    fs.writeFileSync(masterAudioPath, masterWav);

    // 3. Mux original video stream + studio Urdu audio stream via FFmpeg
    const outFilename = `dubbed_${arcId}_${Date.now()}.mp4`;
    const outputPath = resolveContained(dubbedVideosDir, outFilename)!;

    try {
      await execFilePromise('ffmpeg', [
        '-y',
        '-i', inputVideoPath,
        '-i', masterAudioPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        outputPath,
      ]);
    } catch (ffErr: any) {
      if (ffErr && ffErr.code === 'ENOENT') {
        return res.status(503).json({ error: 'FFmpeg is not available on this server; rendering requires a media worker (see docs/11-infrastructure-deployment.md).' });
      }
      console.error('FFmpeg mux failed:', ffErr);
      return res.status(500).json({ error: 'FFmpeg mux failed; no dubbed video was produced.' });
    }

    const stat = fs.statSync(outputPath);

    res.json({
      success: true,
      dubbedVideoUrl: `/dubbed-videos/${outFilename}`,
      filename: outFilename,
      fileSizeBytes: stat.size,
      durationSeconds: duration,
      masterAudioUrl: `/audio-cache/${masterAudioFilename}`,
      partial: missingSegments.length > 0,
      missingSegments,
      message: 'Original video and studio Urdu voiceover successfully merged!',
    });
  } catch (err: any) {
    console.error('Error in dub-video-studio:', err);
    res.status(500).json({ error: 'Failed to merge original video and Urdu dub' });
  }
});

/**
 * Transcript extraction is NOT implemented. This route previously asked a model
 * to invent a realistic sample transcript from URL/title text (AUDIT F10) and
 * presented it as the user's source. It is disabled rather than faked: a real
 * source-derived transcript arrives via TASK-014 (ASR) or an owner-supplied
 * transcript file. See docs/03-youtube-rights-ingestion.md.
 */
app.post('/api/gemini/extract-transcript', (_req, res) => {
  res.status(501).json({
    error: 'Automatic transcript extraction from a YouTube link is not implemented. Provide authorized source media (upload) or a supplied transcript; a link is not a source of renderable bytes.',
  });
});

/**
 * Setup Vite in Dev or Static files in Prod
 */
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve ONLY the built client directory. The server bundle lives at
    // dist/server.js and must never be reachable over HTTP (AUDIT F15).
    const clientPath = path.resolve(process.cwd(), 'dist', 'public');
    app.use(express.static(clientPath, { index: false, dotfiles: 'deny' }));
    // SPA fallback for client routes only; API paths, dotfiles, and file-like
    // paths (e.g. /server.js, /.env) must never receive HTML or backend bytes.
    app.get('*', (req, res, _next) => {
      const isDotfile = path.basename(req.path).startsWith('.');
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/audio-cache/') ||
        isDotfile ||
        path.extname(req.path) !== ''
      ) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.resolve(clientPath, 'index.html'), (err) => {
        if (err) {
          res.status(404).json({ error: 'Client build not found. Run npm run build first.' });
        }
      });
    });
  }

  const server = app.listen(PORT, () => {
    const address = server.address();
    const boundPort = typeof address === 'object' && address !== null ? address.port : PORT;
    console.log(`ManhwaUrdu DubStudio server listening on http://0.0.0.0:${boundPort}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
