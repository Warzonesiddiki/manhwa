/**
 * Security/honesty regression tests for TASK-005 (AUDIT F01, F02, F07, F09, F10).
 * Every test reproduces a confirmed audit behavior and asserts the repaired state.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { bootServer, shutdownServer, type BootedServer } from '../helpers/boot';

let server: BootedServer;
let base: string;

beforeAll(async () => {
  server = await bootServer({ marker: 'SEC-MARKER' });
  base = server.base;
}, 30000);

afterAll(() => shutdownServer(server));

function cacheDir() {
  return path.join(server.tmpDir, 'audio-cache');
}
function uploadsDir() {
  return path.join(server.tmpDir, 'uploads');
}
function listWavs() {
  return readdirSync(cacheDir()).filter((f) => f.endsWith('.wav'));
}

async function uploadMultipart(filename: string, bytes: Uint8Array | string, type = 'application/octet-stream') {
  const form = new FormData();
  const blob = new Blob([bytes as BlobPart], { type });
  form.append('video', blob, filename);
  return fetch(`${base}/api/upload-video`, { method: 'POST', body: form });
}

describe('F01 — path containment', () => {
  it('rejects encoded traversal reads with 400 and leaks no sentinel', async () => {
    const sentinel = 'AUDIT-F01-SENTINEL-OUTSIDE';
    writeFileSync(path.join(server.tmpDir, 'audit-sentinel.txt'), sentinel);
    const res = await fetch(`${base}/audio-cache/..%2Faudit-sentinel.txt`);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).not.toContain(sentinel);
  });

  it('rejects traversal in plain and dot-dot parameter forms', async () => {
    for (const name of ['..%2F..%2Fetc%2Fpasswd', '%2e%2e%2faudit-sentinel.txt', 'sub%2Fdir.wav']) {
      const res = await fetch(`${base}/audio-cache/${name}`);
      expect(res.status).toBe(400);
    }
  });

  it('does not create files outside the cache via GET fallback (write probe)', async () => {
    const before = readdirSync(server.tmpDir).sort();
    const res = await fetch(`${base}/audio-cache/..%2Faudit-generated.wav`);
    expect(res.status).toBe(400);
    expect(existsSync(path.join(server.tmpDir, 'audit-generated.wav'))).toBe(false);
    expect(readdirSync(server.tmpDir).sort()).toEqual(before);
  });

  it('rejects traversal segment/arc IDs on write routes with 400', async () => {
    const stitch = await fetch(`${base}/api/gemini/stitch-master-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segments: [{ id: '../evil', start: 0, end: 1 }],
        totalDurationSeconds: 10,
        arcId: 'arc-1',
      }),
    });
    expect(stitch.status).toBe(400);

    const badArc = await fetch(`${base}/api/gemini/stitch-master-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segments: [{ id: 'seg-ok', start: 0, end: 1 }],
        totalDurationSeconds: 10,
        arcId: '../../etc',
      }),
    });
    expect(badArc.status).toBe(400);
  });

  it('refuses client-supplied filesystem paths as uploaded video references', async () => {
    const res = await fetch(`${base}/api/dub-video-studio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoSource: 'uploaded',
        uploadedVideoUrl: '../../public/videos/sample-manhwa-original.mp4',
        arcId: 'arc-1',
        segments: [{ id: 'seg-1', start: 0, end: 1 }],
        totalDurationSeconds: 5,
      }),
    });
    // Must fail; must NOT silently fall back to the sample video (F12).
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/refusing to substitute sample/i);
  });
});

describe('F07 — GET/HEAD audio-cache is strictly read-only', () => {
  it('returns 404 for a missing artifact and creates nothing', async () => {
    const before = listWavs();
    const getRes = await fetch(`${base}/audio-cache/not-there.wav`);
    expect(getRes.status).toBe(404);
    const headRes = await fetch(`${base}/audio-cache/not-there.wav`, { method: 'HEAD' });
    expect(headRes.status).toBe(404);
    expect(listWavs()).toEqual(before);
    expect(existsSync(path.join(cacheDir(), 'not-there.wav'))).toBe(false);
  });

  it('serves an existing artifact read-only with nosniff', async () => {
    const name = 'read-only-check.wav';
    writeFileSync(path.join(cacheDir(), name), Buffer.from('RIFFfakeWAVE'));
    const res = await fetch(`${base}/audio-cache/${name}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toContain('RIFFfakeWAVE');
  });
});

describe('F02 — upload validation', () => {
  it('rejects HTML uploads regardless of claimed extension', async () => {
    const before = readdirSync(uploadsDir());
    const res = await uploadMultipart('evil.html', '<html><script>alert(1)</script></html>', 'text/html');
    expect(res.status).toBe(400);
    expect(readdirSync(uploadsDir())).toEqual(before);
  });

  it('rejects HTML content disguised as .mp4 (polyglot/prefix)', async () => {
    const before = readdirSync(uploadsDir());
    const res = await uploadMultipart('evil.mp4', '<html><body>hi</body></html>', 'video/mp4');
    expect(res.status).toBe(400);
    expect(readdirSync(uploadsDir())).toEqual(before);
  });

  it('rejects SVG active content', async () => {
    const res = await uploadMultipart('evil.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'image/svg+xml');
    expect(res.status).toBe(400);
  });

  it('accepts a sniffed video container and generates the stored name/extension', async () => {
    const ftyp = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftyp'),
      Buffer.from('isom'),
      Buffer.alloc(12, 0x20),
    ]);
    const res = await uploadMultipart('my video (1).MP4', ftyp, 'video/mp4');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; videoUrl: string; filename: string };
    expect(body.success).toBe(true);
    expect(body.filename).toMatch(/^orig_[0-9]+_[0-9a-f]+\.mp4$/);
    // Served with hardening headers so stored media can never execute.
    const served = await fetch(`${base}${body.videoUrl}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
    expect(served.headers.get('content-security-policy')).toContain('sandbox');
  });
});

describe('F09/F10 — honest failures, no fabricated speech or transcripts', () => {
  it('TTS POST without credentials returns 400 and writes no audio', async () => {
    const before = listWavs();
    const res = await fetch(`${base}/api/gemini/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'یہ ایک ٹیسٹ ہے', segmentId: 'seg-test-1', voiceName: 'Zephyr' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/GEMINI_API_KEY/);
    expect(listWavs()).toEqual(before);
  });

  it('batch TTS without credentials returns 400 with no fabricated results', async () => {
    const res = await fetch(`${base}/api/gemini/batch-tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments: [{ id: 'seg-b1', urduText: 'ہیلو' }] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; results?: unknown };
    expect(body.error).toMatch(/GEMINI_API_KEY/);
    expect(body.results).toBeUndefined();
  });

  it('rejects invalid segment IDs and oversized text on TTS', async () => {
    const badId = await fetch(`${base}/api/gemini/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello', segmentId: '../evil' }),
    });
    expect(badId.status).toBe(400);
    const longText = await fetch(`${base}/api/gemini/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'x'.repeat(10001) }),
    });
    expect(longText.status).toBe(400);
  });

  it('stitch refuses to render missing segments as silence (409) unless explicitly allowed', async () => {
    writeFileSync(path.join(cacheDir(), 'seg-have.wav'), Buffer.alloc(64, 1));
    const strict = await fetch(`${base}/api/gemini/stitch-master-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segments: [
          { id: 'seg-have', start: 0, end: 1 },
          { id: 'seg-missing', start: 1, end: 2 },
        ],
        totalDurationSeconds: 4,
        arcId: 'arc-sec',
      }),
    });
    expect(strict.status).toBe(409);
    const body = (await strict.json()) as { missingSegments: string[] };
    expect(body.missingSegments).toEqual(['seg-missing']);

    const partial = await fetch(`${base}/api/gemini/stitch-master-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segments: [
          { id: 'seg-have', start: 0, end: 1 },
          { id: 'seg-missing', start: 1, end: 2 },
        ],
        totalDurationSeconds: 4,
        arcId: 'arc-sec',
        allowPartial: true,
      }),
    });
    expect(partial.status).toBe(200);
    const partialBody = (await partial.json()) as { partial: boolean; missingSegments: string[] };
    expect(partialBody.partial).toBe(true);
    expect(partialBody.missingSegments).toEqual(['seg-missing']);
  });

  it('rejects invalid timeline bounds (non-numbers, negative, oversized)', async () => {
    for (const [segments, duration] of [
      [[{ id: 's1', start: 0, end: 'abc' }], 10],
      [[{ id: 's1', start: 0, end: null }], 10],
      [[{ id: 's1', start: -5, end: 2 }], 10],
      [[{ id: 's1', start: 0, end: 2 }], 'abc'],
      [[{ id: 's1', start: 0, end: 2 }], null],
      [[{ id: 's1', start: 0, end: 2 }], 100000],
      [[], 10],
    ] as const) {
      const res = await fetch(`${base}/api/gemini/stitch-master-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, totalDurationSeconds: duration, arcId: 'arc-1' }),
      });
      expect(res.status).toBe(400);
    }
  });

  it('extract-transcript is disabled with 501 and invents nothing', async () => {
    const res = await fetch(`${base}/api/gemini/extract-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ', titleHint: 'anything' }),
    });
    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/not implemented/i);
    expect(JSON.stringify(body)).not.toMatch(/detectedTitle|initialSampleSegments/);
  });

  it('never exposes the server bundle from the HTTP surface in source mode', async () => {
    const res = await fetch(`${base}/server.js`);
    expect([400, 404]).toContain(res.status);
    const text = await res.text();
    expect(text).not.toContain('Dynamic require');
    expect(text).not.toContain('GEMINI_API_KEY is not configured');
  });
});
