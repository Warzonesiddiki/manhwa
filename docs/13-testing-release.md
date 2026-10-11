# 13 — Test strategy and release gates

**Status:** planned tests, not a passing suite. The audit contains the only baseline executed results.

## Test layers and suggested tools

Unit/property tests for schemas, time conversions, coverage, cache fingerprints, and cost accounting; API integration tests against isolated storage/database adapters; React component/keyboard tests; Playwright-style browser journeys; containerized FFmpeg fixtures; live-provider benchmark runs behind explicit budget approval. Choose compatible tools and pinned versions during TASK-004 rather than installing a large stack blindly.

## Test catalog and traceability

| ID | Test / failure injection | Requirements | Main tasks |
|---|---|---|---|
| TEST-001 | Built artifact starts, frontend loads, backend bundle/env paths inaccessible | 018, 021 | 004, 005 |
| TEST-002 | Token expiry, unauthenticated/wrong-owner asset/job access | 001, 019 | 006 |
| TEST-003 | Encoded traversal, unsafe IDs, symlinks, HTML/SVG/polyglot uploads, malformed media | 003, 004, 019, 021 | 005, 009 |
| TEST-004 | Upload interrupted/resumed, checksum mismatch, >limits, no API buffering | 002, 004 | 009, 010 |
| TEST-005 | Autosave/reload, edit conflict, versioned archive import/restore | 005, 009 | 007, 027 |
| TEST-006 | Duplicate dispatch, killed worker, expired lease, stale commit | 013, 018 | 011, 012 |
| TEST-007 | Cancel/pause mid-job, browser closed, late provider response | 013, 014 | 012, 023 |
| TEST-008 | Concurrent budget reservations, unknown-charge outcome, quota/backoff | 014, 021 | 013 |
| TEST-009 | True transcript versus known audio, chunk-boundary words, invalid SRT/VTT, uncertain spans | 006, 007 | 014, 015 |
| TEST-010 | Urdu/English/Roman edits, glossary consistency, names/numbers/negation evaluation | 008, 010, 020 | 016, 017 |
| TEST-011 | Cache changes with effective text/voice/style/model; HEAD/GET read-only | 012, 018 | 018 |
| TEST-012 | Real pilot approval binds exact profile; changed profile revokes bulk approval | 011, 012 | 019 |
| TEST-013 | RIFF metadata, raw PCM conversion, empty audio, clip overflow, overlaps, large-audio container | 015, 017 | 020, 021 |
| TEST-014 | Edit during generation/render; only changed dependencies regenerate | 009, 013, 016 | 012, 018, 022 |
| TEST-015 | Correct selected source/range, no truncation, exact output duration, Urdu caption shaping | 016, 017, 020 | 022, 024 |
| TEST-016 | Export modal open/close, seek/rate/volume, arc change, keyboard/RTL, long-list performance | 018, 022 | 005, 017, 025 |
| TEST-017 | Signed URL expiry/refresh and Range 206, deletion, backup/restore, secret rotation | 005, 019, 021 | 026, 027, 032 |
| TEST-018 | Full 10-hour source, interruption/recovery, bounded resources, cost and QA evidence | Original workflow at intermediate scale; not 24-hour qualification | 029, 030, 033 |

## Mandatory day-long extension tests

| ID | Test / failure injection | Requirements | Main tasks |
|---|---|---|---|
| TEST-019 | Large upload browser close/reselect, session expiry/mismatch, late finalize, immutable ranged download | 004, 019, 024 | 039 |
| TEST-020 | Exact 24-hour endpoint, >limit, GB/byte limits, rational frame/sample math, 32-bit overflow, source/part offsets | 007, 015, 023, 028 | 038, 040, 045 |
| TEST-021 | Hour-23 glossary/plot consistency, context provenance, dependent-edit fan-out, no future-event invention | 008, 009, 010, 026 | 045 |
| TEST-022 | Review session resume, scoped bulk approval, sampled vs listened, critical issue release block | 020, 027 | 042 |
| TEST-023 | 24-hour source split into destination-valid parts; actual byte/duration limits, complete source coverage, local chapters/captions | 016, 017, 028 | 040 |
| TEST-024 | GC versus active/paused/review references, orphan/corrupt object, expired source reference, delete/late commit and full restore | 005, 019, 030 | 043 |
| TEST-025 | 10,000-row UX, tiled previews, bounded browser memory, tested browser/codec/RTL matrix and token expiry | 022, 029 | 044, 048 |
| TEST-026 | Multi-day quota/file/model expiry, circuit breaker, uncertain billing, no silent voice/provider fallback | 013, 014, 025 | 041 |
| TEST-027 | Final 24-hour qualification including all required publication parts, faults, human QA, resource/cost and recovery evidence | 023–032 plus original workflow | 049, 033 |
| TEST-028 | Stage/wait telemetry, recovery efficiency, budget reconciliation, notification/redaction and operational drills | 014, 018, 021, 032 | 047 |
| TEST-029 | Real component/media/voice/font inventory, notices, unresolved obligation release block | 003, 019, 031 | 046 |

TEST-018 remains a **10-hour intermediate test**; it no longer qualifies the full product promise. TEST-027 is the final 24-hour gate. Duration fixtures alone are not enough: transfer/source byte capacity must also be tested near the approved upload profile limit, and compressed repeated content cannot prove language quality.

Numbers in requirement/task columns abbreviate `REQ-`/`TASK-` IDs.

## Fixture library

Rights-cleared sources: 60-second deterministic audio/video; 10-minute representative recap; 1/3/10/12/18/24-hour scale fixtures. Include non-sensitive natural speech for quality; repeated synthetic media is acceptable for throughput/recovery stress but cannot prove narrative coherence or Urdu quality.

Edge cases: silent source; music under narration; corrupt/truncated upload; unsupported codec; variable frame rate; rotated video; stereo; long blank spans; overlapping captions; empty/negative/NaN timestamps; >4 GiB audio export; C2PA/extra RIFF chunks; mixed Urdu/English/numerals; filenames with separators/control characters; expired asset credentials.

Keep small deterministic fixtures in a documented test directory with licenses; large/private media in controlled storage with a manifest/hash. No user uploads in Git.

## Quality gates

- Types, Hooks lint, unit/schema/API tests, and production startup all pass.
- No open critical/high security findings.
- Exact selected input revision is traceable to each generated artifact.
- All generated clips pass automatic format/duration checks; missing clips block final export.
- Owner approved script/pilot; flagged Urdu and timing issues resolved or recorded as explicit accepted exceptions.
- Each export duration matches its approved source-to-output map (initial tolerance ≤250 ms, including any approved inserted/retimed spans), with no silent truncation, unintended English narration or corrupt streams.
- TEST-018 is the retained 10-hour intermediate proof; TEST-027 is the mandatory 24-hour release proof, with memory/scratch bounds, browser-independent execution, multi-day recovery, review and actual cost reporting.
- Backup restoration and rollback are demonstrated, not only described.

## Evidence format

Record date, commit/build, environment, model/voice/prompt/rate versions, fixture hashes, commands, job IDs, assertions, output checksums, listening scores, observed cost, and residual risks. “Not run” is distinct from “pass.” An AI-generated test report without execution evidence is not acceptance.

## Release procedure

Use the release checklist template. Deploy staging, run smoke/security/fixture tests, run approved live-provider evaluation, produce a release candidate, review diff and migration/backups, obtain owner approval, deploy privately, smoke again, monitor initial jobs, and retain rollback artifacts. No automatic production deploy from an unreviewed AI Studio edit.
