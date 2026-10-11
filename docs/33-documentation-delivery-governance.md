# 33 — Documentation completeness and implementation handoff

**Status:** planning governance. This library specifies the intended system; it does not replace measurements, approved decisions or working code.

## Authority and accountability

The owner decides scope, budget, rights, provider/data use and release acceptance. The coding agent proposes/implements only approved tasks and records evidence; it cannot self-approve spend, legal clearance, production readiness or a changed product promise. Automated checks can validate links/contracts, not whether narration is faithful.

## What this planning phase can complete

Product scope, requirements, UX states, contracts, architecture alternatives, capacity arithmetic, security controls, job/recovery semantics, quality/review policies, lifecycle, tests, roadmap/backlog, rollout/operations procedures, source evidence and reusable templates. Numbers/service selections explicitly marked proposed remain proposals until approved.

## What cannot honestly be pre-completed

| Artifact | Current status / required task |
|---|---|
| Exact provider capability, voice quality, account quotas/rates | Unmeasured; TASK-002/041 |
| Worker memory/scratch/24-hour throughput/cost results | Unmeasured; TASK-003/028/038/049 |
| Executable OpenAPI and runtime validators matching implementation | Design outline exists; TASK-008; no false assertion current legacy server implements `/api/v1` |
| Database migrations/indexes and restore scripts | Design exists; TASK-007/027/043 |
| Docker/FFmpeg codec build, CI and infrastructure-as-code | Not implemented; TASK-004/031/046 |
| Final license/privacy notices and rights clearance | Needs actual asset/provider choices and owner review; TASK-046 |
| Signed deployment/release/quality reports | Blank templates until evidence exists; TASK-033/049 |
| Production secrets/resource IDs/account permissions | Configured privately later; never invented in docs |

“Remaining docs completed” means required plans/templates are covered—not that these future factual artifacts can be manufactured now.

## Change-impact rule

A changed limit, model, feature, privacy practice or storage policy updates: requirement → decision → contracts/data/API → tests → backlog/dependencies → roadmap → current state → owner guide → changelog. Keep prior audit evidence and historical changelog entries intact. No global search/replace that turns a 10-hour arithmetic example into incorrect 24-hour figures.

Scope v0.2 expands the maximum target to 24 hours. TEST-018/TASK-030 remain the 10-hour intermediate milestone; TEST-027/TASK-049 become the final 24-hour qualification. Optional improvements remain after the private release and are not prerequisites unless explicitly promoted.

## Review checklist for each documentation update

- Local links, unique/stable requirement/task/test IDs and code fences valid.
- All referenced tasks/decisions exist; dependencies acyclic and release-gating work not accidentally optional.
- Capacity arithmetic, GB/GiB and hours/ms/sample conversions checked.
- Source duration, job lifetime, worker timeout and publication limits not conflated.
- Every external capability claim has official evidence and date; account behavior still labeled unverified when so.
- Distinguish confirmed owner intent, recommended default, open decision and implemented fact.
- Do not alter the historical audit to imply its defects were fixed.
- Update small “current state” so AI Studio sessions do not depend on an enormous chat transcript.

## Context packs for later AI Studio sessions

| Work area | Minimum reading |
|---|---|
| Source/transfer | AGENTS, current state, requirements, docs 03/10/23/24, TASK-039 |
| Jobs/provider | Docs 05/06/07/12/23/29/30 plus relevant tests |
| Urdu/review | Docs 08/17/25/26 and quality fixture manifest |
| Media/package | Docs 09/23/27/28 and render contract/tests |
| Operations/release | Docs 11/13/19/29/31/32/34 and release evidence |

One session still executes one bounded task. Ask for a plan, approve scope, run checks, review diff and write handoff. Do not paste every document and ask an agent to “build everything.”

## Planning handoff gate

Before coding: owner confirms source access, approximate bitrate/size, budget, provider/cloud consent, expected output package and acceptable review/completion time. Before production: every mandatory gate including measured 24-hour qualification, restore, compliance and owner acceptance passes. Unanswered questions are tracked blockers, not silently filled with assumptions.

## Reproducible documentation validation

Run from the repository root with Python 3. This validates documentation structure and selected capacity arithmetic only; it does not run the planned application tests, verify live external URLs, certify legal rights, or prove runtime capacity. Changes to the approved catalog sizes must update this check deliberately.

```bash
python3 - <<'PY'
from pathlib import Path
import json
import math
import re

planning = [Path('README.md'), Path('AGENTS.md'), *sorted(Path('docs').rglob('*.md'))]
files = [*planning, Path('AUDIT.md')]
assert len(planning) == 54  # +2 after docs/decisions/DEC-008 + DEC-011 (TASK-004/006, 2026-10-11)
catalogs = {}
for prefix, name, count in [
    ('REQ', '01-requirements.md', 32),
    ('TASK', '15-backlog.md', 49),
    ('TEST', '13-testing-release.md', 29),
]:
    found = re.findall(r'^\| (' + prefix + r'-\d{3}) \|', Path('docs', name).read_text(), re.M)
    assert len(found) == len(set(found)) == count, (prefix, 'duplicate or missing definition')
    catalogs[prefix] = set(found)
    assert catalogs[prefix] == {f'{prefix}-{n:03}' for n in range(1, count + 1)}

for path in files:
    text = path.read_text()
    assert len(re.findall(r'^```', text, re.M)) % 2 == 0, (path, 'unbalanced code fence')
    for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
        if target.startswith(('https://', 'http://', '#', 'mailto:')):
            continue
        relative = target.split('#')[0]
        assert not relative or (path.parent / relative).exists(), (path, target)
    for prefix, defined in catalogs.items():
        for identifier in re.findall(r'\b' + prefix + r'-\d{3}\b', text):
            assert identifier in defined, (path, identifier)
    for block in re.findall(r'```json\n(.*?)\n```', text, re.S):
        json.loads(block)

hub = Path('docs/README.md').read_text()
for path in Path('docs').rglob('*.md'):
    if path.name != 'README.md':
        assert f']({path.relative_to("docs").as_posix()})' in hub, path

graph = {}
for row in Path('docs/15-backlog.md').read_text().splitlines():
    if re.match(r'^\| TASK-\d{3} \|', row):
        cells = [cell.strip() for cell in row.split('|')]
        graph[cells[1]] = {f'TASK-{n}' for n in re.findall(r'\b\d{3}\b', cells[3])}
visiting, done = set(), set()
def visit(task):
    assert task in graph, ('undefined dependency', task)
    assert task not in visiting, ('dependency cycle', task)
    if task in done:
        return
    visiting.add(task)
    for dependency in graph[task]:
        visit(dependency)
    visiting.remove(task)
    done.add(task)
for task in graph:
    visit(task)
required, pending = set(), list(graph['TASK-033'])
while pending:
    task = pending.pop()
    if task not in required:
        required.add(task)
        pending.extend(graph[task])
assert {f'TASK-{n:03}' for n in range(38, 50)} <= required
assert not {f'TASK-{n:03}' for n in range(34, 38)} & required

assert 24 * 3600 * 1000 == 86_400_000
for mbps, expected_gb in [(2, 21.6), (4, 43.2), (8, 86.4), (12, 129.6), (16, 172.8)]:
    assert math.isclose(mbps * 1_000_000 * 24 * 3600 / 8 / 1e9, expected_gb)
assert math.isclose(48_000 * 2 * 2 * 24 * 3600 / 1e9, 16.5888)
assert math.isclose(24_000 * 2 * 24 * 3600 / 1e9, 4.1472)
assert math.isclose(128e9 * 8 / 10e6 / 3600, 28.444444444444443)
assert 24 * 3600 / 20 / 2 / 60 == 36
print('PASS: 54 planning documents + audit; 32 requirements, 49 tasks, 29 test families')
print('PASS: local links, inventory, JSON examples, fences, dependency DAG and release gates')
print('PASS: selected duration, size, transfer and request-quota arithmetic')
PY
```

Also inspect the staged diff with `git diff --cached --check` and verify that only the intended Markdown files are present. Secret scanning and semantic review complement these structural checks; none certifies absolute perfection.
