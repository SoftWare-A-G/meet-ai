import { describe, test, expect, afterEach } from "bun:test";
import { ProcessManager, type TeamProcess } from "../src/lib/process-manager";

describe("ProcessManager", () => {
  let pm: ProcessManager;

  afterEach(() => {
    pm?.killAll();
  });

  test("spawn adds a process to the map", () => {
    pm = new ProcessManager({ claudePath: "echo", dryRun: true });
    pm.spawn("room-1", "test-room");
    const team = pm.get("room-1");
    expect(team).toBeDefined();
    expect(team!.status).toBe("starting");
    expect(team!.roomName).toBe("test-room");
  });

  test("list returns all tracked processes", () => {
    pm = new ProcessManager({ claudePath: "echo", dryRun: true });
    pm.spawn("room-1", "test-room-1");
    pm.spawn("room-2", "test-room-2");
    expect(pm.list().length).toBe(2);
  });

  test("kill removes process from map", () => {
    pm = new ProcessManager({ claudePath: "echo", dryRun: true });
    pm.spawn("room-1", "test-room");
    pm.kill("room-1");
    expect(pm.get("room-1")).toBeUndefined();
  });

  test("killAll clears the map", () => {
    pm = new ProcessManager({ claudePath: "echo", dryRun: true });
    pm.spawn("room-1", "r1");
    pm.spawn("room-2", "r2");
    pm.killAll();
    expect(pm.list().length).toBe(0);
  });
});
