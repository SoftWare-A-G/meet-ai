import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

/**
 * Find Claude Code CLI installation
 */
function findClaudeCli(): string {
  try {
    const command = platform() === "win32" ? "where claude" : "which claude";
    const result = execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    const claudePath = result.split("\n")[0].trim();
    if (claudePath && existsSync(claudePath)) {
      return claudePath;
    }
  } catch {
    // Continue to other methods
  }

  const envPath = process.env.MEET_AI_CLAUDE_PATH;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  const home = homedir();
  const commonPaths = [
    join(home, ".bun", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    join(home, ".local", "bin", "claude"),
  ];

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    `
Claude Code is not installed

Please install Claude Code:
  bun add -g @anthropic-ai/claude-code

Or set MEET_AI_CLAUDE_PATH to the Claude Code CLI path.
    `.trim()
  );
}

/**
 * Spawn Claude Code interactively in the current terminal
 */
export async function spawnInteractive(): Promise<void> {
  const claudePath = findClaudeCli();

  return new Promise((resolve, reject) => {
    const child = spawn(claudePath, [], {
      stdio: "inherit",
      env: {
        ...process.env,
        DISABLE_AUTOUPDATER: "1",
      },
    });

    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Claude exited with code ${code}`));
      }
    });

    child.on("error", reject);
  });
}
