# 23 — Day-long source capacity and support envelope

**Status:** proposed capacity contract, not measured support. Supersedes the former 10-hour release ceiling. Owner confirmed 10–24-hour sources on 2026-10-11.

## Four durations must remain separate

1. **Source duration:** the inspected media timeline; target maximum **86,400,000 ms = 24 hours**.
2. **Job wall time:** upload, queue, provider, render, retry and review time; may span several days.
3. **Worker attempt duration:** one bounded unit; not a 24-hour process by default.
4. **Publication-part duration:** governed by the chosen destination and output profile; not automatically equal to source duration.

A 24-hour project can produce 48–96 ordinary 15–30 minute episodes. Short final episodes are valid. Processing shards and speech segments are separate boundaries. Existing support for shorter inputs remains required; 10 hours is not a minimum.

## Proposed envelope — approval and measurement required

| Dimension | Proposed v1 contract |
|---|---|
| Source timeline | Greater than zero and ≤24 hours; include exact endpoint and reject >limit |
| Source bytes | ≤128,000,000,000 bytes (128 decimal GB) per file; independent of duration |
| Input structure | One validated source file per project initially; a link/playlist is not automatic multi-file acquisition |
| Active projects | One pipeline at a time; resumable queued work, owner can reprioritize |
| Internal timestamps | Integer source-relative ms and explicit rational frame/sample conversions; no date/time-of-day representation |
| Narration metadata scale | Design and test for at least 10,000 segment rows; do not hardcode that as a semantic maximum without data |
| Work unit | Bounded ASR shard, adaptation batch, speech segment, render shard/episode |
| Project lifetime | Can outlive model-file, signed-link, token, worker and upload-session expiries |
| Output | Checked episode/multipart package covering all approved source spans; full archival master optional and separately qualified |

128 GB is a proposal, not an already authorized upload allowance or an infrastructure guarantee. Some 24-hour files exceed it: fail early with measured size and supported options. Never compress or cut the source silently. A larger profile requires a new decision, budget and benchmark.

## Sizing arithmetic (decimal GB, illustrative constant total bitrate)

| Media | 10 hours | 12 hours | 24 hours |
|---|---:|---:|---:|
| 2 Mbps video+audio | 9 | 10.8 | 21.6 |
| 4 Mbps | 18 | 21.6 | 43.2 |
| 8 Mbps | 36 | 43.2 | 86.4 |
| 12 Mbps | 54 | 64.8 | 129.6 |
| 16 Mbps | 72 | 86.4 | 172.8 |
| 24 kHz mono PCM16 | 1.728 | 2.0736 | 4.1472 |
| 48 kHz mono PCM16 | 3.456 | 4.1472 | 8.2944 |
| 48 kHz stereo PCM16 | 6.912 | 8.2944 | 16.5888 |

Formula: bitrate × seconds / 8; PCM: sampleRate × channels × bytesPerSample × seconds. A source, final copy, proxy, retained versions, intermediates, backups, and egress all count separately. Container overhead and variable bitrate alter actual sizes. Do not label decimal GB as GiB.

At 24 kHz mono, a 24-hour PCM16 payload is just below 4 GiB; at 48 kHz mono/stereo it is above. Do not use a blanket duration-only WAV rule: choose the container from actual byte size plus header constraints. RF64/FLAC/split WAV compatibility must be tested.

## Throughput and quota are distinct

Continuous speech in 20-second units yields about 4,320 clips. An illustrative provider allowance of **2 requests/minute** would require **36 hours just for those requests**, even before failures/review/rendering. This is arithmetic, **not a claim about any actual provider quota**. More workers cannot overcome an account-level request cap.

At 120–180 source words/minute, continuous 24-hour narration would contain approximately 172,800–259,200 words. Estimate from actual speech density and source text, not duration alone. The UI must avoid suggesting that “24-hour support” means completion in 24 hours.

## Admission control

Before upload/processing: inspect available metadata, declared size, supported profile, rights, current quota, storage headroom, outstanding reservations, review plan, and estimated provider usage. Reserve resources for accepted work; queue or block when infeasible. Enforce configured caps again after actual inspection.

Define per-worker memory, scratch and CPU budgets, not a single arbitrary total-memory target. Record `resourceProfileVersion` on jobs. Worker choice remains a measured Cloud Run versus disk-backed VM decision.

## Qualification ladder

10-minute correctness → 1/3-hour recovery → 10-hour intermediate TEST-018 → 12-hour boundary → 18-hour load → **24-hour TEST-027**. Include a representative source as well as cheap synthetic scale fixtures. Shorter success or extrapolated throughput is not 24-hour release evidence.

Source acceptance, whole-project processing, publication packaging, and optional full-master generation each have separate test results. Never disable safety checks to make a large fixture “pass.”
