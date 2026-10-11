import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isSafeId } from './projectStore';
import { inspectMedia, SourceMetadata } from '../media/inspector';
import { generatePreviewProxy } from '../media/previewProxy';

export const MAX_UPLOAD_SIZE = 128 * 1024 * 1024 * 1024; // 128 GB architectural design limit
export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB recommended chunk size
export const DEFAULT_SESSION_TTL_HOURS = 24;

export interface Asset {
  id: string;
  projectId: string;
  ownerId: string;
  type: 'source_video' | 'transcript' | 'audio' | 'export' | 'preview_proxy';
  filename: string;
  byteLength: number;
  sha256?: string;
  mimeType: string;
  status: 'quarantined' | 'inspected_ready' | 'failed' | 'deleted';
  quarantineReason?: string;
  storagePath: string;
  durationMs?: number;
  sourceMetadata?: SourceMetadata;
  previewAssetId?: string;
  previewStoragePath?: string;
  createdAt: string;
  updatedAt: string;
}

export type UploadSessionStatus =
  | 'created'
  | 'uploading'
  | 'verifying'
  | 'inspected_ready'
  | 'cancelled'
  | 'session_expired'
  | 'failed';

export interface UploadSession {
  id: string;
  projectId: string;
  ownerId: string;
  assetId: string;
  filename: string;
  declaredSize: number;
  mimeType: string;
  status: UploadSessionStatus;
  uploadedBytes: number;
  chunkSize: number;
  expiresAt: string;
  sha256Expected?: string;
  sha256Computed?: string;
  tempFilePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadStoreOptions {
  assetsDir?: string;
  quarantineDir?: string;
  sessionsDir?: string;
  proxiesDir?: string;
}

// Media container magic signatures for inspection
const VIDEO_MAGIC: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  // ISO-BMFF (mp4/mov/m4v): 'ftyp' at offset 4 or 'moov' at offset 4
  {
    ext: '.mp4',
    test: (b) =>
      b.length >= 12 &&
      (b.subarray(4, 8).toString('latin1') === 'ftyp' || b.subarray(4, 8).toString('latin1') === 'moov'),
  },
  // EBML (webm/mkv)
  {
    ext: '.webm',
    test: (b) => b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
  // AVI: RIFF....AVI
  {
    ext: '.avi',
    test: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'AVI ',
  },
];

/**
 * Sniffs media container to ensure it's a real video container and not active content (HTML, SVG, polyglots).
 */
export function inspectMediaContainer(filePath: string): { ok: true; ext: string } | { ok: false; reason: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, reason: 'File does not exist on disk' };
    }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return { ok: false, reason: 'File is empty (0 bytes)' };
    }

    const fd = fs.openSync(filePath, 'r');
    const head = Buffer.alloc(Math.min(512, stat.size));
    fs.readSync(fd, head, 0, head.length, 0);
    fs.closeSync(fd);

    const headAscii = head.toString('latin1').toLowerCase();

    // Check for forbidden active content / scripts
    if (
      headAscii.includes('<html') ||
      headAscii.includes('<!doctype') ||
      headAscii.includes('<svg') ||
      headAscii.includes('<script') ||
      headAscii.includes('<?xml')
    ) {
      return { ok: false, reason: 'Rejected active/HTML/SVG content disguised as video' };
    }

    for (const { ext, test } of VIDEO_MAGIC) {
      if (test(head)) {
        return { ok: true, ext };
      }
    }

    return { ok: false, reason: 'Unknown or unsupported media container magic' };
  } catch (err: any) {
    return { ok: false, reason: err.message || 'Failed to inspect media' };
  }
}

export class UploadStore {
  public assetsDir: string;
  public quarantineDir: string;
  public sessionsDir: string;
  public proxiesDir: string;

  constructor(options?: UploadStoreOptions) {
    this.assetsDir = options?.assetsDir || path.resolve(process.cwd(), 'data/assets');
    this.quarantineDir = options?.quarantineDir || path.resolve(process.cwd(), 'data/quarantine');
    this.sessionsDir = options?.sessionsDir || path.resolve(process.cwd(), 'data/upload-sessions');
    this.proxiesDir = options?.proxiesDir || path.resolve(process.cwd(), 'data/proxies');

    if (!fs.existsSync(this.assetsDir)) fs.mkdirSync(this.assetsDir, { recursive: true });
    if (!fs.existsSync(this.quarantineDir)) fs.mkdirSync(this.quarantineDir, { recursive: true });
    if (!fs.existsSync(this.sessionsDir)) fs.mkdirSync(this.sessionsDir, { recursive: true });
    if (!fs.existsSync(this.proxiesDir)) fs.mkdirSync(this.proxiesDir, { recursive: true });
  }

  private getSessionPath(sessionId: string): string | null {
    if (!isSafeId(sessionId)) return null;
    const base = path.resolve(this.sessionsDir);
    const candidate = path.resolve(base, `${sessionId}.json`);
    if (!candidate.startsWith(base + path.sep)) return null;
    return candidate;
  }

  private getAssetMetaPath(assetId: string): string | null {
    if (!isSafeId(assetId)) return null;
    const base = path.resolve(this.assetsDir);
    const candidate = path.resolve(base, `${assetId}.meta.json`);
    if (!candidate.startsWith(base + path.sep)) return null;
    return candidate;
  }

  public async createSession(input: {
    projectId: string;
    ownerId?: string;
    filename: string;
    declaredSize: number;
    mimeType?: string;
    sha256?: string;
    chunkSize?: number;
    ttlHours?: number;
  }): Promise<{ ok: true; session: UploadSession; asset: Asset } | { ok: false; code: number; error: string; errorCode?: string }> {
    if (!isSafeId(input.projectId)) {
      return { ok: false, code: 400, error: 'Invalid project ID', errorCode: 'INVALID_PAYLOAD' };
    }
    if (!input.filename || typeof input.filename !== 'string') {
      return { ok: false, code: 400, error: 'filename is required', errorCode: 'INVALID_PAYLOAD' };
    }

    // Sanitize filename: strip path separators, limit length
    const sanitizedFilename = path.posix.basename(input.filename.replace(/\\/g, '/')).trim();
    if (!sanitizedFilename || sanitizedFilename.startsWith('.') || sanitizedFilename.includes('..')) {
      return { ok: false, code: 400, error: 'Invalid filename', errorCode: 'UPLOAD_INVALID' };
    }

    // Reject dangerous file extensions
    if (/\.(html?|svg|js|mjs|exe|bat|sh|php|cgi)$/i.test(sanitizedFilename)) {
      return { ok: false, code: 422, error: 'File type not allowed', errorCode: 'MEDIA_UNSUPPORTED' };
    }

    if (
      typeof input.declaredSize !== 'number' ||
      !Number.isFinite(input.declaredSize) ||
      input.declaredSize <= 0
    ) {
      return { ok: false, code: 400, error: 'declaredSize must be a positive integer', errorCode: 'INVALID_PAYLOAD' };
    }

    if (input.declaredSize > MAX_UPLOAD_SIZE) {
      return {
        ok: false,
        code: 413,
        error: `declaredSize exceeds maximum allowed upload limit (${MAX_UPLOAD_SIZE} bytes)`,
        errorCode: 'LIMIT_EXCEEDED',
      };
    }

    const sessionId = `upl_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
    const assetId = `ast_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    const ttlHours = input.ttlHours ?? DEFAULT_SESSION_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    const tempFileName = `${sessionId}.part`;
    const tempFilePath = path.join(this.quarantineDir, tempFileName);

    // Initial empty quarantined file
    fs.writeFileSync(tempFilePath, Buffer.alloc(0));

    const session: UploadSession = {
      id: sessionId,
      projectId: input.projectId,
      ownerId: input.ownerId || 'owner',
      assetId,
      filename: sanitizedFilename,
      declaredSize: input.declaredSize,
      mimeType: input.mimeType || 'application/octet-stream',
      status: 'created',
      uploadedBytes: 0,
      chunkSize: input.chunkSize || DEFAULT_CHUNK_SIZE,
      expiresAt,
      sha256Expected: input.sha256,
      tempFilePath,
      createdAt: now,
      updatedAt: now,
    };

    const asset: Asset = {
      id: assetId,
      projectId: input.projectId,
      ownerId: input.ownerId || 'owner',
      type: 'source_video',
      filename: sanitizedFilename,
      byteLength: 0,
      mimeType: input.mimeType || 'application/octet-stream',
      status: 'quarantined',
      storagePath: tempFilePath,
      createdAt: now,
      updatedAt: now,
    };

    const sessionPath = this.getSessionPath(sessionId)!;
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf8');

    const assetMetaPath = this.getAssetMetaPath(assetId)!;
    fs.writeFileSync(assetMetaPath, JSON.stringify(asset, null, 2), 'utf8');

    return { ok: true, session, asset };
  }

  public async getSession(sessionId: string): Promise<UploadSession | null> {
    const sessionPath = this.getSessionPath(sessionId);
    if (!sessionPath || !fs.existsSync(sessionPath)) return null;

    try {
      const raw = fs.readFileSync(sessionPath, 'utf8');
      const session = JSON.parse(raw) as UploadSession;

      // Check expiry
      if (session.status !== 'inspected_ready' && session.status !== 'cancelled') {
        if (new Date(session.expiresAt).getTime() <= Date.now()) {
          session.status = 'session_expired';
          this.saveSession(session);
        }
      }

      return session;
    } catch {
      return null;
    }
  }

  public saveSession(session: UploadSession): void {
    const sessionPath = this.getSessionPath(session.id);
    if (sessionPath) {
      session.updatedAt = new Date().toISOString();
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf8');
    }
  }

  public async appendChunk(
    sessionId: string,
    chunk: Buffer,
    offset: number
  ): Promise<
    | { ok: true; uploadedBytes: number; status: UploadSessionStatus }
    | { ok: false; code: number; error: string; errorCode: string; details?: Record<string, unknown> }
  > {
    const session = await this.getSession(sessionId);
    if (!session) {
      return { ok: false, code: 404, error: 'Upload session not found', errorCode: 'NOT_FOUND' };
    }

    if (session.status === 'session_expired' || new Date(session.expiresAt).getTime() <= Date.now()) {
      session.status = 'session_expired';
      this.saveSession(session);
      return {
        ok: false,
        code: 410,
        error: 'Upload session has expired',
        errorCode: 'TRANSFER_SESSION_EXPIRED',
      };
    }

    if (session.status === 'cancelled') {
      return { ok: false, code: 409, error: 'Upload session was cancelled', errorCode: 'JOB_CANCELLED' };
    }

    // Verify offset strictly matches server-confirmed bytes
    if (offset !== session.uploadedBytes) {
      return {
        ok: false,
        code: 409,
        error: `Byte offset mismatch: expected ${session.uploadedBytes}, received ${offset}`,
        errorCode: 'UPLOAD_OFFSET_MISMATCH',
        details: { currentOffset: session.uploadedBytes, receivedOffset: offset },
      };
    }

    if (session.uploadedBytes + chunk.length > session.declaredSize) {
      return {
        ok: false,
        code: 413,
        error: `Chunk of ${chunk.length} bytes at offset ${offset} exceeds declared size ${session.declaredSize}`,
        errorCode: 'LIMIT_EXCEEDED',
        details: { declaredSize: session.declaredSize, attemptedBytes: session.uploadedBytes + chunk.length },
      };
    }

    // Append chunk to quarantined temporary file
    fs.appendFileSync(session.tempFilePath, chunk);
    session.uploadedBytes += chunk.length;

    if (session.uploadedBytes === session.declaredSize) {
      session.status = 'verifying';
    } else {
      session.status = 'uploading';
    }

    this.saveSession(session);
    return { ok: true, uploadedBytes: session.uploadedBytes, status: session.status };
  }

  public async cancelSession(sessionId: string): Promise<{ ok: boolean; status: UploadSessionStatus }> {
    const session = await this.getSession(sessionId);
    if (!session) return { ok: false, status: 'failed' };

    session.status = 'cancelled';
    this.saveSession(session);

    // Clean up temporary quarantined file
    if (fs.existsSync(session.tempFilePath)) {
      try {
        fs.unlinkSync(session.tempFilePath);
      } catch {
        // Ignore unlink error
      }
    }

    const asset = await this.getAsset(session.assetId);
    if (asset) {
      asset.status = 'deleted';
      this.saveAsset(asset);
    }

    return { ok: true, status: 'cancelled' };
  }

  public async getAsset(assetId: string): Promise<Asset | null> {
    const metaPath = this.getAssetMetaPath(assetId);
    if (!metaPath || !fs.existsSync(metaPath)) return null;

    try {
      const raw = fs.readFileSync(metaPath, 'utf8');
      return JSON.parse(raw) as Asset;
    } catch {
      return null;
    }
  }

  public saveAsset(asset: Asset): void {
    const metaPath = this.getAssetMetaPath(asset.id);
    if (metaPath) {
      asset.updatedAt = new Date().toISOString();
      fs.writeFileSync(metaPath, JSON.stringify(asset, null, 2), 'utf8');
    }
  }

  public async listProjectAssets(projectId: string): Promise<Asset[]> {
    if (!isSafeId(projectId) || !fs.existsSync(this.assetsDir)) return [];
    const files = fs.readdirSync(this.assetsDir).filter((f) => f.endsWith('.meta.json'));
    const assets: Asset[] = [];

    for (const f of files) {
      try {
        const full = path.join(this.assetsDir, f);
        const raw = fs.readFileSync(full, 'utf8');
        const asset = JSON.parse(raw) as Asset;
        if (asset.projectId === projectId && asset.status !== 'deleted') {
          assets.push(asset);
        }
      } catch {
        // Skip malformed
      }
    }

    return assets;
  }

  public async finalizeAsset(
    projectId: string,
    assetId: string
  ): Promise<
    | { ok: true; asset: Asset }
    | { ok: false; code: number; error: string; errorCode: string; details?: Record<string, unknown> }
  > {
    const asset = await this.getAsset(assetId);
    if (!asset || asset.projectId !== projectId) {
      return { ok: false, code: 404, error: 'Asset not found', errorCode: 'NOT_FOUND' };
    }

    // Idempotency: if already inspected and ready, return success
    if (asset.status === 'inspected_ready') {
      return { ok: true, asset };
    }

    // Find associated upload session
    const sessions = fs.existsSync(this.sessionsDir)
      ? fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'))
      : [];

    let matchedSession: UploadSession | null = null;
    for (const f of sessions) {
      try {
        const raw = fs.readFileSync(path.join(this.sessionsDir, f), 'utf8');
        const s = JSON.parse(raw) as UploadSession;
        if (s.assetId === assetId) {
          matchedSession = s;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!matchedSession) {
      return { ok: false, code: 404, error: 'Upload session for asset not found', errorCode: 'NOT_FOUND' };
    }

    if (matchedSession.uploadedBytes < matchedSession.declaredSize) {
      return {
        ok: false,
        code: 400,
        error: `Upload incomplete: received ${matchedSession.uploadedBytes} of ${matchedSession.declaredSize} bytes`,
        errorCode: 'UPLOAD_INVALID',
      };
    }

    const tempFilePath = matchedSession.tempFilePath;
    if (!fs.existsSync(tempFilePath)) {
      return { ok: false, code: 404, error: 'Quarantined file missing from disk', errorCode: 'ARTIFACT_MISSING' };
    }

    const stat = fs.statSync(tempFilePath);
    if (stat.size !== matchedSession.declaredSize) {
      return {
        ok: false,
        code: 422,
        error: `File size mismatch: expected ${matchedSession.declaredSize}, found ${stat.size} bytes`,
        errorCode: 'UPLOAD_INVALID',
      };
    }

    // Compute SHA-256
    const hash = crypto.createHash('sha256');
    const buf = fs.readFileSync(tempFilePath);
    hash.update(buf);
    const computedSha256 = hash.digest('hex');

    if (matchedSession.sha256Expected && matchedSession.sha256Expected.toLowerCase() !== computedSha256.toLowerCase()) {
      asset.status = 'failed';
      asset.quarantineReason = `Checksum mismatch: expected ${matchedSession.sha256Expected}, got ${computedSha256}`;
      this.saveAsset(asset);
      matchedSession.status = 'failed';
      this.saveSession(matchedSession);

      return {
        ok: false,
        code: 422,
        error: 'SHA-256 checksum mismatch',
        errorCode: 'CHECKSUM_MISMATCH',
        details: { expected: matchedSession.sha256Expected, computed: computedSha256 },
      };
    }

    // Inspect container magic (AUDIT F02 / TEST-003)
    const inspection = inspectMediaContainer(tempFilePath);
    if (!inspection.ok) {
      asset.status = 'failed';
      asset.quarantineReason = inspection.reason;
      this.saveAsset(asset);
      matchedSession.status = 'failed';
      this.saveSession(matchedSession);

      return {
        ok: false,
        code: 422,
        error: `Media quarantine verification failed: ${inspection.reason}`,
        errorCode: 'QUARANTINE_REJECTED',
      };
    }

    // Deep container & stream inspection using real FFprobe (TASK-010)
    const probeResult = await inspectMedia(tempFilePath, {
      assetId: asset.id,
      computeSha256: false,
    });

    if (!probeResult.ok) {
      asset.status = 'failed';
      asset.quarantineReason = probeResult.error;
      this.saveAsset(asset);
      matchedSession.status = 'failed';
      this.saveSession(matchedSession);

      return {
        ok: false,
        code: probeResult.errorCode === 'LIMIT_EXCEEDED' ? 413 : 422,
        error: probeResult.error,
        errorCode: probeResult.errorCode,
        details: probeResult.details,
      };
    }

    // Success: move from quarantine to permanent assets directory
    const targetFileName = `${asset.id}${inspection.ext}`;
    const targetFilePath = path.join(this.assetsDir, targetFileName);

    fs.copyFileSync(tempFilePath, targetFilePath);
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // ignore
    }

    asset.status = 'inspected_ready';
    asset.byteLength = stat.size;
    asset.sha256 = computedSha256;
    asset.storagePath = targetFilePath;
    asset.durationMs = probeResult.metadata.durationMs;
    asset.sourceMetadata = probeResult.metadata;
    delete asset.quarantineReason;

    // Generate lightweight preview proxy where possible
    try {
      const proxyPath = path.join(this.proxiesDir, `${asset.id}.preview.mp4`);
      const proxyResult = await generatePreviewProxy(targetFilePath, proxyPath, { maxDurationSec: 60 });
      if (proxyResult.ok && proxyResult.outputPath) {
        asset.previewStoragePath = proxyResult.outputPath;
      }
    } catch {
      // Non-blocking for asset ingestion
    }

    this.saveAsset(asset);

    matchedSession.status = 'inspected_ready';
    matchedSession.sha256Computed = computedSha256;
    this.saveSession(matchedSession);

    return { ok: true, asset };
  }

  public async inspectAsset(
    projectId: string,
    assetId: string
  ): Promise<
    | { ok: true; asset: Asset; sourceMetadata: SourceMetadata }
    | { ok: false; code: number; error: string; errorCode: string; details?: Record<string, unknown> }
  > {
    const asset = await this.getAsset(assetId);
    if (!asset || asset.projectId !== projectId) {
      return { ok: false, code: 404, error: 'Asset not found', errorCode: 'NOT_FOUND' };
    }
    if (!fs.existsSync(asset.storagePath)) {
      return { ok: false, code: 404, error: 'Asset media file missing on disk', errorCode: 'ARTIFACT_MISSING' };
    }

    const probe = await inspectMedia(asset.storagePath, { assetId: asset.id, computeSha256: true });
    if (!probe.ok) {
      asset.status = 'failed';
      asset.quarantineReason = probe.error;
      this.saveAsset(asset);
      return {
        ok: false,
        code: probe.errorCode === 'LIMIT_EXCEEDED' ? 413 : 422,
        error: probe.error,
        errorCode: probe.errorCode,
        details: probe.details,
      };
    }

    asset.status = 'inspected_ready';
    asset.durationMs = probe.metadata.durationMs;
    asset.sourceMetadata = probe.metadata;
    if (probe.sha256) asset.sha256 = probe.sha256;
    this.saveAsset(asset);

    return { ok: true, asset, sourceMetadata: probe.metadata };
  }

  public async generateAssetPreview(
    projectId: string,
    assetId: string
  ): Promise<
    | { ok: true; previewPath: string; asset: Asset }
    | { ok: false; code: number; error: string; errorCode: string }
  > {
    const asset = await this.getAsset(assetId);
    if (!asset || asset.projectId !== projectId) {
      return { ok: false, code: 404, error: 'Asset not found', errorCode: 'NOT_FOUND' };
    }
    if (asset.status !== 'inspected_ready') {
      return {
        ok: false,
        code: 403,
        error: `Asset is not in inspected_ready status (current: ${asset.status})`,
        errorCode: 'QUARANTINE_REJECTED',
      };
    }
    if (!fs.existsSync(asset.storagePath)) {
      return { ok: false, code: 404, error: 'Asset media file missing on disk', errorCode: 'ARTIFACT_MISSING' };
    }

    const proxyPath = path.join(this.proxiesDir, `${asset.id}.preview.mp4`);
    if (fs.existsSync(proxyPath) && fs.statSync(proxyPath).size > 0) {
      asset.previewStoragePath = proxyPath;
      this.saveAsset(asset);
      return { ok: true, previewPath: proxyPath, asset };
    }

    const proxyRes = await generatePreviewProxy(asset.storagePath, proxyPath);
    if (!proxyRes.ok || !proxyRes.outputPath) {
      return {
        ok: false,
        code: 500,
        error: proxyRes.error || 'Failed to generate preview proxy',
        errorCode: 'INTERNAL_ERROR',
      };
    }

    asset.previewStoragePath = proxyRes.outputPath;
    this.saveAsset(asset);
    return { ok: true, previewPath: proxyRes.outputPath, asset };
  }
}
