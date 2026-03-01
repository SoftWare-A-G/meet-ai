import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, useInput, useApp, useStdout } from "ink";
import { Dashboard } from "./dashboard";
import { StatusBar } from "./status-bar";
import { SpawnDialog } from "./spawn-dialog";
import { ProcessManager } from "../lib/process-manager";
import type { MeetAiClient } from "../types";
import {
  ensureControlRoom,
  parseControlMessage,
  sendStatus,
} from "../lib/control-room";

interface AppProps {
  processManager: ProcessManager;
  client: MeetAiClient;
}

export function App({ processManager, client }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [teams, setTeams] = useState(processManager.list());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showSpawn, setShowSpawn] = useState(false);
  const controlRoomIdRef = useRef<string | null>(null);

  const terminalHeight = stdout?.rows ?? 24;
  const dashboardHeight = terminalHeight - 2;

  const refreshTeams = useCallback(() => {
    setTeams([...processManager.list()]);
  }, [processManager]);

  const handleSpawn = useCallback(
    async (roomName: string, prompt: string, _model?: string) => {
      try {
        const room = await client.createRoom(roomName);
        processManager.spawn(room.id, roomName, prompt);
        refreshTeams();

        const controlRoomId = controlRoomIdRef.current;
        if (controlRoomId) {
          sendStatus(client, controlRoomId, {
            type: "team_started",
            room_id: room.id,
            room_name: roomName,
          });
        }
      } catch {
        // Room creation failed -- silently ignore in TUI
      }
    },
    [client, processManager, refreshTeams],
  );

  const handleKillById = useCallback(
    (roomId: string) => {
      processManager.kill(roomId);
      refreshTeams();
      const controlRoomId = controlRoomIdRef.current;
      if (controlRoomId) {
        sendStatus(client, controlRoomId, {
          type: "team_killed",
          room_id: roomId,
        });
      }
    },
    [processManager, refreshTeams, client],
  );

  // Keep stable refs for use in the mount effect
  const handleSpawnRef = useRef(handleSpawn);
  handleSpawnRef.current = handleSpawn;
  const handleKillByIdRef = useRef(handleKillById);
  handleKillByIdRef.current = handleKillById;

  // Set up control room WebSocket on mount
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    ensureControlRoom(client).then((roomId) => {
      controlRoomIdRef.current = roomId;

      const ws = client.listen(roomId, {
        onMessage: (msg) => {
          const cmd = parseControlMessage(msg.content);
          if (!cmd) return;

          if (cmd.type === "spawn_request") {
            handleSpawnRef.current(cmd.room_name, cmd.prompt, cmd.model);
          } else if (cmd.type === "kill_request") {
            handleKillByIdRef.current(cmd.room_id);
          }
        },
      });

      cleanup = () => {
        ws.close();
      };
    });

    return () => {
      cleanup?.();
    };
  }, [client]);

  // Refresh TUI every 200ms to pick up new lines
  useEffect(() => {
    const interval = setInterval(refreshTeams, 200);
    return () => clearInterval(interval);
  }, [refreshTeams]);

  useInput((input, key) => {
    if (showSpawn) return;

    if (input === "q") {
      processManager.killAll();
      exit();
      return;
    }

    if (input === "n") {
      setShowSpawn(true);
      return;
    }

    if (input === "k" && teams.length > 0) {
      const team = teams[focusedIndex];
      if (team) handleKillById(team.roomId);
      if (focusedIndex >= teams.length - 1) {
        setFocusedIndex(Math.max(0, focusedIndex - 1));
      }
      return;
    }

    if (key.leftArrow) {
      setFocusedIndex((i) => Math.max(0, i - 1));
    }
    if (key.rightArrow) {
      setFocusedIndex((i) => Math.min(teams.length - 1, i + 1));
    }
  });

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Dashboard
        teams={teams}
        focusedIndex={focusedIndex}
        height={dashboardHeight}
      />
      {showSpawn ? (
        <SpawnDialog
          onSubmit={(name, prompt) => {
            setShowSpawn(false);
            handleSpawn(name, prompt);
          }}
          onCancel={() => setShowSpawn(false)}
        />
      ) : (
        <StatusBar
          teamCount={teams.length}
          focusedRoom={teams[focusedIndex]?.roomName ?? null}
          showingSpawnDialog={false}
        />
      )}
    </Box>
  );
}
