import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Notifier } from '../../../packages/core/dist/notifications/notifier.js';
import type { FleetEvent } from '../../../packages/core/dist/notifications/notifier.js';

describe('Notifier', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to webhook URL with JSON body', async () => {
    const notifier = new Notifier({
      webhooks: [{ url: 'https://example.com/hook' }],
    });

    const event: FleetEvent = { type: 'pr-merged', missionId: 'M1', branch: 'feature/auth' };
    await notifier.notify(event);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(event);
  });

  it('filters events when events array is specified', async () => {
    const notifier = new Notifier({
      webhooks: [{ url: 'https://example.com/hook', events: ['pr-merged'] }],
    });

    await notifier.notify({ type: 'ci-failed', missionId: 'M1', branch: 'feature/x' });
    expect(mockFetch).not.toHaveBeenCalled();

    await notifier.notify({ type: 'pr-merged', missionId: 'M1', branch: 'feature/x' });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('formats Slack messages correctly', async () => {
    const notifier = new Notifier({
      webhooks: [{ url: 'https://hooks.slack.com/xxx', format: 'slack' }],
    });

    await notifier.notify({ type: 'pr-merged', missionId: 'M1', branch: 'feature/auth' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('M1');
    expect(body.text).toContain('merged');
  });

  it('does not throw when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const notifier = new Notifier({
      webhooks: [{ url: 'https://example.com/hook' }],
    });

    // Should not throw
    await notifier.notify({ type: 'pr-merged', missionId: 'M1', branch: 'feature/x' });
  });

  it('sends to multiple webhooks', async () => {
    const notifier = new Notifier({
      webhooks: [
        { url: 'https://example.com/hook1' },
        { url: 'https://example.com/hook2' },
      ],
    });

    await notifier.notify({ type: 'pr-merged', missionId: 'M1', branch: 'feature/x' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
