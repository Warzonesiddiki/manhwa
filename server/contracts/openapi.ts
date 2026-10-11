export function getOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ManhwaUrdu DubStudio API',
      version: '1.0.0',
      description:
        'RESTful API for personal Urdu manhwa recap dubbing, episodic chunking, and synchronized voiceover production studio with optimistic concurrency and single-owner authentication.',
    },
    servers: [
      {
        url: '/',
        description: 'Current environment server',
      },
    ],
    components: {
      securitySchemes: {
        SessionCookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'mh_session',
          description: 'HMAC-signed HttpOnly session cookie acquired via POST /api/auth/login.',
        },
      },
      schemas: {
        ErrorEnvelope: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'retryable', 'requestId'],
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'UNAUTHENTICATED',
                    'FORBIDDEN',
                    'SOURCE_REQUIRED',
                    'RIGHTS_REVIEW_REQUIRED',
                    'UPLOAD_INVALID',
                    'MEDIA_UNSUPPORTED',
                    'LIMIT_EXCEEDED',
                    'PRECONDITION_REQUIRED',
                    'REVISION_CONFLICT',
                    'NOT_FOUND',
                    'BUDGET_EXCEEDED',
                    'PROVIDER_UNAVAILABLE',
                    'PROVIDER_OUTCOME_UNKNOWN',
                    'QUALITY_REVIEW_REQUIRED',
                    'ARTIFACT_MISSING',
                    'JOB_CANCELLED',
                    'RATE_LIMITED',
                    'INVALID_PAYLOAD',
                    'TRANSFER_SESSION_EXPIRED',
                    'CHECKSUM_MISMATCH',
                    'UPLOAD_OFFSET_MISMATCH',
                    'QUARANTINE_REJECTED',
                    'MEDIA_CORRUPTED',
                    'INTERNAL_ERROR',
                  ],
                },
                message: { type: 'string' },
                retryable: { type: 'boolean' },
                requestId: { type: 'string' },
                details: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
        RecapSegment: {
          type: 'object',
          required: ['id', 'start', 'end', 'englishText', 'urduText', 'romanUrduText', 'toneDirective'],
          properties: {
            id: { type: 'string' },
            start: { type: 'number', description: 'Start time in seconds' },
            end: { type: 'number', description: 'End time in seconds' },
            englishText: { type: 'string' },
            urduText: { type: 'string' },
            romanUrduText: { type: 'string' },
            toneDirective: { type: 'string' },
            audioUrl: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pending', 'synthesizing', 'ready', 'failed'], nullable: true },
          },
        },
        StoryArc: {
          type: 'object',
          required: ['id', 'arcNumber', 'title', 'titleUrdu', 'startMinute', 'endMinute', 'durationMinutes', 'segments'],
          properties: {
            id: { type: 'string' },
            arcNumber: { type: 'integer' },
            title: { type: 'string' },
            titleUrdu: { type: 'string' },
            startMinute: { type: 'number' },
            endMinute: { type: 'number' },
            durationMinutes: { type: 'number' },
            chaptersCovered: { type: 'string' },
            cliffhangerHook: { type: 'string' },
            cliffhangerHookUrdu: { type: 'string' },
            pacing: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'scripted', 'dubbed', 'exported'] },
            segments: {
              type: 'array',
              items: { $ref: '#/components/schemas/RecapSegment' },
            },
          },
        },
        Project: {
          type: 'object',
          required: ['id', 'title', 'titleUrdu', 'totalDurationMinutes', 'arcs', 'revision'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            titleUrdu: { type: 'string' },
            sourceVideoUrl: { type: 'string' },
            youtubeId: { type: 'string', nullable: true },
            uploadedVideoUrl: { type: 'string', nullable: true },
            uploadedVideoFilename: { type: 'string', nullable: true },
            totalDurationMinutes: { type: 'number' },
            genre: { type: 'string' },
            mainCharacter: { type: 'string' },
            arcs: {
              type: 'array',
              items: { $ref: '#/components/schemas/StoryArc' },
            },
            revision: { type: 'integer', description: 'Optimistic concurrency revision number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            ownerId: { type: 'string', nullable: true },
          },
        },
        ProjectSummary: {
          type: 'object',
          required: ['id', 'title', 'titleUrdu', 'revision', 'totalDurationMinutes', 'arcCount', 'segmentCount'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            titleUrdu: { type: 'string' },
            sourceVideoUrl: { type: 'string' },
            uploadedVideoFilename: { type: 'string', nullable: true },
            totalDurationMinutes: { type: 'number' },
            arcCount: { type: 'integer' },
            segmentCount: { type: 'integer' },
            revision: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UploadSession: {
          type: 'object',
          required: [
            'id',
            'projectId',
            'assetId',
            'filename',
            'declaredSize',
            'status',
            'uploadedBytes',
            'chunkSize',
            'expiresAt',
          ],
          properties: {
            id: { type: 'string' },
            projectId: { type: 'string' },
            assetId: { type: 'string' },
            filename: { type: 'string' },
            declaredSize: { type: 'integer' },
            mimeType: { type: 'string' },
            status: {
              type: 'string',
              enum: [
                'created',
                'uploading',
                'verifying',
                'inspected_ready',
                'cancelled',
                'session_expired',
                'failed',
              ],
            },
            uploadedBytes: { type: 'integer' },
            chunkSize: { type: 'integer' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        Asset: {
          type: 'object',
          required: ['id', 'projectId', 'type', 'filename', 'byteLength', 'status'],
          properties: {
            id: { type: 'string' },
            projectId: { type: 'string' },
            type: {
              type: 'string',
              enum: ['source_video', 'transcript', 'audio', 'export', 'preview_proxy'],
            },
            filename: { type: 'string' },
            byteLength: { type: 'integer' },
            sha256: { type: 'string' },
            mimeType: { type: 'string' },
            status: {
              type: 'string',
              enum: ['quarantined', 'inspected_ready', 'failed', 'deleted'],
            },
            quarantineReason: { type: 'string' },
            durationMs: { type: 'integer' },
            previewStoragePath: { type: 'string' },
            sourceMetadata: { $ref: '#/components/schemas/SourceMetadata' },
          },
        },
        SourceMetadata: {
          type: 'object',
          required: ['assetId', 'durationMs', 'container', 'sizeBytes', 'isSeekable', 'streams'],
          properties: {
            assetId: { type: 'string' },
            durationMs: { type: 'integer' },
            container: { type: 'string' },
            formatLongName: { type: 'string' },
            sizeBytes: { type: 'integer' },
            bitRate: { type: 'integer' },
            isSeekable: { type: 'boolean' },
            video: {
              type: 'object',
              properties: {
                codec: { type: 'string' },
                width: { type: 'integer' },
                height: { type: 'integer' },
                fps: { type: 'number' },
                rFrameRate: { type: 'string' },
                rotation: { type: 'integer' },
              },
            },
            audio: {
              type: 'object',
              properties: {
                codec: { type: 'string' },
                channels: { type: 'integer' },
                sampleRate: { type: 'integer' },
              },
            },
            streams: {
              type: 'array',
              items: { type: 'object' },
            },
            inspectedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      {
        SessionCookieAuth: [],
      },
    ],
    paths: {
      '/api/v1/openapi.json': {
        get: {
          summary: 'Retrieve OpenAPI 3.1 specification',
          security: [],
          responses: {
            '200': {
              description: 'OpenAPI specification document',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/api/v1/projects': {
        get: {
          summary: 'List project summaries for the owner',
          responses: {
            '200': {
              description: 'List of projects',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      projects: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ProjectSummary' },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
        post: {
          summary: 'Create a new project',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Project' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Project created successfully',
              headers: {
                ETag: { schema: { type: 'string' }, description: 'ETag corresponding to revision' },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { project: { $ref: '#/components/schemas/Project' } },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ErrorResponse' },
            '401': { $ref: '#/components/responses/ErrorResponse' },
            '413': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}': {
        get: {
          summary: 'Get project by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Full project details',
              headers: {
                ETag: { schema: { type: 'string' }, description: 'Current ETag/revision' },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { project: { $ref: '#/components/schemas/Project' } },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/ErrorResponse' },
            '404': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
        put: {
          summary: 'Update project with optimistic concurrency (RFC 6585)',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'If-Match',
              in: 'header',
              required: false,
              schema: { type: 'string' },
              description: 'Expected revision ETag (e.g. "rev-1")',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    project: { $ref: '#/components/schemas/Project' },
                    expectedRevision: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Project updated and revision incremented',
              headers: {
                ETag: { schema: { type: 'string' }, description: 'New ETag/revision' },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { project: { $ref: '#/components/schemas/Project' } },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/ErrorResponse' },
            '404': { $ref: '#/components/responses/ErrorResponse' },
            '412': {
              description: 'Precondition Failed (concurrent revision conflict)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
            },
            '428': {
              description: 'Precondition Required (missing If-Match / expectedRevision)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
            },
          },
        },
        delete: {
          summary: 'Delete project',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Project deleted successfully' },
            '401': { $ref: '#/components/responses/ErrorResponse' },
            '404': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}/upload-sessions': {
        post: {
          summary: 'Create scoped resumable upload session for project media',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['filename', 'declaredSize'],
                  properties: {
                    filename: { type: 'string' },
                    declaredSize: { type: 'integer' },
                    mimeType: { type: 'string' },
                    sha256: { type: 'string' },
                    chunkSize: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Upload session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      session: { $ref: '#/components/schemas/UploadSession' },
                      asset: { $ref: '#/components/schemas/Asset' },
                      uploadUrl: { type: 'string' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ErrorResponse' },
            '404': { $ref: '#/components/responses/ErrorResponse' },
            '413': { $ref: '#/components/responses/ErrorResponse' },
            '422': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}/upload-sessions/{sessionId}': {
        get: {
          summary: 'Get upload session status and confirmed offset',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Upload session details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      session: { $ref: '#/components/schemas/UploadSession' },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}/upload-sessions/{sessionId}/chunks': {
        put: {
          summary: 'Upload binary chunk at specified offset',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'offset', in: 'query', required: false, schema: { type: 'integer' } },
          ],
          responses: {
            '200': {
              description: 'Chunk uploaded successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      uploadedBytes: { type: 'integer' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
            '409': { $ref: '#/components/responses/ErrorResponse' },
            '410': { $ref: '#/components/responses/ErrorResponse' },
            '413': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}/upload-sessions/{sessionId}/resume': {
        post: {
          summary: 'Resume or reconcile upload session',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Session reconciled',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      session: { $ref: '#/components/schemas/UploadSession' },
                    },
                  },
                },
              },
            },
            '410': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}/upload-sessions/{sessionId}/cancel': {
        post: {
          summary: 'Cancel upload session and clean up quarantined parts',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Session cancelled',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/projects/{id}/assets/{assetId}/finalize': {
        post: {
          summary: 'Finalize asset inspection and move from quarantine to verified store',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'assetId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Asset verified and ready',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      asset: { $ref: '#/components/schemas/Asset' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ErrorResponse' },
            '422': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}/assets': {
        get: {
          summary: 'List verified and quarantined assets for project',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'List of assets',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      assets: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Asset' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/assets/{id}/access': {
        get: {
          summary: 'Authorized range-capable delivery for inspected asset',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Full media asset delivery' },
            '403': { $ref: '#/components/responses/ErrorResponse' },
            '404': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}/assets/{assetId}/inspect': {
        post: {
          summary: 'Inspect asset duration, rational frame rate, and streams via FFprobe',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'assetId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Asset inspection succeeded',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      asset: { $ref: '#/components/schemas/Asset' },
                      sourceMetadata: { $ref: '#/components/schemas/SourceMetadata' },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/ErrorResponse' },
            '413': { $ref: '#/components/responses/ErrorResponse' },
            '422': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/projects/{id}/assets/{assetId}/preview': {
        post: {
          summary: 'Trigger or ensure preview proxy generation for media asset',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'assetId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Preview proxy ready',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      previewUrl: { type: 'string' },
                      asset: { $ref: '#/components/schemas/Asset' },
                    },
                  },
                },
              },
            },
            '403': { $ref: '#/components/responses/ErrorResponse' },
            '404': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
      '/api/v1/assets/{id}/preview': {
        get: {
          summary: 'Stream lightweight range-capable preview proxy MP4',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Preview MP4 video stream' },
            '206': { description: 'Partial content (HTTP Range delivery)' },
            '403': { $ref: '#/components/responses/ErrorResponse' },
            '404': { $ref: '#/components/responses/ErrorResponse' },
          },
        },
      },
    },
    responses: {
      ErrorResponse: {
        description: 'Standard error envelope',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
          },
        },
      },
    },
  };
}
