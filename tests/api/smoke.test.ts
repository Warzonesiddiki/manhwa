/**
 * API smoke test (TEST-001 harness, TASK-004, adapted in TASK-005 to the
 * dist/public client layout).
 *
 * Green assertions only describe behavior that is honest TODAY; known audit
 * blockers get their own regression tests in tests/api/security.test.ts and
 * tests/api/packaging.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { bootServer, shutdownServer, type BootedServer } from '../helpers/boot';

const MARKER = 'SMOKE-INDEX-MARKER-3f9a';
let server: BootedServer;
let base: string;

beforeAll(async () => {
  server = await bootServer({ marker: MARKER });
  base = server.base;
}, 30000);

afterAll(() => shutdownServer(server));

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

  it('keeps runtime media directories inside the isolated working directory', () => {
    expect(existsSync(path.join(server.tmpDir, 'uploads'))).toBe(true);
    expect(existsSync(path.join(server.tmpDir, 'audio-cache'))).toBe(true);
    expect(readdirSync(path.join(server.tmpDir, 'uploads'))).toEqual([]);
  });
});
