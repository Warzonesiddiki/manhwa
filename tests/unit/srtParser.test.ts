import { describe, it, expect } from 'vitest';
import { parseTimestampToSeconds, parseSrtOrVtt } from '../../src/utils/srtParser';

describe('parseTimestampToSeconds', () => {
  it('parses SRT comma-millisecond timestamps', () => {
    expect(parseTimestampToSeconds('00:00:01,500')).toBe(1.5);
    expect(parseTimestampToSeconds('00:01:23,450')).toBe(83.45);
    expect(parseTimestampToSeconds('01:00:00,000')).toBe(3600);
  });

  it('parses VTT dot-millisecond timestamps beyond one hour', () => {
    expect(parseTimestampToSeconds('01:02:03.250')).toBe(3723.25);
    expect(parseTimestampToSeconds('23:59:59.900')).toBe(86399.9);
  });

  it('parses two-part mm:ss timestamps', () => {
    expect(parseTimestampToSeconds('02:05')).toBe(125);
    expect(parseTimestampToSeconds('02:05.5')).toBe(125.5);
  });

  it('tolerates whitespace and returns 0 for unusable input', () => {
    expect(parseTimestampToSeconds('  00:00:02,000  ')).toBe(2);
    expect(parseTimestampToSeconds('nonsense')).toBe(0);
    expect(parseTimestampToSeconds('')).toBe(0);
  });
});

describe('parseSrtOrVtt', () => {
  const srt = [
    '1',
    '00:00:01,000 --> 00:00:03,500',
    'Hello world',
    '',
    '2',
    '00:00:04,000 --> 00:00:06,000',
    'Second <b>line</b>',
    'continued',
    '',
  ].join('\n');

  it('parses SRT blocks into segments with timestamps and text', () => {
    const segments = parseSrtOrVtt(srt);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      id: 'seg-import-1',
      start: 1,
      end: 3.5,
      englishText: 'Hello world',
      urduText: '',
      romanUrduText: '',
    });
    expect(segments[1].englishText).toBe('Second line continued');
  });

  it('parses WEBVTT headers and strips inline tags', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      '<v Speaker>Hi there',
      '',
      '00:01:00.000 --> 00:01:02.000',
      'At one minute',
      '',
    ].join('\n');
    const segments = parseSrtOrVtt(vtt);
    // The WEBVTT header line has no "-->" so the first cue is the "Hi there" block.
    expect(segments.length).toBe(2);
    expect(segments[0].englishText).toBe('Hi there');
    expect(segments[0].start).toBe(0);
    expect(segments[1].start).toBe(60);
    expect(segments[1].end).toBe(62);
  });

  it('skips cue blocks without text and handles CRLF', () => {
    const crlf = '1\r\n00:00:01,000 --> 00:00:02,000\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nReal text\r\n';
    const segments = parseSrtOrVtt(crlf);
    expect(segments).toHaveLength(1);
    expect(segments[0].englishText).toBe('Real text');
  });

  it('returns an empty list for empty or unusable content', () => {
    expect(parseSrtOrVtt('')).toEqual([]);
    expect(parseSrtOrVtt('no timings here\nat all')).toEqual([]);
  });
});
