import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface SpawnDialogProps {
  onSubmit: (roomName: string, prompt: string) => void;
  onCancel: () => void;
}

export function SpawnDialog({ onSubmit, onCancel }: SpawnDialogProps) {
  const [step, setStep] = useState<"name" | "prompt">("name");
  const [roomName, setRoomName] = useState("");
  const [prompt, setPrompt] = useState("");

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (step === "name" && roomName.trim()) {
        setStep("prompt");
      } else if (step === "prompt" && prompt.trim()) {
        onSubmit(roomName.trim(), prompt.trim());
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (step === "name") setRoomName((v) => v.slice(0, -1));
      else setPrompt((v) => v.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      if (step === "name") setRoomName((v) => v + input);
      else setPrompt((v) => v + input);
    }
  });

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
        <Text color={step === "name" ? "cyan" : "white"}>{roomName}</Text>
        {step === "name" && <Text color="cyan">{"█"}</Text>}
      </Box>
      {step === "prompt" && (
        <Box>
          <Text>Prompt: </Text>
          <Text color="cyan">{prompt}</Text>
          <Text color="cyan">{"█"}</Text>
        </Box>
      )}
    </Box>
  );
}
