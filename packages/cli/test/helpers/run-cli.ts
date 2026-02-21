import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../../src/index.ts", import.meta.url));

export function runCli(
  args: string[],
  env?: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("bun", ["run", CLI_PATH, ...args], {
      env: { ...process.env, CLAUDECODE: "", ...env },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}
