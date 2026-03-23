import type { Mission } from '../protocol/types.js';

const DONE_STATUSES = new Set(['completed', 'merge-queued', 'merged']);

export function getReadyMissions(missions: Mission[]): Mission[] {
  return missions.filter((mission) => {
    if (mission.status !== 'pending') return false;
    if (mission.depends.length === 0) return true;

    return mission.depends.every((depId) => {
      const dep = missions.find((m) => m.id === depId);
      return dep && DONE_STATUSES.has(dep.status);
    });
  });
}

export function validateDAG(
  missions: Mission[]
): { valid: boolean; cycles?: string[] } {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[] = [];

  function dfs(id: string): boolean {
    if (inStack.has(id)) {
      cycles.push(id);
      return true;
    }
    if (visited.has(id)) return false;

    visited.add(id);
    inStack.add(id);

    const mission = missions.find((m) => m.id === id);
    if (mission) {
      for (const depId of mission.depends) {
        if (dfs(depId)) return true;
      }
    }

    inStack.delete(id);
    return false;
  }

  for (const mission of missions) {
    if (dfs(mission.id)) break;
  }

  return cycles.length > 0 ? { valid: false, cycles } : { valid: true };
}
