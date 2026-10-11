# 29 — Artifact integrity, lifecycle, garbage collection, and recovery

**Status:** proposed storage/state contract; essential when jobs and review span days.

## Retention follows references and job state

Age alone must not delete active source, pending-review clips, approved export inputs or recovery checkpoints. A paused job still owns its inputs. Use explicit retention classes, holds/pins, dependency references and owner-approved policies; lifecycle rules on buckets must agree with application state.

Keep separate classes: incomplete upload, quarantined source, active source, temporary attempt output, committed artifact, approved publication part, optional archival master, historical revision, backup and provider-uploaded copy. Each has its own cleanup trigger and evidence.

## Commit protocol

1. Worker writes to an attempt-scoped temporary object; metadata status remains incomplete.
2. Verify byte count, checksum, actual media format/duration, expected input fingerprint and QA.
3. Atomically commit the object generation/version reference and step state under current fencing token.
4. Immutable committed artifacts are not overwritten; replacement creates a new version.
5. Garbage collector later removes unreferenced temporary objects after a safety window.

A cloud object can exist without a committed artifact, and a metadata reference can be stale after an operational failure. Reconciliation handles both directions. Never declare success solely because a filename exists or a queue message was acknowledged.

## Dependency-aware garbage collection

Use mark/sweep or an equivalent auditable reference graph: live project revisions, jobs, approvals, packages and pins form roots. Mark referenced artifacts; identify candidates; apply hold/grace period; recheck transaction/version before delete; log IDs and reason. First run is a dry-run inventory reviewed by owner. Do not delete a shared artifact until all live references release it.

Concurrent review approval, new export, pause/resume and delete are race cases. Project deletion prevents new root creation, drains/cancels work and rejects late commits. Provider copies may expire independently; reupload only if still authorized and needed.

## Checksums and integrity

Record checksum algorithm, source of measurement, byte count and storage object generation. Verify source after upload, artifacts before commit, package outputs before ready, and archive assets on restore. Provider ETags or object names are not assumed to be cryptographic content hashes. Hashing large files must be streaming/bounded.

Range downloads resume only against the same immutable object generation. If content differs, restart explicitly; never splice ranges from different render versions.

## Backups and restore granularity

Back up metadata plus enough immutable assets to meet the approved recovery promise. Clarify whether raw sources are backed up, merely retained once, or must be re-uploaded after disaster. A metadata-only backup does not restore missing source/audio bytes.

Restore one project into an isolated namespace: verify owner, schema/revisions, manifest hashes, artifact availability, approval provenance and package maps; re-create expiring credentials on demand. Do not revive cancelled/deleted work without explicit owner choice. Validate a sample render and review state before replacing production.

The proposed metadata RPO/RTO in requirements remain unproven until drills. Day-long pipeline recovery from recent checkpoints is a separate metric from disaster recovery from backups.

## Migration and rollback

Data schema migrations have version, dry-run counts, required backup, compatibility window, and rollback/forward-fix policy. Worker image/schema changes must not make an in-progress 24-hour job consume a different contract silently. Pin job input/prompt/profile versions and either let compatible old workers finish or pause with a migration decision.

## Mandatory test cases

Orphan object; metadata without bytes; corrupt committed object; duplicate upload finalize; expired provider reference; old fenced worker late commit; cleanup during pause/review; project delete during render; backup restore with missing media; archive path traversal; new revision while GC runs. TEST-024 covers these, with explicit human approval before destructive drills.
