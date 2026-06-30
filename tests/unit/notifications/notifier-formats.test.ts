import { describe, it, expect } from 'vitest';
import { Notifier } from '@fleetspark/core';
import type { FleetEvent } from '@fleetspark/core';

const notifier = new Notifier({ webhooks: [] });
const event: FleetEvent = { type: 'ci-failed', missionId: 'M1', branch: 'feature/auth' };

describe('Notifier.formatBody', () => {
  it('formats Discord with a content field', () => {
    const body = notifier.formatBody(event, { url: 'x', format: 'discord' }) as { content: string };
    expect(body.content).toContain('M1');
    expect(body.content).toContain('CI failed');
  });

  it('formats Telegram with chat_id and Markdown', () => {
    const body = notifier.formatBody(event, { url: 'x', format: 'telegram', chatId: '12345' }) as {
      chat_id: string;
      text: string;
      parse_mode: string;
    };
    expect(body.chat_id).toBe('12345');
    expect(body.text).toContain('M1');
    expect(body.parse_mode).toBe('Markdown');
  });

  it('formats Linear with title, description, and labels', () => {
    const body = notifier.formatBody(event, { url: 'x', format: 'linear' }) as {
      title: string;
      description: string;
      labels: string[];
    };
    expect(body.title).toContain('CI failed for M1');
    expect(body.description).not.toMatch(/[*`]/); // markdown stripped
    expect(body.labels).toContain('fleet');
    expect(body.labels).toContain('ci-failed');
  });

  it('formats Slack with a text field', () => {
    const body = notifier.formatBody(event, { url: 'x', format: 'slack' }) as { text: string };
    expect(body.text).toContain('M1');
  });

  it('defaults to the raw JSON event', () => {
    const body = notifier.formatBody(event, { url: 'x' });
    expect(body).toEqual(event);
  });

  it('routes each format through notify()', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, opts: { body: string }) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      return { ok: true };
    }) as unknown as typeof fetch;

    const n = new Notifier({
      webhooks: [
        { url: 'https://discord', format: 'discord' },
        { url: 'https://telegram', format: 'telegram', chatId: '9' },
      ],
    });
    await n.notify(event);
    globalThis.fetch = orig;

    expect(calls).toHaveLength(2);
    expect((calls[0].body as { content?: string }).content).toBeDefined();
    expect((calls[1].body as { chat_id?: string }).chat_id).toBe('9');
  });
});
