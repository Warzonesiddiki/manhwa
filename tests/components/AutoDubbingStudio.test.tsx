// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AutoDubbingStudio } from '../../src/components/AutoDubbingStudio';
import type { StoryArc, MarathonProject } from '../../src/types';

const testArc: StoryArc = {
  id: 'arc-1',
  arcNumber: 1,
  title: 'Tower of God Intro',
  titleUrdu: 'ٹاور آف گاڈ آغاز',
  startMinute: 0,
  endMinute: 25,
  durationMinutes: 25,
  chaptersCovered: 'Ch 1-15',
  cliffhangerHook: 'Who is Rachel?',
  cliffhangerHookUrdu: 'راشیل کون ہے؟',
  pacing: 'medium',
  status: 'scripted',
  segments: [
    {
      id: 'seg-1',
      start: 0,
      end: 4,
      englishText: 'Bam was trapped in the darkness beneath the tower.',
      urduText: 'بام ٹاور کے نیچے گہرے اندھیرے میں قید تھا اور وہ اکیلا تھا۔',
      romanUrduText: 'Bam tower ke neeche gehre andhere mein qaid tha.',
      toneDirective: 'Dramatic',
    },
  ],
};

const testProjectWithUpload: MarathonProject = {
  id: 'proj-1',
  title: 'Solo Leveling Recap',
  titleUrdu: 'سولو لیولنگ خلاصہ',
  sourceVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  uploadedVideoUrl: '/uploads/custom-source-manhwa.mp4',
  uploadedVideoFilename: 'custom-source-manhwa.mp4',
  totalDurationMinutes: 25,
  genre: 'Action Fantasy',
  mainCharacter: 'Sung Jinwoo',
  arcs: [testArc],
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  class MockAudioContext {
    createOscillator() {
      return {
        type: 'sawtooth',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          setTargetAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
    }
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
    }
    currentTime = 0;
    close = vi.fn().mockReturnValue(Promise.resolve());
    destination = {};
  }
  window.AudioContext = MockAudioContext as any;
});

describe('AutoDubbingStudio Dual Intake and Audio Replacement', () => {
  it('displays YouTube reference link and uploaded video filename from project', () => {
    render(
      <AutoDubbingStudio
        arc={testArc}
        allArcs={[testArc]}
        project={testProjectWithUpload}
        onSelectArc={vi.fn()}
        selectedVoice="Puck"
        onSelectVoice={vi.fn()}
        onUpdateArcSegments={vi.fn()}
      />
    );

    // YouTube reference link is displayed
    expect(screen.getByText('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeTruthy();
    expect(screen.getByText(/YouTube Reference/i)).toBeTruthy();

    // Uploaded original source media is displayed
    expect(screen.getByText('custom-source-manhwa.mp4')).toBeTruthy();
    expect(screen.getByText(/Original Source Media/i)).toBeTruthy();
  });

  it('displays 100% Spoken Urdu Narration badge with English audio completely replaced', () => {
    render(
      <AutoDubbingStudio
        arc={testArc}
        allArcs={[testArc]}
        project={testProjectWithUpload}
        onSelectArc={vi.fn()}
        selectedVoice="Puck"
        onSelectVoice={vi.fn()}
        onUpdateArcSegments={vi.fn()}
      />
    );

    // Audio replacement strip
    expect(screen.getByText((content) => content.includes('100% Spoken Urdu Narration') && content.includes('completely replaced'))).toBeTruthy();

    // On-video badge
    expect(screen.getByText((content) => content.includes('English Audio Completely Replaced'))).toBeTruthy();
  });

  it('sets muted on original video player to ensure English audio is not played', () => {
    const { container } = render(
      <AutoDubbingStudio
        arc={testArc}
        allArcs={[testArc]}
        project={testProjectWithUpload}
        onSelectArc={vi.fn()}
        selectedVoice="Puck"
        onSelectVoice={vi.fn()}
        onUpdateArcSegments={vi.fn()}
      />
    );

    const videoEl = container.querySelector('video') as HTMLVideoElement;
    expect(videoEl).toBeTruthy();
    expect(videoEl.muted).toBe(true);
    expect(videoEl.src).toContain('custom-source-manhwa.mp4');
  });

  it('allows switching video source between uploaded video and sample video', () => {
    render(
      <AutoDubbingStudio
        arc={testArc}
        allArcs={[testArc]}
        project={testProjectWithUpload}
        onSelectArc={vi.fn()}
        selectedVoice="Puck"
        onSelectVoice={vi.fn()}
        onUpdateArcSegments={vi.fn()}
      />
    );

    const sampleTab = screen.getByRole('button', { name: /^Original Video$/i });
    expect(sampleTab).toBeTruthy();

    fireEvent.click(sampleTab);
    expect(screen.getByText(/Built-in 105s/i)).toBeTruthy();
  });
});
