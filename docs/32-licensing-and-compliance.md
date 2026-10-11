# 32 — Software, model, media, and publication compliance checklist

**Status:** operational checklist, not legal advice or an executed license review.

## Distinct rights inventories

1. **Source content:** footage, manhwa art, script/recap, music, effects, intro/outro, attribution, permitted derivatives/languages/territories and expiry.
2. **Narration provider:** stock voice availability, permitted commercial/distribution use, model service terms, data handling and applicable consent limits.
3. **Software/build:** application dependencies, worker container/base image, FFmpeg build options/codecs, subtitle libraries, fonts and redistributed assets.
4. **Publication:** channel/platform rules, disclosure obligations where applicable, rights evidence and metadata.

Permission in one inventory does not automatically cover the others. A public Git repository without an explicit application license must not be assumed to grant any particular distribution license. The owner chooses a repository license with appropriate advice if distribution is planned.

## Required release inventory

Component/asset name, version/hash, origin, applicable license/terms URL, permitted use, obligations, notices/attribution, redistribution/build restrictions, evidence owner and review date. Inventory actual installed versions and container build options, not just top-level package names. Generate an SBOM/license report during implementation and review its findings.

Codec/font/media obligations can depend on the selected build and distribution mode. Do not assert all FFmpeg builds or all downloadable fonts are interchangeable or cleared. Include font packaging and Urdu shaping tests when selecting a production font.

## Content-processing agreement

Record that the owner is authorized to provide the source for processing by the chosen providers and publish the localized result. Private creator permission, underlying artwork/music rights and platform acquisition permissions may differ. A checkbox/AI classifier is not legal clearance.

Keep sensitive rights evidence private, minimize personal data, record permission expiry, and define revocation/deletion behavior for derived outputs. If permission changes during a multi-day job, pause release and review; do not rely only on the original upload timestamp.

## Publication caveat

YouTube says reused-content monetization assessment is separate from copyright enforcement and can apply even where permission exists. Do not sell this tool's Urdu dub, AI voice or editing as guaranteed monetizable. [1](https://support.google.com/youtube/answer/1311392?hl=en)

Disclosure/legal notices must be reviewed against actual product behavior and current policies before production. No auto-generated privacy policy claiming practices we have not implemented. A private tool still needs an owner-visible data-flow/retention statement; public SaaS terms are deferred because public SaaS is out of scope.

## Approval gate

TASK-046 produces the actual dependency/image/font/media inventory, reviewed notices, owner-approved provider/rights configuration and flagged uncertainties. TEST-029 verifies inventory coverage and that unreviewed mandatory assets/terms block the release checklist. It does not assert a legal opinion.
