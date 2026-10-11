import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import { execFile } from 'child_process';
import util from 'util';
import { GoogleGenAI, Type } from '@google/genai';
import { ProjectStore } from './server/storage/projectStore';
import { UploadStore } from './server/storage/uploadStore';
import { getOpenApiSpec } from './server/contracts/openapi';
import { sendApiError, ApiError } from './server/contracts/errors';
import { validateProjectInput, assertNoMediaPayloadsInJson } from './server/contracts/schemas';

dotenv.config();

const execFilePromise = util.promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));

// Request-Id correlation tracking middleware (TASK-008, doc-06)
app.use((req, res, next) => {
  const reqId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  (req as any).requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Directories for original videos, uploads, audio cache, and dubbed outputs
const videosDir = path.resolve(process.cwd(), 'public/videos');
const uploadsDir = path.resolve(process.cwd(), 'uploads');
const dubbedVideosDir = path.resolve(process.cwd(), 'dubbed-videos');

if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dubbedVideosDir)) fs.mkdirSync(dubbedVideosDir, { recursive: true });

// Hardened static serving for untrusted media: never sniff types, never allow
// active content to execute on this origin (AUDIT F02). Mounted AFTER the
// owner-auth guard (TASK-006) so private media requires a session.
function untrustedStatic(root: string) {
  return express.static(root, {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    },
  });
}

// --- Safe opaque resource names (AUDIT F01) ---------------------------------
// Client-supplied identifiers must never contain separators or traversal
// sequences. Server-generated names only: letters, digits, dot, underscore,
// hyphen; first character alphanumeric; max 128 chars.
const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function isSafeName(name: unknown): name is string {
  return typeof name === 'string' && SAFE_NAME_RE.test(name) && !name.includes('..');
}
/** Resolve `name` strictly inside `baseDir`, or null if unsafe/escaping. */
function resolveContained(baseDir: string, name: string): string | null {
  if (!isSafeName(name)) return null;
  const base = path.resolve(baseDir);
  const candidate = path.resolve(base, name);
  if (!candidate.startsWith(base + path.sep)) return null;
  return candidate;
}

// --- Request bounds (AUDIT F04 interim mitigation) --------------------------
// Full bounded/streaming media work is TASK-020/022/028. Until then these
// finite schema limits reject the pathological inputs that caused unbounded
// synchronous allocation. 7200 s at 24 kHz mono s16 = ~345 MB per buffer —
// high, but finite; larger work must use the durable job pipeline.
const MAX_STITCH_SECONDS = 7200;
const MAX_TIMELINE_SEGMENTS = 1000;
interface TimelineSegmentInput {
  id: string;
  start: number;
  end: number;
}
function validateTimeline(
  segments: unknown,
  totalDurationSeconds: unknown,
): { ok: true; segments: TimelineSegmentInput[]; totalDurationSeconds: number } | { ok: false; error: string } {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { ok: false, error: 'segments array is required' };
  }
  if (segments.length > MAX_TIMELINE_SEGMENTS) {
    return { ok: false, error: `segments exceeds ${MAX_TIMELINE_SEGMENTS} items` };
  }
  const duration = totalDurationSeconds;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration > MAX_STITCH_SECONDS) {
    return { ok: false, error: `totalDurationSeconds must be a finite number in (0, ${MAX_STITCH_SECONDS}]` };
  }
  const out: TimelineSegmentInput[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as Record<string, unknown>;
    const id = seg?.id;
    const start = seg?.start;
    const end = seg?.end;
    if (!isSafeName(id)) {
      return { ok: false, error: `segments[${i}].id is invalid` };
    }
    if (
      typeof start !== 'number' || typeof end !== 'number' ||
      !Number.isFinite(start) || !Number.isFinite(end) ||
      start < 0 || end < start || end > duration + 3600
    ) {
      return { ok: false, error: `segments[${i}] timestamps are out of range` };
    }
    out.push({ id, start, end });
  }
  return { ok: true, segments: out, totalDurationSeconds: duration };
}

// --- Upload validation (AUDIT F02) ------------------------------------------
// Extensions are derived from sniffed container magic, never from the client.
const VIDEO_MAGIC: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  // ISO-BMFF (mp4/mov/m4v): 'ftyp' at byte offset 4
  { ext: '.mp4', test: (b) => b.length >= 12 && b.subarray(4, 8).toString('latin1') === 'ftyp' },
  // EBML (webm/mkv)
  { ext: '.webm', test: (b) => b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  // AVI: RIFF....AVI
  { ext: '.avi', test: (b) => b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'AVI ' },
];
function sniffVideoExt(head: Buffer): string | null {
  for (const { ext, test } of VIDEO_MAGIC) {
    if (test(head)) return ext;
  }
  return null;
}

// Multer storage for user original video uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, _file, cb) => {
    // Server-generated opaque name; real extension is appended after sniffing.
    cb(null, `orig_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.bin`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB interim cap; resumable large upload is TASK-009/039
});

// Initialize Google GenAI client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// --- Owner-only authentication (AUDIT F03, TASK-006, DEC-011 interim) -------
// Single-owner access is enforced server-side on every API and media route.
// Identity: allowlisted OWNER_TOKEN exchanged for an HMAC-signed HttpOnly
// session cookie. If OWNER_TOKEN is unset the server FAILS CLOSED (503) —
// in development an ephemeral token is generated and logged instead.
// Firebase Authentication is the documented upgrade once DEC-002 is approved.
const SESSION_COOKIE = 'mh_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h work session
let ownerToken: string | null = process.env.OWNER_TOKEN || null;
if (!ownerToken) {
  if (isProduction) {
    console.error('OWNER_TOKEN is not set: all protected routes will fail closed (503).');
  } else {
    ownerToken = crypto.randomBytes(24).toString('hex');
    console.warn(`[dev] OWNER_TOKEN not set — generated ephemeral owner token: ${ownerToken}`);
    console.warn('[dev] Set the OWNER_TOKEN environment variable for stable sessions.');
  }
}

function signSession(exp: number): string {
  const payload = `v1.${exp}`;
  const mac = crypto.createHmac('sha256', ownerToken!).update(payload).digest('hex');
  return `${payload}.${mac}`;
}
function verifySession(value: string | undefined): boolean {
  if (!ownerToken || !value) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = crypto.createHmac('sha256', ownerToken).update(`v1.${parts[1]}`).digest();
  let given: Buffer;
  try {
    given = Buffer.from(parts[2], 'hex');
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
// Naive per-IP login throttle (in-memory; adequate for a single-owner service).
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function loginThrottled(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

function requireOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ownerToken) {
    return res.status(503).json({ error: 'Owner authentication is not configured (OWNER_TOKEN). This service fails closed.' });
  }
  const cookies = parseCookies(req.headers.cookie);
  if (verifySession(cookies[SESSION_COOKIE])) {
    return next();
  }
  return res.status(401).json({ error: 'Owner authentication required.' });
}

// Public liveness + session endpoints (registered before the /api guard).
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    hasOwnerAuth: Boolean(ownerToken),
    timestamp: new Date().toISOString(),
  });
});

// OpenAPI 3.1.0 specification endpoint (TASK-008)
app.get(['/api/v1/openapi.json', '/openapi.json'], (_req, res) => {
  res.json(getOpenApiSpec());
});

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (loginThrottled(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
  }
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const expected = Buffer.from(ownerToken ?? '');
  const given = Buffer.from(token);
  const ok =
    ownerToken !== null &&
    given.length === expected.length &&
    crypto.timingSafeEqual(given, expected);
  if (!ok) {
    return res.status(403).json({ error: 'Invalid owner token.' });
  }
  const exp = Date.now() + SESSION_TTL_MS;
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(signSession(exp))}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${isProduction ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
  return res.json({ ok: true, expiresAt: new Date(exp).toISOString() });
});

app.get('/api/auth/session', (req, res) => {
  if (!ownerToken) {
    return res.status(503).json({ authenticated: false, configured: false });
  }
  const cookies = parseCookies(req.headers.cookie);
  const authenticated = verifySession(cookies[SESSION_COOKIE]);
  return res.status(authenticated ? 200 : 401).json({ authenticated, configured: true });
});

// Everything else under /api requires an authenticated owner session.
app.use('/api', requireOwner);
// Private media directories require the session too (REQ-001/019).
app.use('/audio-cache', requireOwner);
app.use('/uploads', requireOwner);
app.use('/videos', requireOwner);
app.use('/dubbed-videos', requireOwner);
app.use('/videos', untrustedStatic(videosDir));
app.use('/dubbed-videos', untrustedStatic(dubbedVideosDir));
app.use('/uploads', untrustedStatic(uploadsDir));

const projectStore = new ProjectStore();
const uploadStore = new UploadStore();

// --- Project & Revision Persistence (TASK-007, TEST-005, AUDIT F14) --------
// Durable project repository with optimistic concurrency control (RFC 6585)
app.get(['/api/v1/projects', '/api/projects'], async (_req, res) => {
  try {
    const projects = await projectStore.list();
    return res.json({ projects });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list projects' });
  }
});

app.post(['/api/v1/projects', '/api/projects'], async (req, res) => {
  try {
    const validated = validateProjectInput(req.body || {});
    const result = await projectStore.create(validated);
    if (!result.ok) {
      return sendApiError(res, result.code, 'INVALID_PAYLOAD', result.error, req);
    }
    res.setHeader('ETag', `"rev-${result.project.revision}"`);
    return res.status(201).json({ project: result.project });
  } catch (err: any) {
    if (err instanceof ApiError) {
      return sendApiError(res, err.status, err.code, err.message, req, { details: err.details });
    }
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to create project', req);
  }
});

app.get(['/api/v1/projects/:id', '/api/projects/:id'], async (req, res) => {
  try {
    const project = await projectStore.get(req.params.id);
    if (!project) {
      return sendApiError(res, 404, 'NOT_FOUND', `Project "${req.params.id}" not found`, req);
    }
    res.setHeader('ETag', `"rev-${project.revision ?? 1}"`);
    return res.json({ project });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to fetch project', req);
  }
});

app.put(['/api/v1/projects/:id', '/api/projects/:id'], async (req, res) => {
  try {
    assertNoMediaPayloadsInJson(req.body, 'project');
    const ifMatch = req.headers['if-match'];
    const expectedRevision = req.body?.expectedRevision !== undefined ? req.body.expectedRevision : ifMatch;
    const updates = req.body?.project ? req.body.project : req.body;
    const result = await projectStore.update(req.params.id, updates, expectedRevision);
    if (!result.ok) {
      if (result.currentRevision !== undefined) {
        res.setHeader('ETag', `"rev-${result.currentRevision}"`);
      }
      const errorCode =
        result.code === 412
          ? 'REVISION_CONFLICT'
          : result.code === 428
          ? 'PRECONDITION_REQUIRED'
          : 'NOT_FOUND';
      return sendApiError(res, result.code, errorCode, result.error, req, {
        details: { currentRevision: result.currentRevision },
      });
    }
    res.setHeader('ETag', `"rev-${result.project.revision}"`);
    return res.json({ project: result.project });
  } catch (err: any) {
    if (err instanceof ApiError) {
      return sendApiError(res, err.status, err.code, err.message, req, { details: err.details });
    }
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to update project', req);
  }
});

app.delete(['/api/v1/projects/:id', '/api/projects/:id'], async (req, res) => {
  try {
    const deleted = await projectStore.delete(req.params.id);
    if (!deleted) {
      return sendApiError(res, 404, 'NOT_FOUND', `Project "${req.params.id}" not found`, req);
    }
    return res.json({ ok: true, message: `Project "${req.params.id}" deleted` });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to delete project', req);
  }
});

// --- Scoped Resumable Upload Sessions & Quarantined Assets (TASK-009, TEST-003/004) ---
// Direct private chunked uploads with server-confirmed byte offsets, checksum verification,
// container inspection, and range-capable delivery.
app.post(['/api/v1/projects/:id/upload-sessions', '/api/projects/:id/upload-sessions'], async (req, res) => {
  try {
    const project = await projectStore.get(req.params.id);
    if (!project) {
      return sendApiError(res, 404, 'NOT_FOUND', `Project "${req.params.id}" not found`, req);
    }
    const { filename, declaredSize, mimeType, sha256, chunkSize } = req.body || {};
    const result = await uploadStore.createSession({
      projectId: req.params.id,
      filename,
      declaredSize,
      mimeType,
      sha256,
      chunkSize,
    });
    if (!result.ok) {
      return sendApiError(res, result.code, (result.errorCode as any) || 'INVALID_PAYLOAD', result.error, req);
    }
    return res.status(201).json({
      session: result.session,
      asset: result.asset,
      uploadUrl: `/api/v1/projects/${req.params.id}/upload-sessions/${result.session.id}/chunks`,
    });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to create upload session', req);
  }
});

app.get(['/api/v1/projects/:id/upload-sessions/:sessionId', '/api/projects/:id/upload-sessions/:sessionId'], async (req, res) => {
  try {
    const session = await uploadStore.getSession(req.params.sessionId);
    if (!session || session.projectId !== req.params.id) {
      return sendApiError(res, 404, 'NOT_FOUND', `Upload session "${req.params.sessionId}" not found`, req);
    }
    return res.json({ session });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to fetch upload session', req);
  }
});

app.put(
  ['/api/v1/projects/:id/upload-sessions/:sessionId/chunks', '/api/projects/:id/upload-sessions/:sessionId/chunks'],
  express.raw({ type: () => true, limit: '100mb' }),
  async (req, res) => {
    try {
      const session = await uploadStore.getSession(req.params.sessionId);
      if (!session || session.projectId !== req.params.id) {
        return sendApiError(res, 404, 'NOT_FOUND', `Upload session "${req.params.sessionId}" not found`, req);
      }

      let offset: number | undefined;
      const range = req.headers['content-range'];
      if (typeof range === 'string') {
        const m = range.match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
        if (m) offset = parseInt(m[1], 10);
      }
      if (offset === undefined && req.headers['x-upload-offset'] !== undefined) {
        offset = parseInt(req.headers['x-upload-offset'] as string, 10);
      }
      if (offset === undefined && req.query.offset !== undefined) {
        offset = parseInt(req.query.offset as string, 10);
      }

      if (offset === undefined || isNaN(offset) || offset < 0) {
        return sendApiError(
          res,
          400,
          'INVALID_PAYLOAD',
          'Upload offset must be specified via Content-Range header, X-Upload-Offset header, or offset query param',
          req
        );
      }

      const chunk = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      if (chunk.length === 0) {
        return sendApiError(res, 400, 'INVALID_PAYLOAD', 'Chunk payload cannot be empty', req);
      }

      const result = await uploadStore.appendChunk(req.params.sessionId, chunk, offset);
      if (!result.ok) {
        return sendApiError(res, result.code, result.errorCode as any, result.error, req, {
          details: result.details,
        });
      }

      return res.json({ ok: true, uploadedBytes: result.uploadedBytes, status: result.status });
    } catch (err: any) {
      return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to append chunk', req);
    }
  }
);

app.post(['/api/v1/projects/:id/upload-sessions/:sessionId/resume', '/api/projects/:id/upload-sessions/:sessionId/resume'], async (req, res) => {
  try {
    const session = await uploadStore.getSession(req.params.sessionId);
    if (!session || session.projectId !== req.params.id) {
      return sendApiError(res, 404, 'NOT_FOUND', `Upload session "${req.params.sessionId}" not found`, req);
    }
    if (session.status === 'session_expired' || new Date(session.expiresAt).getTime() <= Date.now()) {
      return sendApiError(res, 410, 'TRANSFER_SESSION_EXPIRED', 'Upload session has expired', req);
    }
    return res.json({
      ok: true,
      session: {
        id: session.id,
        status: session.status,
        uploadedBytes: session.uploadedBytes,
        declaredSize: session.declaredSize,
        expiresAt: session.expiresAt,
      },
    });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to resume upload session', req);
  }
});

app.post(['/api/v1/projects/:id/upload-sessions/:sessionId/cancel', '/api/projects/:id/upload-sessions/:sessionId/cancel'], async (req, res) => {
  try {
    const session = await uploadStore.getSession(req.params.sessionId);
    if (!session || session.projectId !== req.params.id) {
      return sendApiError(res, 404, 'NOT_FOUND', `Upload session "${req.params.sessionId}" not found`, req);
    }
    const result = await uploadStore.cancelSession(req.params.sessionId);
    return res.json({ ok: true, status: result.status });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to cancel upload session', req);
  }
});

app.post(['/api/v1/projects/:id/assets/:assetId/finalize', '/api/projects/:id/assets/:assetId/finalize'], async (req, res) => {
  try {
    const project = await projectStore.get(req.params.id);
    if (!project) {
      return sendApiError(res, 404, 'NOT_FOUND', `Project "${req.params.id}" not found`, req);
    }
    const result = await uploadStore.finalizeAsset(req.params.id, req.params.assetId);
    if (!result.ok) {
      return sendApiError(res, result.code, result.errorCode as any, result.error, req, {
        details: result.details,
      });
    }

    // Link finalized asset to project model
    project.uploadedVideoUrl = `/api/v1/assets/${result.asset.id}/access`;
    project.uploadedVideoFilename = result.asset.filename;
    project.sourceAssetId = result.asset.id;
    if (result.asset.durationMs) {
      project.durationMs = result.asset.durationMs;
      project.totalDurationMinutes = Math.max(1, Math.round(result.asset.durationMs / 60000));
    }
    await projectStore.update(req.params.id, project, project.revision);

    return res.json({ ok: true, asset: result.asset });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to finalize asset', req);
  }
});

// Explicit media inspection endpoint (TASK-010)
app.post(['/api/v1/projects/:id/assets/:assetId/inspect', '/api/projects/:id/assets/:assetId/inspect'], async (req, res) => {
  try {
    const project = await projectStore.get(req.params.id);
    if (!project) {
      return sendApiError(res, 404, 'NOT_FOUND', `Project "${req.params.id}" not found`, req);
    }
    const result = await uploadStore.inspectAsset(req.params.id, req.params.assetId);
    if (!result.ok) {
      return sendApiError(res, result.code, result.errorCode as any, result.error, req, {
        details: result.details,
      });
    }

    if (result.sourceMetadata.durationMs) {
      project.durationMs = result.sourceMetadata.durationMs;
      project.totalDurationMinutes = Math.max(1, Math.round(result.sourceMetadata.durationMs / 60000));
      await projectStore.update(req.params.id, project, project.revision);
    }

    return res.json({
      ok: true,
      asset: result.asset,
      sourceMetadata: result.sourceMetadata,
    });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to inspect media asset', req);
  }
});

// Generate or trigger preview proxy generation (TASK-010)
app.post(['/api/v1/projects/:id/assets/:assetId/preview', '/api/projects/:id/assets/:assetId/preview'], async (req, res) => {
  try {
    const project = await projectStore.get(req.params.id);
    if (!project) {
      return sendApiError(res, 404, 'NOT_FOUND', `Project "${req.params.id}" not found`, req);
    }
    const result = await uploadStore.generateAssetPreview(req.params.id, req.params.assetId);
    if (!result.ok) {
      return sendApiError(res, result.code, result.errorCode as any, result.error, req);
    }
    return res.json({
      ok: true,
      previewUrl: `/api/v1/assets/${req.params.assetId}/preview`,
      asset: result.asset,
    });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to generate preview proxy', req);
  }
});

app.get(['/api/v1/projects/:id/assets', '/api/projects/:id/assets'], async (req, res) => {
  try {
    const project = await projectStore.get(req.params.id);
    if (!project) {
      return sendApiError(res, 404, 'NOT_FOUND', `Project "${req.params.id}" not found`, req);
    }
    const assets = await uploadStore.listProjectAssets(req.params.id);
    return res.json({ assets });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to list project assets', req);
  }
});

app.get(['/api/v1/assets/:id/access', '/api/assets/:id/access'], async (req, res) => {
  try {
    const asset = await uploadStore.getAsset(req.params.id);
    if (!asset) {
      return sendApiError(res, 404, 'NOT_FOUND', `Asset "${req.params.id}" not found`, req);
    }
    if (asset.status !== 'inspected_ready') {
      return sendApiError(
        res,
        403,
        'QUARANTINE_REJECTED',
        `Asset "${req.params.id}" is in status "${asset.status}"; access denied until quarantine inspection succeeds.`,
        req
      );
    }
    if (!fs.existsSync(asset.storagePath)) {
      return sendApiError(res, 404, 'ARTIFACT_MISSING', 'Asset media file missing on disk', req);
    }

    const stat = fs.statSync(asset.storagePath);
    const total = stat.size;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', asset.mimeType || 'video/mp4');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      if (isNaN(start) || isNaN(end) || start > end || start >= total) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).send('Requested range not satisfiable');
      }

      const chunksize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', chunksize);

      const stream = fs.createReadStream(asset.storagePath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', total);
      const stream = fs.createReadStream(asset.storagePath);
      stream.pipe(res);
    }
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to access asset', req);
  }
});

// Stream preview proxy with range capability (TASK-010, TEST-004)
app.get(['/api/v1/assets/:id/preview', '/api/assets/:id/preview'], async (req, res) => {
  try {
    const asset = await uploadStore.getAsset(req.params.id);
    if (!asset) {
      return sendApiError(res, 404, 'NOT_FOUND', `Asset "${req.params.id}" not found`, req);
    }
    if (asset.status !== 'inspected_ready') {
      return sendApiError(
        res,
        403,
        'QUARANTINE_REJECTED',
        `Asset "${req.params.id}" is in status "${asset.status}"; preview denied until quarantine inspection succeeds.`,
        req
      );
    }

    let filePath = asset.previewStoragePath;
    if (!filePath || !fs.existsSync(filePath)) {
      filePath = asset.storagePath;
    }
    if (!filePath || !fs.existsSync(filePath)) {
      return sendApiError(res, 404, 'ARTIFACT_MISSING', 'Preview proxy media missing on disk', req);
    }

    const stat = fs.statSync(filePath);
    const total = stat.size;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      if (isNaN(start) || isNaN(end) || start > end || start >= total) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).send('Requested range not satisfiable');
      }

      const chunksize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', chunksize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', total);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', err.message || 'Failed to stream preview proxy', req);
  }
});

/**
 * Split long-form manhwa marathon into 15-30 min arcs
 */
app.post('/api/gemini/chunk-marathon', async (req, res) => {
  try {
    const { title, totalDurationMinutes = 600, customChapters = [] } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const prompt = `
You are an expert anime and manhwa YouTube recap producer.
A user has an ultra-long manhwa recap marathon video:
Title: "${title || 'I Became The Undefeated Monarch in 100 Days'}"
Total Duration: ${totalDurationMinutes} minutes (approx ${(totalDurationMinutes / 60).toFixed(1)} hours).
Provided Chapter Notes: ${JSON.stringify(customChapters)}

Split this ultra-long marathon video into episodic 15 to 30-minute story arcs suitable for YouTube binge-watching and episodic Urdu dubbing.
Each arc should have:
1. arcNumber: integer (1, 2, 3...)
2. title: Catchy YouTube episode title (e.g. "Arc 1: The Weakest Hunter's Awakening")
3. titleUrdu: Catchy Urdu title (e.g. "حصہ 1: سب سے کمزور ہنٹر کی بیداری")
4. startMinute: integer
5. endMinute: integer
6. durationMinutes: integer (between 15 and 30 minutes)
7. cliffhangerHook: The dramatic ending hook for the episode (English)
8. cliffhangerHookUrdu: The dramatic ending hook in conversational Urdu
9. pacing: "fast-paced" | "action-heavy" | "emotional-lore" | "boss-fight"
10. chaptersCovered: string (e.g. "Chapters 1 - 15")

Partition the entire duration from 0 to ${totalDurationMinutes} minutes into 8 to 15 cohesive arcs.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            arcs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  arcNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  titleUrdu: { type: Type.STRING },
                  startMinute: { type: Type.INTEGER },
                  endMinute: { type: Type.INTEGER },
                  durationMinutes: { type: Type.INTEGER },
                  cliffhangerHook: { type: Type.STRING },
                  cliffhangerHookUrdu: { type: Type.STRING },
                  pacing: { type: Type.STRING },
                  chaptersCovered: { type: Type.STRING },
                },
                required: [
                  'arcNumber',
                  'title',
                  'titleUrdu',
                  'startMinute',
                  'endMinute',
                  'durationMinutes',
                  'cliffhangerHook',
                  'cliffhangerHookUrdu',
                  'pacing',
                  'chaptersCovered',
                ],
              },
            },
          },
          required: ['arcs'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"arcs":[]}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error chunking marathon:', error);
    res.status(500).json({ error: error.message || 'Failed to partition marathon arcs' });
  }
});

/**
 * Adapt English Manhwa recap transcript into Conversational Urdu YouTube style
 */
app.post('/api/gemini/translate-recap', async (req, res) => {
  try {
    const { segments, arcContext = '', characterNames = [] } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'segments array is required' });
    }

    const prompt = `
You are the top Urdu/Hindi Anime & Manhwa YouTube recap narrator (famous for captivating storytelling in conversational Urdu).
Transform the following English manhwa recap transcript into conversational spoken Urdu for a YouTube voiceover.

CRITICAL TONE RULES:
1. USE NATURAL CONVERSATIONAL URDU (popular YouTube recap style):
   - Use recap hooks and storytelling transitions: "Kahani shuru hoti hai...", "Humara main character...", "Lekin achanak...", "Ab aage dekhiye...", "Yeh sun kar wo dang reh gaya!", "Usne socha bhi nahi tha...".
   - Avoid overly formal/bookish Arabic-Persian archaic words. Use words ordinary viewers understand and love.
   - Maintain fast-paced, breathless anime recap narration rhythm.
2. Provide TRIPLE representation for every segment:
   - "urduText": Proper Urdu Nastaliq script.
   - "romanUrduText": Roman Urdu Latin script (e.g. "Humara hero achanak uthta hai aur dekhta hai ke system screen saamne hai...").
   - "toneDirective": Vocal emotion instruction for the voice actor or TTS (e.g. "Dramatic Whisper", "High Tension Battle", "Suspenseful Hook", "Astonished").
   - "recapPacing": Estimated reading pace ("fast", "normal", "slow").

Arc Context: ${arcContext}
Character Names: ${characterNames.join(', ')}

English Segments to Adapt:
${JSON.stringify(segments, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            adaptedSegments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  englishText: { type: Type.STRING },
                  urduText: { type: Type.STRING },
                  romanUrduText: { type: Type.STRING },
                  toneDirective: { type: Type.STRING },
                  recapPacing: { type: Type.STRING },
                },
                required: ['id', 'start', 'end', 'englishText', 'urduText', 'romanUrduText', 'toneDirective'],
              },
            },
          },
          required: ['adaptedSegments'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"adaptedSegments":[]}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error translating recap:', error);
    res.status(500).json({ error: error.message || 'Failed to adapt recap script' });
  }
});

import crypto from 'crypto';

const audioCacheDir = path.resolve(process.cwd(), 'audio-cache');
if (!fs.existsSync(audioCacheDir)) {
  fs.mkdirSync(audioCacheDir, { recursive: true });
}

function getAudioCacheKey(text: string, voice = 'Zephyr') {
  const norm = (text || '').trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(`${voice}:${norm}`).digest('hex');
}

// Demo placeholder-tone generation and preset-dialogue maps were removed from
// the production server in TASK-005 (AUDIT F07/F09/F10): narration artifacts
// may only come from explicit TTS requests; tones are never presented as speech.
// Fixture generation lives in the standalone dev script pre-cache.ts only.

// Read-only audio artifact access (AUDIT F07). GET and HEAD never synthesize,
// never write, and never fall back to placeholder audio. Speech is produced
// only through the explicit POST /api/gemini/tts job below.
app.get('/audio-cache/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = resolveContained(audioCacheDir, filename);
  if (!filePath) {
    return res.status(400).json({ error: 'Invalid artifact name' });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ error: 'Audio artifact not found' });
  }
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return fs.createReadStream(filePath).pipe(res);
});

app.get('/api/cached-audio-list', (req, res) => {
  try {
    const files = fs.readdirSync(audioCacheDir).filter((f) => f.endsWith('.wav'));
    res.json({ files });
  } catch {
    res.json({ files: [] });
  }
});

/**
 * Generate High-Fidelity Urdu Voiceover with Gemini TTS (gemini-3.8-flash-lite-tts)
 */
app.post('/api/gemini/tts', async (req, res) => {
  try {
    const { text, segmentId, voiceName = 'Zephyr', toneStyle = 'Excited, dramatic anime recap narrator with high tension and energy' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const validVoices = ['Zephyr', 'Fenrir', 'Kore', 'Puck', 'Charon'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Zephyr';

    if (segmentId !== undefined && !isSafeName(segmentId)) {
      return res.status(400).json({ error: 'Invalid segmentId' });
    }
    if (text.length > 10000) {
      return res.status(400).json({ error: 'text exceeds 10000 characters' });
    }

    // 1. Check disk cache first!
    const cacheKey = getAudioCacheKey(text, chosenVoice);
    const keyFile = resolveContained(audioCacheDir, `${cacheKey}.wav`)!;
    const idFile = segmentId ? resolveContained(audioCacheDir, `${segmentId}.wav`) : null;
    const resolvedUrl = `/audio-cache/${segmentId ? `${segmentId}.wav` : `${cacheKey}.wav`}`;

    if (idFile && fs.existsSync(idFile)) {
      const buffer = fs.readFileSync(idFile);
      return res.json({
        audioUrl: resolvedUrl,
        audioBase64: buffer.toString('base64'),
        mimeType: 'audio/wav',
        voice: chosenVoice,
        fromCache: true,
      });
    }

    if (fs.existsSync(keyFile)) {
      const buffer = fs.readFileSync(keyFile);
      if (idFile) fs.writeFileSync(idFile, buffer);
      return res.json({
        audioUrl: resolvedUrl,
        audioBase64: buffer.toString('base64'),
        mimeType: 'audio/wav',
        voice: chosenVoice,
        fromCache: true,
      });
    }

    if (!apiKey) {
      // Honest failure: no credentials means no speech. Never substitute a
      // placeholder tone for narration (AUDIT F07/F09).
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    // Call gemini-3.8-flash-lite-tts unary
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text,
              speechMetadata: {
                style: toneStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(502).json({ error: 'No audio data returned from Gemini TTS model.' });
    }

    // Save to disk cache
    const buf = Buffer.from(base64Audio, 'base64');
    fs.writeFileSync(keyFile, buf);
    if (idFile) {
      fs.writeFileSync(idFile, buf);
    }

    res.json({
      audioUrl: resolvedUrl,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voice: chosenVoice,
      fromCache: false,
    });
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    res.status(502).json({ error: 'TTS provider request failed; no audio was produced.' });
  }
});

/**
 * Batch synthesize all segments in an arc
 */
app.post('/api/gemini/batch-tts', async (req, res) => {
  try {
    const { segments = [], voiceName = 'Zephyr', toneStyle = 'Dramatic conversational Urdu YouTube manhwa recap host' } = req.body;

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'segments array is required' });
    }
    if (segments.length > 1000) {
      return res.status(400).json({ error: 'segments exceeds 1000 items; use the durable job pipeline for larger batches' });
    }
    if (!apiKey) {
      // Honest missing-key failure up front: no partial fake results (AUDIT F09).
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const validVoices = ['Zephyr', 'Fenrir', 'Kore', 'Puck', 'Charon'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Zephyr';

    const results: Array<{ id: string; audioUrl: string | null; audioGenerated: boolean; error?: string }> = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segId = seg.id;
      if (!isSafeName(segId)) {
        results.push({ id: String(segId ?? `index-${i}`), audioUrl: null, audioGenerated: false, error: 'invalid-id' });
        continue;
      }
      const text = seg.urduText || seg.romanUrduText;
      if (!text || typeof text !== 'string') {
        results.push({ id: segId, audioUrl: null, audioGenerated: false, error: 'no-text' });
        continue;
      }
      if (text.length > 10000) {
        results.push({ id: segId, audioUrl: null, audioGenerated: false, error: 'text-too-long' });
        continue;
      }

      const cacheKey = getAudioCacheKey(text, chosenVoice);
      const idFile = resolveContained(audioCacheDir, `${segId}.wav`)!;
      const keyFile = resolveContained(audioCacheDir, `${cacheKey}.wav`)!;
      const audioUrl = `/audio-cache/${segId}.wav`;

      if (fs.existsSync(idFile)) {
        results.push({ id: segId, audioUrl, audioGenerated: true });
        continue;
      }
      if (fs.existsSync(keyFile)) {
        fs.writeFileSync(idFile, fs.readFileSync(keyFile));
        results.push({ id: segId, audioUrl, audioGenerated: true });
        continue;
      }

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text, speechMetadata: { style: toneStyle } }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: chosenVoice } },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const buf = Buffer.from(base64Audio, 'base64');
          fs.writeFileSync(keyFile, buf);
          fs.writeFileSync(idFile, buf);
          results.push({ id: segId, audioUrl, audioGenerated: true });
          continue;
        }
        results.push({ id: segId, audioUrl: null, audioGenerated: false, error: 'provider-returned-no-audio' });
      } catch (err: any) {
        console.warn(`Batch TTS item ${segId} warning:`, err.message);
        // Failed or partial generation stays visibly failed (AUDIT F09).
        results.push({ id: segId, audioUrl: null, audioGenerated: false, error: 'provider-error' });
      }
    }

    const failed = results.filter((r) => !r.audioGenerated).length;
    res.json({ results, complete: failed === 0, failedCount: failed });
  } catch (error: any) {
    console.error('Error in batch TTS:', error);
    res.status(502).json({ error: 'Batch TTS synthesis failed; see results for per-item state.' });
  }
});

/**
 * Stitch all segments into a master continuous WAV audio track
 */
app.post('/api/gemini/stitch-master-audio', (req, res) => {
  try {
    const { segments = [], totalDurationSeconds = 120, arcId = 'arc-1', allowPartial = false } = req.body;

    const checked = validateTimeline(segments, totalDurationSeconds);
    if (!checked.ok) {
      return res.status(400).json({ error: checked.error });
    }
    if (!isSafeName(arcId)) {
      return res.status(400).json({ error: 'Invalid arcId' });
    }
    const timeline = checked.segments;
    const duration = checked.totalDurationSeconds;

    const sampleRate = 24000;
    const bytesPerSample = 2; // 16-bit
    const totalSamples = Math.ceil(duration * sampleRate);
    const pcmDataSize = totalSamples * bytesPerSample;

    // Allocate silence buffer for entire arc
    const masterPcm = Buffer.alloc(pcmDataSize);

    // Merge each segment; missing artifacts are recorded, never silently
    // replaced with silence presented as success (AUDIT F09).
    const missingSegments: string[] = [];
    for (const seg of timeline) {
      const segFile = resolveContained(audioCacheDir, `${seg.id}.wav`)!;
      if (!fs.existsSync(segFile)) {
        missingSegments.push(seg.id);
        continue;
      }
      const segWav = fs.readFileSync(segFile);
      if (segWav.length > 44) {
        const segPcm = segWav.subarray(44);
        const startSample = Math.floor((seg.start || 0) * sampleRate);
        const startByte = startSample * bytesPerSample;

        if (startByte < masterPcm.length) {
          const copyLen = Math.min(segPcm.length, masterPcm.length - startByte);
          segPcm.copy(masterPcm, startByte, 0, copyLen);
        }
      }
    }

    if (missingSegments.length > 0 && !allowPartial) {
      return res.status(409).json({
        error: 'Missing segment audio; refusing to render silence as complete narration. Generate the missing segments or pass allowPartial:true to accept explicit gaps.',
        missingSegments,
      });
    }

    // Build master WAV with RIFF header
    const masterWav = Buffer.alloc(44 + pcmDataSize);
    masterWav.write('RIFF', 0);
    masterWav.writeUInt32LE(36 + pcmDataSize, 4);
    masterWav.write('WAVE', 8);
    masterWav.write('fmt ', 12);
    masterWav.writeUInt32LE(16, 16);
    masterWav.writeUInt16LE(1, 20); // PCM
    masterWav.writeUInt16LE(1, 22); // Mono
    masterWav.writeUInt32LE(sampleRate, 24);
    masterWav.writeUInt32LE(sampleRate * bytesPerSample, 28);
    masterWav.writeUInt16LE(bytesPerSample, 32);
    masterWav.writeUInt16LE(16, 34);
    masterWav.write('data', 36);
    masterWav.writeUInt32LE(pcmDataSize, 40);
    masterPcm.copy(masterWav, 44);

    const masterFilename = `master_${arcId}_${Date.now()}.wav`;
    const masterPath = resolveContained(audioCacheDir, masterFilename)!;
    fs.writeFileSync(masterPath, masterWav);

    res.json({
      masterAudioUrl: `/audio-cache/${masterFilename}`,
      durationSeconds: duration,
      fileSizeBytes: masterWav.length,
      partial: missingSegments.length > 0,
      missingSegments,
    });
  } catch (error: any) {
    console.error('Error stitching audio:', error);
    res.status(500).json({ error: 'Failed to stitch master audio' });
  }
});

/**
 * Upload an original manhwa video file for dubbing (MP4, WebM, MKV, MOV)
 */
app.post('/api/upload-video', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }
  // Validate actual media container (AUDIT F02): extension comes from sniffed
  // magic bytes, never from the client. Non-video/active content is deleted.
  const tmpPath = req.file.path;
  try {
    const fd = fs.openSync(tmpPath, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    const ext = sniffVideoExt(head);
    if (!ext || req.file.size < 16) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'Rejected: file is not a recognized video container (mp4/mov/webm/mkv/avi).' });
    }
    const baseName = path.basename(req.file.filename, '.bin');
    const finalName = `${baseName}${ext}`;
    const finalPath = resolveContained(uploadsDir, finalName)!;
    fs.renameSync(tmpPath, finalPath);
    res.json({
      success: true,
      videoUrl: `/uploads/${finalName}`,
      filename: finalName,
      originalname: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    console.error('Upload validation error:', err);
    try { fs.unlinkSync(tmpPath); } catch { /* already removed */ }
    return res.status(400).json({ error: 'Upload validation failed; file was discarded.' });
  }
});

// Multer failures (e.g. size limit) must fail honestly as JSON (AUDIT F04/F02).
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Upload exceeds the 500 MB interim limit; large resumable transfer is TASK-009/039.' });
  }
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ error: `Upload rejected: ${err.code}` });
  }
  return next(err);
});

/**
 * List available original videos (built-in sample and user uploads)
 */
app.get('/api/available-videos', (req, res) => {
  try {
    const samplePath = path.join(videosDir, 'sample-manhwa-original.mp4');
    const hasSample = fs.existsSync(samplePath);
    const uploadedFiles = fs.existsSync(uploadsDir)
      ? fs.readdirSync(uploadsDir).filter((f) => /\.(mp4|webm|mkv|mov)$/i.test(f))
      : [];
    const dubbedFiles = fs.existsSync(dubbedVideosDir)
      ? fs.readdirSync(dubbedVideosDir).filter((f) => /\.(mp4|webm)$/i.test(f))
      : [];

    res.json({
      sample: hasSample
        ? {
            videoUrl: '/videos/sample-manhwa-original.mp4',
            title: 'Sample Manhwa Recap Original Video (Solo Leveling Episode 1)',
            durationSeconds: 105,
          }
        : null,
      uploads: uploadedFiles.map((f) => ({
        videoUrl: `/uploads/${f}`,
        filename: f,
      })),
      recentDubbed: dubbedFiles.map((f) => ({
        dubbedVideoUrl: `/dubbed-videos/${f}`,
        filename: f,
      })),
    });
  } catch (err: any) {
    res.json({ error: err.message, uploads: [], recentDubbed: [] });
  }
});

/**
 * Studio Quality Dubbing Engine:
 * Combines Original Video + Synced Spoken Urdu Audio using FFmpeg
 */
app.post('/api/dub-video-studio', async (req, res) => {
  try {
    const {
      videoSource = 'sample',
      uploadedVideoUrl,
      arcId = 'arc-1',
      segments = [],
      totalDurationSeconds = 105,
      allowPartial = false,
    } = req.body;

    const checked = validateTimeline(segments, totalDurationSeconds);
    if (!checked.ok) {
      return res.status(400).json({ error: checked.error });
    }
    if (!isSafeName(arcId)) {
      return res.status(400).json({ error: 'Invalid arcId' });
    }
    const timeline = checked.segments;
    const duration = checked.totalDurationSeconds;

    // 1. Resolve original video file path. Never silently substitute the
    //    sample video for an invalid upload reference (AUDIT F12).
    let inputVideoPath: string;
    if (videoSource === 'sample') {
      inputVideoPath = path.join(videosDir, 'sample-manhwa-original.mp4');
    } else if (videoSource === 'uploaded') {
      const uploadName = typeof uploadedVideoUrl === 'string' ? path.posix.basename(uploadedVideoUrl.replace(/^\/+/, '')) : '';
      const candidatePath = resolveContained(uploadsDir, uploadName);
      if (!candidatePath || !fs.existsSync(candidatePath)) {
        return res.status(400).json({ error: 'Invalid or missing uploaded video reference; refusing to substitute sample footage.' });
      }
      inputVideoPath = candidatePath;
    } else {
      return res.status(400).json({ error: "videoSource must be 'sample' or 'uploaded'" });
    }

    if (!fs.existsSync(inputVideoPath)) {
      return res.status(404).json({ error: 'Original video not found' });
    }

    // 2. Stitch master continuous Urdu WAV track
    const sampleRate = 24000;
    const bytesPerSample = 2; // 16-bit
    const totalSamples = Math.ceil(duration * sampleRate);
    const pcmDataSize = totalSamples * bytesPerSample;
    const masterPcm = Buffer.alloc(pcmDataSize);

    const missingSegments: string[] = [];
    for (const seg of timeline) {
      const segFile = resolveContained(audioCacheDir, `${seg.id}.wav`)!;
      if (!fs.existsSync(segFile)) {
        missingSegments.push(seg.id);
        continue;
      }
      const segWav = fs.readFileSync(segFile);
      if (segWav.length > 44) {
        const segPcm = segWav.subarray(44);
        const startSample = Math.floor((seg.start || 0) * sampleRate);
        const startByte = startSample * bytesPerSample;

        if (startByte < masterPcm.length) {
          const copyLen = Math.min(segPcm.length, masterPcm.length - startByte);
          segPcm.copy(masterPcm, startByte, 0, copyLen);
        }
      }
    }

    if (missingSegments.length > 0 && !allowPartial) {
      return res.status(409).json({
        error: 'Missing segment audio; refusing to mux silence as complete narration. Generate the missing segments or pass allowPartial:true to accept explicit gaps.',
        missingSegments,
      });
    }

    // Build master WAV with RIFF header
    const masterWav = Buffer.alloc(44 + pcmDataSize);
    masterWav.write('RIFF', 0);
    masterWav.writeUInt32LE(36 + pcmDataSize, 4);
    masterWav.write('WAVE', 8);
    masterWav.write('fmt ', 12);
    masterWav.writeUInt32LE(16, 16);
    masterWav.writeUInt16LE(1, 20); // PCM
    masterWav.writeUInt16LE(1, 22); // Mono
    masterWav.writeUInt32LE(sampleRate, 24);
    masterWav.writeUInt32LE(sampleRate * bytesPerSample, 28);
    masterWav.writeUInt16LE(bytesPerSample, 32);
    masterWav.writeUInt16LE(16, 34);
    masterWav.write('data', 36);
    masterWav.writeUInt32LE(pcmDataSize, 40);
    masterPcm.copy(masterWav, 44);

    const masterAudioFilename = `master_${arcId}_${Date.now()}.wav`;
    const masterAudioPath = resolveContained(audioCacheDir, masterAudioFilename)!;
    fs.writeFileSync(masterAudioPath, masterWav);

    // 3. Mux original video stream + studio Urdu audio stream via FFmpeg
    const outFilename = `dubbed_${arcId}_${Date.now()}.mp4`;
    const outputPath = resolveContained(dubbedVideosDir, outFilename)!;

    try {
      await execFilePromise('ffmpeg', [
        '-y',
        '-i', inputVideoPath,
        '-i', masterAudioPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        outputPath,
      ]);
    } catch (ffErr: any) {
      if (ffErr && ffErr.code === 'ENOENT') {
        return res.status(503).json({ error: 'FFmpeg is not available on this server; rendering requires a media worker (see docs/11-infrastructure-deployment.md).' });
      }
      console.error('FFmpeg mux failed:', ffErr);
      return res.status(500).json({ error: 'FFmpeg mux failed; no dubbed video was produced.' });
    }

    const stat = fs.statSync(outputPath);

    res.json({
      success: true,
      dubbedVideoUrl: `/dubbed-videos/${outFilename}`,
      filename: outFilename,
      fileSizeBytes: stat.size,
      durationSeconds: duration,
      masterAudioUrl: `/audio-cache/${masterAudioFilename}`,
      partial: missingSegments.length > 0,
      missingSegments,
      audioMode: 'replaced_original_audio',
      message: 'Original video and studio Urdu voiceover successfully merged; original English audio completely replaced with Urdu narration.',
    });
  } catch (err: any) {
    console.error('Error in dub-video-studio:', err);
    res.status(500).json({ error: 'Failed to merge original video and Urdu dub' });
  }
});

/**
 * Transcript extraction is NOT implemented. This route previously asked a model
 * to invent a realistic sample transcript from URL/title text (AUDIT F10) and
 * presented it as the user's source. It is disabled rather than faked: a real
 * source-derived transcript arrives via TASK-014 (ASR) or an owner-supplied
 * transcript file. See docs/03-youtube-rights-ingestion.md.
 */
app.post('/api/gemini/extract-transcript', (_req, res) => {
  res.status(501).json({
    error: 'Automatic transcript extraction from a YouTube link is not implemented. Provide authorized source media (upload) or a supplied transcript; a link is not a source of renderable bytes.',
  });
});

/**
 * Setup Vite in Dev or Static files in Prod
 */
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve ONLY the built client directory. The server bundle lives at
    // dist/server.js and must never be reachable over HTTP (AUDIT F15).
    const clientPath = path.resolve(process.cwd(), 'dist', 'public');
    app.use(express.static(clientPath, { index: false, dotfiles: 'deny' }));
    // SPA fallback for client routes only; API paths, dotfiles, and file-like
    // paths (e.g. /server.js, /.env) must never receive HTML or backend bytes.
    app.get('*', (req, res, _next) => {
      const isDotfile = path.basename(req.path).startsWith('.');
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/audio-cache/') ||
        isDotfile ||
        path.extname(req.path) !== ''
      ) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.resolve(clientPath, 'index.html'), (err) => {
        if (err) {
          res.status(404).json({ error: 'Client build not found. Run npm run build first.' });
        }
      });
    });
  }

  const server = app.listen(PORT, () => {
    const address = server.address();
    const boundPort = typeof address === 'object' && address !== null ? address.port : PORT;
    console.log(`ManhwaUrdu DubStudio server listening on http://0.0.0.0:${boundPort}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
