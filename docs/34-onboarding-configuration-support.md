# 34 — Owner onboarding, configuration, and support reference

**Status:** future operating specification; no setup/deployment is performed in this planning session.

## Onboarding sequence

1. Confirm owner identity and private access; do not enable public signup.
2. Explain authorized sources, private data flows, provider terms and publication limits.
3. Record desired source envelope, typical bitrate/filesize, monthly/project INR caps and one-pipeline concurrency.
4. Verify cloud storage/worker/provider readiness using a tiny rights-cleared fixture with approved spend.
5. Set Urdu glossary/narration defaults; approve a representative voice pilot.
6. Choose episode/publication-part package, optional archival master, captions and original-audio policy.
7. Set review plan, notification channel, retention/pins and backup expectations.
8. Complete a short full pipeline and restore example before a day-long production job.

Do not ask the owner to type raw API keys into a browser form or chat. Use the approved platform secret mechanism and test readiness without revealing values.

## Configuration ownership and change behavior

| Setting | Default status | Change consequence |
|---|---|---|
| Max source duration | Proposed 86,400,000 ms | Above-limit input rejected; increasing requires capacity decision/test |
| Max source bytes | Proposed 128,000,000,000 | Separate quota from duration; no silent transcoding |
| Source/input profile | One validated file initially | Playlist/multi-source support requires a feature decision |
| Owner/project budget | Unset until owner approval | No paid scheduling while unset; changed estimate may need reapproval |
| Provider/model/voice/style | Unselected until benchmark | New capability/profile snapshot and pilot; impacted clips stale |
| Output destination profile | Owner-selected/versioned | Revalidate actual parts; historical artifacts retain old provenance |
| Review coverage | Explicit per session/range | Sampling never becomes a full-listening claim |
| Retention/pinning | Draft defaults from security/lifecycle docs | Preview affected objects before destructive policy change |
| Concurrency/resource profile | Conservative measured proposal | Quota/cost/capacity implications; no client-chosen worker command |

## Readiness states

`configuration_required`, `identity_verified`, `storage_ready`, `worker_ready`, `provider_verified`, `pilot_approved`, `short_pipeline_verified`, `scale_qualified`. Distinguish live service, configured provider, actual tested capability and production qualification. A health 200 is not “24-hour ready.”

## Troubleshooting map

| Symptom | First checks / honest action |
|---|---|
| Link works but no export | Source media missing; attach authorized original |
| Upload stopped after closing browser | Server job continuation does not apply to unfinished local upload; reopen/reselect/resume |
| Upload too large | Compare measured bytes to approved cap; offer documented source-preparation options, never unnoticed loss |
| Many clips queued | Check centralized quota/budget/backoff, not only worker count |
| Hours spent but little progress | Separate transfer, quota, human-review, provider and rendering waits |
| Voice changed halfway | Stop release; inspect model/profile snapshots; do not hide fallback |
| Wrong names late in story | Review glossary/context evidence and impacted line list |
| Full 24-hour file rejected by destination | Use validated publication parts; internal support ≠ upload permission |
| Download keeps restarting | Check immutable version, range support, credential refresh and local storage |
| Project missing after restore | Check artifact bytes as well as metadata backup coverage |
| Spend differs from estimate | Reconcile retry/unknown outcomes, units/rates, FX/taxes and transfer/storage cost |

## Support and privacy

Diagnostic export contains redacted config versions, request/job/attempt IDs, error codes, fixture/media metadata and checksums—not raw secrets, live signed URLs or private transcripts by default. Owner explicitly approves any content sample shared for debugging. Use the incident and handoff templates.

Maintain a tested-environments/known-limitations page once actual results exist. Do not advertise supported browsers, codecs, providers, processing time or a public SLA from this proposed matrix alone.
