// @vitest-environment jsdom
// Regression test for AUDIT F06: closed -> open transition must not change hook count.
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { ExportModal } from '../../src/components/ExportModal';
import type { StoryArc, MarathonProject } from '../../src/types';

const arc: StoryArc = {
  id: 'arc-1',
  arcNumber: 1,
  title: 'Test Arc',
  titleUrdu: 'ٹیسٹ آرک',
  startMinute: 0,
  endMinute: 25,
  durationMinutes: 25,
  chaptersCovered: 'Ch 1',
  cliffhangerHook: 'Hook',
  cliffhangerHookUrdu: 'ہک',
  pacing: 'fast',
  status: 'scripted',
  segments: [
    {
      id: 'seg-1',
      start: 0,
      end: 3,
      englishText: 'Hello',
      urduText: 'ہیلو',
      romanUrduText: 'Hello',
      toneDirective: 'Narrative',
    },
  ],
};

const project: MarathonProject = {
  id: 'proj-1',
  title: 'Test Project',
  titleUrdu: 'ٹیسٹ پروجیکٹ',
  sourceVideoUrl: 'sample',
  totalDurationMinutes: 25,
  genre: 'Test',
  mainCharacter: 'Tester',
  arcs: [arc],
};

afterEach(() => cleanup());

describe('ExportModal hook integrity (F06 regression)', () => {
  it('renders the open modal after starting closed without throwing', () => {
    const { rerender } = render(
      <ExportModal isOpen={false} onClose={() => {}} arc={arc} project={project} />,
    );
    expect(screen.queryByText(/Export Dubbed Production Package/i)).toBeNull();
    // The previously crashing transition: closed -> open adds hooks if any sit
    // behind the early return ("Rendered more hooks than during the previous render").
    expect(() =>
      rerender(<ExportModal isOpen={true} onClose={() => {}} arc={arc} project={project} />),
    ).not.toThrow();
    expect(screen.getByText(/Export Dubbed Production Package/i)).toBeTruthy();
  });

  it('can close and reopen again without throwing', () => {
    const { rerender } = render(
      <ExportModal isOpen={true} onClose={() => {}} arc={arc} project={project} />,
    );
    rerender(<ExportModal isOpen={false} onClose={() => {}} arc={arc} project={project} />);
    expect(() =>
      rerender(<ExportModal isOpen={true} onClose={() => {}} arc={arc} project={project} />),
    ).not.toThrow();
    expect(screen.getByText(/Export Dubbed Production Package/i)).toBeTruthy();
  });
});
