# DEC-011 — Owner authentication/session pattern (interim)

Status: accepted (owner delegated engineering/product decisions in the 2026-10-11 YOLO-mode session; interim implementation — revisit with DEC-002)
Date: 2026-10-11 · Approver: owner (delegated) · Replaces/replaced by: none (Firebase Authentication remains the planned upgrade)

## Context and constraints

REQ-001 requires private single-owner access enforced server-side on every resource (AUDIT F03:
the prototype had no authentication at all). No cloud identity provider can be provisioned yet
because DEC-002 (hosting/billing) is unapproved, and the development environment must not depend
on an external service. The interim mechanism must be provider-agnostic and replaceable without
changing resource contracts.

## Options

| Option | Benefits | Costs/risks | Evidence |
|---|---|---|---|
| A: OWNER_TOKEN → HMAC-signed HttpOnly session cookie (server-side check on every API/media route) | Zero external dependencies; fail-closed; no JS-readable secrets; testable in CI | Shared static token (single owner only); rotation = restart with new token; no MFA | Implemented in TASK-006 with TEST-002 suite (56/56 green) |
| B: Firebase Authentication allowlisted UID | Documented recommendation (docs/04); scalable identity, Google-consented | Requires cloud project + billing consent (DEC-002); unavailable in this environment | Deferred until DEC-002 |
| C: No auth, rely on network boundary | Simplest | Directly reproduces AUDIT F03; forbidden by REQ-001 and mission rules | Rejected |

## Decision

**Option A (interim).** `OWNER_TOKEN` environment variable (server-side secret, never sent to the
client except as the login form input). Login (`POST /api/auth/login`, throttled 10/min/IP)
exchanges it for `mh_session`: an HMAC-SHA256-signed, expiry-bearing, `HttpOnly; SameSite=Strict`
cookie (12 h TTL; `Secure` in production). Every `/api/*` route except `/api/health`,
`/api/auth/login`, `/api/auth/session`, and every `/audio-cache/*`, `/uploads/*`, `/videos/*`,
`/dubbed-videos/*` access requires a valid session. **Fail closed:** if `OWNER_TOKEN` is unset in
production, protected routes return 503; in development an ephemeral token is generated and logged
once (auth still enforced). Timing-safe comparisons; tampered/expired cookies → 401.

## Consequences

- Single-owner semantics match the product scope; sessions survive server restarts while
  OWNER_TOKEN is stable; changing OWNER_TOKEN invalidates all sessions (acceptable rotation).
- The app shell (client bundle) is public; it contains no secrets. All data and media are gated.
- Upgrading to Firebase (DEC-002) replaces the login/session layer only; ownership checks and
  route guards stay. Worker identity for TASK-011 is a separate future decision.
- UI: minimal `LoginGate` overlay; session cookie is not JS-accessible (no localStorage tokens).

## Validation and revisit trigger

TEST-002 suite (`tests/api/auth.test.ts`): unauthenticated 401 on API + media, wrong token 403,
tampered cookie 401, throttle 429, fail-closed 503 without OWNER_TOKEN. Revisit when DEC-002
(Firebase/hosting) is approved, or if multi-user/team access is ever scoped (currently a v1
non-goal).

## Affected documents/tasks/tests

TASK-006 (this record is its decision evidence); TEST-002; REQ-001/019; docs/10-security-privacy.md
(interim identity); docs/CURRENT_STATE.md; docs/CHANGELOG.md; `docs/15-backlog.md` status log.
