/**
 * API smoke test (TEST-001 harness, TASK-004).
 *
 * Boots the real `server.ts` via tsx in an ISOLATED temporary working directory:
 * - no GEMINI_API_KEY (no provider calls can happen),
 * - a marker `dist/index.html` stands in for built client assets,
 * - runtime dirs (uploads/, audio-cache/, dubbed-videos/) are created under the
 *   temp dir and removed afterwards.
 *
 * Green assertions only describe behavior that is honest TODAY. The known audit
 * blockers (F05 built-server packaging, F07 GET/HEAD audio-cache mutation, F15
 * backend-source exposure) are owned by TASK-005 and get their own regression
 * tests there; nothing here asserts that broken behavior is acceptable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const MARKER = 'SMOKE-INDEX-MARKER-3f9a';

let tmpDir: string;
let child: ChildProcess;
let base: string;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      if (address === null || typeof address === 'string') {
        srv.close(() => reject(new Error('could not allocate port')));
        return;
      }
      const { port } = address;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url: string, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = new Error('server did not start');
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`health returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw lastError;
}

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'manhwa-smoke-'));
  mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
  writeFileSync(path.join(tmpDir, 'dist', 'index.html'), `<!doctype html><p>${MARKER}</p>`);
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), [path.join(REPO_ROOT, 'server.ts')], {
    cwd: tmpDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      GEMINI_API_KEY: '',
      APP_URL: base,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderrBuf = '';
  child.stderr?.on('data', (d) => {
    stderrBuf += String(d);
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error('server exited early:', code, stderrBuf);
    }
  });
  try {
    await waitForHealth(`${base}/api/health`);
  } catch (err) {
    console.error('server stderr:', stderrBuf);
    throw err;
  }
}, 30000);

afterAll(() => {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
  }
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('server smoke (isolated cwd, no credentials)', () => {
  it('reports liveness via /api/health without claiming provider readiness', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; hasApiKey: boolean; timestamp: string };
    expect(body.status).toBe('ok');
    expect(body.hasApiKey).toBe(false);
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('serves client assets from the client directory', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(MARKER);
  });

  it('returns 404 for unknown POST API routes (no silent success)', async () => {
    const res = await fetch(`${base}/api/does-not-exist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(404);
  });

  it('rejects malformed JSON bodies with 400', async () => {
    const res = await fetch(`${base}/api/gemini/chunk-marathon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    });
    expect(res.status).toBe(400);
  });

  it('fails honestly with 400 when GEMINI_API_KEY is missing (no fabricated output)', async () => {
    const res = await fetch(`${base}/api/gemini/chunk-marathon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Smoke Test', totalDurationMinutes: 30 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/GEMINI_API_KEY/);
  });
});
