import React from "react";
import { Box, Text } from "ink";
import type { ProcessStatus } from "../lib/process-manager";

const STATUS_ICONS: Record<ProcessStatus, string> = {
  starting: "...",
  running: ">>>",
  exited: "[done]",
  error: "[err]",
};

interface PaneProps {
  roomName: string;
  status: ProcessStatus;
  lines: string[];
  focused: boolean;
  height: number;
}

export function Pane({ roomName, status, lines, focused, height }: PaneProps) {
  const visibleLines = lines.slice(-(height - 2));

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle={focused ? "double" : "single"}
      borderColor={focused ? "cyan" : "gray"}
      height={height}
    >
      <Box>
        <Text bold color={focused ? "cyan" : "white"}>
          {" "}
          {roomName}{" "}
        </Text>
        <Text dimColor>{STATUS_ICONS[status]}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {visibleLines.map((line, i) => (
          <Text key={i} wrap="truncate">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
