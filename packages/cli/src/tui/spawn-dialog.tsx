import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface SpawnDialogProps {
  onSubmit: (roomName: string) => void;
  onCancel: () => void;
}

export function SpawnDialog({ onSubmit, onCancel }: SpawnDialogProps) {
  const [roomName, setRoomName] = useState("");
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return && roomName.trim()) {
      onSubmit(roomName.trim());
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

    if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
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
    </Box>
  );
}
