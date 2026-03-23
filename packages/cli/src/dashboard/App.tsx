import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { FleetManifest, MissionLog } from '@fleet/core';
import {
  RealGitOps,
  parseFleetManifest,
  parseMissionLog,
} from '@fleet/core';
import { MissionBoard } from './MissionBoard.js';
import { ShipHealth } from './ShipHealth.js';
import { MergeQueue } from './MergeQueue.js';
import { LogViewer } from './LogViewer.js';
import { Header } from './Header.js';
import { HelpBar } from './HelpBar.js';

export type View = 'board' | 'logs';

export function App({ cwd }: { cwd: string }): React.JSX.Element {
  const { exit } = useApp();
  const [manifest, setManifest] = useState<FleetManifest | null>(null);
  const [missionLogs, setMissionLogs] = useState<Map<string, MissionLog>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('board');
  const [selectedMission, setSelectedMission] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Poll fleet state
  useEffect(() => {
    const git = new RealGitOps(cwd);

    const poll = async () => {
      try {
        const content = await git.readFile('fleet/state', 'FLEET.md');
        const m = parseFleetManifest(content);
        setManifest(m);
        setLastRefresh(new Date());
        setError(null);

        // Fetch mission logs for in-progress missions
        const logs = new Map<string, MissionLog>();
        for (const mission of m.missions) {
          if (['in-progress', 'assigned', 'completed'].includes(mission.status)) {
            try {
              await git.fetchBranch(mission.branch);
              const logContent = await git.readFile(`origin/${mission.branch}`, 'MISSION.md');
              logs.set(mission.id, parseMissionLog(logContent));
            } catch {
              // Branch may not exist yet
            }
          }
        }
        setMissionLogs(logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 10_000);
    return () => clearInterval(interval);
  }, [cwd]);

  // Keyboard input
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
    if (input === 'tab' || input === 't') {
      setView(view === 'board' ? 'logs' : 'board');
    }
    if (key.upArrow || input === 'k') {
      setSelectedMission(Math.max(0, selectedMission - 1));
    }
    if (key.downArrow || input === 'j') {
      if (manifest) {
        setSelectedMission(Math.min(manifest.missions.length - 1, selectedMission + 1));
      }
    }
  });

  if (error && !manifest) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>Error: {error}</Text>
        <Text dimColor>Make sure you are in a Fleet-initialized repository.</Text>
        <Text dimColor>Press q to quit.</Text>
      </Box>
    );
  }

  if (!manifest) {
    return (
      <Box padding={1}>
        <Text color="cyan">Loading fleet state...</Text>
      </Box>
    );
  }

  const selectedId = manifest.missions[selectedMission]?.id;

  if (view === 'logs') {
    const log = selectedId ? missionLogs.get(selectedId) : undefined;
    const mission = manifest.missions[selectedMission];
    return (
      <Box flexDirection="column">
        <Header manifest={manifest} lastRefresh={lastRefresh} view={view} />
        <LogViewer mission={mission} log={log} />
        <HelpBar view={view} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Header manifest={manifest} lastRefresh={lastRefresh} view={view} />
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" flexGrow={1}>
          <MissionBoard
            missions={manifest.missions}
            selectedIndex={selectedMission}
            missionLogs={missionLogs}
          />
        </Box>
        <Box flexDirection="column" width={32} marginLeft={2}>
          <ShipHealth missions={manifest.missions} missionLogs={missionLogs} />
          <MergeQueue mergeQueue={manifest.mergeQueue} completed={manifest.completed} />
        </Box>
      </Box>
      <HelpBar view={view} />
    </Box>
  );
}
