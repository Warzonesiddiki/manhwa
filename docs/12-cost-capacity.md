# 12 — Cost, capacity, and feasibility model

**Status:** planning estimates/formulas, not provider quotes. No budget has been approved.

## Measure before promising

Track **₹ per finished hour**, processing wall time per source hour, human review time, retry overhead, storage GB-days, and network egress. Low model cost is not useful if narration must be redone or a failed 24-hour job restarts from zero.

Exact provider prices, quotas, currencies, taxes, and limits change. During TASK-002/003, capture a dated rate card from the selected provider/account. Never describe a free tier as an adequate guaranteed production budget.

## Cost formula

```text
project estimate =
  transcription input/output units × selected rates
  + adaptation input/output units × rates
  + TTS billable units × rates
  + optional alignment/QA model usage
  + worker CPU/RAM/GPU-time × rates
  + source/proxy/intermediate/output GB-days × storage rates
  + download/cross-service egress × rates
  + database/queue/logging operations
  + explicit retry/uncertainty allowance
```

If billing is in USD, record the dated exchange-rate assumption, INR estimate, tax treatment, and uncertainty. Do not hard-code a currency conversion into the UI. A rate-version change invalidates old estimates or requires reapproval.

## Illustrative 24-hour capacity arithmetic

Decimal GB, not real measured project sizes. Detailed 10/12/24-hour comparisons are in [doc 23](23-day-long-capacity.md).

| 24-hour source | Approximate media size |
|---|---:|
| 2 Mbps total bitrate | 21.6 GB |
| 4 Mbps | 43.2 GB |
| 8 Mbps | 86.4 GB |
| 12 Mbps | 129.6 GB — exceeds proposed 128 GB cap |
| 24 kHz mono 16-bit PCM | 4.1472 GB |
| 48 kHz stereo 16-bit PCM | 16.5888 GB |

Video formula: `bitrate_bits_per_second × seconds / 8`. A 43.2 GB source + similarly sized publication parts already totals about 86.4 GB. Retaining an additional full archival master adds another ~43.2 GB, before proxies, intermediates, historical versions and backups. Downloading all copies also incurs separate transfer/egress costs where charged.

The proposed **128 GB per-file cap** is independent of **24 hours** and is not approved capacity. Some 24-hour high-bitrate encodings exceed it. Reserve storage headroom for outputs and active attempts; admitting a source does not guarantee sufficient room for every retained derivative.

Streaming does not make storage or transfer free. A 128 GB upload at an ideal 10 Mbps takes ~28.44 hours before overhead; interrupted browser uploads, source/provider expiration and multi-day processing belong in the cost/time model.

## Benchmark ladder

| Fixture | What it establishes |
|---|---|
| 60–120 seconds | Urdu pronunciation/style, provider response format, pilot cost |
| 10 minutes | Complete real pipeline, timing, render/subtitle correctness |
| 1 hour | Concurrency, persistence, retries, review workload, cost projection |
| 3 hours | Chunk boundaries, memory plateau, quota pressure, source/output transfer |
| 10 hours | Intermediate TEST-018; not the final promised scale |
| 12 hours | Boundary/time-map/publication-profile checks |
| 18 hours | Increased metadata/review/storage pressure and expiry scenarios |
| 24 hours | Mandatory TEST-027: complete project, parts, recovery, review, actual cost/resource evidence |
| Near approved byte cap | Independent transfer/hash/seek/scratch/download qualification; long low-bitrate loops do not replace it |

Use rights-cleared representative media for language quality and inexpensive synthetic fixtures for selected stress tests. Keep distinct reports; one cannot substitute for the other. Do not multiply a 1-minute result and declare 24-hour support verified.

## Human time and calendar time

Track script review, pronunciation correction, listening, publication check and failure recovery as real costs even for a personal tool. A day-long output takes a day to listen at normal speed; the chosen sampling plan must disclose coverage. Worker concurrency does not accelerate the human review gate.

Separate upload time, quota wait, active model/worker time and review time. A provider quota can make total processing span several days. “Supports 24-hour videos” is not a completion-time SLA. Billing reconciliation can also lag technical completion; unknown usage stays visible.

## Budget controls

- Monthly owner cap, project cap, and separate pilot/generation/render approvals.
- Reserve estimated cost atomically before dispatch; include retries and in-flight reservations.
- Pause new chargeable work when the application budget is exhausted; explain already accepted calls may still settle.
- Explicitly reconcile unknown provider outcomes and final invoices/usage where possible.
- Warn before voice/model/global script changes that invalidate many artifacts.
- Reuse unchanged artifacts; never regenerate because a temporary download URL expired.
- Restrict debug logging and clean intermediates to avoid hidden operational cost.

## Capacity defaults to validate

One active project, one bounded media worker, small adjustable TTS concurrency, queued excess requests, max source/upload constraints, and bounded scratch. Increase only with evidence that provider rate limits, budget, memory, and output correctness remain stable.

## Owner decisions needed

| Decision | Current status |
|---|---|
| Monthly total budget in INR | Not provided; required before paid setup |
| Maximum spend per 24-hour project | Not provided |
| Expected projects per month | Not provided |
| Typical source bitrate/resolution and file size | Not provided |
| Target render quality (720p/1080p/source) | Recommend preserve source when practical; benchmark pending |
| Acceptable multi-day completion and human-review time | Not provided; no speed promise |
| Retain raw media/how long | Draft policy only |

Prefer reducing unnecessary multimodal calls, invalidated work, and storage waste before degrading Urdu quality. Paid model choices and a second provider require explicit owner approval.
