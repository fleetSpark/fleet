import type { Workstream, ReviewGateField } from './workstream.js';

export interface GateCheckResult {
  passed: boolean;
  reason?: string;
}

function isGateComplete(gate: ReviewGateField, requirePeerReview: boolean): boolean {
  if (!gate.artifact || !gate.self_review) return false;
  if (requirePeerReview && !gate.peer_review) return false;
  return true;
}

/**
 * Check whether the spec gate is complete for the given workstream.
 * L3+: artifact + self_review required.
 * L4: artifact + self_review + peer_review required.
 */
export function checkSpecGate(ws: Workstream): GateCheckResult {
  const level = parseInt(ws.maturity_level, 10);
  if (level < 3) return { passed: true }; // L1/L2 — no gate enforcement

  const requirePeer = level >= 4;
  const gate = ws.review_gate.spec;

  if (!gate.artifact) {
    return { passed: false, reason: `Workstream ${ws.id}: spec artifact not recorded. The spec mission must commit a spec document before implementation can start.` };
  }
  if (!gate.self_review) {
    return { passed: false, reason: `Workstream ${ws.id}: spec self-review not recorded. Complete the self-review in workstreams.json before implementation starts.` };
  }
  if (requirePeer && !gate.peer_review) {
    return { passed: false, reason: `Workstream ${ws.id} (L4): spec peer-review not recorded. An L4 workstream requires a peer review of the spec before implementation can start.` };
  }

  return { passed: true };
}

/**
 * Check whether the code gate is complete (used before the review/M3 mission starts).
 */
export function checkCodeGate(ws: Workstream): GateCheckResult {
  const level = parseInt(ws.maturity_level, 10);
  if (level < 3) return { passed: true };

  const requirePeer = level >= 4;
  const gate = ws.review_gate.code;

  if (!gate.artifact) {
    return { passed: false, reason: `Workstream ${ws.id}: code artifact not recorded. The implementation mission must record its artifact before the review mission can start.` };
  }
  if (!gate.self_review) {
    return { passed: false, reason: `Workstream ${ws.id}: code self-review not recorded. Complete the self-review before the review mission starts.` };
  }
  if (requirePeer && !gate.peer_review) {
    return { passed: false, reason: `Workstream ${ws.id} (L4): code peer-review not recorded. An L4 workstream requires a peer review of the implementation before the review mission starts.` };
  }

  return { passed: true };
}

/**
 * Check whether the workstream merge gate is open (merge_gate === "ready").
 */
export function checkMergeGate(ws: Workstream): GateCheckResult {
  const level = parseInt(ws.maturity_level, 10);
  if (level < 3) return { passed: true };

  if (ws.merge_gate !== 'ready') {
    return {
      passed: false,
      reason: `Workstream ${ws.id}: merge_gate is "${ws.merge_gate}", not "ready". Update workstreams.json to set merge_gate = "ready" when all review criteria are met.`,
    };
  }

  // L4 — verify all gate fields are populated
  if (level >= 4) {
    for (const phase of ['spec', 'plan', 'code'] as const) {
      const gate = ws.review_gate[phase];
      if (!gate.artifact || !gate.self_review || !gate.peer_review) {
        return {
          passed: false,
          reason: `Workstream ${ws.id} (L4): review_gate.${phase} is incomplete (artifact, self_review, and peer_review are all required). Populate all fields before merging.`,
        };
      }
    }
  }

  return { passed: true };
}

/**
 * Infer the current phase of a mission from its branch name.
 * Returns 'spec' | 'impl' | 'review' | 'unknown'.
 */
export function inferMissionPhase(branch: string): 'spec' | 'impl' | 'review' | 'unknown' {
  if (branch.endsWith('-spec') || branch.includes('-spec/')) return 'spec';
  if (branch.endsWith('-impl') || branch.includes('-impl/')) return 'impl';
  if (branch.endsWith('-review') || branch.includes('-review/')) return 'review';
  return 'unknown';
}
