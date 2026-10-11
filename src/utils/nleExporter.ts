import { StoryArc, RecapSegment } from '../types';
import { formatSrtTimestamp } from './audioSynthesizer';

/**
 * Generate standard Final Cut Pro 7 / Adobe Premiere Pro XML timeline
 */
export function generatePremiereXml(
  arc: StoryArc,
  projectTitle: string,
  fps = 30
): string {
  const durationFrames = Math.round(arc.durationMinutes * 60 * fps);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>${arc.title}</name>
    <duration>${durationFrames}</duration>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>1920</width>
            <height>1080</height>
            <rate>
              <timebase>${fps}</timebase>
            </rate>
          </samplecharacteristics>
        </format>
        <track>
          <!-- Video Track containing manhwa recap footage -->
          <clipitem id="clipitem-video-1">
            <name>${projectTitle} - Video Footage</name>
            <duration>${durationFrames}</duration>
            <start>0</start>
            <end>${durationFrames}</end>
          </clipitem>
        </track>
      </video>
      <audio>
        <track>
          <!-- Synchronized Urdu Voiceover Track -->
${arc.segments
  .map((seg, idx) => {
    const startFrame = Math.round(seg.start * fps);
    const endFrame = Math.round(seg.end * fps);
    const durFrames = endFrame - startFrame;
    return `          <clipitem id="clipitem-audio-${idx + 1}">
            <name>Urdu Narration: ${seg.romanUrduText.slice(0, 30)}...</name>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>0</in>
            <out>${durFrames}</out>
          </clipitem>`;
  })
  .join('\n')}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;
}

/**
 * Generate CapCut / DaVinci Resolve EDL timeline file
 */
export function generateEdl(arc: StoryArc, fps = 30): string {
  let edl = `TITLE: ${arc.title.replace(/[^a-zA-Z0-9 ]/g, '')}\nFCM: NON-DROP FRAME\n\n`;

  const toEdlTimecode = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * fps);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  };

  arc.segments.forEach((seg, idx) => {
    const num = String(idx + 1).padStart(3, '0');
    const startTc = toEdlTimecode(seg.start);
    const endTc = toEdlTimecode(seg.end);
    edl += `${num}  AX       AA/V  C        ${startTc} ${endTc} ${startTc} ${endTc}\n`;
    edl += `* FROM CLIP: URDU_VOICEOVER_${idx + 1}.WAV\n`;
    edl += `* COMMENT: ${seg.romanUrduText.slice(0, 50)}\n\n`;
  });

  return edl;
}

/**
 * Generate high-CTR YouTube metadata, title variants, description, and hashtags
 */
export function generateYouTubeSeoMetadata(arc: StoryArc, projectTitle: string, allArcs: StoryArc[]): string {
  const chapters = allArcs
    .map((a) => {
      const mins = a.startMinute;
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      const tc = hrs > 0 ? `${String(hrs).padStart(2, '0')}:${String(rem).padStart(2, '0')}:00` : `${String(rem).padStart(2, '0')}:00`;
      return `${tc} - ${a.title} (${a.titleUrdu})`;
    })
    .join('\n');

  return `=== HIGH-CTR YOUTUBE VIDEO METADATA (URDU / HINDI) ===

🔥 VIRAL TITLE OPTIONS (Choose 1):
Option 1: ${arc.titleUrdu} | ${arc.title} Full Manhwa Recap
Option 2: سب سے کمزور ہنٹر نے پوری دنیا پر راج کر لیا! (Urdu Recap)
Option 3: جب بے بس ہنٹر کو شیڈو پاور مل گئی | ${projectTitle}

📝 OPTIMIZED YOUTUBE DESCRIPTION:
Watch the complete story of "${projectTitle}" dubbed in conversational, fast-paced Urdu!
Episode: ${arc.title}
Chapters Covered: ${arc.chaptersCovered}

TIMESTAMPS / CHAPTERS:
${chapters}

KEYWORDS & TAGS:
#ManhwaRecapUrdu #ManhwaInHindi #SoloLevelingRecap #UrduAnimeRecap #ManhwaDubbed #FullManhwaRecap #AnimeInUrdu
`;
}
