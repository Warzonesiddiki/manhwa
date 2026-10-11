/**
 * TASK-010: Media Inspection & Preview Proxy (TEST-003, TEST-004)
 * Covers:
 * - Real FFprobe stream inspection (container, codecs, rational frame rate, sample rate, channels, rotation).
 * - Bounded validation: duration bounds, positive duration, 24-hour limit enforcement.
 * - Corrupted, truncated, and invalid media failure safety (MEDIA_CORRUPTED 422).
 * - Source SHA-256 calculation and verification.
 * - Lightweight browser-compatible preview MP4 proxy generation.
 * - Range-capable HTTP 206 delivery for preview proxy.
 * - Automatic synchronization of probed duration to Project entity.
 * - Security gates: auth enforcement, fail-closed, path containment.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  bootServer,
  shutdownServer,
  login,
  withCookie,
  TEST_OWNER_TOKEN,
  type BootedServer,
} from '../helpers/boot';
import { inspectMedia, parseRational } from '../../server/media/inspector';
import { generatePreviewProxy } from '../../server/media/previewProxy';

const execFileAsync = promisify(execFile);

let server: BootedServer;
let base: string;
let cookie: string;
let projectId: string;

const FIXTURE_DIR = path.resolve(process.cwd(), 'tests/fixtures');
const REAL_VIDEO_PATH = path.join(FIXTURE_DIR, 'valid_sample_1s.mp4');
const CORRUPT_VIDEO_PATH = path.join(FIXTURE_DIR, 'corrupted_sample.mp4');

beforeAll(async () => {
  if (!fs.existsSync(FIXTURE_DIR)) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  }

  // Generate a real 1-second H.264/AAC MP4 fixture using ffmpeg
  await execFileAsync('ffmpeg', [
    '-f',
    'lavfi',
    '-i',
    'testsrc=duration=1:size=320x240:rate=30',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=1000:duration=1',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-t',
    '1',
    REAL_VIDEO_PATH,
    '-y',
  ]);

  // Generate a corrupted video file (valid ftyp container magic but corrupted payload & broken moov atom)
  const corruptBuf = Buffer.alloc(1024, 0);
  corruptBuf.writeUInt32BE(16, 0);
  corruptBuf.write('ftyp', 4, 'latin1');
  corruptBuf.write('mp42', 8, 'latin1');
  corruptBuf.writeUInt32BE(0, 12);
  for (let i = 16; i < 1024; i++) {
    corruptBuf[i] = (i * 31) % 256;
  }
  fs.writeFileSync(CORRUPT_VIDEO_PATH, corruptBuf);

  server = await bootServer({ marker: 'MEDIA-INSPECT-TEST' });
  base = server.base;
  cookie = await login(base, TEST_OWNER_TOKEN);

  // Create test project
  const createRes = await fetch(`${base}/api/v1/projects`, {
    ...withCookie(cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Media Inspection Test Marathon',
        titleUrdu: 'میڈیا انسپیکشن',
        totalDurationMinutes: 60,
      }),
    }),
  });
  const created = await createRes.json();
  projectId = created.project.id;
}, 45000);

afterAll(async () => {
  await shutdownServer(server);
  try {
    if (fs.existsSync(REAL_VIDEO_PATH)) fs.unlinkSync(REAL_VIDEO_PATH);
    if (fs.existsSync(CORRUPT_VIDEO_PATH)) fs.unlinkSync(CORRUPT_VIDEO_PATH);
  } catch {
    // ignore cleanup error
  }
});

function authed(url: string, init: Omit<RequestInit, 'body'> & { body?: BodyInit | Buffer | null } = {}) {
  const reqInit = { ...init };
  if (Buffer.isBuffer(reqInit.body)) {
    reqInit.body = new Uint8Array(reqInit.body);
  }
  return fetch(url, withCookie(cookie, reqInit as RequestInit));
}

describe('TASK-010: Media Inspection & Preview Proxy', () => {
  describe('Unit: parseRational helper', () => {
    it('parses standard rational frame rate strings correctly', () => {
      expect(parseRational('30/1')).toBe(30);
      expect(parseRational('25/1')).toBe(25);
      expect(parseRational('24000/1001')).toBeCloseTo(23.976, 2);
      expect(parseRational('60')).toBe(60);
      expect(parseRational('0/0')).toBeNull();
      expect(parseRational('')).toBeNull();
      expect(parseRational(undefined)).toBeNull();
    });
  });

  describe('Unit: inspectMedia FFprobe bounded execution', () => {
    it('accurately probes real media fixture duration, streams, and rational frame rate', async () => {
      const result = await inspectMedia(REAL_VIDEO_PATH, {
        assetId: 'sample_asset_1',
        computeSha256: true,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.metadata.assetId).toBe('sample_asset_1');
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(900);
      expect(result.metadata.durationMs).toBeLessThanOrEqual(1200);
      expect(result.metadata.container).toContain('mp4');
      expect(result.metadata.isSeekable).toBe(true);
      expect(result.sha256).toBeTruthy();

      // Video stream assertions
      expect(result.metadata.video).toBeTruthy();
      expect(result.metadata.video?.codec).toBe('h264');
      expect(result.metadata.video?.width).toBe(320);
      expect(result.metadata.video?.height).toBe(240);
      expect(result.metadata.video?.fps).toBe(30);

      // Audio stream assertions
      expect(result.metadata.audio).toBeTruthy();
      expect(result.metadata.audio?.codec).toBe('aac');
      expect(result.metadata.audio?.sampleRate).toBe(44100);

      // Stream list
      expect(result.metadata.streams.length).toBeGreaterThanOrEqual(2);
    });

    it('fails safely with MEDIA_CORRUPTED on corrupted media bytes without crashing', async () => {
      const result = await inspectMedia(CORRUPT_VIDEO_PATH, {
        assetId: 'corrupted_asset',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errorCode).toBe('MEDIA_CORRUPTED');
      expect(result.error).toContain('corrupted');
    });

    it('fails safely with ARTIFACT_MISSING on nonexistent file', async () => {
      const result = await inspectMedia('/tmp/nonexistent_file_98765.mp4');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errorCode).toBe('ARTIFACT_MISSING');
    });

    it('enforces 24-hour max duration limit with LIMIT_EXCEEDED', async () => {
      // Test limit enforcement using maxDurationMs parameter
      const result = await inspectMedia(REAL_VIDEO_PATH, {
        maxDurationMs: 500, // 0.5s limit, our fixture is 1s
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errorCode).toBe('LIMIT_EXCEEDED');
      expect(result.error).toContain('exceeds the maximum allowed limit');
    });
  });

  describe('Unit: generatePreviewProxy transcoding', () => {
    it('generates a browser-compatible preview MP4 proxy', async () => {
      const proxyOut = path.join(FIXTURE_DIR, 'sample_proxy.mp4');
      try {
        const res = await generatePreviewProxy(REAL_VIDEO_PATH, proxyOut, { maxDurationSec: 5 });
        expect(res.ok).toBe(true);
        expect(fs.existsSync(proxyOut)).toBe(true);
        expect(fs.statSync(proxyOut).size).toBeGreaterThan(0);

        // Verify proxy is also validly probeable
        const probeProxy = await inspectMedia(proxyOut);
        expect(probeProxy.ok).toBe(true);
      } finally {
        if (fs.existsSync(proxyOut)) fs.unlinkSync(proxyOut);
      }
    });
  });

  describe('Integration: API media inspection and preview proxy delivery', () => {
    let uploadedAssetId: string;

    it('uploads a real video asset, finalizes it, and inspects media streams', async () => {
      const realBytes = fs.readFileSync(REAL_VIDEO_PATH);
      const expectedSha256 = crypto.createHash('sha256').update(realBytes).digest('hex');

      // 1. Create upload session
      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'pilot_chapter1.mp4',
          declaredSize: realBytes.length,
          mimeType: 'video/mp4',
          sha256: expectedSha256,
        }),
      });

      expect(createRes.status).toBe(201);
      const { session, asset } = await createRes.json();
      uploadedAssetId = asset.id;

      // 2. Upload full real video chunk
      const chunkRes = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: realBytes,
        }
      );
      expect(chunkRes.status).toBe(200);

      // 3. Finalize asset (triggers container magic check and deep media inspection)
      const finalizeRes = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`,
        { method: 'POST' }
      );
      expect(finalizeRes.status).toBe(200);
      const finalData = await finalizeRes.json();
      expect(finalData.ok).toBe(true);
      expect(finalData.asset.status).toBe('inspected_ready');
      expect(finalData.asset.durationMs).toBeGreaterThan(0);
      expect(finalData.asset.sourceMetadata).toBeTruthy();
      expect(finalData.asset.sourceMetadata.video.codec).toBe('h264');

      // 4. Verify project durationMs updated automatically
      const projectRes = await authed(`${base}/api/v1/projects/${projectId}`);
      expect(projectRes.status).toBe(200);
      const projData = await projectRes.json();
      expect(projData.project.durationMs).toBe(finalData.asset.durationMs);
      expect(projData.project.sourceAssetId).toBe(asset.id);
    });

    it('invokes POST /api/v1/projects/:id/assets/:assetId/inspect to refresh metadata', async () => {
      const inspectRes = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${uploadedAssetId}/inspect`,
        { method: 'POST' }
      );

      expect(inspectRes.status).toBe(200);
      const data = await inspectRes.json();
      expect(data.ok).toBe(true);
      expect(data.sourceMetadata).toBeTruthy();
      expect(data.sourceMetadata.assetId).toBe(uploadedAssetId);
      expect(data.sourceMetadata.isSeekable).toBe(true);
      expect(data.sourceMetadata.video.fps).toBe(30);
    });

    it('generates preview proxy via POST /api/v1/projects/:id/assets/:assetId/preview', async () => {
      const previewGenRes = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${uploadedAssetId}/preview`,
        { method: 'POST' }
      );

      expect(previewGenRes.status).toBe(200);
      const data = await previewGenRes.json();
      expect(data.ok).toBe(true);
      expect(data.previewUrl).toBe(`/api/v1/assets/${uploadedAssetId}/preview`);
    });

    it('streams preview proxy via GET /api/v1/assets/:id/preview with Range 206 support', async () => {
      // Full stream request
      const fullRes = await authed(`${base}/api/v1/assets/${uploadedAssetId}/preview`);
      expect(fullRes.status).toBe(200);
      expect(fullRes.headers.get('content-type')).toBe('video/mp4');
      expect(fullRes.headers.get('accept-ranges')).toBe('bytes');
      expect(fullRes.headers.get('x-content-type-options')).toBe('nosniff');

      // Range request (first 256 bytes)
      const rangeRes = await authed(`${base}/api/v1/assets/${uploadedAssetId}/preview`, {
        headers: { Range: 'bytes=0-255' },
      });
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers.get('content-range')).toMatch(/^bytes 0-255\/\d+/);
      expect(rangeRes.headers.get('content-length')).toBe('256');
    });

    it('safely rejects corrupted media during upload finalization with 422 MEDIA_CORRUPTED', async () => {
      const corruptBytes = fs.readFileSync(CORRUPT_VIDEO_PATH);

      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'corrupted_payload.mp4',
          declaredSize: corruptBytes.length,
          mimeType: 'video/mp4',
        }),
      });
      const { session, asset } = await createRes.json();

      await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: corruptBytes,
        }
      );

      const finalizeRes = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`,
        { method: 'POST' }
      );

      expect(finalizeRes.status).toBe(422);
      const errData = await finalizeRes.json();
      expect(errData.error.code).toBe('MEDIA_CORRUPTED');

      // Access or preview on corrupted asset must be forbidden (403)
      const accessRes = await authed(`${base}/api/v1/assets/${asset.id}/access`);
      expect(accessRes.status).toBe(403);

      const previewRes = await authed(`${base}/api/v1/assets/${asset.id}/preview`);
      expect(previewRes.status).toBe(403);
    });

    it('enforces authentication on inspection and preview endpoints (TEST-002)', async () => {
      const noAuthInspect = await fetch(
        `${base}/api/v1/projects/${projectId}/assets/${uploadedAssetId}/inspect`,
        { method: 'POST' }
      );
      expect(noAuthInspect.status).toBe(401);

      const noAuthPreview = await fetch(`${base}/api/v1/assets/${uploadedAssetId}/preview`);
      expect(noAuthPreview.status).toBe(401);
    });

    it('rejects path traversal attempts on preview endpoint with 400/404', async () => {
      const traversalRes = await authed(`${base}/api/v1/assets/..%2F..%2Fetc%2Fpasswd/preview`);
      expect(traversalRes.status).toBeGreaterThanOrEqual(400);
    });
  });
});
