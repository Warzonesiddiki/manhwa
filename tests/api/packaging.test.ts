/**
 * Packaging regression tests for TASK-005 (AUDIT F05, F15) — TEST-001.
 *
 * Builds the real production artifacts (vite client -> dist/public,
 * esbuild server -> dist/server.js), boots `node dist/server.js`, and asserts:
 * - the built server STARTS (this failed at the audited baseline),
 * - the frontend loads from the client directory,
 * - the backend bundle and env-ish paths are NOT reachable over HTTP.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, freePort, waitForHealth, runBuild, TEST_OWNER_TOKEN } from '../helpers/boot';

let child: ChildProcess;
let base: string;

beforeAll(async () => {
  await runBuild();
  expect(existsSync(path.join(REPO_ROOT, 'dist', 'server.js'))).toBe(true);
  expect(existsSync(path.join(REPO_ROOT, 'dist', 'public', 'index.html'))).toBe(true);

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(REPO_ROOT, 'dist', 'server.js')], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      GEMINI_API_KEY: '',
      OWNER_TOKEN: TEST_OWNER_TOKEN,
      APP_URL: base,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderrBuf = '';
  child.stderr?.on('data', (d) => {
    stderrBuf += String(d);
  });
  try {
    await waitForHealth(`${base}/api/health`, 20000);
  } catch (err) {
    console.error('built server stderr:', stderrBuf);
    throw err;
  }
}, 120000);

afterAll(() => {
  if (child && child.exitCode === null) child.kill('SIGTERM');
});

describe('TEST-001 — built artifact startup and isolation', () => {
  it('starts the built server and reports liveness', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('serves the built frontend', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain('<!doctype html');
    expect(html).toContain('root');
  });

  it('does not expose the backend bundle (F15)', async () => {
    for (const p of ['/server.js', '/dist/server.js', '/../server.js']) {
      const res = await fetch(`${base}${p}`);
      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).not.toContain('Dynamic require');
      expect(text).not.toContain('app.listen');
    }
  });

  it('does not expose env-file style paths', async () => {
    for (const p of ['/.env', '/.env.example', '/package.json']) {
      const res = await fetch(`${base}${p}`);
      expect(res.status).toBe(404);
    }
  });

  it('API paths never fall through to HTML', async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    // Unauthenticated requests are refused by the owner-auth guard (401);
    // authenticated unknown routes return 404. Neither may return the SPA.
    expect([401, 404]).toContain(res.status);
    const text = await res.text();
    expect(text.toLowerCase()).not.toContain('<!doctype html');
  });

  it('the built server bundle does not bundle its npm dependencies (F05 root cause)', () => {
    const serverJs = readFileSync(path.join(REPO_ROOT, 'dist', 'server.js'), 'utf8');
    // With --packages=external the bundle keeps bare imports instead of
    // CJS require shims that crashed with "Dynamic require of path".
    expect(serverJs).not.toContain('Dynamic require of');
    expect(serverJs).toMatch(/from "express"|from 'express'|require\("express"\)/);
  });
});
