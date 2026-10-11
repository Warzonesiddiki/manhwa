# Current state and next session

**Updated:** 2026-10-11 (implementation sessions 1–3) · **Phase:** authorized implementation (P1) · **Branch:** `arena/d12f01b6-manhwa` (pushed: `3bd860e` TASK-004, `d55d489` docs, `63a7a3e` TASK-005; TASK-006 commit follows; CI workflow commit local-only)

## What is actually present

- React/Vite/TypeScript prototype + v0.2 planning library (32 REQ / 49 TASK / 29 TEST) + historical [AUDIT.md](../AUDIT.md).
- **TASK-004 COMPLETE:** reproducible toolchain + initial CI/tests ([DEC-008](decisions/DEC-008-toolchain.md)).
- **TASK-005 COMPLETE:** audit blocker repairs (paths, uploads, read-only cache, built-server packaging, honest failures, demo isolation) with regression tests including TEST-001.
- **TASK-006 COMPLETE:** owner-only auth/authorization ([DEC-011](decisions/DEC-011-auth.md), interim identity) — server-enforced sessions on every API/media route, fail-closed, TEST-002 green. **56/56 tests total.**
- No paid provider calls, cloud infrastructure, deployments, or live provider benchmarks have run. `GEMINI_API_KEY` is not configured in the development environment.

## Confirmed owner intent

Personal channel tool; YouTube-link-first; Urdu; sources typically 10–24 hours with a 24-hour design maximum; shorter inputs supported. Implementation authorized 2026-10-11 with decision delegation ("YOLO mode"). **Paid services, public deployment, destructive operations, and deferred products remain unauthorized.** DEC-001 (authorized source access) and DEC-005 (budget) remain unanswered and block TASK-002/003 and any provider work. The 128 GB byte cap (DEC-010) remains unapproved/unqualified.

## Verification evidence (2026-10-11, sandbox: Node 22.22.3, bun 1.4.3 via npx, no FFmpeg, no API key)

| Check | Exact command | Result |
|---|---|---|
| Frozen install | `npx bun install --frozen-lockfile` | PASS |
| npm resolution (secondary) | `npm install --dry-run --ignore-scripts --no-audit --no-fund` | PASS |
| Strict typecheck | `npm run typecheck` (TS 6.0.3, `strict: true`) | PASS (0 errors) |
| Lint + React Hooks | `npm run lint` (rules-of-hooks **error**, verified live) | PASS (0 errors; 78 legacy warnings tracked) |
| Tests | `npm run test` (vitest 5.0.3) | **PASS 56/56** — srtParser 8, urduPhonetics 6, ExportModal F06 2, API smoke 6, security/honesty 18, packaging/TEST-001 6, auth/TEST-002 10+1 |
| Build + built-server startup | `npm run check` (includes `build`); `tests/api/packaging.test.ts` boots `node dist/server.js` | **PASS** (F05 fixed; F05/F15 regression tests green) |
| Traversal/upload/read-only regressions | `tests/api/security.test.ts` | PASS (encoded traversal read/write blocked; HTML/SVG/polyglot uploads rejected; GET/HEAD cache read-only; missing-key TTS produces nothing; 409 on missing segments; 501 on fabricated transcripts) |
| Auth regressions (TEST-002) | `tests/api/auth.test.ts` | PASS (unauthenticated API/media 401; wrong token 403; tampered cookie 401; throttle 429; fail-closed 503 without OWNER_TOKEN) |
| Doc validation | doc-33 structural script | PASS (54 planning docs) |
| CI workflow | `.github/workflows/ci.yml` (prepared, committed locally) | **BLOCKED** — GitHub App connection lacks the `workflows` permission to push workflow files. Owner action: reconnect GitHub with that scope, push, verify the Actions run |
| FFmpeg/media, live provider, browser journeys, day-long scale | — | **NOT RUN** — need FFmpeg worker/staging, approved key+budget, browser env; see handoff |

## Audit status (audit file stays historical)

**Fixed with regression tests:** F01 (path containment), F02 (upload validation + hardened serving), F05 (built server starts), F06 (modal hooks), F07 (read-only cache; no placeholder tones/preset TTS in production), F15 (backend bundle unreachable). **F03 core (authentication/ownership gate) fixed** via DEC-011 interim identity (TEST-002).
**Partially fixed (honesty parts; full fixes tracked):** F03 (auth ✓; quotas/rate limits beyond login throttle = TASK-013/031), F04 (finite input bounds only; streaming/queue = TASK-020/022/028), F09 (server refuses silent gaps; per-item failure states; client marks arcs honestly; durable job states = TASK-012/023), F10 (fabricated transcript route disabled 501; preset substitution removed; demo banner added; real ingestion = TASK-014), F12 (no silent sample substitution; render/truncation policy = TASK-022).
**Still open:** F08 (revision-aware caches → TASK-007/018), F11 (WAV chunk parsing → TASK-020), F13 (playback sync → TASK-025), F14 (project persistence → TASK-007), F16 (arc partitions → TASK-015).

## Decisions

- **DEC-008 accepted:** Bun 1.4.3 + Node ≥22.12 + TypeScript ~6.0.3 + vitest/RTL + ESLint/hooks ([record](decisions/DEC-008-toolchain.md)). Revisit when typescript-eslint supports TS ≥7.1.
- CI prepared for the **public** repository (no secrets); push blocked on the GitHub `workflows` permission. Repo-visibility decision still open.

## Current blockers

1. **DEC-001** authorized source access (RISK-01) — blocks the real pipeline (TASK-014+).
2. **DEC-005** budget / **DEC-002** cloud consent — block TASK-002/003 and all paid work.
3. GitHub connection needs the `workflows` permission to publish the prepared CI workflow.
4. No FFmpeg in the dev sandbox — media gates (TEST-013/014/015) run only in staging/worker environments.
5. F08/F11/F13/F14/F16 remain open (see map in [18-migration-audit-map.md](18-migration-audit-map.md)).

## Next action

**TASK-007 — Project/revision persistence** (depends on TASK-006 ✓): durable project state, source references, edits with optimistic concurrency, autosave/reload, entity schemas (TEST-005). Server-side storage for a single-owner tool may start as a local SQLite/JSON-store adapter behind repository interfaces (no cloud dependency); Firebase/Firestore remains the DEC-002 upgrade. Then TASK-008 (executable API/domain contracts). TASK-002/003 stay blocked on DEC-001/002/005.

## Session handoff

See [SESSION_HANDOFF.md](../SESSION_HANDOFF.md). Reproduce with `npx bun install --frozen-lockfile && npm run check`.

## Historical: planning update v0.2 (2026-10-11, pre-implementation)

Added docs 23–34 and six evidence templates; extended requirements to REQ-032, tasks to TASK-049 and tests to TEST-029. TASK-030/TEST-018 remains the 10-hour intermediate gate; TASK-049/TEST-027 is the final 24-hour qualification. Documentation checks covered links, unique IDs, dependency acyclicity/release-gate reachability and arithmetic across 52 Markdown files (count later raised to 53 by DEC-008).
