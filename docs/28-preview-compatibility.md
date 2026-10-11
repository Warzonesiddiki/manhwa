# 28 — Preview delivery, browser compatibility, and accessibility

**Status:** proposed support/testing matrix. No browser or codec combination is currently certified.

## Preview is not the production render

Serve a low-bandwidth, source-linked preview/proxy or episode preview as needed. Keep source-to-proxy timestamps and any transcode offset explicit. Master source stays private and is not downloaded into browser memory simply to show a waveform.

V1 baseline can use range-served MP4 episode proxies with an overview timeline. HLS/DASH are optional only if measurements justify their packaging, player, signing and cleanup complexity. Do not build a streaming service unnecessarily.

## Day-long navigation

- Canonical positions are numeric durations, including `24:00:00`, not dates.
- Virtualize transcript/issue rows; test at least 10,000 items and long Urdu text.
- Waveform peaks/thumbnails are tiled/downsampled artifacts; load the current window, not a full 24-hour decoded audio buffer.
- Separate source-global, episode and publication-part timeline labels.
- One media clock drives playback; buffering/pause/seek does not let an independent timer advance narration.
- Seek/rate/volume changes synchronize video and audio; delayed async loads cannot start a stale segment after selection changes.
- Generation readiness, cached audio availability and actual browser playability are separate states.

## Browser/device policy proposal

Primary authoring target: current desktop Chromium on a supported desktop OS, then Firefox and Safari compatibility verified by representative tests. No precise minimum version is promised until the matrix is run. Mobile initially supports status/review/playback where tested; large-file upload and full editing may remain desktop-recommended with an honest message.

Test file selection/reselection, clipboard, sign-in popups/redirects, audio autoplay gesture restrictions, cross-origin signed media, range requests, browser back/refresh, low bandwidth, sleep/wake, and long-session token expiry. Avoid relying on experimental filesystem APIs without fallback.

## Media matrix

Measure source support by actual decode capability and safe inspection, not extension alone. Export profiles prioritize MP4 with commonly supported video/audio codecs, but exact codecs/licenses/runtime build remain approved configuration. Validate variable frame rate, differing sample rates, stereo, rotation, nonzero start timestamp, very long duration, and trailing metadata.

A worker decoding an input does not imply every browser can preview its original codec. Offer a tested proxy or a clear unsupported-preview state while preserving the original for valid rendering.

## Urdu/RTL and accessibility acceptance

UTF-8 storage, tested shaping/font fallback, per-field direction, mixed names/numbers/punctuation, screen-reader labels and live status, logical focus order, keyboard dialogs, reduced motion, contrast and accessible error recovery. Urdu text cannot be treated as a decorative screenshot; copy/edit/search must work.

Locale-sensitive formatting must not modify serialized timestamps or identifiers. Display timezone only for calendar events; duration remains timezone-independent. Do not split combining characters incorrectly for subtitles/text limits.

## Resource targets

Set measured p95 interaction targets and browser-memory budget during staging, relative to a documented reference device. Required invariant: scrolling or previewing hour 23 does not require fetching all earlier clips or retaining all previously played media. Revoke obsolete object URLs, cancel stale fetches, dispose audio nodes and bound caches.

TEST-025 covers this matrix. Claim only tested environments and publish known limitations in owner onboarding.
