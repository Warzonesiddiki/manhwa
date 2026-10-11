# DEC-008 — Runtime, package manager, and type-checker pin

Status: accepted (owner delegated decision authority for engineering/tooling choices in the 2026-10-11 YOLO-mode implementation session)
Date: 2026-10-11 · Approver: owner (delegated) · Replaces/replaced by: none

## Context and constraints

The audited prototype had no pinned toolchain: a committed `bun.lock` worked with frozen
Bun installs while fresh `npm install` failed with an `ERESOLVE` peer conflict
(esbuild `^0.25.0` vs Vite 8.3.4's optional peer `^0.27.0 || ^0.28.0`). AGENTS.md requires
pinning one supported runtime and package manager after a compatibility spike and keeping
the lockfile coherent. TASK-004 also mandates real ESLint + React Hooks checks; the
mandated `typescript-eslint` stack is the binding constraint on the type-checker version.

Compatibility evidence gathered 2026-10-11 in this environment:

- `npx bun@1.4.3 install --frozen-lockfile --ignore-scripts` passes on the committed lockfile.
- `typescript@7.0.2` (current npm `latest`, native Go port) **hard-fails to load
  `typescript-eslint@8.71.1`** (`typescript-eslint does not support TS 7.0`, github.com/typescript-eslint/typescript-eslint#10940).
  TypeScript's own guidance is to run embedding tools on the TS 6 API side-by-side.
- `typescript@6.0.3` satisfies typescript-eslint's peer range (`>=4.8.4 <6.1.0`) and
  type-checks this repository cleanly under `strict` (zero errors).

## Options

| Option | Benefits | Costs/risks | Evidence |
|---|---|---|---|
| A: Pin Bun 1.4.3 + Node >=22.12 + TypeScript ~6.0.3 | Coherent lockfile; mandated lint/hooks gate works now; tsc behavior identical to TS 7 for clean-compiling code | Loses TS 7 compiler speed; must revisit when typescript-eslint supports TS >=7.1 | Frozen install PASS; eslint/tsc PASS on this commit |
| B: Keep TypeScript 7 and skip typescript-eslint | Fastest type-checks | Cannot satisfy the mandated React Hooks/lint gate; audit gap remains open | typescript-eslint throws at load |
| C: Dual compilers (TS 7 CLI + TS 6 for lint via aliases) | Both speeds | Two compilers can disagree; incoherent toolchain; extra scripting | Not adopted: conflicts with "one supported toolchain" rule |

## Decision

**Option A.** `packageManager: bun@1.4.3`, `engines.node >=22.12.0`, `typescript ~6.0.3`
(with `strict: true`), `esbuild ^0.28.0` aligned to Vite 8's declared peer range so that
`npm install --ignore-scripts --dry-run` also resolves (npm stays a *supported-but-secondary*
path; Bun is the authoritative manager and the committed `bun.lock` is the reproducibility
source). Test stack: `vitest@5.0.3` + `jsdom@30.1.2` + `@testing-library/react@16.3.3` +
`@testing-library/dom@10.4.2`. Lint stack: `eslint@10.12.0` + `@eslint/js@10.0.1` +
`typescript-eslint@8.71.1` + `eslint-plugin-react-hooks@7.1.1`, with
`react-hooks/rules-of-hooks` as **error** and `react-hooks/exhaustive-deps` as warn
(tighten after component refactors). New dev dependencies are pinned exactly.

## Consequences

- CI (`.github/workflows/ci.yml`) runs frozen Bun install → strict typecheck → ESLint/hooks
  → vitest suites → build on every push/PR of the **public** repository; the workflow holds
  no secrets and makes no paid calls. If the repository is made private, GitHub Actions
  minutes start counting against the account quota.
- `tsc` speed will lag TS 7 until the toolchain is re-spiked; acceptable at current scale.
- npm users can install again (peer conflict resolved) but `package-lock.json` is not
  maintained; do not treat npm results as release evidence.
- No application behavior changed by the pin itself (the only code changes in TASK-004 are
  the F06 hook-order fix and two lint-driven micro-fixes in `audioSynthesizer.ts`).

## Validation and revisit trigger

Revisit when **typescript-eslint supports TypeScript >= 7.1**
(github.com/typescript-eslint/typescript-eslint/issues/10940) or when Vite changes its
esbuild peer range. Validation evidence: TASK-004 session checks (see docs/CURRENT_STATE.md
and SESSION_HANDOFF.md), frozen install on a clean tree, and CI runs after push.

## Affected documents/tasks/tests

TASK-004 (this record is its acceptance evidence); TEST-001 (harness introduced;
built-server startup gate remains FAIL under F05 until TASK-005); docs/15-backlog.md
(TASK-004 status); docs/CURRENT_STATE.md; docs/CHANGELOG.md; README.md toolchain notes.
