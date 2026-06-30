import type { GitOps } from '../git/git-ops.js';

/**
 * Whether a machine is driven by Fleet missions or operated manually.
 * - `mission`: a ship running `fleet ship` — liveness already flows from MISSION.md.
 * - `manual`: a commander box, an idle machine, or a hand-driven agent session
 *   that has no mission of its own but should still show alive.
 */
export type MachineMode = 'mission' | 'manual';

export interface Presence {
  host: string;
  mode: MachineMode;
  status: 'alive';
  /** ISO timestamp of the last published heartbeat. */
  lastSeen: string;
  note?: string;
}

const PRESENCE_DIR = 'presence';

/** Sanitize a hostname into a filesystem-safe presence filename stem. */
export function sanitizeHost(host: string): string {
  const cleaned = host.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'unknown-host';
}

export function presencePath(host: string): string {
  return `${PRESENCE_DIR}/${sanitizeHost(host)}.json`;
}

export function serializePresence(presence: Presence): string {
  return JSON.stringify(presence, null, 2);
}

export function parsePresence(raw: string): Presence {
  const obj = JSON.parse(raw) as Partial<Presence>;
  if (!obj.host || typeof obj.host !== 'string') {
    throw new Error('Invalid presence record: missing host');
  }
  const mode: MachineMode = obj.mode === 'manual' ? 'manual' : 'mission';
  if (!obj.lastSeen || typeof obj.lastSeen !== 'string') {
    throw new Error('Invalid presence record: missing lastSeen');
  }
  return {
    host: obj.host,
    mode,
    status: 'alive',
    lastSeen: obj.lastSeen,
    ...(obj.note ? { note: obj.note } : {}),
  };
}

/**
 * Is a presence record still fresh? A machine is considered alive if it
 * published within `staleAfterSeconds`. Defaults to 3× a typical 60s interval.
 */
export function isPresenceAlive(
  presence: Presence,
  staleAfterSeconds: number,
  now: Date = new Date()
): boolean {
  const last = new Date(presence.lastSeen).getTime();
  if (Number.isNaN(last)) return false;
  return now.getTime() - last <= staleAfterSeconds * 1000;
}

export interface LivenessOptions {
  host: string;
  mode: MachineMode;
  intervalSeconds: number;
  /** Branch the presence file is published to. Defaults to `fleet/state`. */
  branch?: string;
  note?: string;
}

/**
 * Publishes a non-mission liveness record to the fleet/state branch so a
 * commander, an idle box, or a manually-driven agent session shows alive
 * without running `fleet ship`. Mirrors `ShipHeartbeat`'s timer lifecycle.
 */
export class LivenessPublisher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly branch: string;

  constructor(
    private gitOps: GitOps,
    private options: LivenessOptions
  ) {
    this.branch = options.branch ?? 'fleet/state';
  }

  /** Write a single presence heartbeat and return the published record. */
  async publishOnce(): Promise<Presence> {
    const presence: Presence = {
      host: this.options.host,
      mode: this.options.mode,
      status: 'alive',
      lastSeen: new Date().toISOString(),
      ...(this.options.note ? { note: this.options.note } : {}),
    };

    await this.gitOps.writeAndPush(
      this.branch,
      presencePath(this.options.host),
      serializePresence(presence),
      `heartbeat: ${this.options.host} (${this.options.mode}) ${presence.lastSeen}`
    );

    return presence;
  }

  start(): void {
    if (this.timer) return;
    void this.publishOnce();
    this.timer = setInterval(() => {
      void this.publishOnce();
    }, this.options.intervalSeconds * 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
