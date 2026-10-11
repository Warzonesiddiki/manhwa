/**
 * Owner-only authentication tests — TASK-006, TEST-002 (AUDIT F03 core).
 * Verifies server-side session enforcement on API and private media routes,
 * login throttling, and fail-closed behavior when OWNER_TOKEN is missing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootServer,
  shutdownServer,
  login,
  withCookie,
  TEST_OWNER_TOKEN,
  type BootedServer,
} from '../helpers/boot';

let server: BootedServer;
let base: string;
let cookie: string;

beforeAll(async () => {
  server = await bootServer({ marker: 'AUTH-MARKER' });
  base = server.base;
}, 30000);

afterAll(() => shutdownServer(server));

describe('TEST-002 — unauthenticated and wrong-owner access', () => {
  it('serves the app shell without a session (no secrets in the bundle)', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated API calls with 401', async () => {
    for (const [method, url] of [
      ['POST', '/api/gemini/tts'],
      ['POST', '/api/gemini/batch-tts'],
      ['POST', '/api/gemini/stitch-master-audio'],
      ['POST', '/api/upload-video'],
      ['GET', '/api/available-videos'],
      ['GET', '/api/cached-audio-list'],
    ] as const) {
      const res = await fetch(`${base}${url}`, { method });
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });

  it('protects private media routes without a session (401)', async () => {
    for (const url of [
      '/audio-cache/anything.wav',
      '/uploads/whatever.mp4',
      '/videos/sample-manhwa-original.mp4',
      '/dubbed-videos/out.mp4',
    ]) {
      const res = await fetch(`${base}${url}`);
      expect(res.status, url).toBe(401);
    }
  });

  it('reports session state via /api/auth/session', async () => {
    const res = await fetch(`${base}/api/auth/session`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { authenticated: boolean; configured: boolean };
    expect(body.authenticated).toBe(false);
    expect(body.configured).toBe(true);
  });

  it('rejects a wrong owner token with 403 and sets no session', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'wrong-token-attempt-000000' }),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('issues an HttpOnly session cookie to the correct owner token', async () => {
    cookie = await login(base, TEST_OWNER_TOKEN);
    expect(cookie).toMatch(/^mh_session=/);
    const res = await fetch(`${base}/api/auth/session`, withCookie(cookie));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authenticated: boolean };
    expect(body.authenticated).toBe(true);
  });

  it('rejects tampered/expired session cookies with 401', async () => {
    for (const bad of [
      'mh_session=v1.9999999999999.deadbeef',
      'mh_session=garbage',
      'mh_session=v1.abc.def',
    ]) {
      const res = await fetch(`${base}/api/available-videos`, withCookie(bad));
      expect(res.status, bad).toBe(401);
    }
  });

  it('grants API access with a valid session (and still fails honestly without a key)', async () => {
    const res = await fetch(
      `${base}/api/gemini/tts`,
      withCookie(cookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', segmentId: 'seg-auth-1' }),
      }),
    );
    // Authenticated: proceeds to the honest missing-key error (400), not 401.
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('throttles repeated failed logins (429)', async () => {
    let saw429 = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: `brute-${i}-xxxxxxxxxxxxxxxx` }),
      });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
    // Even the correct token is throttled while the window is active.
    const locked = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TEST_OWNER_TOKEN }),
    });
    expect(locked.status).toBe(429);
  });
});

describe('fail-closed configuration', () => {
  it('returns 503 on protected routes when OWNER_TOKEN is missing in production', async () => {
    const noAuth = await bootServer({ marker: 'NOAUTH', ownerToken: null });
    try {
      const res = await fetch(`${noAuth.base}/api/gemini/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      });
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/fails closed/i);

      const session = await fetch(`${noAuth.base}/api/auth/session`);
      expect(session.status).toBe(503);

      // Liveness stays up for readiness checks.
      const health = await fetch(`${noAuth.base}/api/health`);
      expect(health.status).toBe(200);
      const healthBody = (await health.json()) as { hasOwnerAuth: boolean };
      expect(healthBody.hasOwnerAuth).toBe(false);
    } finally {
      shutdownServer(noAuth);
    }
  }, 30000);
});
