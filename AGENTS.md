# Instructions for coding agents and future AI Studio sessions

## Phase and authority

This repository is currently in **planning/documentation mode**. Do not change application code, install infrastructure, run paid jobs, or deploy unless the owner explicitly authorizes implementation. A roadmap ticket is not execution permission.

Read `docs/CURRENT_STATE.md`, `docs/README.md`, and the selected task's referenced specs before acting. Owner-confirmed product direction is in `docs/00-product-charter.md`; unapproved choices are in `docs/17-decisions-risks.md`. The baseline audit records current defects, not intended behavior.

## Non-negotiable product rules

- Private single-owner, Urdu-first, long-form, YouTube-link-first intake.
- A link does not grant download rights. No unauthorized source acquisition or access-control bypass.
- Demo content must be visibly labeled and isolated. No fake transcripts, placeholder tones reported as speech, fabricated progress, or silent sample-video substitution.
- Browser closure must not cancel durable server jobs. Unfinished local-file uploads have separate browser/reselection/session-expiry behavior. Production rendering is not a browser MediaRecorder operation.
- Secrets stay server-side. Never ask for keys in chat, commit credentials, or place private media in Git.
- Client identifiers are not filesystem paths. Every resource access is authorized.
- Never use one model call or an in-memory full-duration PCM buffer for a 24-hour project.
- Do not claim a provider/model is available without a current capability check and recorded result.

## Task discipline

1. State the task ID, goal, relevant documents, planned files, and acceptance tests.
2. Identify unknowns and contradictory requirements before implementation.
3. Implement one vertical slice; do not redesign the whole app opportunistically.
4. Run available checks and clearly distinguish passed, failed, and not run.
5. Inspect the diff for secrets, unrelated edits, generated artifacts, and dependency churn.
6. Update task status, decisions if changed, and the session handoff.
7. Stop and ask before adding paid services, widening permissions, replacing the package manager, changing public contracts, performing destructive migrations, or substantially expanding scope.

## Engineering rules for the implementation phase

- Separate client assets, API, worker, shared contracts, and provider adapters.
- Validate request schemas and model outputs; use explicit finite bounds and typed errors.
- Use immutable artifact revisions, content/settings-based keys, and optimistic concurrency.
- Jobs require durable state, idempotency, leases/fencing, bounded retries, cost controls, and cancellation.
- A provider timeout is an unknown outcome, not evidence that no charge occurred.
- No secret-bearing logs, raw provider error dumps, arbitrary URL fetches, or shell command concatenation.
- Pin one supported runtime and package manager after the compatibility spike; keep its lockfile coherent.
- Prefer small modules and automated security/media/UI tests over visual polish.
- Maintain rollback and data compatibility; never delete existing work as a shortcut.

## Completion evidence

Use `docs/templates/session-handoff.md`. Report exact commands and outcomes, fixture/job IDs, outstanding risks, and the next bounded task. If tests cannot run in AI Studio, say so and require verification in the deployment/test environment. A successful preview is not production acceptance.

## Day-long scope guardrails

The source target is now **up to 24 hours** (owner expects 10–24), not the old 10-hour ceiling. Read docs 23–34 when working on scale, transfer, continuity, review, packaging or operations. TEST-018 is intermediate; TEST-027/TASK-049 is the final 24-hour qualification and gates TASK-033.

Source duration, upload byte limit, worker attempt duration, project wall time, and destination publication limit are separate. Do not label a 24-hour archival master as YouTube-uploadable. Do not promise upload continuation after browser closure, unlimited source size, overnight completion, perfect Urdu, or proven capacity without evidence.
