import React from "react";
import { Box, Text } from "ink";
import { Pane } from "./pane";
import type { TeamProcess } from "../lib/process-manager";

interface DashboardProps {
  teams: TeamProcess[];
  focusedIndex: number;
  height: number;
}

export function Dashboard({ teams, focusedIndex, height }: DashboardProps) {
  if (teams.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>No teams running. Press </Text>
        <Text bold color="green">
          n
        </Text>
        <Text dimColor> to spawn a new team.</Text>
      </Box>
    );
  }

  return (
    <Box flexGrow={1} flexDirection="row">
      {teams.map((team, index) => (
        <Pane
          key={team.roomId}
          roomName={team.roomName}
          status={team.status}
          lines={team.lines}
          focused={index === focusedIndex}
          height={height}
        />
      ))}
    </Box>
  );
}
