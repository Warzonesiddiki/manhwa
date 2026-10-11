import { RecapSegment } from '../types';

// In-memory audio cache for synthesized segments
const audioCache = new Map<string, string>(); // segmentId -> blobUrl

/**
 * Format seconds into SRT timestamp (00:00:14,250)
 */
export function formatSrtTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Format seconds into MM:SS display
 */
export function formatTimeDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Generate full SRT subtitle file text
 */
export function generateSrtContent(segments: RecapSegment[], language: 'urdu' | 'roman' | 'dual' = 'dual'): string {
  return segments
    .map((seg, idx) => {
      const start = formatSrtTimestamp(seg.start);
      const end = formatSrtTimestamp(seg.end);
      let text: string;
      if (language === 'urdu') {
        text = seg.urduText;
      } else if (language === 'roman') {
        text = seg.romanUrduText;
      } else {
        // Dual: Urdu script on top, Roman Urdu below for viewers
        text = `${seg.urduText}\n${seg.romanUrduText}`;
      }
      return `${idx + 1}\n${start} --> ${end}\n${text}\n`;
    })
    .join('\n');
}

/**
 * Generate YouTube Chapter markers format (00:00 - Introduction)
 */
export function generateYouTubeChapters(arcs: any[]): string {
  let output = '=== YOUTUBE VIDEO CHAPTER TIMESTAMPS ===\n\n';
  arcs.forEach((arc) => {
    const mins = arc.startMinute;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const timeCode = hrs > 0 
      ? `${String(hrs).padStart(2, '0')}:${String(remMins).padStart(2, '0')}:00` 
      : `${String(remMins).padStart(2, '0')}:00`;

    output += `${timeCode} - ${arc.title} (${arc.titleUrdu})\n`;
  });
  return output;
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string | Blob, filename: string, mimeType = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Synthesize audio line using Gemini TTS via server proxy with caching
 */
export async function synthesizeGeminiTTS(
  segmentId: string,
  urduText: string,
  voiceName = 'Zephyr',
  toneStyle = 'Dramatic, fast-paced YouTube anime manhwa recap host'
): Promise<string> {
  const cacheKey = `${segmentId}-${voiceName}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  // Check if static pre-cache audio file is available on server
  try {
    const staticCheck = await fetch(`/audio-cache/${segmentId}.wav`, { method: 'HEAD' });
    if (staticCheck.ok) {
      const staticUrl = `/audio-cache/${segmentId}.wav`;
      audioCache.set(cacheKey, staticUrl);
      return staticUrl;
    }
  } catch {
    // Best-effort cache probe; synthesis below handles real failures (see TASK-005 F07).
  }

  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: urduText,
      segmentId,
      voiceName,
      toneStyle,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to synthesize' }));
    throw new Error(err.error || 'Server TTS error');
  }

  const data = await res.json();
  if (data.audioUrl) {
    audioCache.set(cacheKey, data.audioUrl);
    return data.audioUrl;
  }

  const binary = atob(data.audioBase64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: 'audio/wav' });
  const blobUrl = URL.createObjectURL(blob);
  audioCache.set(cacheKey, blobUrl);
  return blobUrl;
}

/**
 * Batch synthesize all segments in an arc
 */
export async function batchSynthesizeArc(
  segments: RecapSegment[],
  voiceName = 'Zephyr',
  toneStyle = 'Dramatic conversational Urdu YouTube manhwa recap host'
): Promise<Array<{ id: string; audioUrl: string; audioGenerated: boolean }>> {
  const res = await fetch('/api/gemini/batch-tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments, voiceName, toneStyle }),
  });
  if (!res.ok) throw new Error('Batch synthesis failed');
  const data = await res.json();
  return data.results || [];
}

/**
 * Stitch all arc segments into a single master continuous WAV audio track
 */
export async function stitchMasterAudio(
  segments: RecapSegment[],
  totalDurationSeconds: number,
  arcId: string
): Promise<{ masterAudioUrl: string; durationSeconds: number; fileSizeBytes: number }> {
  const res = await fetch('/api/gemini/stitch-master-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments, totalDurationSeconds, arcId }),
  });
  if (!res.ok) throw new Error('Master audio stitching failed');
  return await res.json();
}

/**
 * Fallback instantaneous client Web Speech synthesis (STRICTLY URDU/HINDI ONLY)
 */
export function speakWebSpeech(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  rate = 1.05
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return null;
  }

  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();

  // STRICT REQUIREMENT: Only allow genuine Urdu or Hindi voices.
  // NEVER use an English voice to read Urdu, which produces broken English gibberish!
  const urduVoice = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith('ur') ||
      v.lang.toLowerCase().includes('pk') ||
      v.lang.toLowerCase().startsWith('hi') ||
      v.name.toLowerCase().includes('urdu') ||
      v.name.toLowerCase().includes('hindi')
  );

  if (!urduVoice) {
    // No Urdu/Hindi voice installed in this browser/OS.
    // Return null so caller falls back to Gemini TTS!
    if (onEnd) onEnd();
    return null;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = urduVoice;
  utterance.lang = urduVoice.lang;
  utterance.rate = rate;
  utterance.pitch = 1.0;

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopWebSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Studio Quality Dubbing using server-side FFmpeg:
 * Combines original video frames + high-fidelity Urdu voiceover
 */
export async function dubVideoStudio(options: {
  videoSource?: 'sample' | 'uploaded' | 'custom_path';
  uploadedVideoUrl?: string;
  arcId: string;
  segments: RecapSegment[];
  totalDurationSeconds?: number;
}): Promise<{
  success: boolean;
  dubbedVideoUrl: string;
  filename: string;
  fileSizeBytes: number;
  durationSeconds: number;
  masterAudioUrl: string;
  message: string;
}> {
  const res = await fetch('/api/dub-video-studio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Video dubbing failed' }));
    throw new Error(err.error || 'Failed to dub video with studio quality');
  }
  return await res.json();
}

/**
 * Upload custom original manhwa video file
 */
export async function uploadOriginalVideo(file: File): Promise<{
  success: boolean;
  videoUrl: string;
  filename: string;
  originalname: string;
  size: number;
}> {
  const formData = new FormData();
  formData.append('video', file);
  const res = await fetch('/api/upload-video', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error('Failed to upload video');
  }
  return await res.json();
}

/**
 * List available original videos
 */
export async function getAvailableVideos(): Promise<{
  sample: { videoUrl: string; title: string; durationSeconds: number } | null;
  uploads: Array<{ videoUrl: string; filename: string }>;
  recentDubbed: Array<{ dubbedVideoUrl: string; filename: string }>;
}> {
  const res = await fetch('/api/available-videos');
  if (!res.ok) throw new Error('Failed to fetch available videos');
  return await res.json();
}
