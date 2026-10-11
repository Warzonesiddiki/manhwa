import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { MarathonProject } from '../../src/types/index';

const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isSafeId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_NAME_RE.test(id) && !id.includes('..');
}

export interface ProjectSummary {
  id: string;
  title: string;
  titleUrdu: string;
  sourceVideoUrl: string;
  uploadedVideoFilename?: string;
  totalDurationMinutes: number;
  arcCount: number;
  segmentCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  ownerId?: string;
}

export interface ProjectStoreOptions {
  dataDir?: string;
}

export class ProjectStore {
  private dataDir: string;

  constructor(options?: ProjectStoreOptions) {
    this.dataDir = options?.dataDir || path.resolve(process.cwd(), 'data/projects');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getFilePath(id: string): string | null {
    if (!isSafeId(id)) return null;
    const base = path.resolve(this.dataDir);
    const candidate = path.resolve(base, `${id}.json`);
    if (!candidate.startsWith(base + path.sep)) return null;
    return candidate;
  }

  public async list(ownerId?: string): Promise<ProjectSummary[]> {
    if (!fs.existsSync(this.dataDir)) return [];
    const files = fs.readdirSync(this.dataDir).filter((f) => f.endsWith('.json'));
    const summaries: ProjectSummary[] = [];

    for (const file of files) {
      try {
        const fullPath = path.join(this.dataDir, file);
        const raw = fs.readFileSync(fullPath, 'utf8');
        const proj = JSON.parse(raw) as MarathonProject;
        if (ownerId && proj.ownerId && proj.ownerId !== ownerId) {
          continue;
        }
        summaries.push({
          id: proj.id,
          title: proj.title || 'Untitled Project',
          titleUrdu: proj.titleUrdu || '',
          sourceVideoUrl: proj.sourceVideoUrl || '',
          uploadedVideoFilename: proj.uploadedVideoFilename,
          totalDurationMinutes: proj.totalDurationMinutes || 0,
          arcCount: Array.isArray(proj.arcs) ? proj.arcs.length : 0,
          segmentCount: Array.isArray(proj.arcs)
            ? proj.arcs.reduce((acc, a) => acc + (Array.isArray(a.segments) ? a.segments.length : 0), 0)
            : 0,
          revision: typeof proj.revision === 'number' ? proj.revision : 1,
          createdAt: proj.createdAt || new Date().toISOString(),
          updatedAt: proj.updatedAt || new Date().toISOString(),
          ownerId: proj.ownerId,
        });
      } catch (err) {
        console.warn(`[ProjectStore] failed to read ${file}:`, err);
      }
    }

    // Sort by updatedAt descending
    summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return summaries;
  }

  public async get(id: string, ownerId?: string): Promise<MarathonProject | null> {
    const filePath = this.getFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return null;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const proj = JSON.parse(raw) as MarathonProject;
      if (ownerId && proj.ownerId && proj.ownerId !== ownerId) {
        return null;
      }
      return proj;
    } catch (err) {
      console.error(`[ProjectStore] failed to parse ${filePath}:`, err);
      return null;
    }
  }

  public async create(
    data: Partial<MarathonProject>,
    ownerId?: string
  ): Promise<{ ok: true; project: MarathonProject } | { ok: false; error: string; code: number }> {
    const now = new Date().toISOString();
    const id = isSafeId(data.id) ? data.id : `proj_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const filePath = this.getFilePath(id);

    if (!filePath) {
      return { ok: false, error: 'Invalid project ID format', code: 400 };
    }

    if (fs.existsSync(filePath)) {
      return { ok: false, error: `Project "${id}" already exists`, code: 409 };
    }

    const project: MarathonProject = {
      id,
      title: data.title || 'Untitled Marathon Project',
      titleUrdu: data.titleUrdu || '',
      sourceVideoUrl: data.sourceVideoUrl || '',
      youtubeId: data.youtubeId,
      uploadedVideoUrl: data.uploadedVideoUrl,
      uploadedVideoFilename: data.uploadedVideoFilename,
      totalDurationMinutes: typeof data.totalDurationMinutes === 'number' ? data.totalDurationMinutes : 600,
      genre: data.genre || 'Action / Fantasy',
      mainCharacter: data.mainCharacter || 'Protagonist',
      arcs: Array.isArray(data.arcs) ? data.arcs : [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
      ownerId: ownerId || data.ownerId || 'owner',
    };

    try {
      this.atomicWrite(filePath, project);
      return { ok: true, project };
    } catch (err: any) {
      return { ok: false, error: `Failed to persist project: ${err.message}`, code: 500 };
    }
  }

  public async update(
    id: string,
    updates: Partial<MarathonProject>,
    expectedRevision?: number | string | null,
    ownerId?: string
  ): Promise<
    | { ok: true; project: MarathonProject }
    | { ok: false; error: string; code: 400 | 404 | 412 | 428 | 500; currentRevision?: number }
  > {
    const filePath = this.getFilePath(id);
    if (!filePath) {
      return { ok: false, error: 'Invalid project ID format', code: 400 };
    }

    if (!fs.existsSync(filePath)) {
      return { ok: false, error: `Project "${id}" not found`, code: 404 };
    }

    let existing: MarathonProject;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      existing = JSON.parse(raw);
    } catch (err: any) {
      return { ok: false, error: `Corrupt project data: ${err.message}`, code: 500 };
    }

    if (ownerId && existing.ownerId && existing.ownerId !== ownerId) {
      return { ok: false, error: `Project "${id}" not found`, code: 404 };
    }

    const currentRev = typeof existing.revision === 'number' ? existing.revision : 1;

    // Optimistic concurrency check (RFC 6585 / docs 05/06)
    if (expectedRevision === undefined || expectedRevision === null || expectedRevision === '') {
      return {
        ok: false,
        error: 'Precondition Required: If-Match header or expectedRevision field is required for project updates',
        code: 428,
        currentRevision: currentRev,
      };
    }

    const parsedExpected =
      typeof expectedRevision === 'number'
        ? expectedRevision
        : parseInt(String(expectedRevision).replace(/^W\/"|"/g, '').replace(/^rev-/, ''), 10);

    if (Number.isNaN(parsedExpected) || parsedExpected !== currentRev) {
      return {
        ok: false,
        error: `Precondition Failed: project revision mismatch (expected ${expectedRevision}, current is rev-${currentRev})`,
        code: 412,
        currentRevision: currentRev,
      };
    }

    const now = new Date().toISOString();
    const nextRev = currentRev + 1;

    const merged: MarathonProject = {
      ...existing,
      ...updates,
      id, // Immutable ID
      revision: nextRev,
      updatedAt: now,
      createdAt: existing.createdAt || now,
      ownerId: existing.ownerId || ownerId || 'owner',
    };

    try {
      this.atomicWrite(filePath, merged);
      return { ok: true, project: merged };
    } catch (err: any) {
      return { ok: false, error: `Failed to update project: ${err.message}`, code: 500 };
    }
  }

  public async delete(id: string, ownerId?: string): Promise<boolean> {
    const filePath = this.getFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return false;

    if (ownerId) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const proj = JSON.parse(raw);
        if (proj.ownerId && proj.ownerId !== ownerId) return false;
      } catch {
        return false;
      }
    }

    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error(`[ProjectStore] failed to delete ${filePath}:`, err);
      return false;
    }
  }

  private atomicWrite(targetPath: string, data: unknown): void {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, targetPath);
  }
}
