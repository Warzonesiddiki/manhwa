import type { Request, Response } from 'express';

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'SOURCE_REQUIRED'
  | 'RIGHTS_REVIEW_REQUIRED'
  | 'UPLOAD_INVALID'
  | 'MEDIA_UNSUPPORTED'
  | 'LIMIT_EXCEEDED'
  | 'PRECONDITION_REQUIRED'
  | 'REVISION_CONFLICT'
  | 'NOT_FOUND'
  | 'BUDGET_EXCEEDED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_OUTCOME_UNKNOWN'
  | 'QUALITY_REVIEW_REQUIRED'
  | 'ARTIFACT_MISSING'
  | 'JOB_CANCELLED'
  | 'RATE_LIMITED'
  | 'INVALID_PAYLOAD'
  | 'TRANSFER_SESSION_EXPIRED'
  | 'CHECKSUM_MISMATCH'
  | 'UPLOAD_OFFSET_MISMATCH'
  | 'QUARANTINE_REJECTED'
  | 'MEDIA_CORRUPTED'
  | 'INTERNAL_ERROR';

export interface ErrorDetails {
  affectedFields?: string[];
  currentRevision?: number | string;
  expectedRevision?: number | string;
  limit?: number | string;
  [key: string]: unknown;
}

export interface ErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
    requestId: string;
    details?: ErrorDetails;
  };
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly retryable: boolean;
  public readonly details?: ErrorDetails;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: ErrorDetails }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export function getRequestId(req: Request): string {
  const headerId = req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) {
    return headerId;
  }
  return (req as any).requestId || `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export function formatErrorEnvelope(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  options?: { retryable?: boolean; details?: ErrorDetails }
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      retryable: options?.retryable ?? false,
      requestId,
      ...(options?.details ? { details: options.details } : {}),
    },
  };
}

export function sendApiError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  req: Request,
  options?: { retryable?: boolean; details?: ErrorDetails }
): Response {
  const requestId = getRequestId(req);
  res.setHeader('X-Request-Id', requestId);
  const envelope = formatErrorEnvelope(code, message, requestId, options);
  return res.status(status).json({
    ...envelope,
    ...(options?.details?.currentRevision !== undefined
      ? { currentRevision: options.details.currentRevision }
      : {}),
  });
}
