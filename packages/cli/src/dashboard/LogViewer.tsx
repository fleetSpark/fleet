import React from 'react';
import { Box, Text } from 'ink';
import type { Mission, MissionLog } from '@fleet/core';

export function LogViewer({
  mission,
  log,
}: {
  mission?: Mission;
  log?: MissionLog;
}): React.JSX.Element {
  if (!mission) {
    return (
      <Box padding={1}>
        <Text dimColor>No mission selected. Use arrows to select a mission, then press Tab.</Text>
      </Box>
    );
  }

  if (!log) {
    return (
      <Box padding={1} flexDirection="column">
        <Text bold>{mission.id}: {mission.branch}</Text>
        <Text dimColor>No log data available (mission may not have started yet).</Text>
      </Box>
    );
  }

  return (
    <Box padding={1} flexDirection="column">
      <Box borderStyle="single" borderColor="blue" paddingX={1} flexDirection="column">
        <Box justifyContent="space-between">
          <Text bold color="blue">{mission.id}: {mission.branch}</Text>
          <Text dimColor>{log.status}</Text>
        </Box>
        <Box gap={3}>
          <Text>Ship: <Text bold>{log.ship}</Text></Text>
          <Text>Agent: <Text bold>{log.agent}</Text></Text>
          <Text dimColor>Heartbeat: {log.heartbeat.lastPush.toLocaleTimeString()}</Text>
        </Box>
      </Box>

      {/* Brief */}
      <Box marginTop={1} flexDirection="column">
        <Text bold underline>Brief</Text>
        <Text wrap="wrap">{log.brief}</Text>
      </Box>

      {/* Steps */}
      {log.steps.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold underline>
            Steps ({log.steps.filter((s) => s.done).length}/{log.steps.length})
          </Text>
          {log.steps.map((step, i) => (
            <Box key={i} gap={1}>
              <Text color={step.done ? 'green' : 'gray'}>
                {step.done ? '[✓]' : '[ ]'}
              </Text>
              <Text color={step.done ? 'green' : undefined}>{step.text}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Blockers */}
      {log.blockers.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold underline color="red">Blockers</Text>
          {log.blockers.map((blocker, i) => (
            <Text key={i} color="red">{'• '}{blocker}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
