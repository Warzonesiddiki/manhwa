import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const audioCacheDir = path.resolve(process.cwd(), 'audio-cache');
if (!fs.existsSync(audioCacheDir)) {
  fs.mkdirSync(audioCacheDir, { recursive: true });
}

export function getAudioCacheKey(text, voice = 'Zephyr') {
  const norm = (text || '').trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(`${voice}:${norm}`).digest('hex');
}

export function getCachedAudio(key) {
  const file = path.join(audioCacheDir, `${key}.wav`);
  if (fs.existsSync(file)) {
    return fs.readFileSync(file).toString('base64');
  }
  return null;
}

export function setCachedAudio(key, base64) {
  const file = path.join(audioCacheDir, `${key}.wav`);
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
}
