# Documentation changelog

## 0.7 — 2026-10-12 (TASK-010 media-test cleanup follow-up)

- Made the media-inspection test server optional until setup succeeds and only shut it down when it was actually booted. A missing local `ffmpeg` now remains the single clear setup failure instead of triggering a secondary teardown `TypeError`.
- Did not skip or mock the FFmpeg-backed checks. In this sandbox, the targeted media suite and `npm run check` still fail because `ffmpeg`/`ffprobe` are absent; 13 media tests remain unverified. Typecheck/lint and the other 96 tests pass.
- No product behavior, provider calls, cloud provisioning, deployment, or media assets changed.

## 0.6 — 2026-10-11 (Arena checkout verification · TASK-004 follow-up)

- Found and corrected a stale `bun.lock` that still described the `react-example`/TypeScript 7/esbuild 0.25 dependency set instead of the current `package.json`; regenerated with Bun 1.4.3 and aligned the workspace name. No package manifest or product behavior changed.
- Current checkout evidence: frozen install and npm dry-run pass; typecheck/lint/build pass; 96 tests outside the FFmpeg-dependent suite pass. The full test command is blocked here because `ffmpeg`/`ffprobe` are absent; 13 media tests were not reverified. The earlier 109/109 report is retained as historical evidence from an FFmpeg-equipped environment.
- Reconciled implementation-phase/status text, the active branch reference, a broken link that mislabeled DEC-005 (budget) as a storage decision, and the TASK-003 prerequisite before TASK-011. Clarified that no CI workflow is tracked in this checkout.
- No paid provider calls, cloud provisioning, deployment, or private media were used.

## 0.5 — 2026-10-11 (implementation session 3 · TASK-006)

- **TASK-006 complete:** owner-only authentication/authorization (AUDIT F03 core, TEST-002) — 56/56 tests green.
  - Server-enforced owner sessions: `POST /api/auth/login` (timing-safe, 10/min/IP throttle) exchanges `OWNER_TOKEN` for an HMAC-signed `HttpOnly; SameSite=Strict` cookie (12 h TTL).
  - Every `/api/*` route except liveness/login/session and every `/audio-cache/*`, `/uploads/*`, `/videos/*`, `/dubbed-videos/*` access requires a valid session; tampered/expired cookies → 401; wrong token → 403; **fail closed** (503) when `OWNER_TOKEN` is unset in production (dev generates and logs an ephemeral token).
  - Minimal `LoginGate` UI; no JS-readable tokens. TEST-002 suite: unauthenticated API/media 401, wrong-owner 403, throttle 429, tampered-cookie 401, fail-closed 503.
- New [docs/decisions/DEC-011-auth.md](decisions/DEC-011-auth.md) (interim identity; Firebase upgrade path when DEC-002 is approved); planning-document count raised 53 → 54.

## 0.4 — 2026-10-11 (implementation session 2 · TASK-005)

- **TASK-005 complete:** repaired audit blockers with regression tests (46/46 green).
  - **F01** safe opaque names + resolved-path containment for every filesystem route; encoded-traversal read/write probes tested.
  - **F02** uploads validated by container magic (mp4/mov/webm/mkv/avi), server-derived extensions, active content (HTML/SVG/polyglots) rejected and deleted; media served with `nosniff` + CSP sandbox.
  - **F05** production server starts: `esbuild --packages=external`, client built to `dist/public`, server bundle to `dist/server.js` (TEST-001 startup gate now PASS).
  - **F07** GET/HEAD `/audio-cache` strictly read-only (404 on missing; zero writes); placeholder-tone generator and preset-dialogue map removed from the production server; TTS/batch without credentials return 400 and produce no artifacts.
  - **F09 (server + client honesty)** missing segment audio → 409 unless `allowPartial:true` (explicit gaps only); per-item TTS failures stay visibly failed; arcs marked `dubbed` only when every line has real audio.
  - **F10 (demo isolation)** fabricated `extract-transcript` disabled (501); preset-dialogue import substitution and hard-coded "batch scripting" disabled; visible **Demo fixture** banner for bundled preset projects.
  - **F12 (partial)** invalid uploaded-video references fail with 400 — sample footage is never silently substituted; render/truncation policy remains TASK-022.
  - **F15** backend bundle and dotfile/env paths return 404 from the HTTP surface; SPA fallback limited to extension-less paths.
  - **F04 (interim)** finite schema bounds on durations/segments/timestamps/text; full bounded streaming remains TASK-020/022/028.
- Remaining open from the audit: F03 (auth/quotas → TASK-006/013), F08 (revision-aware caches → TASK-007/018), F11 (WAV chunk parsing → TASK-020), F13 (playback sync → TASK-025), F14 (persistence → TASK-007), F16 (arc partitions → TASK-015), plus the documented partials above.
- Task status log added to [15-backlog.md](15-backlog.md).

## 0.3 — 2026-10-11 (implementation session 1 · TASK-004)

- Owner authorized implementation ("YOLO mode") with delegated engineering/product decisions; paid services, public deployment, destructive operations and deferred products remain unauthorized. AGENTS.md phase updated accordingly.
- **TASK-004 complete:** pinned toolchain per DEC-008 (Bun 1.4.3 + Node ≥22.12 + TypeScript ~6.0.3; esbuild ^0.28.0 aligned to Vite 8 peer range; vitest/RTL and ESLint/typescript-eslint/react-hooks stacks, pinned exactly).
- Added real lint gate: ESLint with `react-hooks/rules-of-hooks` as error (synthetically verified) and `exhaustive-deps` as warn; 76 legacy warnings tracked. Fixed AUDIT **F06** (ExportModal hook order) with a closed→open regression test.
- Added 21 tests across 4 suites (srtParser, urduPhonetics, ExportModal F06, API smoke in an isolated temp cwd with no credentials) — `npm run test` green; TEST-001 harness introduced, built-server startup gate remains FAIL under F05 (TASK-005).
- Prepared `.github/workflows/ci.yml` (frozen install → typecheck → lint → tests → build; no secrets). **Push of workflow files is blocked**: the sandbox GitHub App lacks the `workflows` permission; the file stays prepared until the connection is reconnected with that scope, then CI runs on the public repo.
- New [docs/decisions/DEC-008-toolchain.md](decisions/DEC-008-toolchain.md); planning-document count in the doc-33 validator deliberately raised 52 → 53.
- Task-status convention: verified slices are recorded in [CURRENT_STATE.md](CURRENT_STATE.md) with exact commands and results; backlog IDs stay stable.

## 0.2 — 2026-10-11

- Owner expanded typical source duration to 10–24 hours; raised the design maximum to 24 hours while retaining shorter-source support and the 10-hour intermediate qualification.
- Proposed separate 128 GB source-byte profile, pending owner approval and independent large-transfer/worker qualification. Updated capacity math instead of merely replacing “10” with “24.”
- Distinguished full-source processing, worker/job lifetimes, browser upload continuation, optional archival masters and destination-valid publication parts.
- Added docs 23–34 for large transfers, continuity, review workload/coverage, publication maps, preview compatibility, lifecycle/GC/integrity, provider resilience, observability, licensing, governance and onboarding.
- Expanded to 32 requirements, 49 tasks and 29 test families; made TASK-049/TEST-027 a prerequisite of private release; optional tasks 034–037 remain post-release.
- Added six evidence templates: capacity qualification, publication review, incident, license register, review session and provider rate card.
- Added official evidence for YouTube upload/monetization constraints, resumable-upload credentials/expiry and Cloud Run filesystem behavior.
- Preserved the historical audit and all application code; all implementation tasks remain not started.
- Final pre-merge review clarified PATCH/PUT precondition errors, per-output duration maps, and publication-versus-archive wording; added a reproducible documentation-validation command.

## 0.1 — 2026-10-11

- Recorded owner-confirmed personal/YouTube-first/Urdu/long-form direction.
- Created product charter, requirements, UX, authorized source-ingestion plan, architecture, data/API/job contracts, and Urdu/media quality specifications.
- Added security/privacy, infrastructure, cost/capacity, testing/release, migration, operations, and official-source registers.
- Added a dependency-ordered roadmap and 37 proposed implementation tasks; none marked implemented.
- Added owner workflow, feature opportunity map, AI Studio session prompts, coding-agent rules, and reusable templates.
- Distinguished documented platform capabilities from account/live-provider verification still required.
- Preserved the baseline audit and application code unchanged.

Future entries should identify changed requirements/decisions and affected task/test IDs. Record the evidence for decisions, not only that wording changed.
