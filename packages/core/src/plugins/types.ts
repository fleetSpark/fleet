import type { Mission } from '../protocol/types.js';

export interface FleetContext {
  /** Absolute path to the working directory (cloned repo root) */
  workDir: string;
  /** Git remote URL, if available */
  repoUrl?: string;
}

export interface HookResult {
  /** true = block the action; false = allow it */
  block: boolean;
  /** Human-readable reason shown in the terminal when blocked */
  reason?: string;
}

export interface FleetPlugin {
  name: string;
  version: string;

  /**
   * Called after a ship claims a mission but before the AI agent is spawned.
   * Return { block: true, reason: '...' } to prevent the mission from starting.
   */
  onBeforeMissionStart?(mission: Mission, context: FleetContext): Promise<HookResult>;

  /**
   * Called before MergeCommander creates a pull request for a completed mission.
   * Return { block: true, reason: '...' } to hold the PR until the issue is resolved.
   */
  onBeforeMerge?(mission: Mission, context: FleetContext): Promise<HookResult>;
}

export interface PluginConfig {
  name: string;
  options?: Record<string, unknown>;
}
