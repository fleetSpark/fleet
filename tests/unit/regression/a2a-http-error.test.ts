import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createA2AAdapter } from '../../../packages/adapters/a2a/dist/index.js';

describe('A2A adapter HTTP error handling', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const config = { agentUrl: 'http://localhost:9999/a2a' };
  const mission = {
    id: 'M-err',
    branch: 'feat/error-test',
    brief: 'Test error handling',
    agent: 'a2a',
    depends: [],
  };

  it('throws on HTTP 500 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const adapter = createA2AAdapter(config);
    await expect(adapter.start(mission)).rejects.toThrow(/HTTP 500/);
  });

  it('throws on HTTP 404 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const adapter = createA2AAdapter(config);
    await expect(adapter.start(mission)).rejects.toThrow(/HTTP 404/);
  });

  it('throws on HTTP 503 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const adapter = createA2AAdapter(config);
    await expect(adapter.start(mission)).rejects.toThrow(/HTTP 503/);
  });

  it('throws when response has no task ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: {} }),
    });

    const adapter = createA2AAdapter(config);
    await expect(adapter.start(mission)).rejects.toThrow(/no task ID/);
  });

  it('does not throw on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        result: { id: 'task-ok', status: { state: 'submitted' } },
      }),
    });

    const adapter = createA2AAdapter(config);
    const session = await adapter.start(mission);
    expect(session.missionId).toBe('M-err');
  });
});
