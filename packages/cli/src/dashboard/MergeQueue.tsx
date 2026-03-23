import React from 'react';
import { Box, Text } from 'ink';
import type { MergeEntry, CompletedEntry } from '@fleet/core';

export function MergeQueue({
  mergeQueue,
  completed,
}: {
  mergeQueue: MergeEntry[];
  completed: CompletedEntry[];
}): React.JSX.Element {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold underline>Merge Queue</Text>
      <Box marginTop={1} flexDirection="column">
        {mergeQueue.length === 0 ? (
          <Text dimColor>Empty</Text>
        ) : (
          mergeQueue.map((entry) => {
            const ciColor =
              entry.ciStatus === 'success'
                ? 'green'
                : entry.ciStatus === 'failure'
                  ? 'red'
                  : 'yellow';

            return (
              <Box key={entry.missionId} gap={1}>
                <Text>{entry.missionId}</Text>
                {entry.ciStatus && (
                  <Text color={ciColor}>CI:{entry.ciStatus}</Text>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {completed.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold underline>Completed ({completed.length})</Text>
          <Box marginTop={1} flexDirection="column">
            {completed.slice(-5).map((entry) => (
              <Box key={entry.missionId} gap={1}>
                <Text color="greenBright">{'✓'}</Text>
                <Text>{entry.missionId}</Text>
                <Text dimColor>{entry.branch}</Text>
              </Box>
            ))}
            {completed.length > 5 && (
              <Text dimColor>...and {completed.length - 5} more</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
