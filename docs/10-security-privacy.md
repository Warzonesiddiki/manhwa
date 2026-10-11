# 10 — Security, privacy, and rights controls

**Status:** proposed baseline. No public launch before audit regressions are fixed.

## Assets and trust boundaries

Protect source media, unpublished scripts, rights evidence, generated voices/videos, provider secrets, owner identity, cloud permissions, and budget. Untrusted inputs include URLs, filenames, multipart data, subtitles, archives, model output, and text embedded within source media.

## Threat/control matrix

| Threat | Required control / evidence |
|---|---|
| Path traversal and arbitrary file access | Opaque IDs + server-owned object mapping; no client filesystem paths; encoded traversal and symlink tests |
| Active HTML/SVG upload | Quarantine, allowlisted media types, actual decoding/probing, private separate delivery, restrictive headers |
| Unauthorized owner/API access | Verified token/session, owner allowlist, resource ownership checks, secure logout/token expiry |
| Private bucket leakage | No public ACL; least-privilege identities; short-lived scoped signed reads; list/download authorization |
| SSRF | No arbitrary URL fetch v1; vetted host/redirect/DNS/private-network controls before future URL ingestion |
| Command injection/parser exploit | Argument-array process invocation, patched media image, no shell interpolation, restricted protocols/network/permissions, resource sandbox |
| Cost/CPU/disk denial of service | Request bounds, rate/concurrency limits, atomic budget reservation, queue caps, scratch/storage quotas |
| Prompt injection in source | Treat transcript/media as data; no tools/credentials exposed to translation model; validate structured output |
| Secrets/log exposure | Server-only secrets, redacted logs, no raw provider stack traces, secret scanning |
| Duplicate/stale worker | Idempotency + fenced leases + immutable artifact commit |
| Malicious project archive | Quarantine, schema/size/hash validation, no path extraction outside destination, decompression limits |
| Supply-chain/unsafe deploy | Frozen lockfile, dependency review, image scan, built-server smoke tests, separate static output |

## Owner authentication

Proposed Firebase identity with backend token verification and one allowlisted UID. Do not rely on a hidden URL or the fact that an AI Studio workspace is private. A deployed endpoint has its own access boundary. For cookie-based sessions, require secure HttpOnly/SameSite cookies and CSRF defenses; for bearer tokens, document storage/refresh strategy and prevent cross-origin misuse. Choose one pattern in the auth spike.

Worker/queue calls use service identity with the smallest required roles. The UI cannot trigger arbitrary cloud-job arguments, choose object paths, or mint worker credentials.

## Privacy defaults

- Private buckets and server-mediated metadata; collect minimum rights/owner information.
- Do not log full transcripts or audio payloads by default; debug content capture requires explicit short-lived consent.
- Keep source/derived retention and provider file cleanup visible to the owner.
- Signed URLs are bearer credentials: redact from logs and avoid long-lived storage in manifests.
- Paid-provider data processing, retention, regional availability, and training/log-sharing settings must be reviewed before confidential material is submitted.

Google's terms distinguish unpaid and paid services: unpaid submissions may be used to improve products and may be human-reviewed, and the terms warn against submitting sensitive/confidential/personal information; paid-service terms describe different data use. Verify the applicable account/service terms, including any logging-sharing opt-in, before use. [1](https://ai.google.dev/gemini-api/terms) [3](https://ai.google.dev/gemini-api/docs/logs-policy)

Use public/rights-cleared non-sensitive fixtures while vibe coding. Do not upload confidential source videos into development chat simply because the production API plan is private.

## Retention proposals — owner approval required

Transient upload/render scratch: delete after successful commit or within 24 hours after terminal failure; failed-job debug artifacts: 7 days; raw source and final artifacts: 30 days after project archival unless pinned; security/usage metadata: 90 days without content. Backups have a separate documented expiry and deletion behavior. These are draft operational defaults, not promises already enforced.

## Rights and publication

Store source/voice/music/font licenses and required attribution. Never infer permission from public availability. No automatic publication in v1. Owner confirms export use and platform obligations; the tool cannot guarantee copyright clearance, monetization, or acceptance of AI-generated content.

## Release blockers

All baseline critical/high security findings repaired with regression tests; unauthenticated/wrong-owner access rejected; active-content upload blocked; budget and duration caps enforced; private media inaccessible without authorization; provider keys absent from bundles/logs; delete/restore and credential-rotation runbooks exercised.

## v0.2: transfer credentials and paused-project retention

Resumable-upload session URLs can outlive app sessions and grant upload capability. Protect/redact them, use server-owned destinations, reauthorize resume/finalize, quarantine late writes, and test logout/cancel limitations of the actual storage protocol (doc 24). Expiring signed reads must not be mistaken for durable artifact identity.

The draft age-based cleanup defaults apply only to eligible **unreferenced** objects. Active/paused/review/pinned assets are protected by explicit holds and reference checks (doc 29); a multi-day pause is not grounds to delete required source bytes. Rights revocation, project deletion, storage pressure and provider-file expiry require explicit state transitions, not broad recursive deletion.
