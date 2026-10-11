/**
 * TASK-009: Scoped Resumable Uploads & Quarantined Media Lifecycle (TEST-003, TEST-004)
 * Covers:
 * - Scoped upload session creation under project.
 * - Path traversal and unsafe ID rejection (TEST-003).
 * - Sanitization of filenames and rejection of dangerous types (HTML/SVG/scripts) (TEST-003).
 * - Chunked sequential upload with strict byte offset validation (TEST-004).
 * - Offset mismatch rejection (UPLOAD_OFFSET_MISMATCH 409) (TEST-004).
 * - Interrupted upload recovery and session resume reconciliation (TEST-004).
 * - Checksum mismatch detection (CHECKSUM_MISMATCH 422) (TEST-004).
 * - Quarantined inspection: rejection of disguised HTML/SVG files (TEST-003).
 * - Quarantined asset access protection (QUARANTINE_REJECTED 403) until inspected.
 * - Finalize idempotency and project source reference linking.
 * - HTTP Range-capable 206 media delivery.
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
let projectId: string;

beforeAll(async () => {
  server = await bootServer({ marker: 'UPLOADS-TEST' });
  base = server.base;
  cookie = await login(base, TEST_OWNER_TOKEN);

  // Create test project
  const createRes = await fetch(`${base}/api/v1/projects`, {
    ...withCookie(cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Uploads Test Marathon Project',
        titleUrdu: 'اپ لوڈ ٹیسٹ',
        totalDurationMinutes: 120,
      }),
    }),
  });
  const created = await createRes.json();
  projectId = created.project.id;
}, 30000);

afterAll(() => shutdownServer(server));

function authed(url: string, init: Omit<RequestInit, 'body'> & { body?: BodyInit | Buffer | null } = {}) {
  const reqInit = { ...init };
  if (Buffer.isBuffer(reqInit.body)) {
    reqInit.body = new Uint8Array(reqInit.body);
  }
  return fetch(url, withCookie(cookie, reqInit as RequestInit));
}

// Minimal valid ISO-BMFF MP4 header (ftyp atom at byte 4)
function createValidMp4Buffer(totalBytes = 64): Buffer {
  const buf = Buffer.alloc(totalBytes, 0);
  buf.writeUInt32BE(16, 0); // atom size: 16 bytes
  buf.write('ftyp', 4, 'latin1');
  buf.write('mp42', 8, 'latin1');
  buf.writeUInt32BE(0, 12); // minor version
  // fill remaining with mock video payload
  for (let i = 16; i < totalBytes; i++) {
    buf[i] = (i * 7) % 256;
  }
  return buf;
}

describe('TASK-009: Scoped Resumable Upload Sessions (TEST-003, TEST-004)', () => {
  describe('Session creation & validation (TEST-003)', () => {
    it('creates a scoped upload session with 201 for valid project and declared size', async () => {
      const res = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'raw_manhwa_ep1.mp4',
          declaredSize: 1024,
          mimeType: 'video/mp4',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.session).toBeTruthy();
      expect(data.session.id).toMatch(/^upl_/);
      expect(data.session.projectId).toBe(projectId);
      expect(data.session.declaredSize).toBe(1024);
      expect(data.session.uploadedBytes).toBe(0);
      expect(data.session.status).toBe('created');
      expect(data.asset).toBeTruthy();
      expect(data.asset.status).toBe('quarantined');
      expect(data.uploadUrl).toBeTruthy();
    });

    it('rejects path traversal in project ID with 400/404 (TEST-003)', async () => {
      const res = await authed(`${base}/api/v1/projects/..%2F..%2Fetc/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'escape.mp4',
          declaredSize: 500,
        }),
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('sanitizes filename and rejects active/HTML content extensions (TEST-003)', async () => {
      const res = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'evil_payload.html',
          declaredSize: 500,
        }),
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe('MEDIA_UNSUPPORTED');
    });

    it('rejects non-existent project with 404', async () => {
      const res = await authed(`${base}/api/v1/projects/proj_non_existent/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'sample.mp4',
          declaredSize: 500,
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('Chunked upload & Byte Offset Enforcement (TEST-004)', () => {
    it('enforces sequential offset: rejects offset mismatch with 409 UPLOAD_OFFSET_MISMATCH', async () => {
      // Create session for 100 bytes
      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'chunk_test.mp4',
          declaredSize: 100,
        }),
      });
      const { session } = await createRes.json();

      // Attempt to send chunk at offset 50 when server expects 0
      const chunk = Buffer.alloc(20, 'a');
      const chunkRes = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=50`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: chunk,
        }
      );

      expect(chunkRes.status).toBe(409);
      const data = await chunkRes.json();
      expect(data.error.code).toBe('UPLOAD_OFFSET_MISMATCH');
      expect(data.error.details.currentOffset).toBe(0);
    });

    it('accepts sequential chunks matching offset and updates confirmed uploadedBytes', async () => {
      const totalSize = 64;
      const validMp4 = createValidMp4Buffer(totalSize);

      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'sequential_video.mp4',
          declaredSize: totalSize,
        }),
      });
      const { session, asset } = await createRes.json();

      // Chunk 1: first 32 bytes
      const chunk1 = validMp4.subarray(0, 32);
      const res1 = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes 0-31/${totalSize}`,
          },
          body: chunk1,
        }
      );
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.uploadedBytes).toBe(32);
      expect(data1.status).toBe('uploading');

      // Query status
      const statusRes = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}`
      );
      const statusData = await statusRes.json();
      expect(statusData.session.uploadedBytes).toBe(32);

      // Chunk 2: remaining 32 bytes
      const chunk2 = validMp4.subarray(32, 64);
      const res2 = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes 32-63/${totalSize}`,
          },
          body: chunk2,
        }
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.uploadedBytes).toBe(64);
      expect(data2.status).toBe('verifying');

      // Finalize the asset
      const finalizeRes = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`,
        { method: 'POST' }
      );
      expect(finalizeRes.status).toBe(200);
      const finalizeData = await finalizeRes.json();
      expect(finalizeData.asset.status).toBe('inspected_ready');
      expect(finalizeData.asset.byteLength).toBe(64);
      expect(finalizeData.asset.sha256).toBeTruthy();
    });
  });

  describe('Interrupted upload resume reconciliation (TEST-004)', () => {
    it('resumes interrupted upload using server-confirmed byte offset', async () => {
      const totalSize = 64;
      const validMp4 = createValidMp4Buffer(totalSize);

      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'resume_video.mp4',
          declaredSize: totalSize,
        }),
      });
      const { session, asset } = await createRes.json();

      // Upload first chunk (20 bytes)
      await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: validMp4.subarray(0, 20),
        }
      );

      // Simulate client disconnect and resume reconciliation
      const resumeRes = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/resume`,
        { method: 'POST' }
      );
      expect(resumeRes.status).toBe(200);
      const resumeData = await resumeRes.json();
      expect(resumeData.session.uploadedBytes).toBe(20);

      // Client continues from confirmed offset (20..64)
      const resRemainder = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=20`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: validMp4.subarray(20, 64),
        }
      );
      expect(resRemainder.status).toBe(200);
      const remainderData = await resRemainder.json();
      expect(remainderData.uploadedBytes).toBe(64);

      // Finalize
      const finalizeRes = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`,
        { method: 'POST' }
      );
      expect(finalizeRes.status).toBe(200);
      expect((await finalizeRes.json()).asset.status).toBe('inspected_ready');
    });

    it('cancels session cleanly and rejects subsequent writes', async () => {
      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'to_be_cancelled.mp4',
          declaredSize: 100,
        }),
      });
      const { session } = await createRes.json();

      const cancelRes = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/cancel`,
        { method: 'POST' }
      );
      expect(cancelRes.status).toBe(200);
      expect((await cancelRes.json()).status).toBe('cancelled');

      // Writing to cancelled session fails
      const chunkRes = await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: Buffer.alloc(10),
        }
      );
      expect(chunkRes.status).toBe(409);
      expect((await chunkRes.json()).error.code).toBe('JOB_CANCELLED');
    });
  });

  describe('Integrity, Quarantine Inspection, and Delivery (TEST-003, TEST-004)', () => {
    it('detects SHA-256 checksum mismatch on finalize and fails asset (TEST-004)', async () => {
      const validMp4 = createValidMp4Buffer(48);
      const bogusSha256 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'corrupted.mp4',
          declaredSize: 48,
          sha256: bogusSha256,
        }),
      });
      const { session, asset } = await createRes.json();

      await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: validMp4,
        }
      );

      const finalizeRes = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`,
        { method: 'POST' }
      );
      expect(finalizeRes.status).toBe(422);
      const data = await finalizeRes.json();
      expect(data.error.code).toBe('CHECKSUM_MISMATCH');
    });

    it('rejects disguised HTML/SVG files during quarantine inspection with 422 QUARANTINE_REJECTED (TEST-003)', async () => {
      const fakeVideo = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>');

      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'disguised.mp4',
          declaredSize: fakeVideo.length,
        }),
      });
      const { session, asset } = await createRes.json();

      await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: fakeVideo,
        }
      );

      const finalizeRes = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`,
        { method: 'POST' }
      );
      expect(finalizeRes.status).toBe(422);
      const data = await finalizeRes.json();
      expect(data.error.code).toBe('QUARANTINE_REJECTED');

      // Accessing quarantined/rejected asset is forbidden (403)
      const accessRes = await authed(`${base}/api/v1/assets/${asset.id}/access`);
      expect(accessRes.status).toBe(403);
    });

    it('serves HTTP Range 206 Partial Content for verified asset (TEST-004)', async () => {
      const totalSize = 64;
      const validMp4 = createValidMp4Buffer(totalSize);

      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'streamable.mp4',
          declaredSize: totalSize,
        }),
      });
      const { session, asset } = await createRes.json();

      await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: validMp4,
        }
      );

      await authed(`${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`, {
        method: 'POST',
      });

      // Request range bytes 0-15
      const rangeRes = await authed(`${base}/api/v1/assets/${asset.id}/access`, {
        headers: { Range: 'bytes=0-15' },
      });

      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers.get('content-range')).toBe(`bytes 0-15/${totalSize}`);
      expect(rangeRes.headers.get('content-length')).toBe('16');
      expect(rangeRes.headers.get('accept-ranges')).toBe('bytes');

      const bytes = Buffer.from(await rangeRes.arrayBuffer());
      expect(bytes.length).toBe(16);
      expect(bytes.subarray(4, 8).toString('latin1')).toBe('ftyp');
    });

    it('idempotently returns already finalized asset on duplicate finalize', async () => {
      const totalSize = 48;
      const validMp4 = createValidMp4Buffer(totalSize);

      const createRes = await authed(`${base}/api/v1/projects/${projectId}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'idempotent.mp4',
          declaredSize: totalSize,
        }),
      });
      const { session, asset } = await createRes.json();

      await authed(
        `${base}/api/v1/projects/${projectId}/upload-sessions/${session.id}/chunks?offset=0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: validMp4,
        }
      );

      const finalize1 = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`,
        { method: 'POST' }
      );
      expect(finalize1.status).toBe(200);

      // Second finalize call is idempotent
      const finalize2 = await authed(
        `${base}/api/v1/projects/${projectId}/assets/${asset.id}/finalize`,
        { method: 'POST' }
      );
      expect(finalize2.status).toBe(200);
      const data2 = await finalize2.json();
      expect(data2.asset.status).toBe('inspected_ready');
    });

    it('lists project assets at /api/v1/projects/:id/assets', async () => {
      const res = await authed(`${base}/api/v1/projects/${projectId}/assets`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.assets)).toBe(true);
      expect(data.assets.length).toBeGreaterThan(0);
    });
  });
});
