# 31 — Observability, service objectives, and evidence

**Status:** proposed private-service measurement plan. Targets are not achieved SLAs.

## Measure each wait separately

Project wall time = transfer + queue/provider wait + active processing + retries + human review + publication packaging/download. Record those intervals independently; overlapping work should not be double-counted in end-to-end elapsed time. Show both wall time and worker compute cost.

Required dimensions: project/job/step/attempt IDs, stage, immutable input revision, provider/model/profile version, fixture/source duration class, worker resource/image version and outcome. Avoid source text, signed credentials, raw media and high-cardinality unrestricted payloads in telemetry.

## Proposed indicators

| Indicator | Definition / caution |
|---|---|
| Durable acceptance latency | Time until authenticated valid job + dispatch intent + budget reservation are persisted, not full-job completion |
| Unit completion ratio | Succeeded eligible units / terminal eligible units; display failed/cancelled/blocked separately |
| Recovery efficiency | Preserved committed units and bytes after fault; report replayed work and uncertain/double charges |
| Progress freshness | Age of last committed progress/heartbeat versus configured stale threshold |
| Cost variance | Actual + unresolved reserved usage versus accepted estimate, with currency/rate-version differences explicit |
| Resource headroom | Peak RSS, scratch bytes, active decoder processes and transfer buffers against worker limits |
| Review burden | Owner review minutes/finished hour, issue reopen rate, accepted sample coverage |
| Export integrity | QA-pass parts / requested required parts; optional full-master failure reported separately |
| Completion latency | P50/p95 by duration/profile, separating owner-paused/review time without hiding total elapsed time |

Do not improve a success metric by excluding inconvenient failed projects without showing the exclusion count. “No observed failures” on one run is not a reliability estimate.

## Initial objectives to approve

Existing normal-operation API target <2 seconds p95 excluding cold starts/upload remains a hypothesis. Suggested active job-status freshness ≤30 seconds under healthy services; pause/cancel acknowledgement promptly persisted, with in-flight external work visibly draining. Recovery target is *no lost committed artifact* and bounded replay of unfinished units—not instantaneous full-job completion.

There is no fixed promise that a 24-hour video completes overnight or in real time. Establish stage throughput/cost distributions after the benchmark ladder and publish environment-specific results. Test status usability while workers are resource-constrained.

## Alerts and escalation

Alert on stuck/expired leases, repeated same-unit failure, sustained quota/circuit-breaker state, unexplained spend, resource headroom exhaustion, backup age, corrupt artifact, private-access anomaly and stalled uploads where actionable. Each alert links to an incident/runbook and identifies owner action; do not notify on every normal retry.

Private single-owner operation still needs a reachable notification destination. Selecting email/browser notification is a later configuration decision; never include private transcript or live signed URL in notification content.

## Evidence artifacts

Every qualification stores commit/image/config/schema, timestamps, fixture checksum, provider/profile/prompt/rate snapshots, metrics summary, fault injection details, output checksums, QA/review records and actual/unknown cost. Large/private logs/media remain in protected storage; the repository contains only sanitized references and conclusions.

## Operational drills

Stale job, provider outage, storage full, unexplained bill, lost credentials, corrupted artifact, bad deployment, full project restore and pending-review GC protection. Use the incident/experiment templates. Security incidents follow the runbook, not ad-hoc chat debugging with secrets.

TASK-047 expands TASK-032's operational drills for day-long runs. TEST-028 checks measurements and cost/recovery evidence; it must pass before final TEST-027 qualification.
