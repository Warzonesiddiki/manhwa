# 03 — YouTube-link-first, authorized-source ingestion

**Status:** proposed product/legal boundary; not legal advice.

## Three separate capabilities

1. **Identify a video:** parse a link and optionally obtain permitted metadata.
2. **Analyze content:** a provider may understand supported media or a supported YouTube URL.
3. **Render a dub:** requires authorized access to the actual source-media bytes.

Do not treat these as interchangeable. Official Gemini documentation describes supported public YouTube video understanding, with service/model limits; this does not provide a general downloadable media asset or guarantee full transcription accuracy. [1](https://ai.google.dev/gemini-api/docs/generate-content/video-understanding)

YouTube API policies restrict downloading/importing/caching audiovisual content without YouTube's prior written approval. A content license and platform acquisition permissions are separate checks. [1](https://developers.google.com/youtube/terms/developer-policies)

The official captions download method requires authorization and permission to edit the video; it is not a captions endpoint for arbitrary public links. [2](https://developers.google.com/youtube/v3/docs/captions/download)

## Recommended v1 path

- Owner pastes a link; normalize to video ID, strip unneeded query parameters, store original link as provenance.
- Owner declares rights and permitted localization/distribution use.
- Owner uploads their original/local source file, or chooses an existing private project asset.
- Optionally import an owner-supplied SRT/VTT; validate timestamps against measured source duration.
- If metadata APIs are not configured, allow manual title entry. Do not block source upload on thumbnail availability.
- After upload, inspect and quarantine invalid media; only a validated asset can enter ASR/render jobs.

Optional later: authorized owner-caption integration via OAuth; permitted Gemini URL analysis for chapter suggestions. Neither is a prerequisite for processing an uploaded source. Never insert a downloader as an undocumented “temporary” workaround.

## Intake capability matrix

| Input | Allowed v1 behavior | Blocking condition |
|---|---|---|
| Public YouTube link only | Save project/reference, show source-needed state | No full-video export without a validated source asset |
| Private/unlisted link | Save reference, request source upload | Do not assume provider URL analysis supports it |
| Authorized original file | Resumable upload, inspect, transcribe/render | Invalid type, quota/size/duration limit, unclear rights |
| Video + supplied subtitles | Import as draft transcript and validate | Wrong timebase, overlapping/invalid spans, mismatched source |
| Arbitrary remote URL | Not supported initially | SSRF/acquisition risk; use private signed upload instead |

## Source manifest

Record title, normalized video ID/link, source SHA-256, owner-provided source origin, declared rights holder, permission evidence reference, allowed derivatives/languages/territories, attribution requirements, expiry/restrictions, soundtrack/art/footage rights where distinct, declaration time, and review status. Store evidence privately, not in public logs or Git. Avoid unnecessary personal data.

A checkbox records the user's assertion; it does not prove that all manhwa artwork, music, and footage are licensed or that YouTube will permit monetization. Do not advertise copyright clearance or guaranteed platform acceptance.

## Validation and security

Only accept YouTube hostnames for link parsing; never fetch arbitrary supplied URLs server-side. Reject malformed/oversized inputs. Remote-fetch support, if later needed, requires a separate SSRF threat review including redirects, DNS rebinding, private IP ranges, and egress restrictions.

Uploads use scoped resumable sessions, server-generated object keys, actual byte and media-type checks, checksum verification, and a bounded FFprobe/FFmpeg inspection worker. Failure leaves a visible rejected asset and a cleanup deadline.

## Deletion and revocation

If source rights expire or are withdrawn, block new generation/publishing, flag derived artifacts, and follow the owner's deletion policy. Remove provider-uploaded copies where supported and track expiry where deletion is delayed. Preserve a minimal non-content audit record only as permitted.

Before enabling an official metadata/captions integration, review API-specific storage/refresh, OAuth consent, scope, and deletion requirements against the current official policies. This is a phase-0 decision, not an assumption that all metadata can be retained forever.
