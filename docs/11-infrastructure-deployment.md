# 11 — Infrastructure and deployment plan

**Status:** recommended, unprovisioned. Confirm budget/account/region before execution.

## Environments

- **Development / AI Studio:** synthetic or non-sensitive licensed fixtures; demo adapters visibly marked; low quotas; no production data copies by default.
- **Staging:** deployed API + real private storage/DB/worker image; separate secrets/identities and strict limits; live provider/media integration tests.
- **Private production:** one allowlisted owner, approved providers, backups, monitoring, no automatic public sharing.

Prefer separate cloud projects for staging/production when affordable and manageable; at minimum enforce isolated namespaces, buckets, identities, secrets, and budgets. Choose region after checking service/model availability, latency, pricing, and any source-license/data requirements—not solely the owner's location.

## Provisioning checklist

1. Owner approves DEC-002 architecture, budget cap, provider terms, and region.
2. Configure billing notifications and application-level stop controls; notifications alone are not hard spend caps.
3. Enable only required APIs; create distinct API, dispatcher, worker, and CI identities.
4. Set up private object storage, retention/lifecycle, upload CORS, and scoped resumable uploads.
5. Set up metadata database, indexes, access rules/permissions, backup/export, and restore test.
6. Configure owner authentication and backend authorization.
7. Build a reproducible media worker image with pinned FFmpeg/FFprobe, required codecs/subtitle fonts, image scan, and license review.
8. Configure job resource/concurrency/time/scratch limits and dispatcher/reconciler.
9. Add secrets through the platform/secret manager; use workload identity for cloud access rather than committed service-account JSON.
10. Deploy staging, test access and actual media operations, then run release gates before production.

## Logical configuration register

Future environment/config names (no values or real credentials):

| Key | Purpose |
|---|---|
| `APP_ENV`, `APP_ORIGIN`, `PORT` | Runtime/origin settings |
| `ALLOWED_OWNER_UID` | Private owner authorization |
| `GEMINI_API_KEY` | Server-side provider secret where Developer API is selected |
| `ASR_PROVIDER`, `ASR_MODEL`, `ADAPT_MODEL`, `TTS_PROVIDER`, `TTS_MODEL` | Explicit tested adapters/models |
| `CLOUD_PROJECT`, `CLOUD_REGION`, `MEDIA_BUCKET`, `DATABASE_NAMESPACE` | Resource identity |
| `WORKER_JOB_NAME`, `TASK_QUEUE_NAME` | Dispatch targets fixed by server config |
| `MAX_SOURCE_DURATION_MS`, `MAX_UPLOAD_BYTES` | Measured ingestion limits |
| `MAX_ACTIVE_PROJECTS`, `MAX_MEDIA_WORKERS`, `MAX_PROVIDER_CONCURRENCY` | Capacity controls |
| `OWNER_MONTHLY_BUDGET`, `PROJECT_BUDGET_LIMIT`, `RATE_CARD_VERSION` | Application cost controls |
| `SIGNED_URL_TTL_SECONDS`, `RETENTION_POLICY_VERSION` | Media access/lifecycle |

Secrets must not use browser-exported prefixes. Non-secret model IDs are still validated against a capability registry.

## Build/release contract

Pin supported Node and one package manager after testing AI Studio compatibility. The current Bun lock installs but fresh npm resolution conflicts (see audit); resolve this intentionally rather than maintaining mismatched locks.

Build frontend and API into separate output roots. Test the **built** server, not only `tsx` development mode. Client assets must not expose server.js, source maps with secrets, environment files, uploads, or caches.

CI plan: frozen install → types/lint/hooks → unit/schema/security tests → build → built-server smoke → worker/media fixture tests → dependency/image scan → staging integration → private manual approval. Production deployment cannot bypass failing gates by calling preview success sufficient.

## AI Studio boundary

Official documentation describes React/Node full-stack apps, server-side secrets, GitHub integration, and Cloud Run deployment. These capabilities support the app/control plane; worker images, IAM, storage lifecycle, backups, and long-form resource sizing still need explicit engineering and verification. [1](https://ai.google.dev/gemini-api/docs/aistudio-build-mode) [2](https://ai.google.dev/gemini-api/docs/aistudio-fullstack)

## Rollback

Keep immutable image/config revisions, database schema compatibility, and the previous tested release. Roll back code without deleting project data or blindly reversing completed migrations. Pause new work, preserve job checkpoints, deploy compatible version, reconcile in-flight leases, and validate a small render. Destructive migrations require a tested restore and owner approval.

## Worker hosting decision gate

Benchmark the largest planned source against memory, writable storage, read/seek performance, upload speed, task timeout, and restart behavior. Cloud Run Jobs are preferred only if that evidence supports them. If not, document a VM/disk worker using the same job/artifact interfaces; do not improvise oversized buffers in the API container.

## v0.2: day-long infrastructure evidence

Add profiles for 24-hour timeline support and proposed 128 GB inputs; no increase is approved merely by editing an environment variable. Qualify actual source reads/seeks, scratch/output staging, container/file limits, transfer expiry, provider quota waits, old/new worker compatibility and backup storage costs. Use the validated Cloud Run or disk-backed worker choice from doc 23/DEC-002.

Additional logical config: `RESOURCE_PROFILE_VERSION`, `DESTINATION_PROFILE_VERSION`, `PREVIEW_PROFILE_VERSION`, `CAPABILITY_SNAPSHOT_POLICY`, `GC_GRACE_PERIOD`, `REVIEW_HOLD_POLICY`. Values remain unset/proposed until actual measurements and owner approval; these are not new runtime settings implemented today.
