# 00 — Product charter

**Status:** confirmed direction + proposed scope · **Owner:** channel owner · **2026-10-11**

## Vision

Make a dependable personal Urdu localization workstation for long-form English manhwa recap videos. The owner supplies or lawfully obtains the source, reviews AI-assisted adaptation, and controls voice, timing, cost, and release quality.

## Job to be done

“When I have a long English recap I am authorized to localize, help me produce a faithful, engaging Urdu version without manually managing thousands of audio files or restarting everything when one step fails.”

## Confirmed decisions

- One owner and their channel first; no subscriptions or public signup.
- YouTube link is the primary project-entry experience.
- Urdu narration is the launch language. Roman Urdu is an editing aid, not a substitute language.
- The owner clarified that sources can be **10–24 hours**. Design for a **24-hour maximum source timeline**, while continuing to support shorter sources and test fixtures. Duration support and upload byte limits are separate.
- This session produces plans/docs only. Development will be performed later using Google AI Studio.

## Product principles

1. **Truth over appearance:** a failed model call is failed; no sample substitution.
2. **Human-controlled automation:** approve script and a voice pilot before bulk generation.
3. **Source fidelity:** preserve events, names, numbers, causality, and chronology; hooks cannot invent plot.
4. **Recoverability:** progress survives refresh, disconnect, and process restart.
5. **Incremental work:** edits invalidate only dependent artifacts; previous valid versions remain recoverable.
6. **Cost visibility:** estimate, authorize, reserve, measure, reconcile.
7. **Private by default:** one-owner access is still enforced on every backend operation.
8. **Measured quality:** release claims are supported by fixtures and listening tests.

## Long-form v1 scope

Link intake; rights/source manifest; direct resumable source upload; optional supplied subtitles; timestamped transcription; chapter/episode planning; English/Urdu/Roman editor; pronunciation glossary; stock voice selection and pilot; resumable segment generation; timing/quality warnings; private episode/publication-part exports covering the complete project, plus optional full archival master; SRT/VTT and project archive; persisted history; cancellation/resume; usage and cost reporting; backup/restore.

Deliver short, fully working slices first, but **do not call the long-form v1 complete until the 24-hour acceptance gate passes**.

## Explicit non-goals for v1

Public SaaS, billing/subscriptions, team collaboration, voice cloning or impersonation, real-time dubbing, lip sync, video/image generation, raw-panel-to-video production, automatic YouTube publishing, arbitrary URL downloading, full NLE replacement, guaranteed monetization, and guaranteed elimination of copyright claims. Background-source separation and custom voices are optional later experiments, not hidden v1 dependencies.

## Success measures — proposed gates

- A 24-hour authorized fixture reaches validated episode/publication-part exports covering the selected timeline without loading full media into browser/server memory. Optional whole-file archival export is separately measured, not assumed uploadable to YouTube.
- Closing the browser does not interrupt durably accepted server jobs; worker failure retries only incomplete work. An unfinished local-file upload may require reopening/reselecting the file to resume.
- Every exported audio segment references approved script/settings revisions.
- No missing speech silently passes as success; every omission is blocked or explicitly approved and recorded.
- Owner rates sampled narration at least 4/5 for intelligibility, naturalness, fidelity, and pronunciation, with zero unresolved critical meaning errors.
- Editing one line regenerates that line and affected render outputs, not the entire project.
- Every project shows a cost estimate and recorded usage; no new chargeable work is scheduled beyond its approved application budget.

These are acceptance targets, not current performance claims. Processing speed, ₹/finished hour, and provider Urdu quality must be benchmarked before a delivery promise.

## Release posture

First release is private and human-reviewed. Expand feature scope only after repeated use on real authorized projects reveals a concrete need. Reliability, pronunciation, timing, and recovery have higher priority than additional dashboard animations.
