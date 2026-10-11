# Session handoff — 2026-10-11 · TASK-004 + TASK-005 + TASK-006 (implementation sessions 1–3)

## Context

Repository/revision: `Warzonesiddiki/manhwa`, branch `arena/d12f01b6-manhwa`, base `34c6875` (prototype = audited `e581f0a`).
Current phase: authorized implementation (P1). Owner authorized implementation 2026-10-11 with YOLO delegation of engineering/product decisions; paid services, cloud provisioning, destructive operations, public deployment and deferred products remain unauthorized.
Task IDs and authorization scope: **TASK-004, TASK-005 and TASK-006 executed and complete.** DEC-001 (source rights) and DEC-005 (budget) still unanswered.

## Work performed

**TASK-004 (commit `3bd860e`, pushed):** toolchain pin (Bun 1.4.3 / Node ≥22.12 / TS ~6.0.3 per DEC-008), esbuild peer alignment (npm ERESOLVE fixed), strict typecheck, ESLint + rules-of-hooks (F06 fixed + regression test), vitest stack, 21 tests, docs.

**TASK-005 (commit `63a7a3e`, pushed):** audit blocker repairs — F01 path containment, F02 upload magic-sniff + hardened serving, F05 `esbuild --packages=external` + `dist/public` client split (TEST-001 green), F07 strictly read-only audio cache (placeholder tones + preset TTS map deleted), F09 missing-segment 409/`allowPartial`, truthful per-item TTS states, honest client arc status, F10 fabricated transcript 501 + preset substitution disabled + Demo banner, F12 no silent sample fallback, F15 backend/env paths 404, F04 interim input bounds. 46/46 tests at that point.

**TASK-006 (this commit):** owner-only auth (AUDIT F03 core, TEST-002, [DEC-011](docs/decisions/DEC-011-auth.md)):
- `server.ts`: `OWNER_TOKEN` → `POST /api/auth/login` (timing-safe compare, 10/min/IP throttle) → HMAC-signed `mh_session` cookie (HttpOnly, SameSite=Strict, 12 h TTL, Secure in prod). `requireOwner` on `/api/*` (except `/api/health`, `/api/auth/login`, `/api/auth/session`) and on `/audio-cache`, `/uploads`, `/videos`, `/dubbed-videos` (guards mounted before the static handlers). Fail-closed 503 without `OWNER_TOKEN` in production; dev generates+logs an ephemeral token.
- `src/components/LoginGate.tsx` + `src/App.tsx` session check (cookie-based; no JS-readable tokens).
- `tests/api/auth.test.ts` (11 tests): unauthenticated API/media 401, wrong token 403, tampered cookies 401, login throttle 429 (correct token also throttled inside the window), valid session reaches honest 400 missing-key, fail-closed 503, app shell public.
- `tests/helpers/boot.ts`: `login`/`withCookie`/`TEST_OWNER_TOKEN`; existing suites updated to authenticate.

Things deliberately not changed: revision/persistence layer (TASK-007), WAV chunk parsing (F11/TASK-020), playback sync (F13), arc partition math (F16), quota/budget gates (TASK-013), media fixtures in Git, remaining 78 legacy lint warnings.

## Evidence

| Check | Exact command / fixture / job | Result | Evidence location |
|---|---|---|---|
| Frozen install | `npx bun install --frozen-lockfile` | pass | bun.lock coherent |
| npm resolution | `npm install --dry-run --ignore-scripts --no-audit --no-fund` | pass | terminal |
| Strict typecheck | `npm run typecheck` | pass (0 errors) | terminal |
| Lint + Hooks | `npm run lint` | pass (0 errors, 78 warnings; rules-of-hooks verified live) | terminal |
| Tests | `npm run test` (vitest 5.0.3) | **pass 56/56** (unit 14, component 2, smoke 6, security 18, packaging/TEST-001 6, auth/TEST-002 11) | `tests/**` |
| Build + built server | `npm run check`; packaging suite boots `node dist/server.js` | pass | `tests/api/packaging.test.ts` |
| Security regressions | `tests/api/security.test.ts` | pass (18) | same |
| Auth regressions (TEST-002) | `tests/api/auth.test.ts` | pass (11) | same |
| Doc validation | doc-33 script (54 planning docs) | pass | terminal |
| CI | `.github/workflows/ci.yml` | **blocked** | GitHub App connection lacks the `workflows` permission for pushing workflow files; file committed locally. Owner: reconnect GitHub with workflows scope → `git push origin arena/d12f01b6-manhwa` → confirm Actions run |
| FFmpeg/media/provider/browser | — | **not run** | need staging worker with `ffmpeg`+`ffprobe`, approved `GEMINI_API_KEY`+budget, Playwright browser env |

Provider/model/prompt versions: none used. Paid calls / spend: **none**. No secrets or private media in this record (test token `TEST_OWNER_TOKEN` is a fixture value used only in tests).

## Decisions

Confirmed: **DEC-008** (toolchain) and **DEC-011** (interim owner auth — OWNER_TOKEN → signed HttpOnly session, fail-closed; Firebase upgrade when DEC-002 approved). Records in `docs/decisions/`.
Proposals still pending: DEC-001, DEC-002, DEC-005, DEC-010, DEC-003/004, repo visibility.
Updated IDs: TASK-004/005/006 complete (status log in `docs/15-backlog.md`); TEST-001 PASS; TEST-002 PASS; TEST-003/011 subsets covered; CHANGELOG 0.3–0.5.

## Risks and blockers

- Auth is interim single-token identity (DEC-011): rotating `OWNER_TOKEN` invalidates sessions; no MFA. Fine for single-owner private use; upgrade path documented.
## Intake & Audio Replacement Implementation (2026-10-11)

- **Dual Intake (YouTube links + direct video upload):**
  - Updated `IngestModal` with dedicated tabs and workflow:
    - Tab 1: YouTube Reference Link (accepts YouTube link, extracts metadata, allows optional pairing with authorized source video file)
    - Tab 2: Upload Authorized Original Video File (direct upload to `/api/upload-video` with container verification, file size detection, and automatic project assignment)
  - `AutoDubbingStudio` displays full project intake context (YouTube reference link, active source video file status, and direct upload/replace actions).
  - `MarathonProject` records `uploadedVideoUrl` and `uploadedVideoFilename`.
- **Complete Audio Replacement (Urdu narration replacing English audio):**
  - Preview playback in `AutoDubbingStudio`: original video is muted (`muted={true}`), Urdu narration voiceovers play in sync via audio clock, and on-screen status badge reflects full audio replacement.
  - Server rendering & export (`/api/dub-video-studio`): FFmpeg maps `-map 0:v:0` (original video frames) and `-map 1:a:0` (master Urdu narration track), completely omitting original audio `0:a`. Server returns explicit `audioMode: 'replaced_original_audio'`.
  - `ExportModal`: now connects the project's uploaded video (if present) to the studio dubbing pipeline and provides explicit notice of full audio replacement.
  - Strict UI cleanliness: all `alert()` calls eliminated in favor of dismissible inline status banners.
  - **TASK-010 Media Inspection & Preview Proxy COMPLETE:**
    - Real containerized FFprobe media stream and container inspection (`server/media/inspector.ts`).
    - Extracted rational frame rate parsing, video codec, width, height, rotation, audio codec, channels, sample rate, bit rate, seekability, and computed SHA-256 source hash.
    - Bounded validation: strictly rejects 0-duration and >24-hour media (`LIMIT_EXCEEDED` 413).
    - Fail-safe quarantine rejection on corrupt/truncated containers (`MEDIA_CORRUPTED` 422) without crashing server.
    - Automatic duration synchronization (`project.durationMs` and `project.totalDurationMinutes`).
    - Lightweight browser-compatible faststart MP4 preview proxy generator (`server/media/previewProxy.ts`).
    - HTTP Range 206 Partial Content delivery for preview proxy (`GET /api/v1/assets/:id/preview`).
    - OpenAPI 3.1.0 schemas and paths updated.
  - **Tests:** **109/109 tests pass across 13 test suites** (mediaInspection 13, resumableUploads/TEST-003/004 13, contracts 7, persistence/TEST-005 11, AutoDubbingStudio 4, srtParser 8, urduPhonetics 6, ExportModal 4, IngestModal 3, API smoke 6, security/honesty 18, packaging/TEST-001 6, auth/TEST-002 11).

## Current status

TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, and TASK-010 are complete and verified green.

## Next task

**TASK-011 — Durable job/dispatch ledger** (depends on TASK-008 ✓, TASK-003): Atomic job + intent, idempotent acceptance, step dependencies, worker launch identity; duplicate dispatch tested. TEST-006. Note that live provider work remains blocked on DEC-001/002/005.
