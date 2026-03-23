export type MissionStatus =
  | 'pending'
  | 'ready'
  | 'assigned'
  | 'in-progress'
  | 'completed'
  | 'blocked'
  | 'stalled'
  | 'failed'
  | 'merge-queued'
  | 'merged';

export type CommanderStatus = 'active' | 'offline' | 'transferred';

export interface CommanderInfo {
  host: string;
  lastCheckin: Date;
  status: CommanderStatus;
  timeoutMinutes: number;
}

export interface Mission {
  id: string;
  branch: string;
  ship: string | null;
  agent: string;
  status: MissionStatus;
  depends: string[];
  blocker: string;
}

export interface MergeEntry {
  missionId: string;
  branch: string;
  ciStatus: string;
  note: string;
}

export interface CompletedEntry {
  missionId: string;
  branch: string;
  mergedDate: Date;
}

export interface FleetManifest {
  updated: Date;
  commander: CommanderInfo;
  missions: Mission[];
  mergeQueue: MergeEntry[];
  completed: CompletedEntry[];
}

export interface MissionStep {
  text: string;
  done: boolean;
}

export interface HeartbeatInfo {
  lastPush: Date;
  pushInterval: number;
}

export interface MissionLog {
  branch: string;
  ship: string;
  agent: string;
  status: MissionStatus;
  brief: string;
  steps: MissionStep[];
  blockers: string[];
  heartbeat: HeartbeatInfo;
}

export interface MissionBrief {
  id: string;
  branch: string;
  brief: string;
  agent: string;
  depends: string[];
  context?: string;
}

export interface TaskBrief {
  mission_id: string;
  branch: string;
  ship_id: string;
  adapter: string;
  description: string;
  depends_on: string[];
  context_file: string | null;
  created_at: string;
}

export interface AgentSession {
  pid: number;
  missionId: string;
  adapter: string;
  startedAt: Date;
}

export interface FleetAdapter {
  name: string;
  start(mission: MissionBrief, context?: string): Promise<AgentSession>;
  isAlive(session: AgentSession): Promise<boolean>;
  send(session: AgentSession, message: string): Promise<void>;
  stop(session: AgentSession): Promise<void>;
}
