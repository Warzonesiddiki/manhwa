# 17 — Decisions, open questions, and risks

**Status:** live planning register · **2026-10-11**

## Confirmed owner direction

| ID | Confirmed decision | Evidence |
|---|---|---|
| OWNER-01 | Personal / own-channel first | Owner selected personal use in planning questions |
| OWNER-02 | YouTube-link-first intake | Owner selected YouTube workflow |
| OWNER-03 | Urdu at launch | Owner selected Urdu-first |
| OWNER-04 | Sources may be 10–24 hours; 24-hour design target | Owner explicitly expanded source duration in the follow-up planning request; supersedes the earlier 10-hour target |
| OWNER-05 | Documentation-first direction and Google AI Studio as intended workspace; bounded repository implementation was separately authorized on 2026-10-11 per AGENTS.md | Owner request plus the later implementation authorization |

## Proposed technical/product decisions

Nothing in this table is approved merely because a recommendation is written here.

| ID | Decision needed | Recommendation | Decision gate / owner |
|---|---|---|---|
| DEC-001 | Authorized source acquisition | Link as project reference + owner-uploaded original; optional authorized captions later | Owner must confirm actual source-file access before P0 closes |
| DEC-002 | Hosting/database/worker/storage | React/Node control plane; Firestore/private Cloud Storage; Cloud Run Jobs if measured viable, VM worker fallback | Owner approves cost; TASK-001/003 evidence |
| DEC-003 | ASR/adaptation/TTS providers and models | Versioned adapters; test Google options first, no model selected without account test | TASK-002; owner approves alternatives/data use |
| DEC-004 | Voice, accent, narration style, Urdu quality gate | One consistent stock voice; representative pilot; ≥4/5 quality targets | Owner audition/evaluation |
| DEC-005 | Budget/throughput | Monthly and project INR caps; one active pipeline initially | Owner input before paid work |
| DEC-006 | Output audio/background | Urdu-only default, optional licensed music stem; separation deferred | Owner review of real output |
| DEC-007 | Retention/privacy/region | Private storage, draft lifecycle in security spec, non-sensitive development fixtures | Owner data/privacy/region approval |
| DEC-008 | Runtime/package manager/AI Studio sync | Pin one supported toolchain; test import + reviewed sync; fix current npm peer conflict intentionally | TASK-001/004 |
| DEC-009 | Default episode/render quality | 15–30 min suggested episodes; preserve source timing; 1080p only when source/profile justify it | Pilot and source inventory |
| DEC-010 | Upload/duration/resource limits | 24 hours / proposed 128 GB per source; independent byte and duration validation; bounded workers/scratch | TASK-003/028; limits displayed to owner |
| DEC-011 | Authentication/session pattern | Owner allowlisted identity; verified backend access on every resource | TASK-006 security review |

## Additional v0.2 decisions — not approved yet

| ID | Decision needed | Recommendation | Gate |
|---|---|---|---|
| DEC-012 | Day-long publication packaging | Complete source coverage via episodes/destination-valid parts; full archival master optional | Owner output preference + TASK-040 measurements/current destination profile |
| DEC-013 | Human review capacity and coverage | Saved review sessions, all script approved, flagged/boundary listening plus disclosed sampling plan | Owner availability and native Urdu review plan; TASK-042 |
| DEC-014 | Active/paused artifact holds and GC | Reference-safe cleanup, reviewed destructive dry run, explicit backup/media coverage | TASK-043 restore/race evidence |
| DEC-015 | Actual licenses/provider/media obligations | Inventory actual versions/assets; no assumed clearance from public availability | TASK-046 review |
| DEC-016 | Large-transfer/resume support | Bounded direct upload with protected session credential and reselection/expiry UX | TASK-039 account/browser/protocol tests |

OWNER-04's 24-hour timeline requirement is confirmed. The proposed 128 GB byte cap, exact output part sizes, provider/cloud stack, review sampling and budgets are still recommendations requiring approval. Shorter projects remain supported.

## Questions requiring the owner's answers

**Before paid implementation:**
1. Can you obtain original/local video files for the YouTube links you want to dub? Are they your own or licensed for Urdu localization and distribution?
2. What is the monthly budget in INR, and the maximum acceptable spend for a 24-hour project?
3. How many projects per month, and what are typical resolution, bitrate/file size, and source language?
4. Is Google Cloud billing acceptable for private storage and media workers? Are you open to another provider if Urdu quality is demonstrably better?

**Before pilot/output approval:**
5. Preferred narrator character/accent/energy? Provide a style description or rights-cleared references, not an impersonation requirement.
6. Is removing the original mixed audio acceptable, or do you have separate music/effects stems?
7. Do you want short episodes or longer destination-valid parts by default, and do you also need a full archival master? A 24-hour archival file is not assumed to be one upload-ready publication.
8. Is original visual timing mandatory, or may selected stretches be explicitly retimed?

**Before production:**
9. Acceptable multi-day job duration, raw-media retention, confidentiality, and restore expectations?
10. Who reviews Urdu quality, and can they approve difficult names/pronunciations consistently?

## Risk register

| ID | Risk | Likelihood / impact | Mitigation / stop condition |
|---|---|---|---|
| RISK-01 | No permitted source bytes despite a public link | High / critical | Resolve DEC-001 before full pipeline; never promise downloader capability |
| RISK-02 | Urdu voice quality inconsistent across thousands of clips | Medium / high | Pilot + 30-passage benchmark, profile consistency, boundary review; alternative adapter only with approval |
| RISK-03 | Ten-hour work exceeds budget/quota | High / high | Dated rate card, atomic caps, concurrency limits, incremental cache, cost ladder |
| RISK-04 | Worker scratch/memory insufficient for large sources | High / high | Real seek/render/upload spike; bounded streaming; VM fallback decision |
| RISK-05 | Worker/provider failure repeats paid work | Medium / high | Attempt ledger, idempotency, fencing, uncertain-outcome reconciliation |
| RISK-06 | AI invents events or mistranslates names/negation | Medium / high | Real source spans, glossary, semantic QA, owner script approval |
| RISK-07 | Timing corrections degrade meaning or voice | Medium / high | Limited stretch, approved rewrites, explicit overflow review; no silent truncation |
| RISK-08 | Confidential media enters development/model logs | Medium / high | Fixture-only development, provider terms review, minimal logging, private storage |
| RISK-09 | Vibe coding creates inconsistent architecture or loses context | High / high | AGENTS, contracts, small tasks, diffs, tests, handoffs, decision log |
| RISK-10 | AI Studio capabilities/quotas change | Medium / medium | Reverify current docs/account; keep portable Node/React and external durable data |
| RISK-11 | Source audio contains inseparable English narration/music | High / medium | Urdu-only baseline; licensed stems; no promise of perfect separation |
| RISK-12 | Native Urdu caption shaping breaks in exports | Medium / medium | Test actual worker fonts/libass/rendered output, not just browser CSS |
| RISK-13 | Scope expands into SaaS/panels before core works | High / high | Explicit v1 non-goals and separate feature approval |
| RISK-14 | Security repair overlooked after attractive UI work | High / critical | Audit map, regression tests, security release blockers |

For each accepted decision, create a dated record using the template with alternatives, reasons, evidence, consequences, and revisit trigger. Do not erase superseded decisions; link the successor.

## Additional day-long risks

| ID | Risk | Mitigation / stop condition |
|---|---|---|
| RISK-15 | A 24-hour archival video is mistaken for destination-uploadable output | Destination profile, actual post-render validation and parts; TEST-023 |
| RISK-16 | Upload takes longer than a workday; browser/session/file changes | Honest browser resume/reselection, credential expiry protocol, bandwidth estimates; TEST-019 |
| RISK-17 | Review fatigue allows late-hour meaning/name errors | Saved review sessions, issue priority, source-backed context, disclosed coverage; TEST-021/022 |
| RISK-18 | Quota waits/model/file expiry span days | Capability snapshots, durable rescheduling, no silent fallback; TEST-026 |
| RISK-19 | TTL cleanup deletes paused/review inputs | Reference roots/holds and GC race tests; TEST-024 |
| RISK-20 | Sample count/time-of-day overflow and rounding drift | Rational/sample time math, explicit day endpoint and package maps; TEST-020 |
| RISK-21 | Byte cap, network/disk and derivative storage underestimated | Independent duration/byte admission and resource benchmarks; TEST-019/027 |
| RISK-22 | Many documents create inconsistent or falsely implemented promises | Stable IDs, dependency/link/arithmetic checks and current-state handoff; doc 33 |
