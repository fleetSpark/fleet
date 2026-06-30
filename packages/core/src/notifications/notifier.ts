export type FleetEvent =
  | { type: 'mission-completed'; missionId: string; branch: string }
  | { type: 'pr-created'; missionId: string; prUrl: string }
  | { type: 'pr-merged'; missionId: string; branch: string }
  | { type: 'ci-failed'; missionId: string; branch: string }
  | { type: 'ship-stalled'; missionId: string; ship: string }
  | { type: 'shadow-dispatched'; missionId: string }
  | { type: 'conflict-detected'; missionId: string; files: string[] }
  | { type: 'all-missions-complete'; total: number };

export type WebhookFormat = 'json' | 'slack' | 'discord' | 'telegram' | 'linear';

export interface WebhookConfig {
  url: string;
  events?: string[];
  format?: WebhookFormat;
  /** Telegram chat id (required for the `telegram` format). */
  chatId?: string;
}

export interface NotificationConfig {
  webhooks: WebhookConfig[];
}

export class Notifier {
  constructor(private config: NotificationConfig) {}

  async notify(event: FleetEvent): Promise<void> {
    for (const webhook of this.config.webhooks) {
      if (webhook.events && webhook.events.length > 0 && !webhook.events.includes(event.type)) {
        continue;
      }

      const body = this.formatBody(event, webhook);

      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        console.error(`Notification failed for ${webhook.url}`);
      }
    }
  }

  /** Public so callers/tests can inspect the exact payload per provider. */
  formatBody(event: FleetEvent, webhook: WebhookConfig): object {
    switch (webhook.format) {
      case 'slack':
        return { text: this.plainText(event) };
      case 'discord':
        // Discord incoming webhooks read the `content` field.
        return { content: this.plainText(event) };
      case 'telegram':
        // Telegram bot sendMessage payload.
        return {
          chat_id: webhook.chatId ?? '',
          text: this.plainText(event),
          parse_mode: 'Markdown',
        };
      case 'linear':
        // Structured payload for a Linear-compatible automation endpoint.
        return this.formatLinear(event);
      case 'json':
      default:
        return event;
    }
  }

  private plainText(event: FleetEvent): string {
    switch (event.type) {
      case 'mission-completed':
        return `✅ Mission *${event.missionId}* completed on \`${event.branch}\``;
      case 'pr-created':
        return `🔀 PR created for *${event.missionId}*: ${event.prUrl}`;
      case 'pr-merged':
        return `🎉 PR merged for *${event.missionId}* (\`${event.branch}\`)`;
      case 'ci-failed':
        return `❌ CI failed for *${event.missionId}* (\`${event.branch}\`)`;
      case 'ship-stalled':
        return `⚠️ Ship *${event.ship}* stalled on *${event.missionId}*`;
      case 'shadow-dispatched':
        return `👥 Shadow dispatch triggered for *${event.missionId}*`;
      case 'conflict-detected':
        return `⚡ Conflict detected on *${event.missionId}*: ${event.files.join(', ')}`;
      case 'all-missions-complete':
        return `🏁 All *${event.total}* missions complete!`;
      default:
        return `Fleet event: ${(event as { type: string }).type}`;
    }
  }

  private formatLinear(event: FleetEvent): object {
    const title = (() => {
      switch (event.type) {
        case 'ci-failed':
          return `CI failed for ${event.missionId}`;
        case 'ship-stalled':
          return `Ship ${event.ship} stalled on ${event.missionId}`;
        case 'conflict-detected':
          return `Merge conflict on ${event.missionId}`;
        default:
          return `Fleet: ${event.type}`;
      }
    })();
    return {
      title,
      description: this.plainText(event).replace(/[*`]/g, ''),
      labels: ['fleet', event.type],
    };
  }
}
