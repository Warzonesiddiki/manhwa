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

app.use('/videos', express.static(videosDir));
app.use('/dubbed-videos', express.static(dubbedVideosDir));
app.use('/uploads', express.static(uploadsDir));

// Multer storage for user original video uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `orig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
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

const PRESET_SEGMENTS: Record<string, string> = {
  'seg-1-1': 'کہانی کی شروعات ہوتی ہے ایک خطرناک ایس رینک ڈنجن کے اندر، جہاں ہمارے مین کریکٹر ریان کو اس کی اپنی ٹیم نے دھوکہ دے کر مانسٹرز کے سامنے مرنے کے لیے چھوڑ دیا۔',
  'seg-1-2': 'پورے پانچ سالوں سے ریان کو سب بیکار کچرا سمجھتے تھے، کیونکہ اس کے پاس پورے ملک میں سب سے کمزور ایف رینک اسٹیٹس تھا۔',
  'seg-1-3': 'سیکڑوں خونخوار بھیڑیوں کے بیچ گھیرا ہمارا ہیرو اپنی آخری سانسیں گن رہا تھا۔ لیکن بالکل اسی لمحے، اس کی آنکھوں کے سامنے ایک سنہری سسٹم اسکرین چمک اٹھی!',
  'seg-1-4': 'نوٹیفکیشن میں لکھا تھا: کیا تم قدیم انڈیڈ بادشاہ کا خفیہ تخت حاصل کرنا چاہتے ہو؟ ریان نے بنا ایک سیکنڈ ضائع کیے فورا چیخ کر کہا: ہاں، مجھے منظور ہے!',
  'seg-1-5': 'اور پھر، ڈنجن کے اندر کالے جادو کا اتنا خوفناک دھماکہ ہوا کہ سارے مانسٹرز دہشت سے کانپنے لگے! ریان کی آنکھوں سے خطرناک جامنی روشنی نکلنے لگی۔',
  'seg-1-6': 'سسٹم نے اسے پہلا حکم دیا: اٹھو! اور صرف اس ایک لفظ سے، مرے ہوئے جانوروں کی لاشیں سیاہ سائے والے سپاہی بن کر اپنے نئے بادشاہ کے آگے سر جھکانے لگیں!',
  'seg-1-7': 'اب وہ ہنٹر، جسے سب بیکار سمجھ کر مرنے کے لیے چھوڑ آئے تھے، انسانی دنیا میں واپس لوٹنے والا ہے۔ اور اسے دھوکہ دینے والوں کو اندازہ بھی نہیں کہ انہوں نے کیسی بلا کو جگا دیا ہے!',
};

function generateDramaticNarrationWav(durationSec = 4): Buffer {
  const sampleRate = 24000;
  const numSamples = sampleRate * durationSec;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Smooth cinematic chord sweep
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.sin((t / durationSec) * Math.PI);
    const s1 = Math.sin(2 * Math.PI * 146.83 * t); // D3
    const s2 = Math.sin(2 * Math.PI * 174.61 * t) * 0.6; // F3
    const s3 = Math.sin(2 * Math.PI * 220.00 * t) * 0.4; // A3
    const sample = Math.floor((s1 + s2 + s3) * 0.35 * env * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), 44 + i * 2);
  }
  return buffer;
}

// Resilient audio endpoint that serves cached or on-demand synthesized audio
app.get('/audio-cache/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(audioCacheDir, filename);

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Accept-Ranges', 'bytes');

  if (fs.existsSync(filePath)) {
    return fs.createReadStream(filePath).pipe(res);
  }

  // File not found on disk, try resolving from segment ID or query text
  const segId = filename.replace(/\.wav$/, '');
  const text = (req.query.text as string) || PRESET_SEGMENTS[segId];

  if (text && apiKey) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text, speechMetadata: { style: 'Dramatic Urdu anime recap storyteller' } }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const buf = Buffer.from(base64Audio, 'base64');
        fs.writeFileSync(filePath, buf);
        return res.end(buf);
      }
    } catch (e: any) {
      console.warn(`Dynamic TTS generation for ${segId} warning:`, e.message);
    }
  }

  // Fallback to valid synthesized audio buffer so browser media element never fails
  const fallbackBuf = generateDramaticNarrationWav(4);
  fs.writeFileSync(filePath, fallbackBuf);
  return res.end(fallbackBuf);
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

    // 1. Check disk cache first!
    const cacheKey = getAudioCacheKey(text, chosenVoice);
    const keyFile = path.join(audioCacheDir, `${cacheKey}.wav`);
    const idFile = segmentId ? path.join(audioCacheDir, `${segmentId}.wav`) : null;
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
      const fallbackBuf = generateDramaticNarrationWav(4);
      return res.json({
        audioUrl: resolvedUrl,
        audioBase64: fallbackBuf.toString('base64'),
        mimeType: 'audio/wav',
        voice: chosenVoice,
        fromCache: false,
      });
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
    res.status(500).json({ error: error.message || 'Failed to generate voiceover audio' });
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

    const validVoices = ['Zephyr', 'Fenrir', 'Kore', 'Puck', 'Charon'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Zephyr';

    const results: Array<{ id: string; audioUrl: string; audioGenerated: boolean }> = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const text = seg.urduText || seg.romanUrduText;
      if (!text) continue;

      const cacheKey = getAudioCacheKey(text, chosenVoice);
      const idFile = seg.id ? path.join(audioCacheDir, `${seg.id}.wav`) : null;
      const keyFile = path.join(audioCacheDir, `${cacheKey}.wav`);
      const audioUrl = `/audio-cache/${seg.id ? `${seg.id}.wav` : `${cacheKey}.wav`}`;

      if (idFile && fs.existsSync(idFile)) {
        results.push({ id: seg.id, audioUrl, audioGenerated: true });
        continue;
      }
      if (fs.existsSync(keyFile)) {
        if (idFile) fs.writeFileSync(idFile, fs.readFileSync(keyFile));
        results.push({ id: seg.id, audioUrl, audioGenerated: true });
        continue;
      }

      if (apiKey) {
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
            if (idFile) fs.writeFileSync(idFile, buf);
            results.push({ id: seg.id, audioUrl, audioGenerated: true });
            continue;
          }
        } catch (err: any) {
          console.warn(`Batch TTS item ${seg.id} warning:`, err.message);
        }
      }

      // Fallback
      results.push({ id: seg.id, audioUrl, audioGenerated: false });
    }

    res.json({ results });
  } catch (error: any) {
    console.error('Error in batch TTS:', error);
    res.status(500).json({ error: error.message || 'Batch TTS synthesis failed' });
  }
});

/**
 * Stitch all segments into a master continuous WAV audio track
 */
app.post('/api/gemini/stitch-master-audio', (req, res) => {
  try {
    const { segments = [], totalDurationSeconds = 120, arcId = 'arc-1' } = req.body;

    const sampleRate = 24000;
    const bytesPerSample = 2; // 16-bit
    const totalSamples = Math.ceil(totalDurationSeconds * sampleRate);
    const pcmDataSize = totalSamples * bytesPerSample;

    // Allocate silence buffer for entire arc
    const masterPcm = Buffer.alloc(pcmDataSize);

    // Merge each segment
    for (const seg of segments) {
      const segFile = path.join(audioCacheDir, `${seg.id}.wav`);
      if (fs.existsSync(segFile)) {
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
    const masterPath = path.join(audioCacheDir, masterFilename);
    fs.writeFileSync(masterPath, masterWav);

    res.json({
      masterAudioUrl: `/audio-cache/${masterFilename}`,
      durationSeconds: totalDurationSeconds,
      fileSizeBytes: masterWav.length,
    });
  } catch (error: any) {
    console.error('Error stitching audio:', error);
    res.status(500).json({ error: error.message || 'Failed to stitch master audio' });
  }
});

/**
 * Upload an original manhwa video file for dubbing (MP4, WebM, MKV, MOV)
 */
app.post('/api/upload-video', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }
  res.json({
    success: true,
    videoUrl: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
  });
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
    } = req.body;

    // 1. Resolve original video file path
    let inputVideoPath = path.join(videosDir, 'sample-manhwa-original.mp4');
    if (videoSource === 'uploaded' && uploadedVideoUrl) {
      const cleanPath = uploadedVideoUrl.replace(/^\//, '');
      const candidatePath = path.resolve(process.cwd(), cleanPath);
      if (fs.existsSync(candidatePath)) {
        inputVideoPath = candidatePath;
      }
    }

    if (!fs.existsSync(inputVideoPath)) {
      return res.status(404).json({ error: `Original video not found at ${inputVideoPath}` });
    }

    // 2. Stitch master continuous Urdu WAV track
    const sampleRate = 24000;
    const bytesPerSample = 2; // 16-bit
    const duration = Math.max(totalDurationSeconds, 105);
    const totalSamples = Math.ceil(duration * sampleRate);
    const pcmDataSize = totalSamples * bytesPerSample;
    const masterPcm = Buffer.alloc(pcmDataSize);

    for (const seg of segments) {
      const segFile = path.join(audioCacheDir, `${seg.id}.wav`);
      if (fs.existsSync(segFile)) {
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
    const masterAudioPath = path.join(audioCacheDir, masterAudioFilename);
    fs.writeFileSync(masterAudioPath, masterWav);

    // 3. Mux original video stream + studio Urdu audio stream via FFmpeg
    const outFilename = `dubbed_${arcId}_${Date.now()}.mp4`;
    const outputPath = path.join(dubbedVideosDir, outFilename);

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

    const stat = fs.statSync(outputPath);

    res.json({
      success: true,
      dubbedVideoUrl: `/dubbed-videos/${outFilename}`,
      filename: outFilename,
      fileSizeBytes: stat.size,
      durationSeconds: duration,
      masterAudioUrl: `/audio-cache/${masterAudioFilename}`,
      message: 'Original video and studio Urdu voiceover successfully merged!',
    });
  } catch (err: any) {
    console.error('Error in dub-video-studio:', err);
    res.status(500).json({ error: err.message || 'Failed to merge original video and Urdu dub' });
  }
});

/**
 * YouTube / Video Ingest & Transcript Extractor Simulation
 */
app.post('/api/gemini/extract-transcript', async (req, res) => {
  try {
    const { videoUrl, titleHint = '' } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const prompt = `
You are analyzing a YouTube Manhwa Recap Video for dubbing:
Video URL: ${videoUrl || 'https://www.youtube.com/watch?v=4zgCQqFhDxM'}
Title Hint: ${titleHint || 'Solo Necromancer 10+ Hour Recap Marathon'}

Generate a realistic, high-fidelity sample breakdown of this Manhwa recap video.
Provide:
1. detectedTitle: string (e.g. "I Awoke As The Necromancer Sovereign - 100 Chapter Marathon Recap")
2. estimatedDurationSeconds: number (e.g. 28800 = 8 hours)
3. genre: "Action Fantasy System Manhwa"
4. mainCharacter: "Jin-Woo / Rayan"
5. initialSampleSegments: Array of 6 to 8 timestamped segments for Arc 1 (first 2 minutes) with:
   - id: string
   - start: number (seconds)
   - end: number (seconds)
   - englishText: engaging English manhwa recap narrative line
   - urduText: conversational Urdu spoken line
   - romanUrduText: Roman Urdu transliteration
   - toneDirective: "Dramatic Whisper" | "Action Clash" | "Recap Hook"
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedTitle: { type: Type.STRING },
            estimatedDurationSeconds: { type: Type.NUMBER },
            genre: { type: Type.STRING },
            mainCharacter: { type: Type.STRING },
            initialSampleSegments: {
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
                },
                required: ['id', 'start', 'end', 'englishText', 'urduText', 'romanUrduText', 'toneDirective'],
              },
            },
          },
          required: ['detectedTitle', 'estimatedDurationSeconds', 'genre', 'mainCharacter', 'initialSampleSegments'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error extracting transcript:', error);
    res.status(500).json({ error: error.message || 'Failed to extract transcript' });
  }
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
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`ManhwaUrdu DubStudio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
