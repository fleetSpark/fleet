import React from 'react';
import { Box, Text } from 'ink';
import type { FleetManifest } from '@fleetspark/core';
import type { View } from './App.js';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function Header({
  manifest,
  lastRefresh,
  view,
}: {
  manifest: FleetManifest;
  lastRefresh: Date;
  view: View;
}): React.JSX.Element {
  const total = manifest.missions.length;
  const inProgress = manifest.missions.filter(
    (m) => m.status === 'in-progress' || m.status === 'assigned'
  ).length;
  const completed = manifest.missions.filter(
    (m) => m.status === 'completed' || m.status === 'merged' || m.status === 'merge-queued'
  ).length;
  const failed = manifest.missions.filter((m) => m.status === 'failed').length;

  const cmdStatus = manifest.commander.status === 'active' ? 'green' : 'yellow';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          {'⚓ Fleet Dashboard'}
        </Text>
        <Text dimColor>
          {view === 'board' ? '[Board]' : '[Logs]'} | refreshed {formatTimeAgo(lastRefresh)}
        </Text>
      </Box>
      <Box gap={3}>
        <Text>
          Commander: <Text color={cmdStatus} bold>{manifest.commander.host}</Text>
          {' '}({manifest.commander.status})
        </Text>
        <Text>
          Missions: <Text color="blue">{total}</Text>
          {' | '}<Text color="green">{inProgress} active</Text>
          {' | '}<Text color="greenBright">{completed} done</Text>
          {failed > 0 && <Text>{' | '}<Text color="red">{failed} failed</Text></Text>}
        </Text>
      </Box>
    </Box>
  );
}
