import React from 'react';
import { Box, Text } from 'ink';
import type { View } from './App.js';

export function HelpBar({ view }: { view: View }): React.JSX.Element {
  return (
    <Box marginTop={1} gap={2}>
      <Text dimColor>
        <Text bold>j/k</Text> navigate
        {' | '}
        <Text bold>Tab</Text> {view === 'board' ? 'view logs' : 'view board'}
        {' | '}
        <Text bold>q</Text> quit
        {' | '}
        auto-refresh 10s
      </Text>
    </Box>
  );
}
