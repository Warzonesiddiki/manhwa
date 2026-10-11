# Session handoff — 2026-10-11 · TASK-004 + TASK-005 (implementation sessions 1–2)

## Context

Repository/revision: `Warzonesiddiki/manhwa`, branch `arena/d12f01b6-manhwa`, base `34c6875` (prototype = audited `e581f0a`).
Current phase: authorized implementation (P1). Owner authorized implementation 2026-10-11 with YOLO delegation of engineering/product decisions; paid services, cloud provisioning, destructive operations, public deployment and deferred products remain unauthorized.
Task IDs and authorization scope: **TASK-004 and TASK-005 executed and complete.** DEC-001 (source rights) and DEC-005 (budget) still unanswered.

## Work performed

**TASK-004 (commit `3bd860e`, pushed):** toolchain pin (Bun 1.4.3 / Node ≥22.12 / TS ~6.0.3 per DEC-008), esbuild ^0.28 aligned to Vite 8 peers (npm ERESOLVE fixed), strict typecheck, ESLint 10 + typescript-eslint + react-hooks (rules-of-hooks error), vitest 5 + RTL test stack, 21 tests, docs (DEC-008 record, CURRENT_STATE, CHANGELOG 0.3, AGENTS phase). **F06 fixed** (ExportModal hooks) with closed→open regression test. CI workflow prepared; its push is blocked (below).

**TASK-005 (this commit):** audit-blocker repairs in `server.ts`, `package.json` (build → `--packages=external`), `vite.config.ts` (client → `dist/public`), `src/App.tsx` (client honesty), plus 25 new tests (`tests/helpers/boot.ts`, `tests/api/security.test.ts`, `tests/api/packaging.test.ts`, smoke adapted). Details:
- **F01:** `isSafeName`/`resolveContained` on every filesystem route (audio-cache GET, tts, batch, stitch, dub, master filenames). Encoded-traversal read + write probes tested.
- **F02:** upload magic-sniff (ftyp/EBML/AVI), server-derived extensions, HTML/SVG/polyglots rejected and deleted; `uploads`/`videos`/`dubbed-videos` served with `nosniff` + CSP sandbox; multer limit → 413 JSON.
- **F05/F15:** `esbuild --packages=external` (no CJS dynamic-require crash), client `dist/public` only, SPA fallback excludes `/api/`, `/audio-cache/`, dotfiles and extensioned paths → `/server.js`, `/.env` return 404. TEST-001 green (built server starts, frontend loads, backend unreachable).
- **F07:** GET/HEAD `/audio-cache` strictly read-only (404 on missing, zero writes); `generateDramaticNarrationWav` + `PRESET_SEGMENTS` deleted from the production server; TTS/batch without key → 400 with no artifacts.
- **F09 (honesty):** stitch/dub return 409 with `missingSegments` unless `allowPartial:true` (response then marks `partial`); batch per-item `audioGenerated` truthful with `error` codes + `complete`/`failedCount`; client marks arcs `dubbed` only when all lines have audio.
- **F10 (demo isolation):** `extract-transcript` → 501 (no invented transcripts); preset-dialogue import substitution removed (imported arcs start empty; failures surface as errors); hard-coded "batch scripting" disabled; visible **Demo fixture** banner on preset projects.
- **F12 (partial):** invalid uploaded-video references → 400, never sample fallback. Render `-shortest`/duration policy remains TASK-022.
- **F04 (interim):** `validateTimeline` bounds (finite numbers, ≤7200 s, ≤1000 segments, safe IDs, 10k-char text cap). Full streaming/queueing = TASK-020/022/028.

Things deliberately not changed: WAV chunk parsing (F11/TASK-020), auth (F03/TASK-006), persistence (F08/F14/TASK-007), playback sync (F13), arc partition math (F16/TASK-015), media fixtures in Git, `pre-cache.ts` (dev fixture script), remaining legacy lint warnings (78, tracked).

## Evidence

| Check | Exact command / fixture / job | Result | Evidence location |
|---|---|---|---|
| Frozen install | `npx bun install --frozen-lockfile` | pass | bun.lock coherent |
| npm resolution | `npm install --dry-run --ignore-scripts --no-audit --no-fund` | pass | terminal |
| Strict typecheck | `npm run typecheck` | pass (0 errors) | terminal |
| Lint + Hooks | `npm run lint` | pass (0 errors, 78 warnings; rules-of-hooks verified live) | terminal |
| Tests | `npm run test` (vitest 5.0.3) | **pass 46/46** (unit 14, component 2, API smoke 6, security 18, packaging 6) | `tests/**` |
| Build + built server | `npm run check`; packaging suite boots `node dist/server.js` | pass (F05 regression now green) | `tests/api/packaging.test.ts` |
| Traversal/upload/read-only | `tests/api/security.test.ts` (isolated tmp cwd, no key) | pass (18) | same |
| Doc validation | doc-33 script | pass (53 planning docs) | terminal |
| CI | `.github/workflows/ci.yml` | **blocked** | GitHub App connection refuses workflow-file pushes (`workflows` permission missing). File is committed locally. Owner: reconnect GitHub with workflows scope → `git push origin arena/d12f01b6-manhwa` → confirm Actions run |
| FFmpeg/media/provider/browser | — | **not run** | need staging worker with `ffmpeg`+`ffprobe`, approved `GEMINI_API_KEY`+budget, Playwright browser env |

Provider/model/prompt versions: none used. Paid calls / spend: **none**. No secrets or private media in this record.

## Decisions

Confirmed: **DEC-008** (toolchain; record in `docs/decisions/DEC-008-toolchain.md`), accepted under owner delegation. CI-on-public-repo noted (pending visibility decision).
Proposals still pending: DEC-001, DEC-002, DEC-005, DEC-010, DEC-003/004, DEC-011 (TASK-006 will propose a provider-agnostic owner-allowlist session as the interim identity), repo visibility.
Updated IDs: TASK-004/005 complete (status log in `docs/15-backlog.md`); TEST-001 PASS; TEST-003/011 subsets covered by `tests/api/security.test.ts`; CHANGELOG 0.3/0.4.

## Risks and blockers

- F03 (no auth) is the top remaining exposure — the service must stay private/local until TASK-006 lands; do not deploy.
- F04 only interim-bounded: the synchronous stitch/dub routes still allocate a full PCM buffer (≤7200 s now enforced) — never point them at day-long work; that needs the durable pipeline (TASK-020/022/028).
- 78 lint warnings (legacy `any`/unused/exhaustive-deps) tracked debt.
- CI cannot run until the GitHub connection has the `workflows` permission.
- Media correctness (F11/WAV chunks, F12 render policy, mux QA) untested here — FFmpeg gates stay open.
- DEC-001/005 remain phase-0 owner blockers for provider work.

## Recovery

Reproduce: `npx bun install --frozen-lockfile && npm run check` on this commit. Roll back: `git revert` the TASK-005 commit (then TASK-004's if needed); no data migrations; tests use and delete `/tmp/manhwa-test-*` temp dirs only. Demo media in Git untouched.

## Next session

**Exactly one next task: TASK-006 — Owner-only auth/authorization** (depends on TASK-005 ✓). Scope (TEST-002): a server-enforced owner identity on every API, media and static route (except liveness + login), signed HttpOnly session, ownership checks on every resource access, unauthenticated/wrong-owner tests, and a minimal UI login gate. Record the interim identity choice as **DEC-011** (proposed: allowlisted owner access token → server session cookie; Firebase Auth remains the documented upgrade when DEC-002 hosting is approved). No paid services. Required inputs: none. Relevant documents: docs/10-security-privacy.md, docs/06-api-contract.md (error/ownership conventions), docs/13-testing-release.md (TEST-002), AUDIT.md F03, docs/18-migration-audit-map.md.
