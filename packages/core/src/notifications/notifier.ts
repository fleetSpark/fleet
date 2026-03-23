export type FleetEvent =
  | { type: 'mission-completed'; missionId: string; branch: string }
  | { type: 'pr-created'; missionId: string; prUrl: string }
  | { type: 'pr-merged'; missionId: string; branch: string }
  | { type: 'ci-failed'; missionId: string; branch: string }
  | { type: 'ship-stalled'; missionId: string; ship: string }
  | { type: 'shadow-dispatched'; missionId: string }
  | { type: 'conflict-detected'; missionId: string; files: string[] }
  | { type: 'all-missions-complete'; total: number };

export interface WebhookConfig {
  url: string;
  events?: string[];
  format?: 'json' | 'slack';
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

      const body = webhook.format === 'slack'
        ? this.formatSlack(event)
        : event;

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

  private formatSlack(event: FleetEvent): object {
    let text: string;
    switch (event.type) {
      case 'mission-completed':
        text = `✅ Mission *${event.missionId}* completed on \`${event.branch}\``;
        break;
      case 'pr-created':
        text = `🔀 PR created for *${event.missionId}*: ${event.prUrl}`;
        break;
      case 'pr-merged':
        text = `🎉 PR merged for *${event.missionId}* (\`${event.branch}\`)`;
        break;
      case 'ci-failed':
        text = `❌ CI failed for *${event.missionId}* (\`${event.branch}\`)`;
        break;
      case 'ship-stalled':
        text = `⚠️ Ship *${event.ship}* stalled on *${event.missionId}*`;
        break;
      case 'shadow-dispatched':
        text = `👥 Shadow dispatch triggered for *${event.missionId}*`;
        break;
      case 'conflict-detected':
        text = `⚡ Conflict detected on *${event.missionId}*: ${event.files.join(', ')}`;
        break;
      case 'all-missions-complete':
        text = `🏁 All *${event.total}* missions complete!`;
        break;
      default:
        text = `Fleet event: ${(event as any).type}`;
    }
    return { text };
  }
}
