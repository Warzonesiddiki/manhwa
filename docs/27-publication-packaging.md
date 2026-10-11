# 27 — Output packaging and YouTube publication readiness

**Status:** proposed mandatory packaging contract. Publication remains manual in v1.

## Source support is not destination support

YouTube currently documents a maximum upload of **256 GB or 12 hours, whichever is less**, with account verification needed to upload beyond the ordinary 15-minute limit. The official page notes that older videos can exceed current limits. Recheck before release; do not infer permission from an old 24-hour video already online. [1](https://support.google.com/youtube/answer/71673?hl=en&co=GENIE.Platform%3DDesktop)

Therefore a supported **24-hour source/project must not be labeled a single YouTube-uploadable 24-hour video**. A full master is an archival/local artifact if separately generated and validated. Publication outputs are episodes or destination-compliant parts.

## Three output products

| Product | Meaning |
|---|---|
| Episode | Story-based 15–30 minute suggested unit with a local caption/chapter timeline |
| Publication part | One or more approved episodes, sized/duration-checked against a destination profile |
| Archival master | Optional full approved source timeline, explicitly not guaranteed compatible with a destination upload |

Proposed default: episode package; optional longer parts below the current destination limits with operational headroom. A 24-hour project might use 3 × about 8-hour parts, or more smaller parts, depending on bytes, episode boundaries and inserted material. Do not blindly split at 12:00:00: introductions/outros, encoding duration and maximum-size limits still count.

## Destination profile

Versioned profile fields: destination, verification/restriction status acknowledged by owner, max duration and bytes, preferred codec/container, safe operational margin, subtitle mode, metadata rules, evidence URL, last verified date. A profile is guidance, not a remote promise that an upload will be accepted.

Validate **actual rendered** duration/bytes against profile after encoding. If invalid, repartition/re-encode with explicit approval. Re-encoding cannot solve a duration violation by itself. Never time-compress the story or cut dialogue to squeeze under a cap.

## Package manifest and time maps

`PublicationPackage` references exact approved source/script/audio revisions and destination profile. Each `PublicationPart` has ordered episode/artifact IDs, source intervals, local intervals, measured duration/bytes/checksum, output URLs generated on demand, QA status, chapter/caption artifacts and attribution.

Mapping is explicit: source position → episode-local position → part-local position. For simple unchanged contiguous source: `partMs = sourceMs - part.startMs`; inserted intros/outros or excluded spans require a piecewise map with synthetic intervals distinguished. Do not assume subtraction works after edits.

Union of intended source intervals must equal selected coverage exactly, with no unintended duplicates/gaps. Supplemental intros/outros are not source coverage. A package may become ready incrementally by part, but project completion requires all required parts and QA. A failed optional archival master must not hide already-valid publication parts or falsely mark that master successful.

## Subtitles, chapters and metadata

Regenerate caption/chapter timestamps for **each output's local timeline**. Include Urdu/Roman/dual UTF-8 sidecars as chosen; validate line breaks/shaping for burn-in. Titles/part numbering, continuation notes, source attribution, licensed music/font credits where required, and clear description of localization must be reviewed by owner. No unsupported SEO/monetization claims.

## Rights, monetization and disclosure are separate

YouTube's monetization guidance treats reused-content assessment separately from copyright permission, and its policy can apply even when the creator permits reuse. Translation/dubbing alone is not a guarantee of monetization. [1](https://support.google.com/youtube/answer/1311392?hl=en)

Owner must review current disclosure and publishing policies for the actual generated content; the app must not automatically assert disclosure is unnecessary or that its use guarantees compliance. Keep a versioned release checklist and provenance evidence, not legal certification.

## Failure and release checks

Before download/release: correct source, complete approved audio, no unresolved critical issues, actual size/duration under selected profile, valid local captions/chapters, no overlap/gap, correct part numbering/attribution. Link-only projects cannot produce a falsely “ready” package. TEST-023 is mandatory for 24-hour support.
