# 09 — Media, timing, mixing, and export specification

**Status:** proposed. FFmpeg/FFprobe and Urdu subtitle rendering must be tested in the chosen worker image.

## Source inspection

Measure container, codec, streams, duration, rational frame rate, rotation, sample rate, channels, and seekability. Reject invalid/oversized/encrypted inputs and unsupported formats clearly. Make a small proxy for preview where useful; the export always references the original asset hash and selected source interval.

Extract normalized audio for ASR without uploading unnecessary full video frames. Audio-only transcription is the baseline; visual analysis is optional when it materially helps resolve text/context.

## Canonical timing

Milliseconds are the domain timebase; media operations use rational time/sample conversions. Retain absolute source positions and episode-local offsets. Processing overlap is reconciled once so duplicated boundary words never become duplicate narration. Episode boundaries cover the selected source without accidental gaps/overlap.

## Narration artifact handling

Decode by actual MIME/container; never write arbitrary provider bytes to `.wav` and assume correctness. Parse RIFF chunks or use a real decoder; preserve provenance separately and never copy metadata bytes into PCM. Normalize to a chosen render format, proposed **48 kHz PCM** for video mixing, while retaining original generated artifacts.

Validate nonzero duration, expected channels/rate, peak levels, voiced content, unexpected silence, and content-fit signals. Speech/language detection is heuristic and can trigger review, not a guarantee that the spoken words are correct.

## Timing-fit policy

For each clip, compare measured duration with the allocated dialogue window:

1. If it fits, place at the planned start; preserve intended pauses.
2. If modestly long, propose a faithful shorter script and regenerate after approval.
3. If still slightly long, allow bounded time-stretch, initial proposal **0.90–1.10×** only after listening validation; do not change pitch.
4. Otherwise split/re-time the segment or require a timeline decision.

Never truncate speech silently or overwrite the following clip. Any video retime is explicit and versioned. Default behavior preserves original visual timing. Mix only intentional overlaps; optional short fades cannot hide missing phonemes.

## Original audio and background music

The original track usually combines English narration with music/effects. Lowering that track under Urdu leaves both narrators audible; it is **not** clean background preservation.

V1 default: mute the original mixed track and export clean Urdu narration; optionally mix an owner-supplied, rights-cleared music/effects stem with ducking. Source separation is a later benchmarked feature with artifact/leakage warnings, compute cost, and explicit approval. Do not promise perfect separation.

Proposed listening targets: consistent perceived loudness, no clipping, and true peak at or below -1 dBTP. A provisional integrated target of about -16 LUFS is an internal preset to audition, not a claim of a mandatory YouTube standard. Record normalization and limiter settings in the manifest.

## Long-form rendering design

- Stream/chunk PCM and render episodes independently; do not allocate whole-project PCM buffers.
- Use disk/object-backed intermediates within an explicit scratch budget.
- Prefer stream copy only when codecs, timestamps, boundaries, and destination container are compatible; otherwise transcode with a tested profile.
- Standardized segment outputs allow later concat/remux without decoding the entire marathon again, where compatibility tests permit.
- Exact cuts may require re-encoding around boundaries; keyframe seeking is not guaranteed frame-accurate.
- A full 24-hour output must account for container/audio size limits. 48 kHz stereo 16-bit PCM for 24 hours is approximately 16.59 GB, exceeding ordinary RIFF/WAV's ~4 GiB data-size capacity. Use RF64 where supported, FLAC, or per-episode WAV; never emit an invalid giant WAV.
- Never use `-shortest` as an unnoticed source-truncation policy. Determine and validate expected output duration explicitly.

## Export products

| Artifact | Contract |
|---|---|
| MP4 episode | Correct selected source interval, validated video profile and Urdu audio, complete narration |
| Optional archival full-marathon MP4 | Explicitly selected episodes/source span, full-duration QA, measured final bytes/checksum |
| Audio master | Episode WAV; long full master uses approved RF64/FLAC or split files |
| SRT/VTT | Urdu/Roman/dual modes; timing from approved timeline; UTF-8; valid ordered intervals |
| Burned-in captions | Optional tested render, not a mislabeled overlay that disappears on export |
| Manifest/archive | Source hash, revisions, settings, artifact hashes, QA and attribution; versioned schema |
| Chapter text | Derived from exact episode start times and approved titles |

Subtitle layout must support Urdu shaping/bidi using an appropriately licensed bundled font and a tested renderer. Check numerals, punctuation, combining marks, line wrapping, reading speed, safe margins, and mixed RTL/LTR names. A screenshot in the editor does not prove FFmpeg-rendered subtitles are correct.

## Final QA

Probe every output, decode-test for corruption, check duration and streams, verify no missing/stale narration, compare timeline coverage, inspect audio levels/silence, review Urdu captions, audition joins and difficult spans, and sample the beginning/middle/end of each episode. Downloads become ready only after the QA artifact passes.

## v0.2: source/publication and very-long-file correctness

Use [doc 27](27-publication-packaging.md) for required publication packages and source-to-output maps. A full master is an optional archival profile, not automatically a single destination upload. Captions and chapters are regenerated for each part's local timeline and verified against measured output duration/bytes.

Test source/proxy/transcode offsets, rational frame rates, long-run audio/video drift, joins, encoder padding and exact final endpoint at 24 hours. Avoid accumulating rounded segment durations into a global clock; derive positions from canonical source timestamps and actual sample counts. Never force every timestamp through a 32-bit integer or time-of-day formatter.

For very large MP4s, benchmark container index placement/streaming compatibility and finalization strategy explicitly. A seek-requiring mux must have an approved bounded storage strategy; a streamable intermediate does not prove that a final browser-compatible download is valid. Keep all decoder/protocol/network options restricted and test failed finalization without losing prior valid parts.
