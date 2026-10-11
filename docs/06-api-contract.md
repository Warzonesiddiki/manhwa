# 06 — API contract outline

**Status:** planned `/api/v1` contract, not existing routes. Generate executable OpenAPI + shared validation schemas in TASK-008 after approval.

## Common rules

- API authenticates owner identity server-side; ownership checked for every resource, including nested IDs.
- JSON has small bounded payloads. Media goes directly to scoped object-storage upload sessions.
- Mutations validate strict schemas; timestamps are integer milliseconds, durations finite, IDs opaque.
- Expensive POSTs require an `Idempotency-Key` scoped to owner + route + canonical body; reuse with different input returns conflict.
- Revision-bearing PATCH/PUT updates require `If-Match`; omission returns 428 and a failed revision precondition returns 412 with authorized current-revision metadata. Use 409 for business conflicts such as idempotency-key reuse with different input or an obsolete job snapshot, not failed HTTP preconditions.
- Accepted durable jobs return 202 `{jobId, status, statusUrl}`; no fake completed result.
- GET/HEAD never generate speech, render files, or consume provider inference budget.
- Pagination uses bounded limits/cursors. Logs carry requestId; no tokens/media in URLs or logs beyond scoped media credentials.

## Endpoint catalog

| Method / path | Purpose / key outcome |
|---|---|
| GET `/health/live` | Process liveness without secrets |
| GET `/health/ready` | Restricted readiness of required services; no credential values |
| GET `/me` | Owner identity and allowed capabilities |
| GET, POST `/projects` | Paginated list / create project with source reference |
| GET, PATCH, DELETE `/projects/:id` | Read / revisioned metadata update / asynchronous deletion |
| POST `/projects/:id/rights` | Versioned rights declaration |
| POST `/projects/:id/upload-sessions` | Scoped resumable upload instructions, expiry, size/type constraints |
| POST `/projects/:id/assets/:assetId/finalize` | Verify object and queue media inspection; not immediate trusted availability |
| GET `/projects/:id/assets` | Owner-scoped asset metadata |
| POST `/projects/:id/transcript-imports` | Validate bounded SRT/VTT asset import into draft transcript |
| GET `/projects/:id/segments` | Paginated timeline with revision/flags; no bulk audio payload |
| PATCH `/projects/:id/segments/:segmentId` | Create new text/timing revision, mark dependencies stale |
| POST `/projects/:id/segments/:segmentId/split` | Revisioned split with lineage and timestamp validation |
| POST `/projects/:id/segment-merges` | Merge explicit adjacent revisions; revalidate coverage |
| GET, PUT `/projects/:id/glossary` | Fetch / revisioned glossary update |
| GET, PUT `/projects/:id/episodes` | Episode planning and contiguous-coverage validation |
| GET, PUT `/projects/:id/narration-profile` | Versioned provider/voice/style choice |
| POST `/projects/:id/approvals` | Approve exact script/pilot/timing revisions with recorded exceptions |
| POST `/projects/:id/estimates` | Quote bounded work against a snapshot, rateVersion, and expiry |
| POST `/projects/:id/jobs` | Start inspect/transcribe/adapt/pilot/synthesize/render/archive using approved snapshot/estimate |
| GET `/projects/:id/jobs`, GET `/jobs/:id` | Durable state, per-stage progress, blockers and usage |
| POST `/jobs/:id/pause`, `/resume`, `/cancel` | Idempotent control; cancellation may be cooperative |
| POST `/jobs/:id/retries` | Retry only eligible failed/stale steps with cost reauthorization where needed |
| GET `/assets/:id/access` | Short-lived owner-authorized read/playback URL; range-capable delivery |
| GET `/projects/:id/exports` | Validated outputs and manifests |
| POST `/project-imports` | Quarantined versioned archive restore job |
| GET `/usage` | Owner/project/date-period estimated and reconciled usage |

Workers use separately authenticated internal control endpoints or direct service repositories. Queue/job identity must not reuse a user bearer token. Internal interfaces are not publicly callable merely because the frontend API is public.

## Planned v0.2 contract additions

| Method / path | Purpose |
|---|---|
| GET `/capabilities` | Owner-visible tested provider/resource/destination profiles, evidence dates and limits; no secrets |
| POST `/projects/:id/preflight` | Check the source/revision/profile/rights/budget snapshot; no paid inference or upload side effect |
| GET `/projects/:id/upload-sessions/:sessionId` | Authorized safe status, confirmed offset, expiry; no credential in ordinary logs |
| POST `/projects/:id/upload-sessions/:sessionId/resume` | Reauthorize/reconcile provider session; explain reselection or expiry; never fabricate retained bytes |
| POST `/projects/:id/upload-sessions/:sessionId/cancel` | Cancel/quarantine late writes with honest provider revocation semantics |
| GET, POST `/projects/:id/review-sessions` | List/create revision-bound review session |
| PATCH `/projects/:id/review-sessions/:sessionId` | Save position/coverage/notes using optimistic concurrency |
| GET `/projects/:id/review-issues`, PATCH `/projects/:id/review-issues/:issueId` | Inspect/resolve exact-revision issues with evidence; critical issues gate approval |
| POST `/projects/:id/impact-estimates` | Preview affected segments/artifacts/cost before a glossary/profile/timeline change |
| POST `/projects/:id/publication-packages` | Validate and create immutable package plan referencing a destination profile; rendering is a separate accepted job |
| GET `/projects/:id/publication-packages/:packageId` | Part readiness, actual validation, maps, manifests and independent optional-master status |
| GET `/projects/:id/preview-manifest` | Paginated/tiled preview metadata and source time maps; authorized media access separately |
| POST `/projects/:id/retention-holds`, DELETE `/projects/:id/retention-holds/:holdId` | Server-validated pin/hold lifecycle and reviewed release of hold; not arbitrary file deletion |

`package` may become an allowed job type once the shared schema defines its immutable inputs. Transfer status and job status are distinct resources. New typed errors include `TRANSFER_RESELECTION_REQUIRED`, `TRANSFER_SESSION_EXPIRED`, `DESTINATION_LIMIT_EXCEEDED`, `REVIEW_INCOMPLETE`, `CAPABILITY_CHANGED`, `RETENTION_HOLD_ACTIVE` and `SOURCE_DURATION_EXCEEDED`. Never return a 200 “ready” package if mandatory parts failed or a 24-hour archival file violates the publication profile.

Generate OpenAPI/runtime validators for these alongside TASK-008 extensions, not a contradictory second API. Preserve ownership, bounded payload, idempotency and revision rules above.

## Example: job request (illustrative)

```json
{
  "type": "synthesize",
  "inputRevision": "revision-from-project-response",
  "segmentRevisionIds": ["revision-from-segment-response"],
  "narrationProfileRevision": "revision-from-profile-response",
  "estimateId": "estimate-from-estimate-response",
  "approvedBudgetMinorUnits": 25000,
  "currency": "INR"
}
```

Strings above describe IDs obtained from earlier reads; they are not real resource IDs. Monetary value is illustrative (₹250), not a suggested production budget. The backend rejects a changed, expired, or unapproved snapshot instead of trusting the browser's estimate.

## Error envelope

```json
{
  "error": {
    "code": "INPUT_REVISION_STALE",
    "message": "The script changed after this estimate. Review the new estimate.",
    "retryable": false,
    "requestId": "server-generated-request-id",
    "details": {"affectedFields": ["inputRevision"]}
  }
}
```

Codes include `UNAUTHENTICATED`, `FORBIDDEN`, `SOURCE_REQUIRED`, `RIGHTS_REVIEW_REQUIRED`, `UPLOAD_INVALID`, `MEDIA_UNSUPPORTED`, `LIMIT_EXCEEDED`, `REVISION_CONFLICT`, `BUDGET_EXCEEDED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_OUTCOME_UNKNOWN`, `QUALITY_REVIEW_REQUIRED`, `ARTIFACT_MISSING`, `JOB_CANCELLED`. HTTP 400/401/403/404/409/412/413/422/428/429/503 as appropriate; conceal resource existence where necessary.

## Compatibility and tests

Version schemas explicitly; stable error codes are part of the contract. Contract tests must cover wrong owner, expired token, ID traversal, nested-resource mismatch, duplicate submission, huge body, invalid duration, expired estimate, missing/stale revision preconditions on PATCH and PUT, and no side effects from GET/HEAD. Export an OpenAPI description only after this outline is reconciled with the chosen auth/upload/worker stack.
