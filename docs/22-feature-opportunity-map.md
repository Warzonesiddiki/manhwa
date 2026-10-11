# 22 — Recommendations and future feature map

**Status:** prioritization advice. Only v1 items belong in the committed roadmap; later ideas require evidence and approval.

## Must-have: make the tool real

| Capability | Why it matters |
|---|---|
| Authorized source workflow | Without source bytes, video export is not real |
| Real transcript + uncertainty review | Prevents fabricated story and bad downstream translation |
| Private owner access/storage | Protects content, keys, and spend even for a personal app |
| Persistent projects and revisions | Prevents loss of hours of editing |
| Glossary/pronunciation control | Keeps long-form names and terms consistent |
| Urdu/English/Roman workbench | Makes human review practical |
| Voice pilot and locked profile | Avoids paying for thousands of unsuitable clips |
| Correct artifact caching/invalidation | Makes edits cheap and predictable |
| Durable jobs/checkpoints/cancellation | Makes 10–24 hour operation feasible |
| Cost estimates and budget gates | Prevents unattended runaway spending |
| Correct audio decoding and timing | Prevents noise, clipping, overlap, and truncated dialogue |
| Correct source/range export | Prevents sample substitution and partial videos |
| Episode/publication-part package + optional full archival master | Covers day-long sources without implying a 24-hour file meets destination limits |
| QA report and manifest | Makes outputs reproducible and diagnosable |
| Backup/archive/restore | Turns a prototype into a dependable workstation |

## Should-have: improve daily productivity after the core works

- Global reusable glossary with project-specific overrides and collision warnings.
- Search/filter by name, source phrase, issue severity, changed text, or missing audio.
- Keyboard-first transcript review and bulk approval with visible scope.
- Saved narration presets, pilot comparison, and pronunciation exception library.
- Cost preview for “change this voice across the entire project.”
- Job completion/error notification chosen by owner, without exposing private content.
- Review bookmarks and export QA notes; waveform navigation and segment audition.
- Source-aware chapter suggestions, editable cliffhanger boundaries, reusable licensed intro/outro assets.
- Sidecar captions and optional tested Urdu burned-in captions.
- Usage reports separating provider cost, media compute, storage, and regeneration waste.

## Later experiments: require measurable benefit

- Authorized owner-caption integration to reduce ASR cost where permissions allow.
- Alignment provider or local aligner only after Urdu accuracy validation.
- Licensed music/effects stem mixing and ducking.
- Source separation with explicit artifacts/cost/leakage trade-offs.
- Pronunciation lexicons or custom voice design only with supported provider terms and clear rights.
- NLE export with real media references, escaped XML, and actual editor import tests.
- Better long-context visual analysis to resolve ambiguous scenes; use only if it improves fidelity enough to justify cost.
- Batch channel libraries and project templates once single-project durability is proven.

## Separate products, not quiet scope additions

Raw panels → animated recap creation; multi-language localization; multi-speaker acting/lip-sync; collaborative approval teams; public subscriptions/billing; automatic YouTube publishing. Each adds distinct data, rights, UI, infrastructure, and quality requirements. Do not implement them just because the prototype already has a button.

## Explicitly avoid

Unlimited arbitrary YouTube download promises; one-shot day-long AI requests; browser-dependent long rendering; fake progress; success from placeholder tones; secret entry forms; global segment-ID caches; indiscriminate dependency installation; deploying generated code before tests; unnecessary new services before a benchmark; claiming perfect Urdu, perfect separation, copyright clearance, or guaranteed monetization.

## How to prioritize a new idea

Score: real owner pain, frequency, quality/cost improvement, evidence strength, security/rights risk, and implementation/operational burden. A small pronunciation fix used in every episode can outrank a visually impressive new creation mode. Write a feature spec, define a test, approve its cost, and measure whether it improved the actual workflow.
