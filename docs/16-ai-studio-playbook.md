# 16 — Google AI Studio development playbook

**Status:** instructions for later development. Do not execute setup, paid calls, or implementation during the current planning phase.

## What the platform supports versus what we must build

Google's current Build documentation describes React/Node full-stack apps, server-side secrets, repository import/two-way GitHub sync, ZIP export, and Cloud Run deployment. Confirm these features in the owner's actual account before adopting a workflow. [1](https://ai.google.dev/gemini-api/docs/aistudio-build-mode)

The documented import path is Build → Add files (+) → Import from GitHub; Settings → GitHub handles linking/pull/push. UI and availability can change. If branch selection/import is unavailable, do not overwrite the source repository: use a reviewed export/import path and reconcile through Git. [1](https://ai.google.dev/gemini-api/docs/aistudio-build-mode)

A working preview does not prove persistent storage, authorization, FFmpeg installation, deployed job recovery, or 24-hour feasibility. Those have separate tasks and tests.

## Preparation checklist

- Preserve an immutable repository checkpoint containing the baseline audit and planning docs.
- Confirm the intended repository/revision before import; avoid simultaneous divergent edits in multiple tools.
- Read CURRENT_STATE, charter, requirements, roadmap, and audit.
- Use non-sensitive rights-cleared fixtures in development chat.
- Approve provider/cloud budgets and data terms before configuring paid services.
- Secrets go through AI Studio/platform settings or deployment secret management, not a chat message, source file, or custom browser key form. Official docs describe server-side secrets and external database connections. [2](https://ai.google.dev/gemini-api/docs/aistudio-fullstack)
- Decide how tests unsupported in the preview will run in CI/staging.

## Copy-paste: initial orientation (no coding)

```text
We are planning a private, single-owner Urdu localization tool for authorized
English manhwa recap sources lasting 10–24 hours. YouTube-link-first is intake,
not permission to download arbitrary YouTube videos. Read AGENTS.md,
docs/CURRENT_STATE.md, docs/00-product-charter.md, docs/14-roadmap.md,
and AUDIT.md. Read other specs only as needed.
Do not modify application code, install services, run paid calls, or deploy yet.
Summarize the actual repository state, the proposed architecture, the top
blockers, and unanswered decisions. Distinguish confirmed user decisions,
proposals, and facts verified in this environment. Propose only the next
bounded task and its acceptance tests. Wait for approval.
```

## Copy-paste: authorize one implementation task

```text
Implementation is authorized for TASK-[chosen ID] only.
Read its backlog entry and relevant requirements/contracts/test cases.
First state the goal, dependencies, planned files, acceptance tests,
security/cost impact, and questions. Do not expand scope or silently swap
providers, source media, or cloud services. Preserve project work.
Implement the smallest complete slice with truthful failures and regression
tests. Run the available checks. Identify tests that need CI/staging and do
not claim them passed. Inspect the final diff, update docs/CURRENT_STATE.md
and the task status with evidence, then write a session handoff.
Never commit secrets or user media. Do not deploy or run paid work unless
that action and its budget are separately approved.
```

## Copy-paste: audit a completed slice

```text
Review only the completed TASK-[ID] against its acceptance criteria,
AUDIT.md regressions, and the applicable API/data/jobs/security specs.
Check whether failures are truthful, GET/HEAD are side-effect free,
resource access is authorized, job state is durable, and generated artifacts
are tied to the correct approved revisions. Report issues with file/line
references and reproduction steps. Do not change code until I approve fixes.
```

## Copy-paste: end-of-session handoff

```text
Update the current-state document and use the session-handoff template.
List exact files changed, checks actually executed and their outcomes,
provider calls/spend, decisions made, remaining risks, and one next task.
Do not label a milestone done unless its exit gate has recorded evidence.
Include how to reproduce or roll back this change. Do not include secrets.
```

## Working cycle

1. Pull/import the reviewed checkpoint; verify revision and clean diff.
2. Select one ready backlog task; attach the relevant short specs.
3. Ask for the implementation plan before edits.
4. Review file scope and explicit costs; authorize only that task.
5. Implement → test → inspect diff → review edge cases.
6. If infrastructure/credentials prevent testing, stop with a documented blocker; no mock success.
7. Save a checkpoint through the available reviewed repository/export mechanism.
8. Update handoff and current state; start the next session from that record.

## Context management

Do not paste all documents on every turn. A typical UI task needs current state, requirements, UX, and its tests; a worker task needs architecture, data/jobs, media, security, and tests. Keep model prompts/versioned fixtures in files, not only chat history. When chat context degrades, open a new session with the handoff and the next task.

## Deployment rule

The app/control plane may be developed and deployed with AI Studio; production media processing can require separately configured cloud jobs/storage or a VM worker. If the owner requires everything to run solely inside an unmodified preview container, pause and revisit scope—do not promise long-form reliability without measurements.

## v0.2 mandatory orientation addendum

Read docs 23–34 for the updated day-long design. The owner expects 10–24-hour sources; 24-hour qualification is TASK-049/TEST-027, while the earlier TASK-030/TEST-018 remains a 10-hour intermediate gate. Required tasks now include TASK-038–049; optional TASK-034–037 still come after release despite numeric ordering.

Do not solve larger inputs by changing one constant. Trace the impact across transfer credentials/bytes, worker scratch, quotas/expiry, narrative continuity, human review, waveform/list virtualization, media/container math, publication maps, cleanup and final qualification. Use the relevant small context pack from doc 33, not the entire library in one prompt.
