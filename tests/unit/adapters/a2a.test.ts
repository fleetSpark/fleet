import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createA2AAdapter } from '../../../packages/adapters/a2a/dist/index.js';

describe('A2A adapter', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const config = { agentUrl: 'http://localhost:8080/a2a' };

  it('has name "a2a"', () => {
    const adapter = createA2AAdapter(config);
    expect(adapter.name).toBe('a2a');
  });

  it('start sends tasks/send JSON-RPC request', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: { id: 'task-1', status: { state: 'submitted' } } }),
    });

    const adapter = createA2AAdapter(config);
    const session = await adapter.start({
      id: 'M1', branch: 'feature/test', brief: 'Test mission', agent: 'a2a', depends: [],
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8080/a2a');
    const body = JSON.parse(opts.body);
    expect(body.method).toBe('tasks/send');
    expect(session.adapter).toBe('a2a');
    expect(session.missionId).toBe('M1');
  });

  it('isAlive returns true for working task', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: { id: 'task-1', status: { state: 'submitted' } } }),
    });

    const adapter = createA2AAdapter(config);
    const session = await adapter.start({
      id: 'M2', branch: 'feature/test2', brief: 'Test', agent: 'a2a', depends: [],
    });

    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: { id: 'task-1', status: { state: 'working' } } }),
    });

    const alive = await adapter.isAlive(session);
    expect(alive).toBe(true);
  });

  it('isAlive returns false after stop', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: { id: 'task-1', status: { state: 'submitted' } } }),
    });

    const adapter = createA2AAdapter(config);
    const session = await adapter.start({
      id: 'M3', branch: 'feature/test3', brief: 'Test', agent: 'a2a', depends: [],
    });

    mockFetch.mockResolvedValueOnce({ json: async () => ({ result: {} }) }); // cancel response
    await adapter.stop(session);

    const alive = await adapter.isAlive(session);
    expect(alive).toBe(false);
  });
});
