# Project audit — ManhwaUrdu DubStudio

**Date:** 2026-10-11
**Reviewed baseline:** `e581f0a8a21d5e93bf29479914c963da8e3638ea`
**Scope:** architecture, security, functional correctness, media processing, build/deployment, and quality controls.

## Executive assessment

**This is a feature-rich prototype, not a production-ready dubbing service.** The React interface, script editing, subtitle generation, Gemini proxy routes, and media-processing scaffolding are present. However, public deployment is unsafe, the production executable fails to start, and several workflows can claim success while using unrelated preset content, placeholder tones, or missing narration.

The first priorities are to close filesystem access and upload vulnerabilities, make production startup and export work, and establish truthful, content-addressed audio generation. Do not expose this version publicly or use it for confidential uploads.

Severity assumes the Express server is reachable by untrusted users. An independently configured authentication gateway could reduce exposure, but none is defined in this repository.

## Architecture and implemented scope

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4; approximately 6,400 lines across the reviewed TS/TSX/JS files, including backend and utilities.
- **Backend:** one 856-line Express server; Google GenAI SDK for arc generation, script adaptation, and speech; Multer for uploads; an external FFmpeg process for muxing.
- **State/storage:** project state in React memory; shared local directories for audio, uploads, and video outputs. No database, ownership model, durable job queue, or project persistence layer was found.
- **Deployment:** frontend and bundled backend both written into `dist`; production serves that entire directory. Bun lockfile is committed, but package-manager/runtime requirements and deployment instructions are absent.

| Capability | Actual implementation |
| --- | --- |
| Script editing and SRT export | Implemented client-side; project edits are not persisted across reloads. |
| AI arc planning / Urdu adaptation | Server calls exist; live provider behavior was not verified. Arc planning has contradictory duration constraints. |
| Individual and batch TTS | Implemented, but cache lookup, fallback, and completion-state defects undermine correctness. |
| Original-video upload and FFmpeg mux | Implemented path; unsafe upload/path handling, incorrect duration assumptions, and no verified end-to-end render here. |
| YouTube transcript extraction | A text prompt requests a realistic **sample**; no video or audio is actually ingested by that route. The primary import flow uses preset dialogue. |
| Raw manhwa/panel creation | Selected filenames are retained, not image content; synopsis/panels do not enter the generation request. Scripts are templated. |
| Batch scripting of remaining arcs | Inserts two hard-coded recap lines for empty arcs, rather than processing their source material. |

## Checks performed

| Check | Result |
| --- | --- |
| Clean npm dependency resolution | **Failed:** `npm install --ignore-scripts --package-lock=false --no-audit --no-fund` reports `ERESOLVE`: Vite 8.3.4 optionally peers on esbuild `^0.27.0 || ^0.28.0`, but the project requests `^0.25.0`. |
| Frozen Bun dependency install | **Passed:** `npx --yes bun install --frozen-lockfile --ignore-scripts` using the committed lockfile. |
| TypeScript | **Passed:** `npm run lint` (`tsc --noEmit`). This is not a rules-of-hooks or general lint check. |
| Build | **Passed:** `npm run build`; frontend JS approximately 357 kB / 105 kB gzip. Warnings cover `__dirname` compatibility with a future Vite config loader and an ineffective dynamic import. |
| Production executable | **Failed:** `NODE_ENV=production GEMINI_API_KEY=audit-placeholder node dist/server.js` exits with `Dynamic require of "path" is not supported`. |
| Dependency advisory audit | `npx --yes bun audit`: **no vulnerabilities found**, 264 packages checked. This is a point-in-time advisory result, not a security guarantee. |
| HTTP reproductions | Confirmed path traversal read/write, same-origin HTML upload, HEAD cache mutation, stale TTS cache, missing-credential batch response, backend source exposure in source-run production mode, and ignored Range requests. |
| React component reproduction | Closed-to-open `ExportModal` transition throws `Rendered more hooks than during the previous render.` |
| Audio inspection/stitch test | Existing WAVs contain trailing C2PA chunks; a stitched test track includes that metadata inside its PCM payload. |

**Method and limits:** HTTP probes ran against the original `server.ts` through `tsx`, with `NODE_ENV=production`, an empty API key, and an isolated temporary working directory. Only harmless test sentinels and copied sample audio were used; no real secrets were read, no paid AI calls were made, and no large-memory stress test was run. Production static serving was exercised against the built files, separately from the broken bundled executable. React reproduction used a temporary test renderer, not a full browser. FFmpeg is not installed in this sandbox; muxing, codecs, and final audiovisual synchronization were not end-to-end tested. Live Gemini model availability, account permissions, and returned audio formats remain unverified. No application source or dependency manifest was changed by this audit.

## Prioritized findings

### F01 — Critical: untrusted paths escape the audio cache

**References:** `server.ts:288–296`, `323–335`, `362–380`, `474–484`, `548`, `581–583`, `664–668`, `685`, `718–724`.

`filename`, `segmentId`, segment IDs, and arc IDs enter filesystem paths without safe-name validation or containment checks. Express decodes an encoded slash in a route parameter; `path.join` does not sandbox the result.

**Confirmed:** a request to `/audio-cache/..%2Faudit-sentinel.txt` returned a harmless sentinel outside `audio-cache`. A missing `/audio-cache/..%2Faudit-generated.wav` created a file outside that directory via the fallback path. The read route does not require a WAV extension. Other routes also accept traversal-bearing IDs, and uploaded video paths are resolved relative to the working directory without restricting them to uploads.

**Impact:** unauthenticated reading of files available to the server process, potentially including deployment secrets; out-of-directory file creation/cache corruption. Some write paths can overwrite existing files. No shell injection is needed.

**Fix:** accept opaque server-generated resource IDs, look them up in an owned manifest, and reject separators/traversal. Enforce resolved/realpath containment, account for symlinks, run with restricted filesystem permissions, and avoid client-supplied output filenames. Add encoded-traversal read/write regression tests.

### F02 — High: HTML/SVG uploads can execute on the application's origin

**References:** `server.ts:31`, `34–46`, `599–608`.

Multer preserves the submitted extension and only restricts file size. Files are immediately served through same-origin `express.static`. There is no extension/content allowlist, media validation, or restrictive serving policy.

**Confirmed:** uploading harmless HTML as the `video` multipart field succeeded with HTTP 200; fetching its returned URL served `text/html` without a Content-Security-Policy header.

**Impact:** an attacker can host active content on the application origin and induce visitors to execute it. Authentication added later would make same-origin exposure particularly dangerous. Client-side file-picker filters are not a security control.

**Fix:** validate type and actual media structure; reject non-video content; use generated extensions, a separate untrusted-content origin, and restrictive download/content headers. Sandbox media inspection/transcoding.

### F03 — High: no authentication, ownership isolation, or abuse controls

**References:** `server.ts:14–46`, `73`, `159`, `288`, `338–344`, `350`, `456`, `534`, `599`, `615–641`, `652`.

All AI, upload, stitching, and rendering endpoints are open in the application. Media lists and static directories are shared across callers. There are no per-user quotas, rate limits, or concurrent-job limits. A GET can even generate paid speech.

**Impact:** outsiders can consume the operator's AI budget and disk/CPU resources, enumerate media, and access other users' uploads and outputs. Predictable segment IDs also share audio between unrelated projects.

**Fix:** authenticate before expensive or private routes, enforce project ownership, serve private assets through authorized access/signed URLs, and add cost/disk/rate/concurrency quotas. If intentionally local-only, explicitly enforce and document that boundary.

### F04 — High: unbounded synchronous media allocation can exhaust memory

**References:** `server.ts:18`, `536–565`, `579–583`, `659–682`, `701–737`.

User-supplied duration controls full-track `Buffer.alloc` calls without a finite-number check or upper bound. Each operation allocates both the PCM buffer and another full WAV buffer, performs synchronous reads/copies/writes, and rendering has no application-level queue, deadline, or cancellation.

**Impact:** one large request or several ordinary long-duration requests can exhaust memory or block the event loop. A 10-hour track requires roughly **3.46 GB across the two allocated audio buffers alone**, before other memory. This is a source-derived estimate; a destructive allocation test was not performed.

**Fix:** schema-validate durations, segment counts, timestamps, and text lengths; enforce product limits; stream media work in bounded workers; queue FFmpeg jobs and set timeouts, cancellation, cleanup, and storage-retention limits.

### F05 — High: production build succeeds but its executable cannot start

**References:** `package.json:8–9`; `server.ts:5`, `16`, `833–846`.

The build bundles Multer and its CommonJS dependencies into an ESM output, while only some dependencies are externalized. Running that output on Node 22.22.3 fails in bundled `mime-types`/Multer with `Dynamic require of "path" is not supported`.

**Fix:** externalize runtime packages consistently (for example, use esbuild's package externalization), or deliberately use a compatible server module format/build strategy. Add a CI smoke test that actually starts the built artifact and requests health and the frontend. Explicitly define production `NODE_ENV`; `npm start` does not set it. Document/provision FFmpeg and supported Node/package-manager versions.

### F06 — High: opening the export modal crashes React

**References:** `src/components/ExportModal.tsx:19–21`, `57`, `81`; `src/App.tsx:632–638`.

`ExportModal` returns early when closed, before two later `useState` calls. It remains mounted while its `isOpen` prop changes, so opening it changes the hook count.

**Confirmed:** a closed-to-open render throws `Rendered more hooks than during the previous render.` No application error boundary was found to contain the failure.

**Fix:** put all hooks before any conditional return, or conditionally mount the modal from its parent. Add open/close component tests and React Hooks lint rules.

### F07 — High: a cache probe generates fake audio and bypasses real TTS

**References:** `src/utils/audioSynthesizer.ts:92–107`; `server.ts:288–335`, `390–398`.

The frontend sends HEAD to check for a cached file. Express falls back to the GET handler, which synthesizes/caches a four-second chord when the file is missing and no usable speech is returned. The successful HEAD causes the helper to return without calling the TTS POST endpoint with the user's text, selected voice, and style. For known preset IDs with credentials, that GET instead generates fixed preset text with Zephyr.

**Confirmed:** synthesizing a new test segment made only `HEAD /audio-cache/audit-helper-missing.wav`; it returned a URL and created fallback audio. It never made the intended POST request.

**Impact:** new dialogue can produce a tone rather than narration, selected settings are bypassed, and placeholder audio can become a permanent cache hit. A successful HTTP response is not proof of successful speech generation.

**Fix:** make cache GET/HEAD read-only, return 404 on absence, and synthesize only through an explicit job/POST. Distinguish demo sound from speech and never cache fallback tones as completed narration.

### F08 — High: caches ignore edits, style changes, and project identity

**References:** `server.ts:239–241`, `361–387`, `474–485`; `src/utils/audioSynthesizer.ts:92–103`; `src/App.tsx:81–92`.

The server prefers `<segmentId>.wav` before validating the requested content or voice. The hashed key excludes tone/style and model. The frontend key excludes text and tone; editing a segment also retains its existing audio URL/generated flag. IDs are reused in presets and new projects.

**Confirmed:** a request for completely different text and voice `Kore` under cached `seg-1-1` returned the existing sample with `fromCache: true` and reported the requested voice.

**Fix:** key immutable artifacts by normalized text, voice, style, model/version, and relevant settings; bind segment revisions to those artifact IDs within a project. Invalidate stale audio on edits and do not use segment IDs as shared physical filenames.

### F09 — High: failed or partial generation is presented as complete dubbing

**References:** `src/components/AutoDubbingStudio.tsx:368–399`, `535–545`; `src/App.tsx:229–260`, `489–494`; `server.ts:520–524`, `547–561`.

Auto-dub does not check the translation HTTP status and ignores `audioGenerated: false` from batch TTS, setting every segment to true. The other batch flow catches individual failures but marks the arc dubbed unconditionally. Stitching silently skips missing segment files and succeeds with silence.

**Confirmed backend condition:** without credentials, batch TTS returned `audioGenerated: false` and a URL for a nonexistent test segment. The client code discards that failure flag.

**Fix:** model per-segment states (pending/running/succeeded/failed), preserve error details, expose retries, and mark an arc complete only after every required artifact exists and validates. Reject incomplete exports unless the user explicitly accepts gaps.

### F10 — High: ingestion/creation workflows do not process the supplied source

**References:** `server.ts:756–790`; `src/App.tsx:319–361`, `381–428`; `src/components/ManhwaCreatorView.tsx:25–40`, `51–107`.

The transcript endpoint asks the model to generate a realistic sample from URL/title text, not to transcribe provided media. The main import path sends title/duration to chunking and copies the first preset's dialogue into the new project; even an HTTP error can fall back to preset arcs and display successful import. Raw manhwa uploads retain filenames only; neither images nor synopsis are sent to the generation request. Remaining-arc scripting uses fixed stock dialogue.

**Impact:** users can receive an unrelated recap presented as their video's translation or their panels' generated production. The core advertised end-to-end pipeline is incomplete, not merely untested.

**Fix:** clearly label demo workflows immediately. Implement actual media ingestion/transcription or an explicit transcript import; retain panel content; pass source-derived material through each stage with provenance. Never replace failures with unrelated production data.

### F11 — Medium: WAV stitching treats metadata as audible PCM

**References:** `server.ts:548–559`, `685–695`; also TTS writes at `321–325`, `433–443`, `507–511` and `pre-cache.ts:96–100`.

Stitching assumes every WAV has a 44-byte header and that all following bytes are mono, 24 kHz, signed 16-bit samples. It does not parse RIFF chunks, validate the audio format, honor the data chunk size, or use segment end times. Overlapping segments overwrite rather than mix.

**Confirmed:** `seg-1-1.wav` contains 643,200 bytes of PCM plus a trailing 6,062-byte C2PA payload and chunk header. A test stitch copied `C2PA` into the master audio data. This introduces non-audio bytes into the waveform. TTS persistence also discards the provider MIME declaration, so non-WAV responses would require conversion rather than a renamed extension; live response formats were not tested.

**Fix:** decode validated source media and normalize it with a proper WAV parser or FFmpeg. Copy only decoded samples; define trim/stretch/overlap policy and ensure output duration matches the timeline. Test WAVs with metadata, alternative headers/rates/channels, missing media, and overlapping speech.

### F12 — High: video exports can use the wrong source or truncate uploaded footage

**References:** `src/components/ExportModal.tsx:88–94`; `src/components/AutoDubbingStudio.tsx:84–87`, `551–559`, `584–598`; `server.ts:663–670`, `679`, `726–736`.

The export modal always selects the sample video, regardless of the project. Upload duration is inferred from the last narration segment rather than media metadata. The backend enforces a 105-second minimum and uses `-shortest`, so a long upload with a short script can be cut to that audio duration. An invalid upload path silently falls back to the sample; the browser's failed-upload fallback supplies a `blob:` URL the server cannot read.

**Impact:** a download labeled as the user's full dubbed video can contain the sample or only the beginning of their footage. This is source-confirmed; an FFmpeg end-to-end reproduction was not possible here.

**Fix:** store a validated source-media ID and measured duration on each project/arc. Fail on invalid sources, use explicit source ranges and duration policies, and never silently substitute sample footage.

### F13 — Medium: playback and repeat recording have synchronization defects

**References:** `src/components/AutoDubbingStudio.tsx:145–216`, `448–465`, `500–519`; `src/components/VideoPlayerSync.tsx:153–194`; `src/App.tsx:54–72`.

Playback advances using a 500 ms interval rather than the media clock. In AutoDubbingStudio, playback speed changes that timer and some audio states, but not the video's `playbackRate`. Seeking within the same segment does not reset its audio position; volume/rate updates are applied only when the segment changes or audio is paused. A second canvas export creates a new audio destination but skips reconnecting the previously created narration source, so that recording can omit narration.

**Fix:** use one media timeline as the clock, synchronize all media on seek/rate/volume changes, reset state on arc/source changes, and reconnect/dispose recording nodes per export. Test pause/resume, in-segment seeking, 2x playback, arc switching, and two successive recordings in a real browser.

### F14 — Medium: project work is lost on reload

**References:** `src/App.tsx:18–27`, `81–92`, `413–425`; `src/components/ExportModal.tsx:51–54`.

The app starts from a preset on each mount and stores edits only in React state. No project save/load backend, local browser persistence, or JSON re-import path was found. JSON export is manual and is additionally blocked by F06 until repaired. Server audio can survive while the edited script and its associations disappear.

**Fix:** persist versioned projects and source/artifact references, provide autosave and recovery, and implement validated import/export. For a single-user prototype, IndexedDB/local storage can be a first step, but should not replace an ownership-aware backend for a shared service.

### F15 — Medium: generated backend code is publicly served

**References:** `package.json:8`; `server.ts:841–845`.

Both frontend assets and `server.js` are built into `dist`, and production exposes that whole directory through `express.static`.

**Confirmed:** running the source server in production mode returned the 359,075-byte backend bundle at `/server.js`. This remains relevant once the bundled startup failure is fixed. No embedded credential was identified; the verified issue is unintended backend implementation exposure.

**Fix:** separate client/server output directories and serve only the client directory. Add a production test requiring backend files to return 404.

### F16 — Medium: marathon partition constraints are impossible for defaults

**References:** `server.ts:75`, `88–101`; `src/components/IngestModal.tsx:30`.

The prompt requires full coverage of 600 minutes using 8–15 arcs, each 15–30 minutes. Fifteen 30-minute arcs cover at most 450 minutes; the import UI defaults to 620 minutes. No post-generation checks enforce coverage, chronology, duration consistency, or permitted pacing.

**Fix:** derive feasible arc counts from duration; validate a contiguous partition from zero to the input duration, and handle short final arcs explicitly. Use deterministic timeline validation independent of model output.

## Additional engineering gaps

- **No automated test suite or CI workflow was found.** The only `lint` command is TypeScript, which passed despite the reproduced Hooks failure. `tsconfig.json:2–25` does not enable strict mode. Add unit, component, API security, and production smoke tests, plus ESLint/React Hooks rules.
- **Package manager/deployment ambiguity:** frozen Bun install works while a fresh npm resolution fails. Pin/document Bun using `packageManager`, or resolve the esbuild peer conflict if npm is supported. Add setup, environment, FFmpeg, and deployment instructions. Do not describe the Bun-supported project as entirely uninstallable.
- **Misleading range support:** `server.ts:292–296` advertises `Accept-Ranges: bytes` but ignores Range. A request for bytes 0–43 returned HTTP 200 and the entire 649,314-byte sample, not 206. Use a safe, read-only range-capable serving implementation.
- **Generated media lifecycle:** roughly 15 MB of audio cache and 3.2 MB of dubbed outputs are tracked. `.gitignore` does not exclude runtime uploads/caches/outputs; there is no expiry or cleanup policy. Separate intentional fixtures from runtime storage and keep user media out of Git.
- **Accessibility:** the modals lack dialog semantics, focus trapping/restoration, and explicit accessible names for some icon-only close buttons (`ExportModal.tsx:114–129`, `IngestModal.tsx:50–66`). Validate keyboard and screen-reader workflows in-browser.
- **Large coupled modules and duplicated processing:** the two player components duplicate substantial audio/canvas behavior, and both stitching endpoints duplicate WAV assembly. Split API schemas, media services, AI adapters, job/state management, and playback hooks into testable units before extending features.
- **Unused integration helpers:** SRT/VTT parsing and NLE-export utilities exist but are not wired into the main UI. `nleExporter.ts` also interpolates unescaped user text into XML; repair/test it before exposing that path.
- **Health/readiness and diagnostics:** health reports `ok` without a usable key or FFmpeg check; failures commonly return raw exception messages. Distinguish liveness from readiness, add structured request/job logging, and sanitize public error responses.

## Positive foundations

- The API key is read on the server; no frontend key injection was found.
- FFmpeg uses `execFile` with an argument array rather than constructing a shell command.
- Gemini JSON-generation routes request structured response schemas, although semantic validation is still needed.
- TypeScript and the frontend build pass with the committed Bun dependency resolution.
- Multipart uploads have a per-file size cap, and `.env` files are excluded from Git except the documented example.
- Core domain types and reusable subtitle/download helpers provide a reasonable basis for refactoring.

## Recommended remediation order

### 1. Contain exposure before any public deployment

Fix F01–F04: safe resource IDs and path containment, validated isolated uploads, authentication/ownership, and bounded processing. Until then, keep the service private and do not accept confidential media. If an affected version has already been publicly reachable, review access logs and consider rotation of secrets readable by that deployment.

### 2. Restore a truthful, working core workflow

Fix production startup and modal hooks (F05–F06), remove mutation from cache reads (F07), implement revision-aware audio artifacts (F08), and make failed/partial states explicit (F09). Add regression tests reproducing each confirmed issue.

### 3. Establish real source-to-output correctness

Replace demo ingestion or label it clearly (F10); fix WAV handling, source selection, measured durations, and synchronization (F11–F13). Validate a short uploaded source through transcript, edited Urdu, selected voice, and exported video before claiming marathon support.

### 4. Add durability and operational readiness

Implement project persistence, separate production outputs, validate arc partitions (F14–F16), then add worker jobs, cleanup/retention, observability, accessibility checks, documentation, and CI.

**Suggested release gate:** a clean frozen install; type/lint/test/build checks; successful built-server startup; traversal/active-upload/unauthorized-access rejection; export modal open/close; edited text and voice generating new artifacts; failed TTS remaining failed; correct source and duration in an FFmpeg-rendered fixture; project reload recovery; and no backend bundle reachable from the public static root.
