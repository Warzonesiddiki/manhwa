# 30 — Provider capability, quotas, multi-day failure, and change policy

**Status:** proposed adapter/governance contract. No provider call, quota or price has been verified for the owner's account.

## Immutable capability snapshots

A job references a `CapabilitySnapshot`: provider, exact API/model, known model version if exposed, voice/language, output format, input/output limits, rate/concurrency limits, retry/idempotency behavior, file retention, supported region/tier, rate-card version, verification date and fixture evidence.

Model aliases can change behavior without an exposed stable version. Record that uncertainty; store actual outputs and provenance and do not claim byte-identical regeneration. Changes require a benchmark/pilot and explicit owner acceptance when they affect an active project's voice/style.

## Adapter contract

Operations: validate capability/input; estimate billable usage; submit bounded work; inspect/reconcile request when supported; decode/validate result; return typed artifact data/usage/error; cancel/delete provider resources where supported. No adapter receives arbitrary filesystem paths or lets source text invoke tools.

Separate transient failure, permanent input/policy rejection, malformed result, quota exhaustion, unsupported language/model, and **unknown external outcome**. Preserve provider request ID and safe diagnostic metadata without secrets/raw private content.

## Quota scheduler

Respect per-project/account/model request, token, audio, concurrency and daily limits as actually measured/documented. Do not treat a provider's RPM cap as per-worker. Use centralized scheduling/reservations, Retry-After where available, jitter, bounded attempts and a circuit breaker. Counter reset schedules/timezones come from the provider; do not assume local midnight.

Waiting for quota is an honest blocked/backoff state. Refresh ETA from observed effective throughput, including retries and queue wait. Do not spin thousands of sleeping worker containers when durable rescheduling is sufficient.

## Multi-day expiry scenarios

Signed storage access, auth tokens, upload sessions, provider file IDs, job leases and model availability all have independent lifetimes. Keep durable asset IDs and credentials separate; mint authorized short-lived access as needed. Revalidate right-to-process after a long pause, especially if rights or user access expired.

If provider-uploaded source expires, reupload only the needed bounded shard from the private durable source and account for usage. Do not require the original browser to stay open. If required source was deleted, fail clearly rather than manufacture replacement dialogue.

## External exactly-once limits

A lost response after submission may mean work completed and was charged. Query by provider request ID where supported. When reconciliation is impossible, mark usage unknown, retain a conservative reservation and ask/obey approved retry policy; internal dedupe alone does not guarantee no double billing.

Any new output from a retried nondeterministic TTS call is a distinct attempt. Only one validated result becomes the active artifact for a given committed step; retain lineage for discarded attempts and their costs.

## Fallback policy

No silent switch of model, voice, language, provider or data-processing tier. If the preferred service is unavailable: pause/queue, preserve successful work, explain ETA uncertainty, and offer a separately estimated alternative only after privacy/licensing review and a new voice pilot. Never concatenate alternating fallback voices into a “consistent narrator” export unnoticed.

## Safety/policy refusal

Treat a model refusal as a typed review blocker. Provide legitimate source/content review options; do not implement bypass prompts, repeated automatic attempts to evade restrictions, or fabricated output. Keep refusal handling privacy-preserving and inform the owner what can be retried legitimately.

## Tests

Mid-project model removal; changed response MIME; 429 storms; 5xx; timeout after provider success; malformed output; expired files; circuit breaker open/half-open; budget depleted with in-flight calls; resumed job sees changed price/model. TEST-026 and TASK-041 own these gates.
