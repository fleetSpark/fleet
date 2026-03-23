import type { MissionLog, MissionStatus, MissionStep, HeartbeatInfo } from './types.js';

export function parseMissionLog(markdown: string): MissionLog {
  const lines = markdown.split('\n');

  const headerLine = lines[0] ?? '';
  const branchMatch = headerLine.match(/# Mission log — (.+)/);
  const branch = branchMatch ? branchMatch[1].trim() : '';

  const metaLine = lines[1] ?? '';
  const ship = extractField(metaLine, 'Ship');
  const agent = extractField(metaLine, 'Agent');
  const status = extractField(metaLine, 'Status') as MissionStatus;

  const sections = splitByHeadings(lines.slice(2));

  const brief = (sections['mission brief'] ?? '').trim();
  const steps = parseSteps(sections['steps'] ?? '');
  const blockers = parseBlockers(sections['blockers'] ?? '');
  const heartbeat = parseHeartbeat(sections['heartbeat'] ?? '');

  return { branch, ship, agent, status, brief, steps, blockers, heartbeat };
}

export function writeMissionLog(log: MissionLog): string {
  const lines: string[] = [];

  lines.push(`# Mission log — ${log.branch}`);
  lines.push(`Ship: ${log.ship}  |  Agent: ${log.agent}  |  Status: ${log.status}`);
  lines.push('');
  lines.push('## Mission brief');
  lines.push(log.brief);
  lines.push('');
  lines.push('## Steps');
  for (const step of log.steps) {
    lines.push(`- [${step.done ? 'x' : ' '}] ${step.text}`);
  }
  lines.push('');
  lines.push('## Blockers');
  if (log.blockers.length === 0) {
    lines.push('none');
  } else {
    for (const b of log.blockers) {
      lines.push(b);
    }
  }
  lines.push('');
  lines.push('## Heartbeat');
  lines.push(`last_push: ${log.heartbeat.lastPush.toISOString()}`);
  lines.push(`push_interval_seconds: ${log.heartbeat.pushInterval}`);
  lines.push('');

  return lines.join('\n');
}

// --- Internal helpers ---

function extractField(line: string, field: string): string {
  const regex = new RegExp(`${field}:\\s*([^|]+)`);
  const match = line.match(regex);
  return match ? match[1].trim() : '';
}

function splitByHeadings(lines: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  let currentKey = '';

  for (const line of lines) {
    const headingMatch = line.match(/^## (.+)$/);
    if (headingMatch) {
      currentKey = headingMatch[1].trim().toLowerCase();
      result[currentKey] = '';
      continue;
    }
    if (currentKey) {
      result[currentKey] += line + '\n';
    }
  }

  return result;
}

function parseSteps(section: string): MissionStep[] {
  return section
    .split('\n')
    .filter((line) => line.match(/^- \[[ x]\]/))
    .map((line) => {
      const done = line.includes('[x]');
      const text = line.replace(/^- \[[ x]\]\s*/, '');
      return { text, done };
    });
}

function parseBlockers(section: string): string[] {
  const trimmed = section.trim();
  if (!trimmed || trimmed === 'none') return [];
  return trimmed.split('\n').filter(Boolean);
}

function parseHeartbeat(section: string): HeartbeatInfo {
  const lines = section.trim().split('\n');
  let lastPush = new Date();
  let pushInterval = 60;

  for (const line of lines) {
    if (line.startsWith('last_push:')) {
      lastPush = new Date(line.substring('last_push:'.length).trim());
    } else if (line.startsWith('push_interval_seconds:')) {
      pushInterval = parseInt(
        line.substring('push_interval_seconds:'.length).trim(),
        10
      );
    }
  }

  return { lastPush, pushInterval };
}
