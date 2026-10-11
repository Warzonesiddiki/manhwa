/**
 * TASK-008: Executable API / Domain Contract Tests (doc-06 / doc-05)
 * Covers:
 * - OpenAPI 3.1.0 specification endpoint (/api/v1/openapi.json).
 * - Standard Error Envelope compliance: code, message, retryable, requestId, details.
 * - Request-Id header propagation and correlation.
 * - Rejection of media payloads embedded in JSON (LIMIT_EXCEEDED / UPLOAD_INVALID).
 * - Precondition error code mapping (PRECONDITION_REQUIRED 428, REVISION_CONFLICT 412).
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
  server = await bootServer({ marker: 'CONTRACTS-TEST' });
  base = server.base;
  cookie = await login(base, TEST_OWNER_TOKEN);
}, 30000);

afterAll(() => shutdownServer(server));

describe('TASK-008: Executable API & Domain Contracts', () => {
  it('serves valid OpenAPI 3.1.0 specification at /api/v1/openapi.json', async () => {
    const res = await fetch(`${base}/api/v1/openapi.json`);
    expect(res.status).toBe(200);
    const spec = await res.json();

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info).toBeTruthy();
    expect(spec.info.title).toContain('ManhwaUrdu DubStudio');
    expect(spec.components?.schemas?.ErrorEnvelope).toBeTruthy();
    expect(spec.components?.schemas?.Project).toBeTruthy();
    expect(spec.components?.schemas?.UploadSession).toBeTruthy();
    expect(spec.components?.schemas?.Asset).toBeTruthy();
    expect(spec.components?.schemas?.SourceMetadata).toBeTruthy();
    expect(spec.paths['/api/v1/projects']).toBeTruthy();
    expect(spec.paths['/api/v1/projects/{id}']).toBeTruthy();
    expect(spec.paths['/api/v1/projects/{id}/upload-sessions']).toBeTruthy();
    expect(spec.paths['/api/v1/projects/{id}/assets/{assetId}/inspect']).toBeTruthy();
    expect(spec.paths['/api/v1/projects/{id}/assets/{assetId}/preview']).toBeTruthy();
    expect(spec.paths['/api/v1/assets/{id}/access']).toBeTruthy();
    expect(spec.paths['/api/v1/assets/{id}/preview']).toBeTruthy();
  });

  it('sets X-Request-Id header and echoes client requestId if provided', async () => {
    const customTraceId = 'trace_client_correlation_123';
    const res = await fetch(`${base}/api/v1/openapi.json`, {
      headers: { 'X-Request-Id': customTraceId },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe(customTraceId);
  });

  it('formats errors in standard envelope with code, message, retryable, and requestId', async () => {
    const res = await fetch(`${base}/api/v1/projects/non_existent_project_xyz`, withCookie(cookie));
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(data.error.code).toBe('NOT_FOUND');
    expect(typeof data.error.message).toBe('string');
    expect(data.error.retryable).toBe(false);
    expect(typeof data.error.requestId).toBe('string');
    expect(res.headers.get('x-request-id')).toBe(data.error.requestId);
  });

  it('returns PRECONDITION_REQUIRED code when If-Match / expectedRevision is omitted', async () => {
    // First create a test project
    const createRes = await fetch(
      `${base}/api/v1/projects`,
      withCookie(cookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'contract_test_proj_01',
          title: 'Contract Test Project',
        }),
      })
    );
    expect(createRes.status).toBe(201);

    // Update without precondition
    const updateRes = await fetch(
      `${base}/api/v1/projects/contract_test_proj_01`,
      withCookie(cookie, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title Without Precondition' }),
      })
    );

    expect(updateRes.status).toBe(428);
    const err = await updateRes.json();
    expect(err.error.code).toBe('PRECONDITION_REQUIRED');
    expect(err.error.details?.currentRevision).toBe(1);
    expect(err.error.requestId).toBeTruthy();
  });

  it('returns REVISION_CONFLICT code when expected revision mismatches', async () => {
    const updateRes = await fetch(
      `${base}/api/v1/projects/contract_test_proj_01`,
      withCookie(cookie, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': '"rev-999"',
        },
        body: JSON.stringify({
          title: 'Conflict Title',
          expectedRevision: 999,
        }),
      })
    );

    expect(updateRes.status).toBe(412);
    const err = await updateRes.json();
    expect(err.error.code).toBe('REVISION_CONFLICT');
    expect(err.error.details?.currentRevision).toBe(1);
    expect(err.error.requestId).toBeTruthy();
  });

  it('rejects embedded media data URIs in JSON with UPLOAD_INVALID (422)', async () => {
    const fakeDataUri = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAWlzb21tcDQy';
    const res = await fetch(
      `${base}/api/v1/projects`,
      withCookie(cookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'contract_test_media_in_json',
          title: 'Project with embedded video',
          sourceVideoUrl: fakeDataUri,
        }),
      })
    );

    expect(res.status).toBe(422);
    const err = await res.json();
    expect(err.error.code).toBe('UPLOAD_INVALID');
    expect(err.error.message).toContain('Data URIs are not allowed');
    expect(err.error.details?.affectedFields).toContain('project.sourceVideoUrl');
  });

  it('rejects oversized JSON string field payloads with LIMIT_EXCEEDED (413)', async () => {
    const hugeString = 'X'.repeat(70 * 1024); // 70 KB > 64 KB limit
    const res = await fetch(
      `${base}/api/v1/projects`,
      withCookie(cookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'contract_test_huge_payload',
          title: 'Huge Payload Project',
          genre: hugeString,
        }),
      })
    );

    expect(res.status).toBe(413);
    const err = await res.json();
    expect(err.error.code).toBe('LIMIT_EXCEEDED');
    expect(err.error.message).toContain('maximum string payload size');
  });
});
