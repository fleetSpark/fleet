import type { FleetPlugin, FleetContext, HookResult } from '@fleetspark/core';
import type { Mission } from '@fleetspark/core';
import {
  readAdapterConfig,
  readWorkstreams,
  findWorkstreamForBranch,
} from './workstream.js';
import {
  inferMissionPhase,
  checkSpecGate,
  checkCodeGate,
  checkMergeGate,
} from './gate-checker.js';

const plugin: FleetPlugin = {
  name: '@fleetspark/plugin-drsti-dev-flow',
  version: '1.0.0',

  async onBeforeMissionStart(mission: Mission, context: FleetContext): Promise<HookResult> {
    const adapter = await readAdapterConfig(context.workDir);
    if (!adapter) {
      // No .drsti/adapter.yml — plugin degrades gracefully, no enforcement
      return { block: false };
    }

    const workstreams = await readWorkstreams(context.workDir, adapter.state.workstreams);
    const ws = findWorkstreamForBranch(workstreams, mission.branch);

    if (!ws) {
      // No workstream registered for this branch — allow (not every mission is governed)
      return { block: false };
    }

    const phase = inferMissionPhase(mission.branch);

    // Before impl starts — check spec gate
    if (phase === 'impl') {
      const specCheck = checkSpecGate(ws);
      if (!specCheck.passed) {
        return { block: true, reason: specCheck.reason };
      }
    }

    // Before review starts — check code gate
    if (phase === 'review') {
      const codeCheck = checkCodeGate(ws);
      if (!codeCheck.passed) {
        return { block: true, reason: codeCheck.reason };
      }
    }

    return { block: false };
  },

  async onBeforeMerge(mission: Mission, context: FleetContext): Promise<HookResult> {
    const adapter = await readAdapterConfig(context.workDir);
    if (!adapter) return { block: false };

    const workstreams = await readWorkstreams(context.workDir, adapter.state.workstreams);
    const ws = findWorkstreamForBranch(workstreams, mission.branch);

    if (!ws) return { block: false };

    const mergeCheck = checkMergeGate(ws);
    if (!mergeCheck.passed) {
      return { block: true, reason: mergeCheck.reason };
    }

    return { block: false };
  },
};

export default plugin;
