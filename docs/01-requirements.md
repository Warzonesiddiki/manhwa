# 01 — Product requirements and acceptance criteria

**Status:** proposed v1 contract; not implemented. Direction confirmed in the charter.

## Requirement catalog

| ID | Requirement | Acceptance evidence |
|---|---|---|
| REQ-001 | Private owner access | Unauthenticated requests fail; another authenticated identity cannot access projects, jobs, or media. |
| REQ-002 | YouTube-link-first intake | Valid watch/short/youtu.be links normalize to a video ID; invalid links fail clearly; a project can wait for authorized source media. |
| REQ-003 | Source provenance | Source, rights declaration, permitted uses, attribution, and known restrictions are stored before chargeable media processing. A declaration is not represented as legal proof. |
| REQ-004 | Large resumable upload | Upload bypasses the API payload path; pause/network loss resumes; checksum, actual media type, measured duration, and size are validated. |
| REQ-005 | Durable projects | Reload restores source, timeline, edits, approvals, job status, and artifact versions. Export/import reconstructs a project without depending on an old signed URL. |
| REQ-006 | Real transcript | ASR reads actual source audio or a supplied transcript; uncertain spans are reviewable; every span has source-relative timestamps. No invented fallback. |
| REQ-007 | Episodes and processing shards | Episode boundaries cover the source exactly once; user can adjust boundaries; processing chunks are independent of publishable episodes. |
| REQ-008 | Urdu adaptation | English, Urdu script, Roman Urdu, notes, and glossary terms are editable together; names/numbers/plot remain faithful. |
| REQ-009 | Revision control | Autosave has visible saved/error state; stale concurrent edits return conflict; edits invalidate affected approvals/audio/exports. |
| REQ-010 | Glossary and narration profile | Per-project spelling, pronunciation hints, stock voice/model/style versions persist; intentional changes are versioned. |
| REQ-011 | Voice pilot | Owner hears a short real sample from representative approved lines before bulk generation; pilot settings match bulk settings. |
| REQ-012 | Accurate TTS artifacts | Cache key includes speech text and all effective voice/model/style settings; changing any speech-affecting value creates a new artifact. |
| REQ-013 | Reliable jobs | Durably accepted server work survives browser closure; unfinished browser uploads have separate resume semantics. Crash recovery uses leases/checkpoints; duplicate delivery does not duplicate committed artifacts. |
| REQ-014 | Cost and control | Estimate precedes paid execution; budget reservation is atomic; pause, resume, cancel, and bounded retry are available. |
| REQ-015 | Timing and audio QA | Measured clip duration is compared to its time window; overflow, clipping, wrong format, silence, or missing audio blocks release until resolved. |
| REQ-016 | Correct rendered media | Original selected source/range is used; output has the expected Urdu audio and duration; no sample substitution or silent truncation. |
| REQ-017 | Export package | Required episode/publication-part MP4 package covers all selected source ranges; optional archival full master is separate. Supported audio master, SRT/VTT, chapters, JSON manifest and QA have checksums/revision provenance. |
| REQ-018 | Honest states | Progress reflects committed work; failed, blocked, stale, demo, and partially complete are distinguishable. |
| REQ-019 | Private media lifecycle | Signed media access, range support, expiry, deletion, backup, and restore are tested. Raw source remains private. |
| REQ-020 | Reviewable quality | All script is approved; automated media checks cover all segments; owner reviews flagged spans and a stratified listening sample before final export. |
| REQ-021 | Safe operation | Bounded memory/CPU/storage/model concurrency; readiness distinguishes missing providers/FFmpeg/storage from live HTTP service. |
| REQ-022 | Accessible editing | Keyboard control, named buttons, dialog focus handling, RTL text, and accurate long-duration time display work. |

## Day-long extensions (v0.2)

| ID | Requirement | Acceptance evidence |
|---|---|---|
| REQ-023 | True 24-hour source support | Process the inspected 86,400,000 ms boundary under an approved resource profile; reject larger/over-byte-cap input; maintain 24:00:00 time display without wrapping. |
| REQ-024 | Recoverable large transfers | Browser close/reopen, file reselection, session expiry, immutable ranged download and checksum failures behave truthfully without full-file RAM buffering. |
| REQ-025 | Multi-day provider continuity | Quotas, file/token expiry, outages, unknown charges and changed capabilities are handled with checkpoints and explicit reapproval, not silent fallback. |
| REQ-026 | Narrative consistency at scale | Source-backed glossary/context survives late-hour adaptation; term edits identify only dependent speech/render work and retain lineage. |
| REQ-027 | Review workload and coverage | Persist review sessions and exact revision/range approvals; distinguish full listening, sampling and unreviewed content; unresolved critical issues block release. |
| REQ-028 | Destination-aware publication package | Complete selected source coverage across valid parts; actual bytes/duration obey profile; local captions/chapters and source-to-part maps are checked. |
| REQ-029 | Bounded day-long preview | Navigate hour 23 with virtualized transcript/tiled waveform/proxy media without loading all source/audio; documented browser/RTL matrix passes. |
| REQ-030 | Reference-safe data lifecycle | GC respects active/paused/review/pinned dependencies; late writes/deletes are fenced; archive/restore verifies media bytes and metadata. |
| REQ-031 | Actual license/compliance inventory | Review real software/container/codec/font/voice/source obligations and owner-approved data use before release; no implied legal/monetization certification. |
| REQ-032 | Honest onboarding, telemetry and scale claims | Readiness distinguishes configured/tested/scale-qualified; measured cost/wait/recovery/review evidence supports claims and owner limits. |

## Proposed launch constraints

- Source duration: up to **86,400,000 ms (24 hours)**; reject invalid, non-finite, or larger values until explicitly supported.
- Upload cap: initially **128 GB per source**, subject to storage/transfer tests. This is a proposed application limit, not an approved provider capability. It fits some, not all, 24-hour encodings; see the capacity spec. Show both duration and byte limits before upload.
- One active project pipeline per owner initially; independently bounded worker/model concurrency.
- ASR processing chunks: initial benchmark range **5–10 minutes**, with short overlaps and deterministic deduplication.
- Narration units: semantic sentences/paragraphs, initially roughly **10–30 seconds**, subject to model duration limits and voice continuity tests.
- Publishable episodes: typically 15–30 minutes, user adjustable; short final episode explicitly allowed.
- No invented time/size estimates when metadata is unavailable; display “awaiting inspection.”

## Nonfunctional targets

| Area | Proposed target and measurement |
|---|---|
| UI responsiveness | Normal edit/status interactions remain responsive while a 24-hour job runs; virtualize thousands of transcript rows. |
| API | Job submission returns promptly after durable acceptance; no render/transcribe operation waits for completion in a browser HTTP request. Initial p95 target <2 seconds excluding cold starts/upload, measured in staging. |
| Progress | Refresh status approximately every 5–15 seconds while active, back off when idle; show last heartbeat and stale worker warnings. |
| Durability | Persist job transitions and artifact references before reporting success. Draft changes save within 2 seconds after idle under normal connectivity; show unsaved state offline. |
| Security | No unresolved critical/high security finding at release. |
| Audio timeline | Automated no-overflow/no-missing-media checks; actual output duration differs by ≤250 ms from the expected duration derived from that output's approved source-to-output map, including any approved inserted or retimed spans. Do not compare an individual part with the entire source duration. |
| Recovery | Proposed metadata RPO ≤24 hours and private-beta RTO ≤24 hours; demonstrate a restore before accepting them as achieved. |

## Core acceptance journey

Create a project from a link → attach a rights-cleared source → interrupt/resume upload → transcribe → correct a name → set glossary → review/adapt → approve a pilot → start batch → close browser → simulate worker failure → reopen/resume → change one line → approve corrected timing → render episode → package all selected source into destination-valid parts → optionally render archival full master → verify playback/subtitles/maps → archive → restore. Repeat scale qualification through 24 hours with multi-day expiry/failure tests.

All numerical targets are initial design hypotheses. Changing them requires an updated decision, test, and user-facing limit—not a silent fallback.
