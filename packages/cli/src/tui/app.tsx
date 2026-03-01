import React, { useState, useCallback, useEffect, useRef, Component, type ReactNode } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { Dashboard } from "./dashboard";
import { StatusBar } from "./status-bar";
import { SpawnDialog } from "./spawn-dialog";
import { ProcessManager } from "../lib/process-manager";
import type { MeetAiClient } from "../types";
import { parseControlMessage } from "../lib/control-room";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="red" bold>TUI crashed: {this.state.error.message}</Text>
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

interface AppProps {
  processManager: ProcessManager;
  client: MeetAiClient;
}

function AppInner({ processManager, client }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [teams, setTeams] = useState(processManager.list());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showSpawn, setShowSpawn] = useState(false);

  const terminalHeight = stdout?.rows ?? 24;
  const dashboardHeight = terminalHeight - 2;

  const refreshTeams = useCallback(() => {
    setTeams([...processManager.list()]);
  }, [processManager]);

  // Spawn into an existing room (room already created)
  const handleSpawnForRoom = useCallback(
    (roomId: string, roomName: string) => {
      // Don't spawn if we're already managing this room
      if (processManager.list().some((t) => t.roomId === roomId)) return;
      processManager.spawn(roomId, roomName);
      refreshTeams();
    },
    [processManager, refreshTeams],
  );

  // Create a new room then spawn
  const handleSpawn = useCallback(
    async (roomName: string) => {
      try {
        const room = await client.createRoom(roomName);
        processManager.spawn(room.id, roomName);
        refreshTeams();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const errorId = `error-${Date.now()}`;
        processManager.addError(errorId, roomName, msg);
        refreshTeams();
      }
    },
    [client, processManager, refreshTeams],
  );

  const handleKillById = useCallback(
    (roomId: string) => {
      processManager.kill(roomId);
      refreshTeams();
    },
    [processManager, refreshTeams],
  );

  // Keep stable refs for use in the mount effect
  const handleSpawnForRoomRef = useRef(handleSpawnForRoom);
  handleSpawnForRoomRef.current = handleSpawnForRoom;
  const handleKillByIdRef = useRef(handleKillById);
  handleKillByIdRef.current = handleKillById;

  // Listen on the lobby WS for new rooms, then check for spawn_request messages
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = client.listenLobby({
        silent: true,
        onRoomCreated: async (roomId, _roomName) => {
          try {
            const messages = await client.getMessages(roomId);
            for (const msg of messages) {
              const cmd = parseControlMessage(msg.content);
              if (cmd?.type === "spawn_request") {
                handleSpawnForRoomRef.current(roomId, cmd.room_name);
                return;
              }
            }
          } catch {
            // Room may have been deleted or inaccessible
          }
        },
      });
    } catch {
      // WebSocket creation failed — will not listen for lobby events
    }

    return () => {
      ws?.close();
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
          onSubmit={(name) => {
            setShowSpawn(false);
            handleSpawn(name);
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

export function App(props: AppProps) {
  return (
    <ErrorBoundary>
      <AppInner {...props} />
    </ErrorBoundary>
  );
}
