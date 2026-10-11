# ManhwaUrdu DubStudio (مانہوا اردو ڈب)

An automated production studio that transforms long-form English YouTube manhwa recap videos (up to 10+ hours) into captivating, conversational Urdu voiceovers with episodic arc chunking, dramatic storytelling adaptation, audio synchronization, and export-ready media tracks.

### User Review & Critical Decisions

> [!IMPORTANT]
> The studio architecture reflects the three critical operational preferences confirmed in Phase 1:

- **Confirmed Decision 1: Core Workflow**: Prioritizing the **YouTube English Video to Urdu Dubber & Voiceover Pipeline**. Users can input any English manhwa recap video (such as long-form marathon recaps), automatically ingest transcripts or audio segments, and convert them into natural Urdu recaps with synchronized timestamps.
- **Confirmed Decision 2: Voiceover Style & Narration Tone**: **Conversational Urdu YouTube Recap Style with Dramatic Storytelling**. Uses popular recap channel narration tropes ("Kahani shuru hoti hai...", "Humara main character...", "Lekin tabhi...", "Ab aage dekhiye..."), keeping language natural, high-energy, and easy to follow rather than stiff literary Urdu. Provides dual Urdu script (Nastaliq/Arabic script) and Roman Urdu phonetics for reading ease.
- **Confirmed Decision 3: Long-Form Marathon Handling (10+ Hours)**: **Split into 15 to 30 Minute Chapter Arcs with Marathon Batching**. The engine breaks 5–10+ hour marathon videos into binge-able 15–30 minute story arcs (e.g., *Arc 1: The Weakest Hunter's Awakening*, *Arc 2: The Dungeon Raid Betrayal*), allowing arc-by-arc script review, parallel audio generation, and batch marathon export.
- **Open Decision / Recommended Default: Audio Engine**: Using Gemini's high-fidelity TTS (`gemini-3.8-flash-lite-tts`) server-side for natural vocal inflection with multi-voice selection (e.g. Zephyr, Fenrir, Kore) paired with instant Web Speech in-browser preview and high-quality WAV track download with timed SRT subtitles.

---

### 1. Overview & Core Concept

- **What It Does**: ManhwaUrdu DubStudio bridges international manhwa creators and Urdu/Hindi-speaking audiences. It ingests English manhwa recap videos or transcripts, intelligently partitions ultra-long videos into 15–30 min story arcs, rewrites the commentary into fast-paced dramatic conversational Urdu, generates voiceover audio using Gemini voice models, and provides an interactive dual-track dubbing editor with video-audio sync, wave timeline scrubbing, and full marathon package exports.
- **Target Audience / Persona**: Manhwa content creators, localization teams, anime/manga YouTubers, and licensed manhwa writers seeking to expand their readership into South Asian and diaspora audiences.
- **Key Value**: Eliminates the 40+ hours of manual translation, script timing, voice recording, and subtitle syncing required for a 10-hour manhwa recap, turning marathon localization into a streamlined 15-minute review and export workflow.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Ingest & Episode Setup**: The user pastes a YouTube URL (or selects from pre-loaded popular recap marathons or uploads transcripts/video files). The system parses total duration (e.g., 8 hours 45 min) and detects story milestones.
2. **Arc Chunking & Batch Queue**: The marathon is segmented into numbered 20-minute arcs (e.g. *Episode 01: Rebirth in the Abyss*, *Episode 02: Tower Ascension*). The user can adjust arc boundaries or batch-process all arcs.
3. **Dramatic Urdu Script Generation**: For each arc, Gemini adapts the English recap into charismatic, conversational Urdu script. Users view side-by-side:
   - Original English transcript with timestamps
   - Natural Urdu narration (Nastaliq script)
   - Roman Urdu pronunciation guide (for dubbers/voice actors who prefer Latin script)
   - Narration tone tags (`[Excited]`, `[Tense Whispering]`, `[Battle Pacing]`)
4. **Voiceover Generation & Audition**: User auditions Gemini voice personas (`Zephyr` - dramatic narrator, `Fenrir` - deep action tone, `Kore` - emotional storytelling) and renders audio clips with 1-click batch synthesis.
5. **Interactive Video & Audio Synchronizer**: Live video player synced to the audio waveform and Urdu subtitle teleprompter. Users can scrub through timestamps, adjust segment speed to match video pace, re-record or tweak line translations.
6. **Production Export**: One-click export of dubbed audio tracks (WAV), timed Urdu subtitles (SRT/VTT), episode-by-episode voiceover packages, or complete marathon stitched timeline scripts ready for YouTube upload or video editor import (CapCut, Premiere).

#### Visual Identity & Theme
- **Aesthetic Direction**: Dark, cinematic creator workstation inspired by DaVinci Resolve and professional dubbing software, combined with anime/manhwa action aesthetics. High-contrast slate neutrals with vibrant amber and crimson accents.
- **Color Palette & Mood**:
  - Canvas: Deep charcoal neutral (`#0B0F17` / `slate-950`)
  - Structural Panels: Subdued slate (`#151C28` / `slate-900` with 1px border `slate-800`)
  - Accent 1 (Primary Action / Recording): Energetic Amber/Flame (`#F59E0B` / `#D97706`)
  - Accent 2 (Manhwa Action / High Energy): Crimson Ruby (`#E11D48`)
  - Urdu Typography Highlight: Warm Gold (`#FBBF24`)
  - Status Indicators: Clean emerald (`#10B981`) for completed arcs, muted sky (`#38BDF8`) for processing.
- **Typography & Hierarchy**:
  - Display / Headings: `Plus Jakarta Sans` with `Outfit` for energetic, clean modern layout.
  - Body & Workspace: `DM Sans` / `Public Sans` for dense, legible workspace panels.
  - Urdu Narration: Noto Nastaliq Urdu / System Urdu font stack with balanced line height for beautiful Arabic script legibility.
  - Timestamps & Metrics: Strict tabular monospace (`font-mono tabular-nums`).
- **Zero-Pill & Anti-Slop Discipline**: Metadata rendered cleanly with typographic separators (`18:42 · Arc 3 · 3,420 words`); no unnecessary decorative badges or fake metrics.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual Audio Pipeline (Gemini TTS Server Proxy + Browser Speech Synthesis)**
  - *Chosen Approach*: Implement a server-side endpoint calling `gemini-3.8-flash-lite-tts` for production-grade, expressive vocal WAV audio, coupled with an instantaneous Web Speech API client synthesizer for low-latency live script scrubbing and immediate preview.
  - *Why*: Allows zero-latency preview while editing lines without waiting on network calls, while still enabling studio-grade Gemini TTS audio generation for the final video export.
  - *Alternatives Considered*: Client-only speech synthesis (poor Urdu vocal emotion) or Server-only TTS (slower editing loop). Dual approach delivers the best UX.

- **Decision 2: 15–30 Minute Arc Chunking Strategy**
  - *Chosen Approach*: Ultra-long 10-hour videos are partitioned into distinct, independently editable episodes (Arcs). Each arc maintains its own timestamp offset, script tokens, and rendered audio buffers.
  - *Why*: Browsers and APIs encounter memory and timeout bottlenecks when processing a single 10-hour continuous file. 20-minute arcs match real YouTube series structures (Ep 1-30) and allow creators to release episodic content OR compile full marathons.
  - *Alternatives Considered*: Giant single monolithic timeline (risk of browser crashes with 10-hour audio buffers and massive token contexts).

- **Decision 3: Triple-Script Representation (English Original, Spoken Urdu, Roman Urdu)**
  - *Chosen Approach*: Every recap line presents original English, colloquial spoken Urdu script, and Roman Urdu.
  - *Why*: Many YouTubers and dubbing artists understand Urdu fluently when spoken or read in Roman Urdu (`Humara hero achanak utha...`), while native script is vital for accurate subtitles and text-to-speech phonetics.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ManhwaUrdu DubStudio                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand Wordmark — Navigation Links — Export Marathon CTA)   │
├──────────────────────┬──────────────────────────────────────────────────────┤
│  Arc & Episode Bar   │  [Arc 1: 00:00 - 22:30]  [Arc 2: 22:30 - 45:10] ...  │
├──────────────────────┴──────────────────────────────────────────────────────┤
│  Workstation Split View:                                                    │
│  ┌─────────────────────────────────────┬──────────────────────────────────┐ │
│  │ 1. Video Player & Waveform Timeline │ 2. Dual-Script Adaptation Studio │ │
│  │  - Synchronized YouTube/Local Video │   - English Source Transcript    │ │
│  │  - Audio Waveform Scrubber          │   - Conversational Urdu Script   │ │
│  │  - Dub vs Original Audio Balance    │   - Roman Urdu Phonetics         │ │
│  │  - Teleprompter Subtitle Overlay    │   - Emotion & Tone Directives    │ │
│  │  - Speed & Timestamp Sync Control   │   - 1-Click Line Regeneration    │ │
│  ├─────────────────────────────────────┴──────────────────────────────────┤ │
│  │ 3. Gemini Voiceover Engine & Marathon Batch Exporter                   │ │
│  │  - Voice Selector (Zephyr, Fenrir, Kore, Puck)                         │ │
│  │  - Batch Arc Synthesizer (Gemini TTS API)                              │ │
│  │  - Subtitle SRT / VTT Downloader                                       │ │
│  │  - Dubbed Audio Track & Video Package Export                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                         Server Proxy (/api/gemini/*)
                                       │
              ┌────────────────────────┴────────────────────────┐
              │                                                 │
    gemini-3.8-flash                               gemini-3.8-flash-lite-tts
 (Colloquial Urdu Recap Adaptation              (Studio Vocal Audio Generation,
  & Timestamp Arc Segmentation)                  WAV 24kHz Mono Voiceover)
```

#### Data Model & Entities
- **MarathonProject**:
  - `id`: string
  - `title`: string (e.g. *"Solo Necromancer: Chapters 1-150 Full Recap"*)
  - `sourceVideoUrl`: string (YouTube or uploaded file)
  - `totalDurationSeconds`: number (e.g. 36,000 for 10 hours)
  - `arcs`: `StoryArc[]`
- **StoryArc**:
  - `id`: string
  - `arcNumber`: number (e.g. 1)
  - `title`: string (e.g. *"Arc 1: The Dungeon Awakening"*)
  - `startTime`: number (seconds)
  - `endTime`: number (seconds)
  - `status`: `'pending' | 'scripted' | 'dubbed' | 'exported'`
  - `segments`: `RecapSegment[]`
- **RecapSegment**:
  - `id`: string
  - `start`: number (seconds relative to arc)
  - `end`: number (seconds relative to arc)
  - `englishText`: string
  - `urduText`: string (Nastaliq script)
  - `romanUrduText`: string (Romanized)
  - `toneDirective`: `'dramatic' | 'suspense' | 'action' | 'comedic' | 'climax'`
  - `audioUrl`?: string (base64 WAV or synthesized audio)
  - `speakerVoice`: string

#### API Endpoints
- `POST /api/gemini/translate-recap`: Ingests English transcript chunks and produces conversational, high-drama YouTube recap Urdu scripts with tone tags and Roman Urdu.
- `POST /api/gemini/tts`: Calls `gemini-3.8-flash-lite-tts` with `voiceName` and returns full audio WAV bytes.
- `POST /api/gemini/segment-marathon`: Intelligently analyzes video chapter titles or transcripts and splits ultra-long runs into 15–30 minute story arcs with cliffhangers and episodic recaps.

---

### Planned Execution Steps

1. **Backend Integration**: Set up Express server routes with `@google/genai` using `gemini-3.8-flash` for dramatic Urdu recap scripting and `gemini-3.8-flash-lite-tts` for voiceover generation.
2. **Project & Marathon Data Architecture**: Create preset sample projects (including the user's referenced manhwa video style) with pre-chunked arcs, transcripts, and Urdu recap adaptations.
3. **Core Studio Views**:
   - Ingest & Marathon Arc Manager (chapter splitter, batch queue)
   - Synchronized Video & Waveform Timeline Player
   - Triple-Script Workbench (English, Nastaliq Urdu, Roman Urdu) with interactive audio preview
   - Gemini Voice Synthesizer & Audio Mixer
   - Export Hub (SRT subtitles, WAV voiceover, video packages)
4. **Interactive Handlers & Polish**: Ensure every button (play, pause, regenerate line, synthesize arc, export SRT/audio, swap voices, adjust speed) is fully functional and responsive.
