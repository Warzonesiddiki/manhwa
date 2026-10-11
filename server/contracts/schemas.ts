import { isSafeId } from '../storage/projectStore';
import { ApiError } from './errors';
import type { StoryArc } from '../../src/types/index';

export const MAX_PROJECT_TITLE_LENGTH = 256;
export const MAX_GENRE_LENGTH = 64;
export const MAX_CHARACTER_LENGTH = 64;
export const MAX_JSON_STRING_FIELD_BYTES = 64 * 1024; // 64 KB limit per field to prevent media payloads in JSON

/**
 * Validates that an object contains no large binary/media data embedded as base64 in JSON.
 */
export function assertNoMediaPayloadsInJson(obj: unknown, path = 'body'): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    if (obj.length > MAX_JSON_STRING_FIELD_BYTES) {
      throw new ApiError(
        413,
        'LIMIT_EXCEEDED',
        `Field "${path}" exceeds maximum string payload size (${MAX_JSON_STRING_FIELD_BYTES} bytes). Media payloads must use scoped upload endpoints, not JSON.`,
        { details: { affectedFields: [path], limit: MAX_JSON_STRING_FIELD_BYTES } }
      );
    }
    if (obj.startsWith('data:image/') || obj.startsWith('data:video/') || obj.startsWith('data:audio/')) {
      throw new ApiError(
        422,
        'UPLOAD_INVALID',
        `Data URIs are not allowed in JSON payloads for "${path}". Use scoped upload endpoints instead.`,
        { details: { affectedFields: [path] } }
      );
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoMediaPayloadsInJson(obj[i], `${path}[${i}]`);
    }
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      assertNoMediaPayloadsInJson(value, `${path}.${key}`);
    }
  }
}

export interface ValidatedProjectInput {
  id?: string;
  title: string;
  titleUrdu?: string;
  sourceVideoUrl?: string;
  uploadedVideoUrl?: string;
  uploadedVideoFilename?: string;
  totalDurationMinutes?: number;
  genre?: string;
  mainCharacter?: string;
  arcs?: StoryArc[];
}

export function validateProjectInput(body: unknown): ValidatedProjectInput {
  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'INVALID_PAYLOAD', 'Request body must be a JSON object.');
  }

  assertNoMediaPayloadsInJson(body, 'project');

  const b = body as Record<string, unknown>;

  if (b.id !== undefined && !isSafeId(b.id)) {
    throw new ApiError(400, 'INVALID_PAYLOAD', 'Field "id" contains unsafe characters or invalid format.', {
      details: { affectedFields: ['id'] },
    });
  }

  const title = typeof b.title === 'string' ? b.title.trim() : 'Untitled Marathon Project';
  if (title.length > MAX_PROJECT_TITLE_LENGTH) {
    throw new ApiError(400, 'LIMIT_EXCEEDED', `Title exceeds maximum length of ${MAX_PROJECT_TITLE_LENGTH} characters.`, {
      details: { affectedFields: ['title'], limit: MAX_PROJECT_TITLE_LENGTH },
    });
  }

  const totalDurationMinutes =
    typeof b.totalDurationMinutes === 'number' && Number.isFinite(b.totalDurationMinutes) && b.totalDurationMinutes > 0
      ? b.totalDurationMinutes
      : 600;

  return {
    id: typeof b.id === 'string' ? b.id : undefined,
    title,
    titleUrdu: typeof b.titleUrdu === 'string' ? b.titleUrdu : undefined,
    sourceVideoUrl: typeof b.sourceVideoUrl === 'string' ? b.sourceVideoUrl : undefined,
    uploadedVideoUrl: typeof b.uploadedVideoUrl === 'string' ? b.uploadedVideoUrl : undefined,
    uploadedVideoFilename: typeof b.uploadedVideoFilename === 'string' ? b.uploadedVideoFilename : undefined,
    totalDurationMinutes,
    genre: typeof b.genre === 'string' ? b.genre.substring(0, MAX_GENRE_LENGTH) : 'Action / Fantasy',
    mainCharacter: typeof b.mainCharacter === 'string' ? b.mainCharacter.substring(0, MAX_CHARACTER_LENGTH) : 'Protagonist',
    arcs: Array.isArray(b.arcs) ? b.arcs : [],
  };
}
