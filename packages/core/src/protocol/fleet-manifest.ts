import type {
  FleetManifest,
  CommanderInfo,
  Mission,
  MergeEntry,
  CompletedEntry,
  MissionStatus,
  CommanderStatus,
} from './types.js';

export function parseFleetManifest(markdown: string): FleetManifest {
  const sections = splitSections(markdown);

  const updated = parseUpdatedTimestamp(sections.header);
  const commander = parseCommander(sections.commander);
  const missions = parseMissions(sections.missions);
  const mergeQueue = parseMergeQueue(sections.mergeQueue);
  const completed = parseCompleted(sections.completed);

  return { updated, commander, missions, mergeQueue, completed };
}

export function writeFleetManifest(manifest: FleetManifest): string {
  const lines: string[] = [];

  lines.push('# Fleet manifest');
  lines.push(`Updated: ${manifest.updated.toISOString()}`);
  lines.push('');
  lines.push('## Commander');
  lines.push(
    `host: ${manifest.commander.host}  |  last_checkin: ${manifest.commander.lastCheckin.toISOString()}  |  status: ${manifest.commander.status}`
  );
  lines.push(`timeout_minutes: ${manifest.commander.timeoutMinutes}`);
  lines.push('');
  lines.push('## Active missions');
  lines.push('| ID | Branch | Ship | Agent | Status | Depends | Blocker |');
  lines.push('|----|--------|------|-------|--------|---------|---------|');

  for (const m of manifest.missions) {
    const depends = m.depends.length > 0 ? m.depends.join(', ') : 'none';
    const ship = m.ship ?? 'none';
    lines.push(
      `| ${m.id} | ${m.branch} | ${ship} | ${m.agent} | ${m.status} | ${depends} | ${m.blocker} |`
    );
  }

  lines.push('');
  lines.push('## Merge queue');
  for (const entry of manifest.mergeQueue) {
    const ciPart = entry.ciStatus ? `CI ${entry.ciStatus}, ` : '';
    lines.push(`- ${entry.missionId} ${entry.branch} — ${ciPart}${entry.note}`);
  }

  lines.push('');
  lines.push('## Completed');
  for (const entry of manifest.completed) {
    lines.push(
      `- ${entry.missionId} ${entry.branch} merged ${entry.mergedDate.toISOString()}`
    );
  }

  lines.push('');
  return lines.join('\n');
}

// --- Internal helpers ---

interface Sections {
  header: string;
  commander: string;
  missions: string;
  mergeQueue: string;
  completed: string;
}

function splitSections(markdown: string): Sections {
  const result: Sections = {
    header: '',
    commander: '',
    missions: '',
    mergeQueue: '',
    completed: '',
  };

  const sectionMap: Record<string, keyof Sections> = {
    'commander': 'commander',
    'active missions': 'missions',
    'merge queue': 'mergeQueue',
    'completed': 'completed',
  };

  let currentKey: keyof Sections = 'header';
  const lines = markdown.split('\n');

  for (const line of lines) {
    const headingMatch = line.match(/^## (.+)$/);
    if (headingMatch) {
      const heading = headingMatch[1].trim().toLowerCase();
      currentKey = sectionMap[heading] ?? currentKey;
      continue;
    }
    result[currentKey] += line + '\n';
  }

  return result;
}

function parseUpdatedTimestamp(header: string): Date {
  const match = header.match(/Updated:\s*(.+)/);
  if (!match) throw new Error('Missing Updated timestamp in FLEET.md');
  return new Date(match[1].trim());
}

function parseCommander(section: string): CommanderInfo {
  const lines = section.trim().split('\n').filter(Boolean);
  if (lines.length < 2) throw new Error('Invalid Commander section in FLEET.md');

  const headerLine = lines[0];
  const pairs = headerLine.split('|').map((s) => s.trim());

  let host = '';
  let lastCheckin = new Date();
  let status: CommanderStatus = 'active';

  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx < 0) continue;
    const key = pair.substring(0, colonIdx).trim();
    const joinedValue = pair.substring(colonIdx + 1).trim();
    if (key === 'host') host = joinedValue;
    else if (key === 'last_checkin') lastCheckin = new Date(joinedValue);
    else if (key === 'status') status = joinedValue as CommanderStatus;
  }

  const timeoutLine = lines[1];
  const timeoutMatch = timeoutLine.match(/timeout_minutes:\s*(\d+)/);
  const timeoutMinutes = timeoutMatch ? parseInt(timeoutMatch[1], 10) : 15;

  return { host, lastCheckin, status, timeoutMinutes };
}

function parseMissions(section: string): Mission[] {
  const lines = section.trim().split('\n').filter(Boolean);
  const dataLines = lines.filter(
    (line) =>
      line.startsWith('|') &&
      !line.includes('----') &&
      !line.toLowerCase().includes('| id ')
  );

  return dataLines.map((line) => {
    const cells = line
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    if (cells.length < 7) throw new Error(`Invalid mission row: ${line}`);

    const [id, branch, ship, agent, status, depends, blocker] = cells;

    return {
      id,
      branch,
      ship: ship === 'none' ? null : ship,
      agent,
      status: status as MissionStatus,
      depends: depends === 'none' ? [] : depends.split(',').map((s) => s.trim()),
      blocker,
    };
  });
}

function parseMergeQueue(section: string): MergeEntry[] {
  const lines = section.trim().split('\n').filter(Boolean);
  return lines
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const content = line.substring(2);
      const dashIdx = content.indexOf('—');
      const beforeDash = dashIdx >= 0 ? content.substring(0, dashIdx).trim() : content;
      const note = dashIdx >= 0 ? content.substring(dashIdx + 1).trim() : '';

      const parts = beforeDash.split(/\s+/);
      const missionId = parts[0];
      const branch = parts[1] ?? '';

      let ciStatus = '';
      let finalNote = note;
      const ciMatch = note.match(/^CI\s+(\w+),\s*(.*)/);
      if (ciMatch) {
        ciStatus = ciMatch[1];
        finalNote = ciMatch[2];
      }

      return { missionId, branch, ciStatus, note: finalNote };
    });
}

function parseCompleted(section: string): CompletedEntry[] {
  const lines = section.trim().split('\n').filter(Boolean);
  return lines
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const content = line.substring(2);
      const parts = content.split(/\s+/);
      const missionId = parts[0];
      const branch = parts[1] ?? '';
      const mergedIdx = parts.indexOf('merged');
      const dateStr = mergedIdx >= 0 ? parts.slice(mergedIdx + 1).join(' ') : '';

      return {
        missionId,
        branch,
        mergedDate: new Date(dateStr),
      };
    });
}
