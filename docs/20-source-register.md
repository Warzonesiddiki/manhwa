# 20 — Official source register and verification boundaries

**Reviewed:** 2026-10-11. Documentation review is not a live account/API/infrastructure test. Recheck before implementation, model changes, and release.

## External capability evidence

### Google AI Studio Build

Google documents React/Node full-stack applications, server-side secrets, GitHub import/two-way synchronization, ZIP export, and Cloud Run deployment. The Build page's GitHub FAQ was read directly during planning; account UI and branch support still require a practical check. [1](https://ai.google.dev/gemini-api/docs/aistudio-build-mode)

Google's full-stack guide describes server-side Node logic, secrets, and external database connections. This does not itself provision the architecture proposed in these docs. [2](https://ai.google.dev/gemini-api/docs/aistudio-fullstack)

### Gemini media/voice

Video understanding documentation describes supported YouTube URL analysis and associated limitations. Treat analysis access separately from download/render access and permissions. [1](https://ai.google.dev/gemini-api/docs/generate-content/video-understanding)

Audio understanding documentation describes transcription and audio-request limits. Chunking is a deliberate project design regardless of a model's maximum context. [2](https://ai.google.dev/gemini-api/docs/generate-content/audio)

Speech generation documentation describes controllable TTS and model/language capabilities. Exact Urdu quality, voice choice, request parameters, response MIME/rate, quotas, and pricing must be tested against the selected endpoint. [1](https://ai.google.dev/gemini-api/docs/speech-generation)

### YouTube source permissions

YouTube API Services Developer Policies restrict downloading/importing/caching audiovisual content without prior written approval. Content ownership/licensing does not automatically resolve platform-specific API acquisition rules. [1](https://developers.google.com/youtube/terms/developer-policies)

Captions download requires authorization and permission to edit the video. It is not a universal public-video transcript API. [2](https://developers.google.com/youtube/v3/docs/captions/download)

### Cloud execution

Cloud Tasks HTTP targets have a default ten-minute and maximum thirty-minute response deadline; long media work should be launched/reconciled separately rather than held open in that request. [1](https://docs.cloud.google.com/tasks/docs/dual-overview)

Cloud Run Jobs documentation permits task-timeout configuration, with different limits for GPU tasks. Timeout availability does not establish adequate writable disk, memory, codec support, or economical 24-hour rendering. [1](https://docs.cloud.google.com/run/docs/configuring/task-timeout)

### Data use and privacy

Gemini terms distinguish paid and unpaid services and warn against submitting confidential/sensitive/personal data to unpaid services; regional/account details and current terms must be reviewed. [1](https://ai.google.dev/gemini-api/terms)

Optional log/dataset sharing can carry separate data-use implications. Do not enable content sharing as an unnoticed debugging convenience. [3](https://ai.google.dev/gemini-api/docs/logs-policy)

## Capability registry to populate in TASK-002

| Field | Required evidence |
|---|---|
| Provider / API / exact model | Actual request in selected account; no inferred availability |
| Account/region/billing tier | Allowed usage and data handling reviewed |
| Input/output schema | Request fixture, validated response, failure examples |
| Audio format | Measured MIME/container, sample rate/channels, duration, metadata |
| Language/voice | Native Urdu listening score and difficult-name benchmark |
| Limits | Current docs + account quotas; text/media/context/concurrency/output constraints |
| Pricing | Dated official rate source, billable units/currency, observed usage reconciliation |
| Retry/idempotency | Documented behavior + fault test where feasible |
| File lifecycle | Provider retention/expiry/delete behavior and project cleanup strategy |
| Change policy | Prompt/model version, regression set, revisit date |

## Not verified in this planning session

Owner's source-file rights/access; AI Studio account configuration; provider account/model calls; cloud billing/quota/region; FFmpeg worker images; true 24-hour resource usage; final costs; native listener ratings; deployment privacy; legal clearance. All remain explicit gates, not facts implied by the proposed design.

## Internal evidence

[AUDIT.md](../AUDIT.md) records source-review findings and the local checks actually run on the current prototype. [CURRENT_STATE.md](CURRENT_STATE.md) separates those findings from unimplemented plans. Do not promote a recommended architecture to “deployed” because its official services exist.

## Additional official evidence for the 24-hour expansion

YouTube's upload help currently specifies **256 GB or 12 hours, whichever is less**, and notes account-verification and historical-limit differences. A 24-hour project therefore requires a destination-specific publication package rather than an assumed single upload. [1](https://support.google.com/youtube/answer/71673?hl=en&co=GENIE.Platform%3DDesktop)

YouTube's channel monetization policy says reused-content assessment is separate from copyright permission and can apply even with creator permission. Dubbing is not automatic monetization approval. [1](https://support.google.com/youtube/answer/1311392?hl=en)

Cloud Run's runtime contract describes the ordinary writable filesystem as in-memory and nonpersistent. Large-source scratch strategy must be benchmarked rather than treated as free persistent disk. [2](https://docs.cloud.google.com/run/docs/container-contract)

Cloud Storage resumable-upload docs identify the session URI as a sensitive upload capability and document one-week expiration. App logout and provider-session revocation are distinct; browser/local-file resumption must follow the selected protocol. [1](https://docs.cloud.google.com/storage/docs/performing-resumable-uploads)

Reviewed 2026-10-11 through official documentation search results. These sources establish platform constraints, not actual account quotas or measured project capacity. The 24-hour/128 GB support envelope is a proposed application profile with separate qualification tasks.
