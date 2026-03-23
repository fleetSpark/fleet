import React from 'react';
import { Box, Text } from 'ink';
import type { Mission, MissionLog, MissionStatus } from '@fleetspark/core';

const STATUS_COLORS: Record<MissionStatus, string> = {
  'pending': 'gray',
  'ready': 'cyan',
  'assigned': 'blue',
  'in-progress': 'yellow',
  'completed': 'green',
  'blocked': 'red',
  'stalled': 'magenta',
  'failed': 'red',
  'merge-queued': 'greenBright',
  'merged': 'greenBright',
};

const STATUS_ICONS: Record<MissionStatus, string> = {
  'pending': '○',
  'ready': '◎',
  'assigned': '◉',
  'in-progress': '●',
  'completed': '✓',
  'blocked': '✗',
  'stalled': '⚠',
  'failed': '✗',
  'merge-queued': '↗',
  'merged': '✓',
};

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max - 1) + '…' : str;
}

function getStepProgress(missionId: string, logs: Map<string, MissionLog>): string {
  const log = logs.get(missionId);
  if (!log || log.steps.length === 0) return '';
  const done = log.steps.filter((s) => s.done).length;
  return `${done}/${log.steps.length}`;
}

export function MissionBoard({
  missions,
  selectedIndex,
  missionLogs,
}: {
  missions: Mission[];
  selectedIndex: number;
  missionLogs: Map<string, MissionLog>;
}): React.JSX.Element {
  if (missions.length === 0) {
    return (
      <Box>
        <Text dimColor>No missions.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>Missions</Text>
      <Box marginTop={1} flexDirection="column">
        {/* Header row */}
        <Box gap={1}>
          <Text dimColor>{' '.padEnd(2)}</Text>
          <Text dimColor bold>{'ID'.padEnd(6)}</Text>
          <Text dimColor bold>{'Branch'.padEnd(26)}</Text>
          <Text dimColor bold>{'Ship'.padEnd(14)}</Text>
          <Text dimColor bold>{'Agent'.padEnd(14)}</Text>
          <Text dimColor bold>{'Status'.padEnd(14)}</Text>
          <Text dimColor bold>{'Progress'.padEnd(8)}</Text>
        </Box>

        {missions.map((m, i) => {
          const isSelected = i === selectedIndex;
          const color = STATUS_COLORS[m.status] ?? 'white';
          const icon = STATUS_ICONS[m.status] ?? '?';
          const progress = getStepProgress(m.id, missionLogs);

          return (
            <Box key={m.id} gap={1}>
              <Text color={isSelected ? 'cyan' : undefined}>
                {isSelected ? '▸ ' : '  '}
              </Text>
              <Text bold={isSelected}>{m.id.padEnd(6)}</Text>
              <Text>{truncate(m.branch, 26).padEnd(26)}</Text>
              <Text color={m.ship ? 'white' : 'gray'}>
                {(m.ship ?? '—').padEnd(14)}
              </Text>
              <Text>{truncate(m.agent, 14).padEnd(14)}</Text>
              <Text color={color}>
                {`${icon} ${m.status}`.padEnd(14)}
              </Text>
              <Text dimColor>{progress.padEnd(8)}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Dependencies for selected mission */}
      {missions[selectedIndex] && missions[selectedIndex].depends.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>
            Depends on: {missions[selectedIndex].depends.join(', ')}
          </Text>
        </Box>
      )}
      {missions[selectedIndex]?.blocker && missions[selectedIndex].blocker !== 'none' && (
        <Box>
          <Text color="red">
            Blocker: {missions[selectedIndex].blocker}
          </Text>
        </Box>
      )}
    </Box>
  );
}
