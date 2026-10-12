# 14 — Dependency-ordered development roadmap

**Status:** dependency-ordered execution plan; implementation is authorized and P1 is in progress. Phase exit gates remain unmet unless evidence is recorded in [CURRENT_STATE.md](CURRENT_STATE.md). Effort labels are relative, not dates or delivery promises.

## Strategy

Design for 24 hours from the outset, prove small complete slices, then validate the full promised scale. Do not build all screens first and discover later that speech quality, source access, or worker storage cannot support the product.

| Phase | Outcome | Scope / tasks | Exit gate |
|---|---|---|---|
| P0 — Feasibility and decisions | Know the product can work within rights, quality, cost and runtime constraints | TASK-001–003; owner source/budget approval; Urdu/provider benchmark; long-source worker/storage spike; AI Studio round-trip | Real pilot reviewed; authorized source path demonstrated; measured cost model; worker strategy and stack decision recorded |
| P1 — Safe engineering foundation | Current prototype no longer hides failures or exposes unsafe file operations | TASK-004–008; pin toolchain, tests, built-server fix, modal fix, disable false demos, auth, persistence, shared contracts | Build AND built-server smoke pass; no unsafe old routes publicly reachable; owner-only project survives reload |
| P2 — Durable source and execution core | Upload/inspect/resume and job ledger work before model scale-up | TASK-009–013; object upload, media inspection, dispatch/leases, cancellation, cost reservation | Interrupt upload and kill worker; recover without losing committed results or bypassing budget |
| P3 — Real script workflow | Actual source becomes reviewed Urdu script | TASK-014–017; ASR/subtitles, context/episodes, glossary/adaptation, editor | 10-minute real source has accurate timeline, glossary, editable faithful Urdu, persisted approvals |
| P4 — Real speech and episode export | One fully working end-to-end localization slice | TASK-018–025; proper caching, pilot approval, audio normalization, timing, render, jobs UI, captions/player | 10-minute fixture produces correct playable Urdu video; edits regenerate only dependencies; no fake completion |
| P5 — Day-long recovery and scale | 1/3/10-hour proofs, then 12/18/24-hour qualification | TASK-028–030 and mandatory TASK-038–049 extensions; capacity, transfer, continuity, review, lifecycle, preview, packaging, compatibility, and failure tests | TEST-027: 24-hour project processed and correctly packaged; bounded resources, multi-day recovery, review and actual-cost evidence |
| P6 — Private production readiness | Safe, durable daily use | TASK-026–027, 031–033 plus mandatory TASK-038–049; all expanded gates, lifecycle, archive/restore, CI/infra, operations, final acceptance | Security + restore + rollback + long-form gate pass; owner accepts cost/quality/retention; private deployment |
| P7 — Evidence-led enhancements | Improve actual workflow pain, not demo breadth | TASK-034–037 and approved feature specs | Each optional feature has its own rights, cost, quality, and regression gate |

## Important sequencing details

- P0 verifies AI Studio can import/sync the repo and that worker operations can run in the chosen deployed environment. Do not assume all cloud setup is done by a generated frontend.
- P1 can introduce safe interfaces while legacy endpoints are disabled. Do not preserve unsafe behavior merely for backward compatibility.
- P2 job infrastructure exists before bulk TTS. P4's small fixture already uses the real durable architecture, not a throwaway synchronous shortcut.
- CI begins in P1; full deployment automation completes in P6.
- Signed media access starts with upload/storage tasks; P6 completes retention/rotation/restore hardening, not the first authorization check.
- P5 scale tests include real representative language evaluation as well as economical synthetic stress fixtures. Long-duration and near-byte-cap tests are independent; one cannot substitute for the other.
- P7 is not required for v1; raw-panel creation, SaaS, and cloning remain separate product decisions.

## Placement of the v0.2 extensions

- Revisit P0 source sizes, network, provider quotas and worker scratch for 24-hour inputs; TASK-003 must use representative large-byte media, not only a long low-bitrate loop.
- TASK-038 follows contracts/budget setup; TASK-039 extends P2 transfer; TASK-045 extends P3 continuity; TASK-041/042/044 extend P4 providers/review/preview.
- TASK-040/043 extend P5 package/lifecycle once their prerequisites exist. Run TASK-031/032 and TASK-046/047 **before** TASK-048/049; operational readiness is an input to qualification, not a task to do after declaring success.
- P5's final qualification and P6's release are blocked on TASK-049. The 10-hour TASK-030 stays as an intermediate proof. Optional tasks 034–037 are not part of this dependency chain.
- Upload completion before browser closure and server-job continuation after durable acceptance are different acceptance cases.

## Original implementation sequence (historical; consult CURRENT_STATE.md for the active next step)

1. Owner approves unanswered source/budget/stack decisions; execute only TASK-001 feasibility setup.
2. Execute TASK-002 Urdu benchmark with a small approved spend; store results, do not extrapolate blindly.
3. Execute TASK-003 long-source worker spike and choose architecture.
4. TASK-004 toolchain/test baseline.
5. TASK-005 audit blockers and honest demo isolation.
6. TASK-006 owner authorization; then TASK-007 project persistence and TASK-008 contracts.

Each task may take multiple bounded coding sessions. At every session end, record what actually ran, update the handoff, and leave one next task. Avoid a single “build the entire roadmap” prompt.

## Stop/go checkpoints

**Stop** if authorized source access is unavailable, Urdu pilot quality is unacceptable, budget is unapproved, required providers are inaccessible, or the worker cannot process safely within limits. Resolve the constraint before building more interface features.

**Go** only with evidence: short source-to-export correctness before long runs; successful recovery before unattended multi-day work; security/backup/cost controls before production.
