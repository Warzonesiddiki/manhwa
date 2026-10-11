# 02 — UX specification

**Status:** proposed. Keep the useful editing layout; remove misleading “complete” labels.

## Information architecture

1. **Projects:** recent jobs, source duration, readiness, actual spend/estimate, last saved time.
2. **New project:** link → rights/source options → metadata/upload inspection → budget/review.
3. **Project overview:** source access status, pipeline stages, blockers, episodes, usage.
4. **Transcript and script:** virtualized source timeline; English/Urdu/Roman columns; glossary drawer; revision history.
5. **Narration studio:** voice/profile selection, pilot, clip auditions, timing warnings, per-line regenerate.
6. **Jobs:** durable status, completed/failed counts, retry reason, heartbeat, cost, pause/resume/cancel.
7. **Export center:** choose episode or destination-valid publication package, approved revisions, audio/subtitles and quality report; optional full archival master is separate.
8. **Settings:** owner identity, provider readiness (never raw keys), usage limits, retention, glossary defaults.

## First-time experience

Explain: “Paste the YouTube link to identify your project. To export a dubbed video, attach the original file you are authorized to use.” The user can save the project before attaching media. Show source states: `link_registered`, `awaiting_source`, `uploading`, `inspecting`, `ready`, `rejected`.

Display measured duration/codec/bytes after inspection. Do not reuse the 105-second demo duration. For blocked source access, offer upload/subtitle alternatives; do not invent a transcript.

## Main workbench

- Source player drives the timeline; clock format supports `HH:MM:SS.mmm`.
- Highlight selected and currently speaking segment separately.
- Urdu input is RTL; Roman Urdu/English/timestamps are LTR. Direction is per field, not global.
- Edits show unsaved/saving/saved/conflict/error states; recovery never silently overwrites a newer revision.
- Search names, English, Urdu, Roman text, and flags; filter by unreviewed, failed, overflow, missing audio, stale.
- Actions: split, merge, correct transcript, adapt selected lines, approve selected lines, generate pilot, regenerate changed lines.
- A destructive operation shows its downstream consequences: “Changing this voice will invalidate 460 approved clips.”

## Review gates

1. Source/rights and cost estimate.
2. Transcript + glossary review before translation of each batch.
3. Urdu script approval before TTS.
4. Representative voice pilot before bulk generation.
5. Timing and flagged-output review before final render.
6. Export QA and rights/attribution checklist before manual publication.

Bulk review is allowed but recorded explicitly. “Reviewed by AI” does not equal owner approval.

## Truthful progress

Use “TTS: 147/220 clips committed; 3 need attention,” not a timer-based 90%. Duration-weighted stage progress is allowed if its formula is documented. ETA is a measured estimate with uncertainty; show “estimating” early. Phase changes can alter ETA but should not erase committed progress.

States: queued, running, waiting for review, paused, cancelling, cancelled, succeeded, failed, blocked by budget, stale due to edit. Each error includes a plain explanation, recoverable action, and reference ID; no raw provider stack traces.

## Empty/error/offline behavior

- No credentials: setup/readiness message, no fake successful synthesis.
- No transcript: attach media or import SRT/VTT.
- Missing audio: export disabled with precise segment list.
- Expired signed URL: refresh authorization, not whole-job regeneration.
- Offline editor: retain draft locally where safe, mark unsynced, resolve conflict on reconnect.
- Cancel: explain completed artifacts are retained; already accepted provider calls may still incur cost.

## Accessibility and performance

Dialog focus trap/restore, Escape, semantic labels, screen-reader live status, visible focus, contrast, reduced motion, non-color error cues. Caption toggles and keyboard seeking must not interfere with Urdu text entry. Virtualized lists preserve selection and keyboard navigation. Do not download all clip audio just to display a timeline.

## Deferred UI

Hide raw-panel creator, subscription/team features, voice cloning, automatic publishing, and NLE integrations until their real services exist. If demo mode is retained, use a prominent persistent banner and separate fixture namespace.

## v0.2: day-long UX additions

Separate upload/session progress from accepted server-job progress. A closed-browser local upload may need file reselection; never show it as still transferring. A project overview shows source-global/episode/publication-part times, step-specific waits, review backlog and days-scale ETA uncertainty.

Add a paginated review queue and resumable listening sessions with explicit coverage (doc 26), tiled previews/virtualized rows (doc 28), and package parts with measured destination validity (doc 27). “Archived master ready,” “all required publication parts ready,” and “published manually by owner” are distinct labels. Do not show a 24-hour project as one upload-ready YouTube video.
