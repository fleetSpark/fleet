import * as vscode from 'vscode';
import { fetchStatus, runFleet, type FleetStatusJson, type MissionJson } from './fleetCli.js';

const STATUS_ICON: Record<string, string> = {
  pending: 'clock',
  ready: 'circle-outline',
  assigned: 'person',
  'in-progress': 'sync',
  completed: 'check',
  blocked: 'error',
  stalled: 'warning',
  failed: 'close',
  'merge-queued': 'git-pull-request',
  merged: 'git-merge',
};

class MissionItem extends vscode.TreeItem {
  constructor(public readonly mission: MissionJson) {
    super(`${mission.id}: ${mission.branch}`, vscode.TreeItemCollapsibleState.None);
    this.description = `${mission.status}${mission.ship ? ` · ${mission.ship}` : ''}`;
    this.tooltip = [
      `Mission: ${mission.id}`,
      `Branch: ${mission.branch}`,
      `Agent: ${mission.agent}`,
      `Status: ${mission.status}`,
      mission.ship ? `Ship: ${mission.ship}` : 'Unassigned',
      mission.depends.length ? `Depends: ${mission.depends.join(', ')}` : 'No dependencies',
      mission.blocker && mission.blocker !== 'none' ? `Blocker: ${mission.blocker}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    this.iconPath = new vscode.ThemeIcon(STATUS_ICON[mission.status] ?? 'circle-outline');
    this.contextValue = 'fleetMission';
  }
}

class ShipItem extends vscode.TreeItem {
  constructor(ship: string, missions: MissionJson[]) {
    super(ship, vscode.TreeItemCollapsibleState.None);
    const active = missions.filter((m) => m.status === 'in-progress' || m.status === 'assigned');
    this.description = active.length ? `${active.length} active` : 'idle';
    this.tooltip = missions.map((m) => `${m.id} (${m.status})`).join('\n');
    this.iconPath = new vscode.ThemeIcon(active.length ? 'vm-active' : 'vm-outline');
  }
}

class FleetProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private status: FleetStatusJson | null = null;

  constructor(private readonly kind: 'missions' | 'ships') {}

  async refresh(): Promise<void> {
    this.status = await fetchStatus();
    this.emitter.fire();
  }

  setStatus(status: FleetStatusJson | null): void {
    this.status = status;
    this.emitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    if (!this.status) {
      return [new vscode.TreeItem('No fleet state — run "fleet init"')];
    }
    if (this.kind === 'missions') {
      if (this.status.missions.length === 0) return [new vscode.TreeItem('No missions')];
      return this.status.missions.map((m) => new MissionItem(m));
    }
    // ships view: group missions by ship
    const byShip = new Map<string, MissionJson[]>();
    for (const m of this.status.missions) {
      if (!m.ship) continue;
      const list = byShip.get(m.ship) ?? [];
      list.push(m);
      byShip.set(m.ship, list);
    }
    if (byShip.size === 0) return [new vscode.TreeItem('No ships active')];
    return [...byShip.entries()].map(([ship, missions]) => new ShipItem(ship, missions));
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const missionsProvider = new FleetProvider('missions');
  const shipsProvider = new FleetProvider('ships');

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('fleetMissions', missionsProvider),
    vscode.window.registerTreeDataProvider('fleetShips', shipsProvider),
  );

  const refreshAll = async () => {
    const status = await fetchStatus();
    missionsProvider.setStatus(status);
    shipsProvider.setStatus(status);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('fleetspark.refresh', refreshAll),
    vscode.commands.registerCommand('fleetspark.status', async () => {
      const status = await fetchStatus();
      if (!status) {
        vscode.window.showWarningMessage('No fleet state found. Run "fleet init".');
        return;
      }
      const counts = status.missions.reduce<Record<string, number>>((acc, m) => {
        acc[m.status] = (acc[m.status] ?? 0) + 1;
        return acc;
      }, {});
      const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ');
      vscode.window.showInformationMessage(
        `Commander ${status.commander.host} (${status.commander.status}) — ${status.missions.length} missions: ${summary}`,
      );
    }),
    vscode.commands.registerCommand('fleetspark.plan', async () => {
      const goal = await vscode.window.showInputBox({ prompt: 'Goal to decompose into missions' });
      if (!goal) return;
      await runInTerminal(['command', '--plan', goal]);
    }),
    vscode.commands.registerCommand('fleetspark.report', () => runInTerminal(['report'])),
    vscode.commands.registerCommand('fleetspark.outcomes', () => runInTerminal(['outcomes'])),
    vscode.commands.registerCommand('fleetspark.replayMission', async () => {
      const status = await fetchStatus();
      const choices = (status?.missions ?? []).map((m) => `${m.id} (${m.status})`);
      const pick = await vscode.window.showQuickPick(choices, { placeHolder: 'Mission to replay' });
      if (!pick) return;
      const id = pick.split(' ')[0];
      await runFleet(['replay', id]);
      await refreshAll();
      vscode.window.showInformationMessage(`Replayed mission ${id}.`);
    }),
  );

  // Initial load + periodic refresh.
  void refreshAll();
  const intervalSec = vscode.workspace.getConfiguration('fleetspark').get<number>('refreshIntervalSeconds', 30);
  const timer = setInterval(() => void refreshAll(), Math.max(5, intervalSec) * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

export function deactivate(): void {
  // no-op
}

function runInTerminal(args: string[]): void {
  const cliPath = vscode.workspace.getConfiguration('fleetspark').get<string>('cliPath', 'fleet');
  const terminal = vscode.window.createTerminal('FleetSpark');
  terminal.show();
  const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
  terminal.sendText(`${cliPath} ${quoted}`);
}
