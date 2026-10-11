# 07 — Durable jobs, retries, and long-form orchestration

**Status:** proposed. Required before enabling hour-scale paid processing.

## Pipeline DAG

```text
source registered → upload verified → media inspected → audio/proxy prepared
  → transcription chunks → overlap reconciliation → transcript review
  → glossary + episode plan review → Urdu adaptation batches → script approval
  → voice pilot → pilot approval → TTS segments → duration/alignment checks
  → corrections/review → episode mixes/renders → export QA
  → optional full-marathon assembly → final QA → archive
```

Rights, source availability, approvals, and budget are prerequisites, not cosmetic checkboxes. Episode renders can complete independently after their own prerequisites; full export requires all selected inputs to be valid.

## Different granularities

- **Source:** up to 24 hours, immutable media identity.
- **Processing shard:** provider/worker-sized unit with source offsets; initial ASR benchmark 5–10 minutes with boundary overlap.
- **Narration segment:** semantic speech unit with exact target window and approved text/settings.
- **Episode:** publishable interval, typically 15–30 minutes, not a required model request size.
- **Job:** immutable requested operation across some or all of those units.

A 24-hour source yields roughly 144–288 non-overlapping 5–10 minute transcription shards before overlap overhead; continuous 10–30 second narration units imply about 2,880–8,640 segments. Actual counts depend on speech density, semantic segmentation, and measured provider limits. Avoid loading all bytes/results into one process.

## State machine

`queued → running → succeeded`

Additional transitions: `running → waiting_review | retry_wait | failed | cancelling`; `queued/running → paused` when in-flight work has checkpointed; `cancelling → cancelled`; `paused/waiting_review → queued` only after explicit prerequisites; `retry_wait → queued` when policy allows.

“Stale” describes a job/artifact's relationship to a newer input revision, not retroactive failure of an immutable historical result. A terminal job never silently changes its input snapshot on retry; changed input creates a successor job.

## Acceptance, dispatch, and recovery protocol

1. Validate source, revisions, approvals, estimate, and limits.
2. Transactionally reserve budget and write job + dispatch intent. Return 202 only after durable acceptance.
3. Dispatcher leases the intent, checks whether an execution already exists, starts the approved worker, and records execution reference.
4. Worker atomically claims a step, receiving a monotonic fencing token and lease deadline; heartbeat renews it.
5. Persist request attempt/provider request ID before or as closely as possible to submission.
6. Write output to a temporary private object; validate checksum, duration, format, and content requirements.
7. Atomically commit the artifact reference and step success only if lease/fencing token and input snapshot still match.
8. Reconcile actual/uncertain usage and release unused reservations.
9. Reconciler finds expired leases, undelivered intents, provider-unknown attempts, and orphaned temporary objects.

At-least-once delivery is expected. Internal idempotency prevents duplicate commits; it **does not guarantee exactly-once external charges** where a provider lacks idempotent submission or request lookup. Unknown outcomes require reconciliation or user-approved retry, not optimistic zero-cost accounting.

## Retry policy — proposed defaults

- Transient 429/5xx/network failures: honor Retry-After, exponential backoff with jitter; initial cap 3 attempts per step.
- Invalid input, forbidden request, unsupported model, missing rights: fail/block without automatic repeat.
- Malformed model JSON: at most one bounded repair attempt, then review; never invent missing segments.
- Invalid/empty audio: fail QA; one bounded regeneration only if budget permits.
- Lost worker: expire lease, retain valid artifacts, reclaim unfinished units; old worker cannot commit.
- Exhausted budget: stop new dispatch, retain checkpoints, request approval.

Numbers must be benchmarked and stored in configuration, not scattered through handlers.

## Pause/cancel semantics

Pause stops dispatch and lets safe in-flight units finish/checkpoint. Cancel marks the job, stops new work, terminates media children where safe, and discards late results from active pipeline use. Already accepted provider work may complete and be charged; usage remains recorded. Completed valid artifacts stay available unless the owner requests deletion. Cancellation never claims immediate deletion of third-party copies.

## Progress and cost

Progress comes from committed unit counts/durations. Record stage total/complete/failed, source seconds covered, queue wait, worker heartbeat, estimate/reserved/actual/unknown usage. Avoid hot-updating one database record for every audio sample or console line; aggregate updates.

Per-project budget reservations must account for parallel tasks; checking a mutable total separately in each worker is insufficient. Cap concurrency conservatively: begin with one media worker and a small provider semaphore, then tune under measured rate/compute limits.

## Required recovery experiments

Duplicate dispatch; worker killed after provider response but before commit; kill during output upload; stale lease writes; browser closed; quota 429; corrupted audio; cancelled job returns late; changed script during render; storage outage; budget exhausted mid-batch. See TEST-006/007/008/014 in the test plan.

## v0.2: project lifetime and package completion

A project may span days even if every worker unit is bounded. Persist capability/resource/rate snapshots, refresh authorized access to durable assets as needed, and distinguish expired external references from deleted source. Quota waits use durable rescheduling rather than keeping idle workers alive. See doc 30.

Publication-package jobs validate exact selected source coverage and produce individually validated parts. Required package-part success and optional archival-master success are separate states; no premature whole-project completion from a single rendered episode. GC protects active, paused and pending-review job references (doc 29).

Add fault cases: pause longer than access-token/provider-file lifetime, profile changes during hour-23 processing, queue retry after release deployment, late result after rights revocation, and package partly ready while another required part fails.
