# Private release checklist — [version]

Status: candidate / blocked / approved / released / rolled back
Commit/image/config/schema: [versions] · Date: [date] · Owner approval: [record]

## Preconditions

- [ ] Requirements and scope frozen for this release; unimplemented features hidden/labeled.
- [ ] Accepted provider/privacy/rights/budget/retention decisions recorded.
- [ ] Known limitations and unresolved defects reviewed.

## Engineering evidence

- [ ] Frozen install, types, lint/hooks, unit/schema/API/security checks pass.
- [ ] Built server starts; client cannot fetch server/env files.
- [ ] Owner-only API/media access and hostile upload/path tests pass.
- [ ] Durable revisions/jobs, cancellation, retries, fencing, budgets tested.
- [ ] Correct source/text/voice revisions and media QA verified.
- [ ] Urdu pilot and sampled final quality approved.
- [ ] Intended scale gate passed; do not label release “24-hour ready” without TEST-027.
- [ ] Player, captions, dialogs, keyboard/RTL and download files checked.
- [ ] Dependency/container scans reviewed.

## Operations

- [ ] Staging configuration and private production permissions reviewed.
- [ ] Backup and restore demonstrated; migration/rollback plan tested.
- [ ] Secret handling/rotation, alerts, cost freeze and cleanup tested.
- [ ] Actual cost/capacity evidence and owner caps recorded.

## Release and post-release

- [ ] Explicit production approval obtained.
- [ ] Deploy immutable tested artifacts, run smoke tests, monitor first job.
- [ ] Record all evidence links, incident/rollback trigger, and next review.

Do not tick an item on intent or generated code alone. Mark not applicable only with reason and approver.

## v0.2 day-long mandatory additions

- [ ] Source duration AND near-approved byte-cap profiles qualified; no extrapolated pass.
- [ ] TEST-019–029 results recorded; final TEST-027 qualifies 24-hour support.
- [ ] Required publication parts cover selected source exactly and satisfy measured destination duration/bytes; optional archival master labeled separately.
- [ ] Transfer/reselection/expiry, provider multi-day failure, review coverage and lifecycle/GC cases pass.
- [ ] Actual license/asset/provider inventory and applicable notices reviewed.
- [ ] Human review/cost/resource evidence and known limitations approved by owner.
