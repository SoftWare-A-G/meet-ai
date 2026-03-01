import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  teamCount: number;
  focusedRoom: string | null;
  showingSpawnDialog: boolean;
}

export function StatusBar({
  teamCount,
  focusedRoom,
  showingSpawnDialog,
}: StatusBarProps) {
  if (showingSpawnDialog) {
    return (
      <Box>
        <Text dimColor>Enter room name and prompt. Press </Text>
        <Text bold>Escape</Text>
        <Text dimColor> to cancel.</Text>
      </Box>
    );
  }

  return (
    <Box justifyContent="space-between">
      <Box gap={2}>
        <Text>
          <Text dimColor>[</Text>
          <Text bold color="green">n</Text>
          <Text dimColor>]ew</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold color="red">k</Text>
          <Text dimColor>]ill</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold>{"<->"}</Text>
          <Text dimColor>]focus</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold color="yellow">q</Text>
          <Text dimColor>]uit</Text>
        </Text>
      </Box>
      <Box gap={2}>
        {focusedRoom && <Text color="cyan">{focusedRoom}</Text>}
        <Text dimColor>
          {teamCount} team{teamCount !== 1 ? "s" : ""}
        </Text>
      </Box>
    </Box>
  );
}
