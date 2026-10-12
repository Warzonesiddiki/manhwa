# Planning hub — build a real tool, not a larger demo

**Version:** 0.7 · **Updated:** 2026-10-12 · **Phase:** authorized implementation (P1; see [AGENTS.md](../AGENTS.md) and [CURRENT_STATE.md](CURRENT_STATE.md))

## What changed in v0.2

The owner clarified that videos can be **10–24 hours**, so the design maximum is now **24 hours (86,400,000 ms)**. Shorter inputs remain supported. A proposed **128 GB** per-file source cap is separate, still subject to approval and measurement; not every 24-hour encoding fits it.

- **Start with [23 Day-long capacity](23-day-long-capacity.md):** byte/storage/network math, quotas, work units and the support envelope.
- **Read [27 Publication packaging](27-publication-packaging.md):** 24-hour projects produce destination-valid parts; full archival master and publication-ready output are distinct.
- **New docs 24–34:** transfer/reselection/expiry, narrative continuity, human review, preview/browser compatibility, dependency-safe retention/restore, provider resilience, telemetry, licensing, governance and onboarding.
- **Expanded traceability:** 32 requirements, 49 tasks and 29 test families. TASK-030/TEST-018 stays the 10-hour intermediate proof; TASK-049/TEST-027 is the final 24-hour qualification, required before private release.
- **Implementation status:** bounded implementation tasks are underway; see the task-status log in [15 Backlog](15-backlog.md) and the latest checkout evidence in [Current state](CURRENT_STATE.md). The full media suite and CI workflow remain environment/checkout gaps. No capacity, provider, cost or legal approval is invented; see [33 Documentation governance](33-documentation-delivery-governance.md).

Scope, estimates and service choices are specifications—not claims that the current prototype supports 24-hour processing.

## The recommendation

Build a **private, human-reviewed Urdu localization studio**, not an unrestricted YouTube downloader or a one-click autonomous content factory. Keep the current interface ideas, but replace the unsafe storage, simulated ingestion, unreliable cache, and synchronous media paths.

The product should be excellent at one job: turning your authorized long-form source into natural Urdu narration with correct timing, recoverable processing, visible costs, and dependable downloads. “Perfect” becomes measurable quality gates—not a promise that AI never makes mistakes.

### What makes it genuinely useful

1. Real source-derived transcripts with uncertainty flags, not invented dialogue.
2. A project-wide character/name/pronunciation glossary.
3. Side-by-side English, Urdu, and Roman Urdu editing with autosave and revisions.
4. A short voice pilot before paying for hours of narration.
5. Durable jobs that resume after browser closure or worker failure.
6. Regeneration of only changed lines and their dependent exports.
7. Accurate source duration, episode boundaries, and audio timing.
8. Clear failure states, cost controls, and traceable source-to-export provenance.
9. Episode/multipart publication packages covering up to 24 hours, plus a separately qualified optional archival master.
10. Private storage, proper ownership checks, backups, and a restore path.

## Confirmed versus proposed

**Owner confirmed:** personal/channel use; YouTube-link-first; Urdu-first; 10–24 hour sources; Google AI Studio as the intended development workspace. Bounded repository implementation was separately authorized on 2026-10-11 per AGENTS.md; the owner's AI Studio account/import/sync path remains unverified.

**Recommended, not yet approved:** Google-oriented hosted architecture, Firebase Authentication/Firestore, private Cloud Storage, Cloud Run API and media Jobs, queue-based orchestration, numerical quality/cost/retention defaults. These require the phase-0 feasibility and budget decisions. No infrastructure has been created.

## Reading order

- **Owner:** charter → requirements → UX → cost → roadmap → open decisions.
- **AI coding session:** current state → AGENTS → relevant backlog ticket → referenced contract/spec → test plan.
- **Technical setup:** architecture → data/API/jobs → security → infrastructure → operations.

## Complete document inventory

| Document | Purpose / authority |
|---|---|
| [Current state](CURRENT_STATE.md) | Honest implementation status and next action |
| [00 Product charter](00-product-charter.md) | Vision, audience, scope, success definition |
| [01 Requirements](01-requirements.md) | Functional/nonfunctional requirements and acceptance IDs |
| [02 User experience](02-user-experience.md) | Screens, journeys, states, accessibility |
| [03 YouTube/rights/ingestion](03-youtube-rights-ingestion.md) | Source access, permissions, compliant fallback |
| [04 Architecture](04-architecture.md) | System boundaries, service choices, alternatives |
| [05 Data model](05-data-model.md) | Entities, revisions, timebase, ownership |
| [06 API contract](06-api-contract.md) | Planned endpoints, errors, versioning |
| [07 Jobs](07-job-orchestration.md) | DAG, retries, resume, cancellation, budget enforcement |
| [08 AI and Urdu quality](08-ai-urdu-quality.md) | Models, prompts, glossary, evaluation |
| [09 Media/export](09-media-and-export.md) | FFmpeg pipeline, synchronization, mixing, formats |
| [10 Security/privacy](10-security-privacy.md) | Threat model and controls |
| [11 Infrastructure](11-infrastructure-deployment.md) | Environments, cloud setup, deployment and rollback |
| [12 Cost/capacity](12-cost-capacity.md) | Cost model, storage sizing, approval thresholds |
| [13 Testing/release](13-testing-release.md) | Test matrix, quality gates, release evidence |
| [14 Roadmap](14-roadmap.md) | Dependency-ordered milestones and exit gates |
| [15 Backlog](15-backlog.md) | Small development tasks with acceptance criteria |
| [16 AI Studio playbook](16-ai-studio-playbook.md) | Import/sync workflow and copy-paste session prompts |
| [17 Decisions/risks](17-decisions-risks.md) | Confirmed decisions, proposals, unknowns, risk register |
| [18 Migration/audit map](18-migration-audit-map.md) | Current-code disposition and every audit finding's owner |
| [19 Operations](19-operations-runbook.md) | Recovery, incidents, backup, cleanup, cost response |
| [20 Source register](20-source-register.md) | Official evidence, verification date, capability caveats |
| [21 Owner workflow](21-owner-workflow.md) | Practical source-to-export operating checklist |
| [22 Feature opportunity map](22-feature-opportunity-map.md) | All recommendations prioritized into core/later/separate scope |
| [23 Day-long capacity](23-day-long-capacity.md) | 24-hour/source-byte envelope, arithmetic and qualification |
| [24 Large-file transfers](24-large-file-transfers.md) | Browser reselection, upload expiry, protected sessions and ranged downloads |
| [25 Continuity/editing](25-continuity-and-editing.md) | Source-backed narrative memory, glossary impact and timeline lineage |
| [26 Human review](26-human-review-operations.md) | Workload, approval scope, listening/sample coverage and issue gates |
| [27 Publication packaging](27-publication-packaging.md) | Destination limits, multipart outputs and source-to-part maps |
| [28 Preview/compatibility](28-preview-compatibility.md) | Bounded previews, browser/codec matrix and day-long accessibility |
| [29 Lifecycle/integrity/recovery](29-lifecycle-integrity-recovery.md) | Reference-safe GC, atomic artifacts, backup/media integrity and restore |
| [30 Provider resilience](30-provider-reliability.md) | Capability snapshots, quotas, multi-day expiry and change policy |
| [31 Observability/objectives](31-observability-service-objectives.md) | Stage metrics, actual costs, wait times, operational evidence |
| [32 Licensing/compliance](32-licensing-and-compliance.md) | Software/image/codec/font/voice/source obligations and review |
| [33 Delivery governance](33-documentation-delivery-governance.md) | Remaining factual artifacts, change-impact rules and AI context packs |
| [34 Onboarding/support](34-onboarding-configuration-support.md) | Configuration/readiness states and owner troubleshooting |
| [Changelog](CHANGELOG.md) | Documentation changes |
| [DEC-008 toolchain pin](decisions/DEC-008-toolchain.md) | Accepted: Bun/Node/TypeScript/lint/test toolchain for implementation |
| [DEC-011 owner auth](decisions/DEC-011-auth.md) | Accepted interim: OWNER_TOKEN → signed HttpOnly session; fail-closed |
| [Feature template](templates/feature-spec.md) | Specify a new feature before coding |
| [Task template](templates/ai-task.md) | Bound one coding-agent request |
| [Handoff template](templates/session-handoff.md) | Preserve context across sessions |
| [Decision template](templates/decision-record.md) | Record consequential choices |
| [Experiment template](templates/experiment.md) | Measure uncertain provider/infrastructure capabilities |
| [Release template](templates/release-checklist.md) | Collect release evidence |
| [Capacity report template](templates/capacity-qualification.md) | Record actual duration/byte/quality/fault qualification |
| [Publication review template](templates/publication-package-review.md) | Verify package coverage, limits and owner approval |
| [Incident template](templates/incident-report.md) | Confirm impact, recovery and regression work |
| [License register template](templates/license-register.md) | Track actual component/media obligations |
| [Review log template](templates/review-session-log.md) | Preserve exact listening/script approval scope |
| [Provider/rate-card template](templates/provider-rate-card.md) | Capture dated capability, quota, pricing and account evidence |
| [Baseline audit](../AUDIT.md) | Verified current-code findings |

## Documentation governance

These are living specifications, not proof of implementation. Requirements use `REQ-*`, tests `TEST-*`, tasks `TASK-*`, decisions `DEC-*`, and risks `RISK-*`. Keep those IDs stable. A change to a requirement must update its tests, dependent tasks, and decision record. Never silently convert a proposal into an approved decision.

Contract authority: requirements define behavior; data/API/jobs define technical invariants; roadmap orders delivery; backlog lists execution units. If documents disagree, stop and record a decision rather than selecting whichever is easier to implement.

Still absent or unverified in this checkout: a CI workflow, deployment/migration/infrastructure artifacts, a containerized FFmpeg worker, real secrets, provider pricing/capability evidence, and final privacy/legal notices. The executable OpenAPI/validators (TASK-008) and application regression suites already exist; the remaining planned test families do not prove provider quality or long-form capacity.

Do not paste this entire library into every model request. Use the short session brief plus only the documents relevant to one task.
