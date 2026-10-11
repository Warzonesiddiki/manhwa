# Current state and next session

**Updated:** 2026-10-11 (implementation sessions 1–3) · **Phase:** authorized implementation (P1) · **Branch:** `arena/d12f01b6-manhwa` (pushed: `3bd860e` TASK-004, `d55d489` docs, `63a7a3e` TASK-005; TASK-006 commit follows; CI workflow commit local-only)

## What is actually present

- React/Vite/TypeScript prototype + v0.2 planning library (32 REQ / 49 TASK / 29 TEST) + historical [AUDIT.md](../AUDIT.md).
- **TASK-004 COMPLETE:** reproducible toolchain + initial CI/tests ([DEC-008](decisions/DEC-008-toolchain.md)).
- **TASK-005 COMPLETE:** audit blocker repairs (paths, uploads, read-only cache, built-server packaging, honest failures, demo isolation) with regression tests including TEST-001.
- **TASK-006 COMPLETE:** owner-only auth/authorization ([DEC-011](decisions/DEC-011-auth.md), interim identity) — server-enforced sessions on every API/media route, fail-closed, TEST-002 green.
- **TASK-007 COMPLETE:** durable project & revision persistence ([DEC-005](decisions/DEC-005-storage.md) / [docs 05](05-data-model.md) / [06](06-api-contract.md)) — server-side atomic JSON repository (`ProjectStore`) under `data/projects/`, REST endpoints under `/api/v1/projects` with optimistic concurrency (RFC 6585 `If-Match`/`expectedRevision`, 412 Precondition Failed, 428 Precondition Required, ETag negotiation), frontend autosave and conflict indicator in Header. TEST-005 suite green.
- **TASK-008 COMPLETE:** executable API & domain contracts ([doc 06](06-api-contract.md)) — OpenAPI 3.1.0 specification at `/api/v1/openapi.json`, canonical error envelope (`code`, `message`, `retryable`, `requestId`, `details`), request bounds and rejection of media in JSON payloads (`LIMIT_EXCEEDED`, `UPLOAD_INVALID`), `X-Request-Id` correlation middleware. Contract test suite green.
- **TASK-009 COMPLETE:** scoped resumable uploads & quarantined asset lifecycle ([doc 24](24-large-file-transfers.md) / [doc 06](06-api-contract.md)) — scoped sessions under projects (`POST /api/v1/projects/:id/upload-sessions`), sequential chunked streaming with strict server-confirmed offset enforcement (`Content-Range` / `UPLOAD_OFFSET_MISMATCH` 409), interrupted upload recovery (`POST .../resume`), SHA-256 integrity check (`CHECKSUM_MISMATCH` 422), container magic inspection and rejection of active/HTML/SVG disguised content (`QUARANTINE_REJECTED` 422), protected quarantined asset lifecycle (403 on unverified asset access), idempotent finalization, and HTTP Range-capable 206 delivery (`GET /api/v1/assets/:id/access`). TEST-003/004 green.
- **TASK-010 COMPLETE:** media inspection & preview proxy ([doc 09](09-media-and-export.md) / [doc 28](28-preview-compatibility.md) / [doc 06](06-api-contract.md)) — real containerized FFprobe stream & container inspection (`server/media/inspector.ts`), parsed rational frame rates, video & audio streams, channel count, sample rate, bit rates, rotation, source SHA-256 integrity, bounded duration validation with 24-hour limit ceiling (`LIMIT_EXCEEDED` 413), safe quarantine failure on corrupted or truncated files (`MEDIA_CORRUPTED` 422), automated project `durationMs` and `totalDurationMinutes` sync, lightweight faststart browser preview MP4 proxy generation (`server/media/previewProxy.ts`), and range-capable partial content delivery (`GET /api/v1/assets/:id/preview`). **109/109 tests total across 13 test suites (TEST-003/004 green).**
- **DUAL INTAKE & 100% AUDIO REPLACEMENT COMPLETE:**
  - IngestModal & AutoDubbingStudio support both YouTube reference links and direct original video uploads (.mp4, .webm, .mkv, .mov) with file metadata validation and pairing.
  - Complete audio replacement implemented: original English audio is 100% replaced with spoken Urdu narration (muted during in-studio preview, completely dropped in export/mux with FFmpeg mapping `-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k`).
  - Strict UI cleanliness: all `alert()` calls eliminated in favor of dismissible inline status banners.

## Confirmed owner intent

Personal channel tool; YouTube-link-first; Urdu; sources typically 10–24 hours with a 24-hour design maximum; shorter inputs supported. Implementation authorized 2026-10-11 with decision delegation ("YOLO mode"). Both YouTube reference links and uploaded video sources are supported; original English audio is completely replaced by Urdu narration. **Paid services, public deployment, destructive operations, and deferred products remain unauthorized.** DEC-001 (authorized source access) and DEC-005 (budget) remain unanswered and block TASK-002/003 and any provider work. The 128 GB byte cap (DEC-010) remains unapproved/unqualified.

## Verification evidence (2026-10-11, sandbox: Node 22.23.2, bun 1.4.3 via npx, FFmpeg 4.4.2 installed, no API key)

| Check | Exact command | Result |
|---|---|---|
| Frozen install | `npx bun install --frozen-lockfile` | PASS |
| npm resolution (secondary) | `npm install --dry-run --ignore-scripts --no-audit --no-fund` | PASS |
| Strict typecheck | `npm run typecheck` (TS 6.0.3, `strict: true`) | PASS (0 errors) |
| Lint + React Hooks | `npm run lint` (rules-of-hooks **error**, verified live) | PASS (0 errors; 116 legacy warnings tracked) |
| Tests | `npm run test` (vitest 5.0.3) | **PASS 109/109** — mediaInspection 13, resumableUploads/TEST-003/004 13, contracts 7, persistence/TEST-005 11, AutoDubbingStudio 4, srtParser 8, urduPhonetics 6, ExportModal 4, IngestModal 3, API smoke 6, security/honesty 18, packaging/TEST-001 6, auth/TEST-002 10+1 |
| Build + built-server startup | `npm run check` (includes `build`); `tests/api/packaging.test.ts` boots `node dist/server.js` | **PASS** (F05 fixed; F05/F15 regression tests green; full bundle compiled cleanly) |
| Media Inspection & Preview (TASK-010) | `tests/api/mediaInspection.test.ts` | PASS (real FFprobe streams, rational frame rate, duration bounds, 24h limit 413, corrupted media safe failure 422, preview proxy generation, Range 206 delivery, project duration sync) |
| Resumable Uploads & Quarantine (TASK-009) | `tests/api/resumableUploads.test.ts` | PASS (session creation, path traversal rejection, offset mismatch 409, interrupted resume, SHA-256 check, HTML/SVG quarantine rejection 422, Range 206 delivery, idempotent finalize) |
| OpenAPI & Contract Suite (TASK-008) | `tests/api/contracts.test.ts` | PASS (OpenAPI 3.1.0 spec, standard error envelope, X-Request-Id correlation, rejection of media in JSON, PRECONDITION_REQUIRED / REVISION_CONFLICT) |
| Persistence & Concurrency (TEST-005) | `tests/api/persistence.test.ts` | PASS (create, read, list, delete, ETag, 412 on stale revision, 428 on missing precondition, path containment) |
| Traversal/upload/read-only regressions | `tests/api/security.test.ts` | PASS (encoded traversal read/write blocked; HTML/SVG/polyglot uploads rejected; GET/HEAD cache read-only; missing-key TTS produces nothing; 409 on missing segments; 501 on fabricated transcripts) |
| Auth regressions (TEST-002) | `tests/api/auth.test.ts` | PASS (unauthenticated API/media 401; wrong token 403; tampered cookie 401; throttle 429; fail-closed 503 without OWNER_TOKEN) |
| Dual intake & audio replacement tests | `tests/components/AutoDubbingStudio.test.tsx`, `tests/components/IngestModal.test.tsx` | PASS (YouTube reference link + upload pairing; 100% Urdu audio replacement badge; muted preview video; source switching) |
| Doc validation | doc-33 structural script | PASS (54 planning docs) |
| CI workflow | `.github/workflows/ci.yml` (prepared, committed locally) | **BLOCKED** — GitHub App connection lacks the `workflows` permission to push workflow files. Owner action: reconnect GitHub with that scope, push, verify the Actions run |
| Media inspection / proxy gate | `tests/api/mediaInspection.test.ts` | **PASS (13/13)** — verified with local container FFmpeg/FFprobe binaries |

## Audit status (audit file stays historical)

**Fixed with regression tests:** F01 (path containment), F02 (upload validation + hardened serving), F05 (built server starts), F06 (modal hooks), F07 (read-only cache; no placeholder tones/preset TTS in production), F14 (durable project revisions & persistence, TEST-005), F15 (backend bundle unreachable). **F03 core (authentication/ownership gate) fixed** via DEC-011 interim identity (TEST-002).
**Partially fixed (honesty parts; full fixes tracked):** F03 (auth ✓; quotas/rate limits beyond login throttle = TASK-013/031), F04 (finite input bounds only; streaming/queue = TASK-020/022/028), F09 (server refuses silent gaps; per-item failure states; client marks arcs honestly; durable job states = TASK-012/023), F10 (fabricated transcript route disabled 501; preset substitution removed; demo banner added; real ingestion = TASK-014), F12 (no silent sample substitution; render/truncation policy = TASK-022).
**Still open:** F08 (revision-aware caches → TASK-018), F11 (WAV chunk parsing → TASK-020), F13 (playback sync → TASK-025), F16 (arc partitions → TASK-015).

## Decisions

- **DEC-008 accepted:** Bun 1.4.3 + Node ≥22.12 + TypeScript ~6.0.3 + vitest/RTL + ESLint/hooks ([record](decisions/DEC-008-toolchain.md)). Revisit when typescript-eslint supports TS ≥7.1.
- CI prepared for the **public** repository (no secrets); push blocked on the GitHub `workflows` permission. Repo-visibility decision still open.

## Current blockers

1. **DEC-001** authorized source access (RISK-01) — blocks the real pipeline (TASK-014+).
2. **DEC-005** budget / **DEC-002** cloud consent — block TASK-002/003 and all paid work.
3. GitHub connection needs the `workflows` permission to publish the prepared CI workflow.
4. F08/F11/F13/F16 remain open (see map in [18-migration-audit-map.md](18-migration-audit-map.md)).

## Next action

**TASK-011 — Durable job/dispatch ledger** (depends on TASK-008 ✓, TASK-003): Atomic job + intent, idempotent acceptance, step dependencies, worker launch identity; duplicate dispatch tested. TEST-006. Note that live provider work remains blocked on DEC-001/002/005.

## Session handoff

See [SESSION_HANDOFF.md](../SESSION_HANDOFF.md). Reproduce with `npx bun install --frozen-lockfile && npm run check`.

## Historical: planning update v0.2 (2026-10-11, pre-implementation)

Added docs 23–34 and six evidence templates; extended requirements to REQ-032, tasks to TASK-049 and tests to TEST-029. TASK-030/TEST-018 remains the 10-hour intermediate gate; TASK-049/TEST-027 is the final 24-hour qualification. Documentation checks covered links, unique IDs, dependency acyclicity/release-gate reachability and arithmetic across 52 Markdown files (count later raised to 53 by DEC-008).
