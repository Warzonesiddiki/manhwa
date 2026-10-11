import { RecapSegment } from '../types';

/**
 * Parse timestamp strings (00:01:23,450 or 00:01:23.450) into seconds
 */
export function parseTimestampToSeconds(timeStr: string): number {
  const parts = timeStr.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    const hrs = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hrs * 3600 + mins * 60 + secs;
  }
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return 0;
}

/**
 * Parse an SRT or VTT file string into structured RecapSegments
 */
export function parseSrtOrVtt(content: string): RecapSegment[] {
  const segments: RecapSegment[] = [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/);

  let idCounter = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const timeParts = lines[timeLineIdx].split('-->');
    if (timeParts.length !== 2) continue;

    const start = parseTimestampToSeconds(timeParts[0]);
    const end = parseTimestampToSeconds(timeParts[1]);

    const textLines = lines.slice(timeLineIdx + 1).map((l) => l.replace(/<[^>]*>/g, '').trim());
    const englishText = textLines.join(' ').trim();

    if (!englishText) continue;

    segments.push({
      id: `seg-import-${idCounter++}`,
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
      englishText,
      urduText: '',
      romanUrduText: '',
      toneDirective: 'Narrative',
      recapPacing: 'normal',
    });
  }

  return segments;
}
