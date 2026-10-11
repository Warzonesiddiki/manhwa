/**
 * Shared server-boot helper for API tests.
 *
 * Boots the real server entrypoint in an isolated temporary working directory:
 * - runtime dirs (uploads/, audio-cache/, dubbed-videos/) live under the temp dir,
 * - GEMINI_API_KEY is unset/empty so no provider call can occur,
 * - for NODE_ENV=production a marker client build is created at dist/public/.
 */
import { spawn, type ChildProcess, execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const REPO_ROOT = process.cwd();
export const TEST_OWNER_TOKEN = 'test-owner-token-0123456789abcdef';

export interface BootedServer {
  base: string;
  tmpDir: string;
  child: ChildProcess;
}

/** Exchange the owner token for a session cookie; returns "mh_session=..." */
export async function login(base: string, token: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  if (!cookie) throw new Error('login returned no session cookie');
  return cookie;
}

/** Merge a session cookie into fetch init headers. */
export function withCookie(cookie: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('cookie', cookie);
  return { ...init, headers };
}

export function freePort(): Promise<number> {
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

export async function waitForHealth(url: string, timeoutMs = 20000): Promise<void> {
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

export interface BootOptions {
  env?: Record<string, string>;
  /** Marker HTML served as the built client in production mode. */
  marker?: string;
  entry?: string;
  /** Owner token for the session auth; pass null to omit (fail-closed test). */
  ownerToken?: string | null;
}

export async function bootServer(opts: BootOptions = {}): Promise<BootedServer> {
  const marker = opts.marker ?? 'SMOKE-INDEX-MARKER';
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'manhwa-test-'));
  mkdirSync(path.join(tmpDir, 'dist', 'public'), { recursive: true });
  writeFileSync(path.join(tmpDir, 'dist', 'public', 'index.html'), `<!doctype html><p>${marker}</p>`);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const entry = opts.entry ?? path.join(REPO_ROOT, 'server.ts');
  const ownerEnv =
    opts.ownerToken === null ? { OWNER_TOKEN: '' } : { OWNER_TOKEN: opts.ownerToken ?? TEST_OWNER_TOKEN };
  const child = spawn(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), [entry], {
    cwd: tmpDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      GEMINI_API_KEY: '',
      APP_URL: base,
      ...ownerEnv,
      ...(opts.env ?? {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderrBuf = '';
  child.stderr?.on('data', (d) => {
    stderrBuf += String(d);
  });
  try {
    await waitForHealth(`${base}/api/health`);
  } catch (err) {
    console.error('server stderr:', stderrBuf);
    shutdownServer({ base, tmpDir, child });
    throw err;
  }
  return { base, tmpDir, child };
}

export function shutdownServer(server: BootedServer): void {
  if (server.child.exitCode === null) {
    server.child.kill('SIGTERM');
  }
  if (server.tmpDir && existsSync(server.tmpDir)) {
    rmSync(server.tmpDir, { recursive: true, force: true });
  }
}

export function runBuild(): Promise<{ stdout: string; stderr: string }> {
  // Full production build: vite client -> dist/public, esbuild server -> dist/server.js.
  return new Promise((resolve, reject) => {
    execFile('npm', ['run', 'build'], { cwd: REPO_ROOT, timeout: 120000 }, (err, stdout, stderr) =>
      err ? reject(err) : resolve({ stdout, stderr }),
    );
  });
}
