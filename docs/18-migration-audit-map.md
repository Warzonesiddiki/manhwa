# 18 — Prototype migration and audit remediation map

**Status:** plan only. Existing files/artifacts have not been migrated, removed, or repaired.

## Keep / refactor / replace / defer

| Existing area | Recommended disposition |
|---|---|
| React layout, script/arc presentation | Retain useful UX ideas; refactor into feature modules and truthful states |
| TypeScript domain types | Evolve into validated revisioned contracts; existing interfaces are not storage schemas |
| SRT/download helpers | Keep after timestamp, Unicode, validation, and lifecycle tests |
| Gemini server proxy concept | Keep server boundary; replace prompts/contracts/providers as validated adapters |
| `server.ts` monolith | Incrementally split into API/services/repositories; remove unsafe legacy access before exposing replacements |
| Local filesystem caches/uploads | Replace with private artifact storage; never treat browser/server ephemeral files as durable project state |
| Segment-ID audio cache | Replace with immutable effective-input fingerprints and revision references |
| Whole-buffer WAV stitching | Replace with decoded, bounded media operations |
| MediaRecorder production export | Remove from production path; optionally retain clearly labeled tiny demo preview |
| Preset projects/media | Quarantine as fixtures, validate licenses and integrity; never import as real user work silently |
| Raw-panel creator / fake transcript generation | Hide or label as demo; implement only under separate approved scope |
| NLE exports | Defer; validate XML escaping/media references if later implemented |

## Every primary audit finding mapped

| Audit ID | Required repair | Backlog | Verification |
|---|---|---|---|
| F01 traversal | Remove client filesystem paths; opaque authorized resource mapping | 005, 008, 009 | TEST-003 |
| F02 active upload | Quarantine/validate media, private safe delivery | 005, 009, 026 | TEST-003/017 |
| F03 unauthenticated abuse | Owner auth, ownership, quotas, worker permissions | 006, 013, 031 | TEST-002/008 |
| F04 unbounded allocations | Bounded workers, validated limits, streaming/chunked media | 003, 010, 020, 028 | TEST-013/018 |
| F05 production crash | Compatible server packaging + actual built-server smoke | 004, 005 | TEST-001 |
| F06 conditional hooks | Move hooks or conditionally mount; UI regression | 005 | TEST-016 |
| F07 HEAD generates fake audio | Read-only GET/HEAD; explicit synth job; no fallback tone | 005, 018 | TEST-011 |
| F08 stale/cross-project cache | Effective-input keys, revisions and ownership | 007, 018 | TEST-011/014 |
| F09 false completion | Typed failures, stage states, artifact QA gate | 012, 020, 023 | TEST-006/007/013 |
| F10 fake ingestion/creation | Real source ASR/import; demo isolation | 001, 005, 014, 016 | TEST-009/010 |
| F11 WAV metadata corruption | Parse/decode and normalize actual media | 020, 021 | TEST-013 |
| F12 wrong/truncated video | Source identity/range/duration contract, correct renderer | 010, 022, 029 | TEST-015/018 |
| F13 playback/recording sync | One media clock; production server export | 022, 025 | TEST-016 |
| F14 edits lost | Durable project revisions/autosave/archive | 007, 027 | TEST-005 |
| F15 backend source public | Separate client/server outputs | 005, 031 | TEST-001 |
| F16 impossible arcs | Deterministic contiguous-coverage constraints | 015 | TEST-009 |

Additional gaps: dependency/tooling/tests → 004/031; media range support → 026; runtime data in Git/retention → 009/026; accessibility → 025; health/diagnostics → 008/032. No audit item is considered resolved until regression evidence exists.

## Migration stages

1. Checkpoint current source and fixture manifest; preserve audit evidence.
2. Disable unsafe/misleading legacy operations; keep a clearly labeled non-production preview if needed.
3. Introduce contracts and repository abstractions; migrate project metadata before replacing every UI screen.
4. Add private storage/job ledger and one real source-to-export slice behind a feature flag.
5. Migrate validated legacy media as **untrusted imported assets**, not preapproved speech.
6. Switch workflows to durable IDs/revisions; deprecate old endpoints with clear client errors.
7. Remove unreachable demo code only after regression and owner review; retain fixtures outside runtime storage.

## Existing media caution

Committed audio may correspond to presets rather than current text or selected voice. Validate hashes, formats, source ownership/licenses, and semantic match. Do not infer “generated” from a filename or trust old status flags. Unknown provenance means quarantine/manual review, not automatically reusable narration.

Any existing project JSON import must validate schema/timestamps, remove arbitrary paths/remote fetch instructions, reconstruct source links, and mark stale/missing artifacts. Back up before transformation; supply dry-run counts and rollback. No destructive rewrite of the working repository during planning.

## v0.2 migration contract

The audit is historical and remains unchanged. New planning scope does not resolve its findings. Retain TASK-030/TEST-018 as 10-hour intermediate evidence and add TASK-038–049 for day-long constraints before release.

Extend revisioned metadata with protected transfer sessions, capability/resource snapshots, context/review records, publication parts/maps and retention holds. Existing “full marathon” flags or sample durations cannot be migrated into a 24-hour support claim. Validate/source-measure each import; retain original revisions and dry-run the migration.

Legacy exports are archival candidates until source/voice correctness, actual duration/bytes and destination profile are checked. Never relabel a 24-hour file as publication-ready merely because rendering completed.
