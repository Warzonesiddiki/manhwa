// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { IngestModal } from '../../src/components/IngestModal';

afterEach(() => {
  cleanup();
});

describe('IngestModal dual intake (YouTube and Upload)', () => {
  it('renders both YouTube Link and Upload Original Video options', () => {
    render(
      <IngestModal
        isOpen={true}
        onClose={() => {}}
        onLoadProject={() => {}}
        onIngestNew={vi.fn()}
        isIngesting={false}
      />
    );

    expect(screen.getByRole('button', { name: /YouTube Link/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Upload Original Video/i })).toBeTruthy();
    expect(screen.getByText(/Dual intake/i)).toBeTruthy();
  });

  it('switches between YouTube tab and Upload Original Video tab', () => {
    render(
      <IngestModal
        isOpen={true}
        onClose={() => {}}
        onLoadProject={() => {}}
        onIngestNew={vi.fn()}
        isIngesting={false}
      />
    );

    // Initial tab is YouTube
    expect(screen.getByText(/YouTube Video URL/i)).toBeTruthy();

    // Click on Upload Original Video tab
    const uploadTabButton = screen.getByRole('button', { name: /Upload Original Video/i });
    fireEvent.click(uploadTabButton);

    // Now Upload Original Video tab is active
    expect(screen.getByText(/Upload Authorized Original Video File/i)).toBeTruthy();
    expect(screen.getByText(/Click or drag video file here/i)).toBeTruthy();
  });

  it('submits with entered YouTube video information', async () => {
    const handleIngest = vi.fn().mockResolvedValue(undefined);
    render(
      <IngestModal
        isOpen={true}
        onClose={() => {}}
        onLoadProject={() => {}}
        onIngestNew={handleIngest}
        isIngesting={false}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Generate 15-30m Arcs & Ingest/i });
    fireEvent.click(submitBtn);

    expect(handleIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        videoUrl: expect.stringContaining('youtube.com'),
        title: expect.any(String),
        totalDurationMinutes: expect.any(Number),
      })
    );
  });
});
