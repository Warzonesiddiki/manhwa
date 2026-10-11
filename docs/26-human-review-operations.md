# 26 — Human review, workload, and acceptance

**Status:** proposed private-owner workflow. Automation assists review; it cannot certify perfect meaning or pronunciation.

## Review is a capacity requirement

A 24-hour output needs 24 hours to listen at normal speed before pauses/corrections; even 2× listening alone takes 12 hours and can hide delivery problems. The product must plan review time separately from compute time. Do not market “one click” as eliminating editorial responsibility.

Offer focused 20–40 minute review sessions as a configurable ergonomic suggestion, not a quality guarantee. Save position, decisions and notes automatically. Resume across days without losing the approved revision context.

## Review queues

1. Source/rights and media identity.
2. Transcript uncertainty, names, numbers, language changes and boundaries.
3. Glossary and narrative continuity.
4. Urdu/Roman meaning and effective spoken text.
5. Voice pilot and changed pronunciation samples.
6. Timing/format/clipping/silence/overflow flags.
7. Publication part transitions, subtitles and package coverage.

Sort by severity and impact. Group repetitive term corrections but retain per-line provenance. Do not skip a critical issue because a global average score is high.

## Coverage and approvals

All selected script revisions require explicit owner approval, possibly in declared ranges/batches. Approval records contain source and script/profile revisions, reviewer, time, action, issue exceptions, and claimed review coverage. “AI checked” and “owner approved” remain different.

Listening coverage has three categories: fully listened, sampled, not listened. A batch approval must not relabel unplayed audio as listened. Every flagged span, first/last boundary of each episode, publication join, and changed high-risk pronunciation requires direct listening. Review a reproducible stratified sample of unflagged material; sampling is not proof that every word is correct.

For initial release/pilot qualification, record an explicit human-review plan for the representative long source. Synthetic repeated audio is useful for stress tests but cannot establish 24-hour narrative quality. If full listening is impractical, disclose the sampled coverage and obtain owner acceptance rather than concealing it.

## Issue rubric

| Severity | Examples | Release policy |
|---|---|---|
| Critical | Wrong meaning/negation, invented event, wrong source, missing dialogue, unlicensed release | Must resolve; no “average score” override |
| Major | Repeated wrong character name, unintelligible Urdu, clipped phrase, significant sync error | Must resolve or narrow scope with an explicit documented decision; never hidden |
| Minor | Awkward pause, noncritical style preference, small formatting issue | May be accepted with explanation |
| Informational | Optional polish suggestion | Does not block by itself |

Voice quality scoring follows doc 08; event fidelity is not reduced to one aggregate rating. Model confidence values are signals, not calibrated certainty.

## Review records and UX

Create `ReviewSession`, `ReviewIssue` and `ReviewCoverage` records referencing exact revisions and source intervals. A session can stop safely; updates after approval make the affected coverage stale. Track approval throughput, time per finished hour, reopen/regenerate rate and common issue categories—not just generated minutes.

There is still one owner. Multi-reviewer assignment/permissions are deferred. The schema may record reviewer identity without pretending team collaboration exists.

## Acceptance tests

Pause/reopen review; changes invalidate only relevant approvals; bulk approve scope is visible; sampled audio never becomes “fully listened”; late-hour name regression is flagged; all unresolved critical issues block a ready-to-publish label. TEST-022 and TASK-042 implement this contract.
