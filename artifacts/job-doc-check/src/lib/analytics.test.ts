import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from './analytics';

describe('trackEvent', () => {
  afterEach(() => {
    delete window.umami;
  });

  it('forwards the event and non-sensitive dimensions to the injected tracker', () => {
    const track = vi.fn();
    window.umami = { track };

    trackEvent('cover_letter_generated', { source: 'recording' });

    expect(track).toHaveBeenCalledWith('cover_letter_generated', {
      source: 'recording',
    });
  });

  it('is a safe no-op when analytics is disabled', () => {
    expect(() => trackEvent('voice_recording_started')).not.toThrow();
  });

  it('does not break the product flow when the tracker fails', () => {
    window.umami = {
      track: vi.fn(() => {
        throw new Error('tracker unavailable');
      }),
    };

    expect(() => trackEvent('voice_file_selected')).not.toThrow();
  });
});