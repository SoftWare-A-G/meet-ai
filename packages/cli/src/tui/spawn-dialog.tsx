import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { CodingAgentId } from "@meet-ai/cli/coding-agents";

interface SpawnDialogProps {
  codingAgents: { id: CodingAgentId; label: string }[];
  onSubmit: (roomName: string, codingAgent: CodingAgentId) => void;
  onCancel: () => void;
}

export function SpawnDialog({ codingAgents, onSubmit, onCancel }: SpawnDialogProps) {
  const [roomName, setRoomName] = useState("");
  const [cursor, setCursor] = useState(0);
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return && roomName.trim()) {
      onSubmit(roomName.trim(), codingAgents[selectedAgentIndex]?.id ?? "claude");
      return;
    }

    if (key.upArrow) {
      setSelectedAgentIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedAgentIndex((current) => Math.min(codingAgents.length - 1, current + 1));
      return;
    }

    if (key.leftArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }

    if (key.rightArrow) {
      setCursor((c) => Math.min(roomName.length, c + 1));
      return;
    }

    if (key.backspace || key.delete) {
      if (cursor > 0) {
        setRoomName((v) => v.slice(0, cursor - 1) + v.slice(cursor));
        setCursor((c) => c - 1);
      }
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setRoomName((v) => v.slice(0, cursor) + input + v.slice(cursor));
      setCursor((c) => c + input.length);
    }
  });

  const before = roomName.slice(0, cursor);
  const at = roomName[cursor] ?? " ";
  const after = roomName.slice(cursor + 1);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
    >
      <Text bold color="green">
        New Team
      </Text>
      <Box>
        <Text>Room name: </Text>
        <Text color="cyan">{before}</Text>
        <Text backgroundColor="cyan" color="black">{at}</Text>
        <Text color="cyan">{after}</Text>
      </Box>
      <Text>
        Agent:{" "}
        <Text color="yellow">
          {codingAgents[selectedAgentIndex]?.label ?? "Claude Code"}
        </Text>
      </Text>
      <Text dimColor>Use ←/→ to edit the room name, ↑/↓ to choose the coding agent, Enter to spawn.</Text>
    </Box>
  );
}
