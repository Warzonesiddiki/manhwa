# Documentation changelog

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
