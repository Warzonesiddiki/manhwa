# 25 — Story continuity, timeline edits, and revision propagation

**Status:** proposed domain extension for day-long narratives; not a second content-generation product.

## Long-form failure modes

A model can change a character's name at hour 15, confuse a flashback with chronology, leak later plot into an early episode, translate the same attack differently, or duplicate sentences at transcription boundaries. More context is not automatically a solution: source-grounded, versioned memory and deterministic timelines are required.

## Context hierarchy

- **Source evidence:** immutable transcript spans linked to actual media offsets.
- **Project glossary:** canonical names, ranks, factions, attacks, places, Urdu/Roman spellings, pronunciation variants and approvals.
- **Narrative state:** source-backed facts and event summaries valid *through a specific timestamp*, not an all-knowing plot rewrite.
- **Episode context:** local arc summary, relationships, approved terms, unresolved ambiguities.
- **Adjacent context:** bounded previous/next spans for pronouns and transitions; target segment IDs unchanged.

Each context item records source span references, revision, effective time range and review state. AI-generated summaries are derivative notes, not stronger evidence than the source. Contradictions generate flags. Treat all source text as untrusted data, not agent instructions.

## Glossary updates without unnecessary regeneration

Track which terms and transformations affect each effective `ttsText`. Correcting one name identifies impacted lines across the project; owner previews count/cost before regeneration. A metadata-only note does not invalidate every clip. Global voice/model/style changes do invalidate affected speech; show impact explicitly.

Provide alias and collision review: two similar Roman spellings may be different characters. Do not globally replace strings across Urdu morphology or unrelated names without a preview and undoable revision.

## Timeline edit policy

V1 preserves original visual timing. Segment split/merge/text correction is supported with lineage. Project-wide source removal/reordering or complex retiming is **not** silently added as an NLE feature; propose it separately if needed.

For each accepted change:
1. Validate timestamp bounds and exact referenced source revision.
2. Create a new immutable segment/episode revision; never mutate committed export inputs.
3. Revoke only dependent approvals/artifacts according to effective input changes.
4. Show estimated regenerated clips, episode mixes, publication parts and full-master implications.
5. Preserve prior valid versions and allow explicit rollback before deleting anything.

Source-global `[startMs,endMs)` is canonical; episode-local and publication-local maps are derived. Source-hour 24 must display as `24:00:00.000`, not roll to midnight or zero. Never use JavaScript Date or time-of-day fields for duration math. Test signed/unsigned 32-bit sample-count overflow and avoid bitwise truncation.

## Editorial exclusions

If a source contains sponsor segments, copyrighted music, offensive material or a rights-restricted section, v1 flags it and blocks release until the owner chooses a supported action. Do not silently summarize it away. A deliberate exclusion manifest, if implemented, must explain omitted source ranges and prevent the package being labeled full coverage.

## Quality checks

Duplicate boundary speech, changed names/ranks, numbers/negation, tense, chronology, narrator perspective, unsupported plot additions, and recap hooks that reveal future events. Continuity QA reports source evidence and locations; human resolves consequential flags. TEST-021 covers late-episode consistency and edit fan-out; TEST-020 covers timeline boundaries.
