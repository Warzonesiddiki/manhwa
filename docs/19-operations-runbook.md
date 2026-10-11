# 19 — Operations and recovery runbook

**Status:** planned procedures. Replace abstract actions with tested commands/resource names in TASK-032; do not fabricate deployed resources.

## Operational dashboard

Track queued/running/blocked/failed jobs, oldest queue age, worker heartbeat/lease expiry, provider 429/5xx, actual/reserved/unknown spend, storage/scratch usage, failed uploads, orphan objects, export QA failures, and backup age. Logs use request/job/step/attempt IDs and model versions without raw media/text/secrets.

Proposed alerts: expired worker leases, repeated failure for the same step, budget approaching cap, storage near approved threshold, missing backup, and any unauthorized-access spike. Tune thresholds from staging behavior; avoid alerting for every expected retry.

## Before a multi-day project

Confirm source/rights, measured duration/bytes, glossary/script/pilot approvals, project budget including retries, storage headroom, provider readiness, no stale revisions, and working alert destination. Start a small current-config pilot if models or worker images changed.

## Recovery playbooks

### Job appears stuck

1. Find job/step/attempt and last heartbeat; inspect worker execution status.
2. Distinguish provider wait, quota backoff, human review, storage I/O, and lost lease.
3. Do not blindly launch a second full project.
4. Reconcile uncertain provider output/charges, reclaim only expired unfinished work using fencing, then retry eligible steps.
5. Record incident and verify no duplicate committed artifact.

### Provider outage/quota exhaustion

Pause new calls, respect backoff, retain checkpoints, show outage to owner. Do not silently change model/voice. Resume when readiness returns or after owner-approved provider migration and a new pilot. Re-estimate cost if rates/settings changed.

### Worker killed / storage full

Stop further dispatch, preserve verified object artifacts, clean only unreferenced temporary data, inspect scratch/capacity, and resume from committed steps. A completed upload/artifact is not deleted simply because its worker died. If architecture limits recur, reopen DEC-002/010 instead of increasing unbounded buffers.

### Unexpected spend

Freeze new chargeable work using the application control; inspect reservations, attempt/request IDs, retries, unknown outcomes, and external billing. Cloud billing alerts are notifications, not a guaranteed real-time hard stop. Rotate keys/restrict access if abuse suspected; only resume with owner approval.

### Wrong or stale export

Revoke/restrict access to the affected export version where possible, preserve evidence, compare source hash/revision/profile/timeline manifest, identify earliest invalid dependency, regenerate only affected artifacts, and rerun full relevant QA. Never overwrite a manifest to hide the defect.

### Secret or private-media exposure

Pause affected access, rotate/revoke compromised credentials/signed sessions, preserve sanitized logs, identify affected data/time range, repair control, review permissions, and inform the owner. Do not paste secrets or media in the incident record. If external notification duties apply, obtain appropriate legal guidance.

## Backup and restore

Back up metadata/configuration and retain required source/final artifacts according to the approved policy. Record backup schema/version and checksums. Restore to an isolated environment, verify ownership/revision graph, remint access URLs, validate artifacts, and render a known fixture. Restore drills prove the proposed RPO/RTO; a scheduled export job alone does not.

## Deletion

Mark project deleting, stop new jobs, cancel/drain in-flight work, enumerate owned artifacts/provider uploads/backups subject to policy, delete/revoke in documented order, and record failures for retry. Explain backup/provider retention exceptions. Never use a client-supplied directory in a recursive delete operation.

## Deployment/rollback

Review migration compatibility and backup status; pause dispatch if necessary; deploy immutable tested image/config; smoke auth/health/media; verify workers and leases; resume. Roll back to previous compatible image if gates fail. Do not reverse metadata changes blindly.

## Service targets to approve

Private-beta RPO ≤24h, RTO ≤24h; no 24/7 support or availability SLA promised. Successful-job rate and throughput targets are established only after pilot metrics. Publish an owner-facing known-limitations list rather than hiding issues behind a healthy HTTP endpoint.

## Day-long run additions

Use doc 31's stage/wait metrics, doc 30's provider expiry/unknown-charge policy and doc 29's reference-safe recovery/cleanup. Resuming a project may require renewed source authorization or a current model pilot, not merely another queue message. Never delete paused/review inputs to recover storage without showing the affected work and obtaining approval.

The incident template records confirmed versus suspected impact; the capacity report records actual 24-hour/source-byte evidence. Notification and readiness setup is specified in doc 34. Publication-package QA failures are handled per part without losing other valid parts or claiming an optional full master succeeded.
