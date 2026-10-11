# 05 — Data model and invariants

**Status:** logical schema proposal. No collections/migrations exist yet.

## Conventions

Opaque server-generated IDs; `ownerId` on owned entities; UTC timestamps; integer milliseconds for canonical timeline positions; byte counts and measured sample counts stored explicitly. Use `[startMs, endMs)` half-open intervals. Frame-based edits convert with the source's rational frame rate, not a universal 30 fps assumption.

Source timeline positions remain absolute throughout processing. Episode-local positions are derived as `sourceMs - episode.startMs`. Audio artifacts record their actual sample rate/channel count and sample length. Processing chunks, narration segments, and episodes are distinct entities.

## Entities

| Entity | Key fields |
|---|---|
| OwnerSettings | ownerId, narration defaults, budget limits, retention, schemaVersion |
| Project | id, ownerId, title, sourceLink/videoId, sourceAssetId, durationMs, activeRevision, status, createdAt/updatedAt |
| RightsRecord | projectId, declaredHolder, permittedUses, evidenceAssetId, attribution, restrictions/expiry, acknowledgedAt |
| Asset | id, ownerId/projectId, type, objectKey, sha256, byteLength, media metadata, inspectionStatus, retention/deletionState |
| SourceMetadata | assetId, durationMs, streams, rational frame rate, codec, channels, sampleRate, rotation, container |
| TranscriptRevision | id, projectId, sourceAssetHash, language, provider/model/promptVersion, coverage, status |
| SegmentRevision | segmentId, revisionId, transcriptRevisionId, startMs/endMs, sourceText, urduText, romanUrdu, ttsText, notes, flags, approval |
| EpisodeRevision | id, projectId, revisionId, title, startMs/endMs, ordered segment references, coverage validation |
| GlossaryRevision | projectId, revisionId, terms with canonical names, Urdu/Roman spellings, pronunciation hints, approved exceptions |
| NarrationProfile | id/revisionId, language, provider/model, voice ID, style/speed settings, glossaryRevisionId, pilotApproval |
| Artifact | id, type, ownerId/projectId, inputFingerprint, immutable objectKey/hash, format/duration, sourceRevisionIds, QA status |
| Job | id, ownerId/projectId, type, immutable inputSnapshot, status, progress counters, budgetReservationId, cancelRequestedAt |
| JobStep / Attempt | id, jobId, stage/chunk/segment, attemptNo, status, leaseOwner/expiry, fencingToken, providerRequestId, heartbeat, errorCode |
| DispatchIntent | id, jobId/stepId, dispatch state, execution reference, retryAt |
| UsageEntry | id, jobId/attemptId, provider/model, request ID, estimated/reserved/actual units, currency/rateVersion, uncertain outcome flag |
| Approval | subjectId/revisionId, ownerId, type, timestamp, exceptions, referenced pilot/QA report |
| ExportManifest | id, projectRevision, sourceAssetHash, timeline snapshot, artifact list/hashes, profile/settings, QA, archiveSchemaVersion |
| AuditEvent | actor, action, resource ID, time, result; no raw script/media/secrets |

## Day-long extension entities

| Entity | Required semantics |
|---|---|
| TransferSession | owner/project/asset, expected size/hash hints, object generation, server-confirmed offset, expiry, state; sensitive session capability protected separately |
| CapabilitySnapshot | exact provider/model/voice API, observed limits/formats, rate version, verification time/evidence; immutable per job |
| NarrativeContextRevision | source-backed facts/summaries, valid-through timestamp, glossary/source-span references and approval |
| TermDependency | effective glossary transformation → affected segment revisions/artifacts; supports scoped invalidation |
| ReviewSession / ReviewIssue / ReviewCoverage | reviewer, exact source/script/audio revisions, intervals, issue severity/state, full-listening/sample/unreviewed distinction, approval lineage |
| DestinationProfile | destination size/duration/format rules, operational margins, evidence/verification date, owner acknowledgement |
| PublicationPackage / PublicationPart | selected source coverage, ordered episode/artifact refs, piecewise source-to-output map, actual bytes/duration/hash, local captions/chapters, QA; archival master separate |
| RetentionHold / ArtifactReference | live roots, pins, expiry/hold reasons, dependency ownership; prevents GC deleting active/review assets |
| ResourceProfile / QualificationRecord | approved duration/byte/memory/scratch/concurrency limits and measured fixture/test evidence; not generic “healthy” status |

These remain proposed schemas. Scale collections/subcollections and paginated queries to thousands of entries; do not append all attempts/review spans into a single large project document. Derived counters must be reconcilable from durable unit state without unsafe hot-record contention.

## Critical invariants

- A successful asset/artifact points to verified bytes with checksum and media metadata; a URL string alone is insufficient.
- `endMs > startMs >= 0`; both are within measured source duration. Overlap is explicit, not accidental.
- Segment IDs remain stable across edits; revision IDs change. Re-splitting records lineage.
- Export jobs read an immutable snapshot, not the current mutable editor state.
- Approved text/settings changing makes associated approval and derived audio stale.
- Transcripts and segments are separate records or chunked objects; do not store thousands of long segments in one project document.
- A speech cache key is a canonical hash of owner namespace, actual TTS text, provider/model/version, voice, style, pronunciation transformations, language, and relevant audio settings.
- A change to Roman Urdu notes does not regenerate speech unless it changes effective TTS input; dependencies must be semantic, not arbitrary.
- Signed URLs are generated on request and never used as durable asset identity.
- Deletion is stateful: request → block new work → cancel/drain → delete derived/source/provider copies → record completion/retention exceptions.

## Concurrency and revision graph

Revision-bearing PATCH/PUT mutations include expected revision (`If-Match`); missing preconditions return 428 and mismatches return 412, consistently with the API contract. Jobs atomically claim pending steps with a fencing token. An expired worker cannot overwrite a newer attempt's committed result. Budget reservations and job acceptance use transactions or an equivalent atomic workflow.

Editing a segment invalidates its speech artifact, the containing episode render, and any full-project manifest depending on it. Unchanged approved clips remain reusable. Final exports are immutable; a new export creates a new version rather than replacing a download already in use.

## Index/query plan

Owner + updatedAt projects; project + timeline position segments; project + revision artifacts; job + stage/status steps; status + lease expiry recovery; owner + period usage. Add indexes from observed access patterns. Server API mediates access; browser direct database access is not a shortcut around authorization.

## Archive and migration

Versioned JSON manifest plus referenced media/checksums; archive import validates ownership, sizes, schema, paths, and hashes in quarantine. Never trust archive filesystem paths. Large media may be an explicit separate archive set rather than a RAM-built ZIP. Record schemaVersion and backward-compatible migrations. Back up and test restore before destructive changes.
