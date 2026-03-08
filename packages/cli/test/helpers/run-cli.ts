import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const CLI_PATH = fileURLToPath(new URL("../../src/index.ts", import.meta.url));
const CLI_DIR = dirname(CLI_PATH);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function runCli(
  args: string[],
  env?: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const captureDir = mkdtempSync(`${tmpdir()}/meet-ai-cli-test-`);
    const stdoutPath = `${captureDir}/stdout.txt`;
    const stderrPath = `${captureDir}/stderr.txt`;
    const command = [
      "cd",
      shellQuote(CLI_DIR.replace(/\/src$/, "")),
      "&&",
      "bun",
      "run",
      shellQuote(CLI_PATH),
      ...args.map(shellQuote),
      ">",
      shellQuote(stdoutPath),
      "2>",
      shellQuote(stderrPath),
    ].join(" ");

    execFile("bash", ["-lc", command], {
      env: { ...process.env, CLAUDECODE: "", ...env },
    }, (error) => {
      const errorCode = (error as NodeJS.ErrnoException | null)?.code;
      const exitCode = typeof errorCode === "number" ? errorCode : error ? 1 : 0;
      let stdout = "";
      let stderr = "";
      try {
        stdout = readFileSync(stdoutPath, "utf8");
      } catch {}
      try {
        stderr = readFileSync(stderrPath, "utf8");
      } catch {}
      rmSync(captureDir, { recursive: true, force: true });
      resolve({
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}
