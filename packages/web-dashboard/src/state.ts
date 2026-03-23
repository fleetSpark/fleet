import type { FastifyReply } from 'fastify';
import type { StateSnapshot } from './poller.js';

function serializeSnapshot(snapshot: StateSnapshot): object {
  const logs: Record<string, unknown> = {};
  for (const [id, log] of snapshot.logs) {
    logs[id] = {
      ...log,
      heartbeat: {
        lastPush: log.heartbeat.lastPush.toISOString(),
        pushInterval: log.heartbeat.pushInterval,
      },
    };
  }

  return {
    manifest: {
      updated: snapshot.manifest.updated.toISOString(),
      commander: {
        host: snapshot.manifest.commander.host,
        lastCheckin: snapshot.manifest.commander.lastCheckin.toISOString(),
        status: snapshot.manifest.commander.status,
        timeoutMinutes: snapshot.manifest.commander.timeoutMinutes,
      },
      missions: snapshot.manifest.missions,
      mergeQueue: snapshot.manifest.mergeQueue,
      completed: snapshot.manifest.completed.map((c) => ({
        ...c,
        mergedDate: c.mergedDate.toISOString(),
      })),
    },
    logs,
    telemetry: {
      ...snapshot.telemetry,
      timestamp: snapshot.telemetry.timestamp.toISOString(),
    },
    fetchedAt: snapshot.fetchedAt.toISOString(),
  };
}

export class StateCache {
  private latest: StateSnapshot | null = null;
  private latestSerialized: object | null = null;
  private subscribers = new Set<FastifyReply>();

  update(snapshot: StateSnapshot): void {
    this.latest = snapshot;
    this.latestSerialized = serializeSnapshot(snapshot);

    const data = `data: ${JSON.stringify(this.latestSerialized)}\n\n`;
    const dead: FastifyReply[] = [];

    for (const reply of this.subscribers) {
      try {
        reply.raw.write(data);
      } catch {
        dead.push(reply);
      }
    }

    for (const reply of dead) {
      this.subscribers.delete(reply);
    }
  }

  getLatest(): object | null {
    return this.latestSerialized;
  }

  getLatestSnapshot(): StateSnapshot | null {
    return this.latest;
  }

  subscribe(reply: FastifyReply): () => void {
    this.subscribers.add(reply);
    return () => {
      this.subscribers.delete(reply);
    };
  }
}
