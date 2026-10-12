# ManhwaUrdu DubStudio

A planned private production workspace for turning authorized English manhwa recap videos—including **10–24-hour sources**—into reviewed, natural Urdu narration and validated episode/publication-part downloads.

> **Current status: implementation in progress (P1), not production-ready.** The existing application began as a prototype with confirmed security and correctness defects (see [AUDIT.md](AUDIT.md)); remediation and the durable core are being implemented task by task (see [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)). This documentation describes the intended product; completed claims appear only where test evidence is recorded.

## Start here

1. [Planning hub and document index](docs/README.md)
2. [Product charter](docs/00-product-charter.md)
3. [Requirements and acceptance criteria](docs/01-requirements.md)
4. [Development roadmap](docs/14-roadmap.md)
5. [Google AI Studio development playbook](docs/16-ai-studio-playbook.md)
6. [Current state and next actions](docs/CURRENT_STATE.md)
7. [Baseline project audit](AUDIT.md)

## Confirmed direction

- One owner / one channel first, not public SaaS.
- YouTube-link-first project intake, with an authorized source-media path for rendering.
- Urdu narration first; Urdu script and Roman Urdu for review.
- Typical long-form sources: 10–24 hours; design maximum 24 hours, with shorter inputs still supported. Duration and source byte caps are separate. Smaller fixtures and the retained 10-hour test precede the final 24-hour release gate.
- Planning and documentation completed first (OWNER-05); implementation authorized from 2026-10-11 on this repository, with development sessions following the [AI Studio playbook](docs/16-ai-studio-playbook.md) discipline.

## Intended workflow

YouTube link → rights/source check → attach authorized video → resumable upload → real transcript → reviewed episode boundaries → Urdu adaptation and glossary → voice pilot approval → resumable speech generation → timing/audio QA → episode/publication-part exports → optional archival master → downloadable project archive.

A YouTube link is not automatically a downloadable video. Do not confuse media understanding with permission or access to the original media bytes.

## The 24-hour expansion

See the [day-long capacity specification](docs/23-day-long-capacity.md) and [publication packaging plan](docs/27-publication-packaging.md). Full source/project support is separate from destination upload limits and optional archival-master generation. Large local-file uploads can require browser reopening/file reselection; accepted server jobs are independently durable.

New specifications cover large transfers, continuity, human review, preview/browser compatibility, lifecycle/GC, provider resilience, telemetry, licensing, documentation governance and owner onboarding. [The planning hub](docs/README.md) indexes the complete library.

## Repository today

React/Vite/TypeScript frontend, Express/GenAI backend, local media caches, and FFmpeg integration code. See the audit for verified installation/build results and defects. Do not expose the current server publicly or submit confidential media to the prototype.

## Working agreement

Read [AGENTS.md](AGENTS.md) before making changes. Work in small, testable tasks; keep decisions and handoffs in the repository; never substitute demo output for completed production work. No milestone is complete until its acceptance evidence exists.

Documentation version: **0.7 — 2026-10-12**. Architecture, service choices, limits, and budgets are proposals unless explicitly recorded as confirmed decisions.
