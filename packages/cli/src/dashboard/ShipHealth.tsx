import React from 'react';
import { Box, Text } from 'ink';
import type { Mission, MissionLog } from '@fleetspark/core';

function getHealthStatus(
  lastPush: Date
): { status: string; color: string } {
  const minutesAgo = (Date.now() - lastPush.getTime()) / (1000 * 60);
  if (minutesAgo < 10) return { status: 'alive', color: 'green' };
  if (minutesAgo < 30) return { status: 'stale', color: 'yellow' };
  return { status: 'dead', color: 'red' };
}

function formatMinutesAgo(date: Date): string {
  const min = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (min < 1) return 'now';
  return `${min}m ago`;
}

export function ShipHealth({
  missions,
  missionLogs,
}: {
  missions: Mission[];
  missionLogs: Map<string, MissionLog>;
}): React.JSX.Element {
  const activeShips = missions.filter(
    (m) => m.ship && (m.status === 'in-progress' || m.status === 'assigned')
  );

  if (activeShips.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold underline>Ships</Text>
        <Text dimColor>No active ships.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>Ships</Text>
      <Box marginTop={1} flexDirection="column">
        {activeShips.map((m) => {
          const log = missionLogs.get(m.id);
          const lastPush = log?.heartbeat.lastPush ?? new Date(0);
          const health = getHealthStatus(lastPush);

          return (
            <Box key={m.id} flexDirection="column" marginBottom={1}>
              <Box gap={1}>
                <Text color={health.color} bold>{'●'}</Text>
                <Text bold>{m.ship}</Text>
                <Text dimColor>({health.status})</Text>
              </Box>
              <Box paddingLeft={2} flexDirection="column">
                <Text dimColor>
                  {m.id} | {m.agent}
                </Text>
                <Text dimColor>
                  heartbeat: {formatMinutesAgo(lastPush)}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
