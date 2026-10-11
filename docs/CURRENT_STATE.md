# Current state and next session

**Updated:** 2026-10-11 (implementation session 1) · **Phase:** authorized implementation (P1) · **Baseline revision:** `34c6875` + TASK-004 working tree

## What is actually present

- React/Vite/TypeScript prototype (the audited code, unchanged until this session) plus the v0.2 planning library (32 REQ / 49 TASK / 29 TEST) and [AUDIT.md](../AUDIT.md) (historical; its baseline `e581f0a` is the prototype's code state).
- **TASK-004 COMPLETE (in_review):** reproducible toolchain + initial CI/tests. See evidence below and [DEC-008](decisions/DEC-008-toolchain.md).
- No paid provider calls, cloud infrastructure, deployments, or live provider benchmarks have run. `GEMINI_API_KEY` is not configured in the development environment.
- Demo/preset media remains in Git as unlabeled fixtures (quarantine is TASK-005+); it has not been modified.

## Confirmed owner intent

Personal channel tool; YouTube-link-first; Urdu; sources typically 10–24 hours with a 24-hour design maximum; shorter inputs supported. Implementation authorized 2026-10-11 with decision delegation for engineering/product choices ("YOLO mode"). **Paid services, public deployment, destructive operations, and deferred products (SaaS/cloning/panels) remain unauthorized.** DEC-001 (authorized source access) and DEC-005 (budget) are still unanswered owner questions and block TASK-002/003 and any provider work. The proposed 128 GB byte cap (DEC-010) remains unapproved/unqualified.

## TASK-004 evidence (2026-10-11, sandbox with Node 22.22.3, npx bun 1.4.3)

| Check | Exact command | Result |
|---|---|---|
| Frozen install (clean tree) | `npx bun install --frozen-lockfile` | PASS |
| npm resolution (secondary path) | `npm install --dry-run --ignore-scripts --no-audit --no-fund` | PASS (peer conflict resolved) |
| Strict typecheck | `npm run typecheck` (`tsc --noEmit`, TS 6.0.3, `strict: true`) | PASS (0 errors) |
| Lint + React Hooks | `npm run lint` (ESLint 10 + typescript-eslint 8.71 + react-hooks 7) | PASS (0 errors; 76 legacy warnings tracked; rules-of-hooks active — verified against a synthetic F06-style violation) |
| Unit/component/API smoke | `npm run test` (vitest 5.0.3) | PASS — 21/21 (srtParser 8, urduPhonetics 6, ExportModal F06 regression 2, API smoke 5) |
| Build | `npm run build` | PASS (client 357 kB / 105 kB gzip; `dist/server.js` built) |
| Built-server startup | `NODE_ENV=production node dist/server.js` | **FAIL — F05 (`Dynamic require of "path"`); owned by TASK-005, TEST-001 gate stays open** |
| CI workflow | `.github/workflows/ci.yml` (prepared) | **BLOCKED** — sandbox GitHub App lacks the `workflows` permission, so the workflow file cannot be pushed and Actions cannot run. Owner action: reconnect GitHub with the workflows scope, commit+push the file, then confirm the run (public repo; workflow has no secrets) |
| Doc validation | doc-33 structural script (updated to 53 planning docs) | PASS |
| FFmpeg/media, live provider, browser journeys | — | **NOT RUN** — need FFmpeg worker/staging, approved key+budget, browser env |

F06 (ExportModal hook order) is **fixed** with a component regression test; the fix is code-level only — TEST-016's broader playback/modal suite is still TASK-005/025 work.

## Audit status

All AUDIT.md findings remain open except **F06 (fixed + regression test in TASK-004)**. Nothing else was repaired in this slice. [docs/18-migration-audit-map.md](18-migration-audit-map.md) remains the finding→task map.

## Decisions

- **DEC-008 accepted:** Bun 1.4.3 + Node ≥22.12 + TypeScript ~6.0.3 (typescript-eslint cannot load TS 7; revisit at typescript-eslint#10940); vitest/RTL test stack; ESLint with rules-of-hooks error. Full record: [decisions/DEC-008-toolchain.md](decisions/DEC-008-toolchain.md).
- CI added on the **public** GitHub repository (no secrets, no paid calls); noted for the pending repo-visibility decision.

## Current blockers

1. **DEC-001** owner must confirm access/rights to original source files (RISK-01) — blocks the real pipeline (TASK-001/014+).
2. **DEC-005** budget and **DEC-002** cloud/billing consent — block TASK-002/003 and all paid work.
3. F01–F05, F07–F16 audit defects — TASK-005 is next and repairs the exposure/truthfulness core.
4. No FFmpeg in the dev sandbox: media checks run only in CI/staging with FFmpeg or a worker image (exact steps in the session handoff).
5. Day-long capacity, provider Urdu quality, and ₹/hour remain unmeasured (TASK-002/003/028/049).

## Next action

**TASK-005 — Repair/disable baseline blockers** (F01 path containment, F02 upload validation, F07 read-only audio access, F05/F15 server packaging + static isolation, honest missing-key/demo behavior, regression tests per fix). Then TASK-006 (owner-only auth) per the roadmap. Paid/provider tasks stay blocked on DEC-001/002/005.

## Session handoff

See [SESSION_HANDOFF.md](../SESSION_HANDOFF.md) at the repository root (per [templates/session-handoff.md](templates/session-handoff.md)). Next session: start from that record, run `npx bun install --frozen-lockfile && npm run check` to reproduce TASK-004 evidence, then execute TASK-005 only.

## Documentation checks for this update

Doc-33 structural validation re-run after adding [decisions/DEC-008-toolchain.md](decisions/DEC-008-toolchain.md) (planning-document count deliberately updated 52 → 53 in the doc-33 script). Historical v0.2 planning-validation text below is retained as a dated record.

## Historical: planning update v0.2 (2026-10-11, pre-implementation)

Added docs 23–34 and six evidence templates; extended requirements to REQ-032, tasks to TASK-049 and tests to TEST-029. TASK-030/TEST-018 remains the 10-hour intermediate gate; TASK-049/TEST-027 is the final 24-hour qualification. Documentation checks covered links, unique IDs, task dependency acyclicity/release-gate reachability, arithmetic and stale-limit searches across 52 Markdown files — planning checks only. Pre-merge review clarified PATCH/PUT revision preconditions, expected-duration validation against each part's source-to-output map, and episode/publication-package versus archival-master wording.
