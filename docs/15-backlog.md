# 15 — Implementation backlog

**Status:** this is the stable task catalog, not a global status declaration. Implemented/blocked items are recorded in the status log below; tasks without an entry remain not started.

One task is one reviewable capability; split further using the task template if its diff becomes broad. Effort S/M/L is comparative uncertainty, not a promised duration. All tasks include tests, documentation update, and handoff.

| ID | Task / scope | Depends on | Size | Acceptance / evidence |
|---|---|---|---|---|
| TASK-001 | Source/rights + AI Studio feasibility | Owner decisions | S | Demonstrate link → authorized file path; verify repository import/sync, account/billing/region, preview vs worker boundary; record DEC-001/002/008. |
| TASK-002 | Urdu/provider evaluation | 001, approved small spend | M | Benchmark ≥30 passages and representative pilot; verify exact APIs/formats/limits; quality scores and dated rate card; DEC-003/004. |
| TASK-003 | Long-media worker/storage spike | 001, approved resources | M | Measure bounded read/seek/scratch/render/upload on realistic large input; choose Cloud Run Jobs or VM worker; resource/cost evidence. |
| TASK-004 | Reproducible tooling + initial CI/tests | 001 | S | Pin Node/package manager, resolve peer conflicts, add types/hooks/unit/API smoke checks; clean frozen install. TEST-001. |
| TASK-005 | Repair/disable baseline blockers | 004 | M | Safe paths/uploads, read-only audio access, honest missing-key errors, modal hooks, server packaging/static isolation; regression tests. No new paid feature. |
| TASK-006 | Owner-only auth/authorization | 005, approved auth decision | M | Verify identity and ownership across API/assets/jobs; wrong-owner tests; worker identity design. TEST-002. |
| TASK-007 | Project/revision persistence | 006 | M | Durable project, source reference, edits, optimistic concurrency, autosave/reload; entity schemas. TEST-005. |
| TASK-008 | Executable API/domain contracts | 006, 007 | M | OpenAPI/shared validators/error codes from docs 05/06; no media payloads in JSON; request bounds and contract tests. |
| TASK-009 | Scoped resumable uploads | 008, 003 | M | Direct private upload, resume/checksum/limits, quarantined asset lifecycle, no arbitrary URL fetch. TEST-003/004. |
| TASK-010 | Media inspection/proxy | 009 | M | Real FFprobe duration/streams, bounded validation, source hash and preview; bad media fails safely. |
| TASK-011 | Durable job/dispatch ledger | 008, 003 | L | Atomic job + intent, idempotent acceptance, step dependencies, worker launch identity; duplicate dispatch tested. TEST-006. |
| TASK-012 | Leases/resume/cancel/invalidation | 011, 007 | L | Fencing, heartbeat/reconciler, checkpoint resume, late-result handling, immutable snapshots; crash/cancel/edit tests. |
| TASK-013 | Usage ledger and budget gate | 011, 002 | M | Versioned estimates, atomic reservations, concurrency-aware cap, unknown outcome, actual usage; TEST-008. |
| TASK-014 | Real ASR + SRT/VTT ingestion | 010, 012, 013, 002 | L | Actual source audio, chunk offsets/overlap dedup, uncertainty flags, validated imported subtitles; TEST-009. |
| TASK-015 | Episode/context planning | 014 | M | Contiguous source coverage, editable boundaries, separate processing shards, glossary/context propagation without invented story. |
| TASK-016 | Urdu adaptation + glossary | 014, 002 | M | Versioned prompt/model output validation, faithful Urdu/Roman/ttsText, entity/numeral QA; TEST-010. |
| TASK-017 | Review editor/autosave | 007, 015, 016 | M | Virtualized RTL/LTR workbench, approvals, split/merge, source-linked seek, conflicts and stale indicators. |
| TASK-018 | Real TTS adapter/artifact cache | 012, 013, 016, 002 | L | Effective-input hash, owner-scoped immutable artifacts, MIME decode, usage/provenance, no GET mutation/fallback tone; TEST-011. |
| TASK-019 | Pilot/profile approval | 017, 018 | S | Real representative pilot; approval binds settings/text revisions; bulk generation blocked after relevant change. TEST-012. |
| TASK-020 | Audio normalization/quality | 018 | M | Parse/decode actual format, correct metadata handling, duration/levels/silence QA, safe large-audio format; TEST-013. |
| TASK-021 | Timing-fit workflow | 019, 020 | M | Overflow flags, approved shorten/regenerate/stretch, no silent crop/overwrite, sample-accurate scheduling. |
| TASK-022 | Server-side episode render | 010, 012, 021 | L | Correct source/range/profile, approved artifact manifest, mute mixed original by default, no truncation, render QA; TEST-014/015. |
| TASK-023 | Real jobs/progress UI | 012, 013 | M | Actual counters, heartbeat, partial failure, pause/resume/cancel, cost and retry information; browser-close recovery. |
| TASK-024 | Subtitles/export manifest | 017, 022 | M | SRT/VTT, optional tested Urdu burn-in, chapter text, hashes/settings/revisions, usable download package; TEST-015. |
| TASK-025 | Playback/accessibility | 017, 022 | M | One media clock, seek/rate/volume correctness, safe modal focus, keyboard/RTL, long-list performance; TEST-016. |
| TASK-026 | Media access/lifecycle hardening | 009, 022, 006 | M | Authorized signed reads/Range, expiry refresh, retention/deletion, cleanup of failed/provider assets; TEST-017. |
| TASK-027 | Archive/restore/backup | 007, 024, 026 | M | Versioned complete manifest, large media strategy, quarantined import, checksum/ownership, restore drill; TEST-005/017. |
| TASK-028 | Capacity/rate-limit tuning | 003, 014, 018, 022 | M | Measured 1/3-hour memory/scratch/cost/latency, provider backoff, bounded concurrency and queues. |
| TASK-029 | Full-marathon assembly | 024, 028 | L | Compatible episode concat/remux or tested transcode; full expected duration; large audio container policy. |
| TASK-030 | Ten-hour fault-injection acceptance | 029, 023, 027 | L | 10-hour fixture, worker loss/resume, browser closure, cost and audio/video QA evidence; TEST-018. |
| TASK-031 | Reproducible deployment/CI | 003, 004, 006, 011 | M | Approved infra-as-code, isolated environments, least privilege, secret management, worker image, staging gates and rollback. |
| TASK-032 | Observability/operations drills | 026, 027, 031 | M | Stuck-job/cost/storage alerts, restore/rotation/rollback tests, runnable operator guide. |
| TASK-033 | Private v1 release | 025, 030, 032, 049 | M | All mandatory tests including TEST-027, zero blocking audit issues, owner quality/cost/capacity approval, release report, private deployment. |
| TASK-034 | Licensed music stems + ducking | 033, feature approval | M | Rights manifest, audible mix tests, no unintended English voice leakage. Optional. |
| TASK-035 | Owner-authorized captions integration | 033, policy/OAuth approval | M | Correct scopes/permissions, retention/deletion compliance, clear forbidden fallback to upload. Optional. |
| TASK-036 | Pronunciation/quality productivity improvements | 033, usage evidence | M | Target measured review pain: dictionary reuse, better timing suggestions, confidence filters; benchmark improvements. Optional. |
| TASK-037 | NLE export or panel-creator discovery | 033, separate scope decision | L | A new feature spec/feasibility study, not automatic commitment to a second product. |

## Mandatory v0.2 extension backlog — not optional polish

These new IDs preserve the existing 10-hour milestone IDs rather than rewriting history. None is started. Dependency numbers abbreviate TASK- IDs. These tasks extend earlier slices and all gate TASK-033 via TASK-049.

| ID | Task / scope | Depends on | Size | Acceptance / evidence |
|---|---|---|---|---|
| TASK-038 | 24-hour support envelope and admission control | 003, 008, 013 | M | Duration/bytes/resource/budget profile, revised capacity arithmetic and preflight; exact day boundary and resource rejection; TEST-020. |
| TASK-039 | Large transfer/resume/revocation hardening | 009, 010, 038 | L | Bounded upload/hash; browser-close/reselect, expiry and changed-file semantics; late finalize safe; immutable range downloads; TEST-019. |
| TASK-040 | Publication packages and source-to-part maps | 024, 029, 038 | L | All selected source covered by destination-valid parts; actual byte/duration checks, local captions/chapters, archival master distinction; TEST-020/023. |
| TASK-041 | Multi-day provider capability and quota resilience | 002, 012, 013, 018 | M | Capability snapshots, expiry, circuit breaker, centralized quota, uncertain-cost reconciliation, no silent fallback; TEST-026. |
| TASK-042 | Review sessions, coverage and critical-issue gates | 017, 019, 025 | M | Persist review ranges/issues, honest listening vs sampling, approval invalidation and release block; TEST-022. |
| TASK-043 | Reference-safe lifecycle and integrity reconciliation | 012, 026, 027 | L | Dry-run mark/sweep, protected active/review/pinned artifacts, orphan/corruption recovery, late-write/delete/restore races; TEST-024. |
| TASK-044 | Day-long preview and bounded browser resources | 010, 017, 025 | M | Tiled waveform/proxy, virtualized ≥10,000 rows, hour-23 navigation without full-media decode; TEST-025. |
| TASK-045 | Narrative memory, term dependency and timeline lineage | 015, 016, 017 | M | Source-backed context, no future-story leakage, term-change impact/cost, edit lineage and 24-hour math; TEST-020/021. |
| TASK-046 | Actual software/media/model compliance inventory | 001, 002, 031 | M | SBOM/image/font/codec/provider/source obligation review, required notices, owner-approved data practices; TEST-029. |
| TASK-047 | Multi-day observability, onboarding and operations evidence | 032, 038, 041, 043 | M | Readiness levels, metrics/wait breakdown, budget/notification/redaction and recovery drills; TEST-028; docs 31/34. |
| TASK-048 | Expanded compatibility and boundary qualification | 039, 040, 042, 044, 045, 046, 047 | L | TEST-019–026/028/029 verified with real fixtures/platform matrix; 12/18-hour rehearsals and byte-cap transfer evidence; known limitations published. |
| TASK-049 | 24-hour final fault-injection and quality qualification | 030, 038, 039, 040, 041, 042, 043, 044, 045, 046, 047, 048 | L | TEST-027: full day-long source, recovery/expiry, truthful human review, destination package, actual costs/resource bounds and approved capacity report. |

TASK-034–037 remain optional post-release features despite their lower numeric IDs. **Task numbering is identity, not execution order.** Use the dependency graph and roadmap. TASK-031/032/026/027 and their dependent extension tasks must finish before the final P5/P6 scale/release gates; do not postpone them merely because they are listed in the production-readiness phase.

## Task status lifecycle

`not_started → specified → approved → in_progress → in_review → verified → complete`; `blocked` records reason/owner/next action. Do not call a task complete on generated code alone. Record implementation commit/build and test evidence alongside status when development begins.

## Definition of ready

Owner approved execution; dependencies verified; relevant requirement and contract identified; inputs/outputs/errors specified; cost/privacy impact understood; acceptance tests and fixture available; bounded file scope agreed.

## Definition of done

Acceptance passes in the relevant environment; negative paths tested; no unrelated diff/secrets; migration/rollback addressed; docs/decisions updated; exact test evidence attached; user-visible failures truthful; handoff names the next task. Unrun tests or provider uncertainty remain explicit blockers, not implied passes.

## Change control

New ideas enter a feature spec, not the current task mid-session. Security corrections may interrupt the queue. Public/team/billing/voice-cloning/panel-generation work requires a new scope decision, threat review, and revised roadmap.

## Status log (implementation phase)

Verified slices are recorded here with evidence; table entries above stay stable as the task catalog. Full command-level evidence lives in [CURRENT_STATE.md](CURRENT_STATE.md) and the root `SESSION_HANDOFF.md`.

| Task | Status | Evidence summary (latest update: 2026-10-12) |
|---|---|---|
| `TASK-004` | complete (checkout follow-up recorded) | DEC-008 toolchain and regression suites are present. The refreshed lockfile passes frozen install (370 packages installed); typecheck, lint (0 errors/116 warnings), and build pass. 96 non-media tests pass here; the FFmpeg-dependent suite remains blocked by missing binaries, and the TASK-010 cleanup guard prevents a secondary teardown error. No CI workflow file is present in this checkout; earlier CI notes are historical. |
| `TASK-005` | complete | F01/F02/F05/F07/F15 repaired with regression tests; F09/F10/F12 honesty repairs (server + client demo isolation); interim F04 input bounds. 46/46 tests green incl. TEST-001 built-server startup/static isolation. |
| `TASK-006` | complete | Owner-only auth (DEC-011 interim): HMAC-signed HttpOnly session on every API/media route, login throttle, fail-closed without OWNER_TOKEN. TEST-002 suite green (56/56 tests overall). |
| `TASK-007` | complete | Project & revision persistence (docs 05/06): atomic JSON store under `data/projects/`, REST CRUD under `/api/v1/projects`, RFC 6585 optimistic concurrency (If-Match/expectedRevision, 412/428, ETags), frontend autosave + conflict indicator in Header. TEST-005 was previously recorded green (76/76 overall). DEC-005 is the separate budget decision; a storage DEC-005 record is not present in this checkout. |
| `TASK-008` | complete | Executable API & domain contracts (doc 06): OpenAPI 3.1.0 spec at `/api/v1/openapi.json`, canonical error envelope, request bounds and media rejection in JSON (`LIMIT_EXCEEDED`, `UPLOAD_INVALID`), X-Request-Id correlation. Contract suite green (83/83 tests overall). |
| `TASK-009` | complete | Scoped resumable uploads & quarantined asset lifecycle (docs 06/24): scoped upload sessions, sequential chunks with offset validation (`UPLOAD_OFFSET_MISMATCH` 409), resume recovery, SHA-256 verification, magic sniff + quarantine protection (`QUARANTINE_REJECTED` 422/403), HTTP Range 206 delivery. TEST-003/004 green (96/96 tests overall). |
| `TASK-010` | complete (previously verified; test-harness follow-up) | Media inspection & preview proxy (docs 06/09/28): real FFprobe streams and rational frame-rate inspection, duration bounds, corrupt-container rejection, project duration sync, faststart proxy, and Range 206 delivery. 109/109 tests were previously recorded green with FFmpeg/FFprobe. This sandbox lacks those binaries; the latest targeted test confirms the expected `ffmpeg` prerequisite failure, and cleanup no longer throws a secondary error. |
| `TASK-001` | blocked (partial) | Current branch/repository verified; owner decisions DEC-001/002/005 and AI Studio account checks remain open. Resolve source rights and resource/budget consent before TASK-003; TASK-011 depends on TASK-003. |
| All others | not_started | — |
