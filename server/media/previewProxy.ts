import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const DEFAULT_PREVIEW_TIMEOUT_MS = 30000; // 30 seconds

export interface PreviewProxyOptions {
  maxDurationSec?: number;
  timeoutMs?: number;
}

/**
 * Generates a lightweight, browser-compatible preview MP4 proxy with H.264 video,
 * AAC audio, and faststart metadata for immediate range-capable playback.
 */
export async function generatePreviewProxy(
  sourcePath: string,
  outputPath: string,
  options?: PreviewProxyOptions
): Promise<{ ok: boolean; error?: string; outputPath?: string }> {
  if (!fs.existsSync(sourcePath)) {
    return { ok: false, error: `Source media does not exist: ${sourcePath}` };
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const args: string[] = ['-i', sourcePath];

  if (options?.maxDurationSec && options.maxDurationSec > 0) {
    args.push('-t', options.maxDurationSec.toString());
  }

  args.push(
    '-vf',
    "scale=min(854\\,iw):-2",
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '28',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    outputPath,
    '-y'
  );

  const timeoutMs = options?.timeoutMs ?? DEFAULT_PREVIEW_TIMEOUT_MS;

  try {
    await execFileAsync('ffmpeg', args, {
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
    });

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return { ok: true, outputPath };
    }
    return { ok: false, error: 'Output proxy file was not created or is empty' };
  } catch (err: any) {
    const errorMsg = err.stderr || err.message || 'FFmpeg failed to transcode preview proxy';
    return { ok: false, error: errorMsg.trim() };
  }
}
