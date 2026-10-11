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
- App shell (client bundle) is public by design — contains no secrets; all API/media gated.
- Login throttle is in-memory (resets on restart) — acceptable interim; TASK-013 adds real quota controls.
- F04 only interim-bounded: synchronous stitch/dub still allocate full PCM (≤7200 s enforced); day-long work needs the durable pipeline (TASK-020/022/028).
- CI still unpushed (workflows permission). Media correctness (F11/F12 render policy) untested without FFmpeg. DEC-001/005 remain phase-0 owner blockers for provider work.

## Recovery

Reproduce: `npx bun install --frozen-lockfile && npm run check` on this commit. Roll back: `git revert` the task commits in reverse order (006 → 005 → 004); no data migrations; tests use and delete `/tmp/manhwa-test-*` only. Set a strong `OWNER_TOKEN` in any deployed environment (required, fail-closed).

## Next session

**Exactly one next task: TASK-007 — Project/revision persistence** (depends on TASK-006 ✓). Scope (TEST-005): durable project entities (project, source ref, segments, revisions), optimistic-concurrency PATCH semantics per docs/05/06, autosave/reload recovery, versioned export/import without old signed URLs, server-side repository interfaces (start with a local store adapter — SQLite or validated JSON files — behind interfaces so the Firestore adapter can swap in under DEC-002; no cloud dependency). Required inputs: none (no spend). Relevant documents: docs/05-data-model.md, docs/06-api-contract.md, docs/07-job-orchestration.md (state precedents), docs/25-continuity-and-editing.md, docs/13-testing-release.md (TEST-005), AUDIT.md F08/F14, docs/18-migration-audit-map.md.
