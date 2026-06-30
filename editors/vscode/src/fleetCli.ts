import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const run = promisify(execFile);

export interface MissionJson {
  id: string;
  branch: string;
  ship: string | null;
  agent: string;
  status: string;
  depends: string[];
  blocker: string;
}

export interface FleetStatusJson {
  updated: string;
  commander: { host: string; status: string; lastCheckin: string; timeoutMinutes: number };
  missions: MissionJson[];
  mergeQueue: Array<{ missionId: string; branch: string; ciStatus: string; note: string }>;
  completed: Array<{ missionId: string; branch: string; mergedDate: string }>;
}

function cliPath(): string {
  return vscode.workspace.getConfiguration('fleetspark').get<string>('cliPath', 'fleet');
}

function workspaceCwd(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/** Run a fleet CLI subcommand and return stdout. */
export async function runFleet(args: string[]): Promise<string> {
  const cwd = workspaceCwd();
  if (!cwd) throw new Error('No workspace folder open.');
  const { stdout } = await run(cliPath(), args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

/** Fetch the parsed fleet status, or null when no fleet state is present. */
export async function fetchStatus(): Promise<FleetStatusJson | null> {
  try {
    const stdout = await runFleet(['status', '--json']);
    return JSON.parse(stdout) as FleetStatusJson;
  } catch {
    return null;
  }
}
