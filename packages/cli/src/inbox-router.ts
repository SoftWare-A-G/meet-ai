import { readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { dirname } from "path";

export const IDLE_CHECK_INTERVAL_MS = 60_000;
export const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

export function appendToInbox(path: string, entry: { from: string; text: string; timestamp: string; read: boolean }) {
  mkdirSync(dirname(path), { recursive: true });
  let messages: any[] = [];
  try { messages = JSON.parse(readFileSync(path, "utf-8")); } catch {}
  messages.push(entry);
  writeFileSync(path, JSON.stringify(messages, null, 2));
}

export function getTeamMembers(teamDir: string): Set<string> {
  try {
    const config = JSON.parse(readFileSync(`${teamDir}/config.json`, "utf-8"));
    return new Set(config.members?.map((m: any) => m.name) || []);
  } catch {
    return new Set();
  }
}

export function resolveInboxTargets(
  content: string,
  members: Set<string>,
): string[] | null {
  const mentions = content.match(/@([\w-]+)/g);
  if (!mentions) return null;

  const valid = [...new Set(mentions.map(m => m.slice(1)))].filter(name => members.has(name));
  return valid.length > 0 ? valid : null;
}

export function checkIdleAgents(
  inboxDir: string,
  members: Set<string>,
  excludeAgent: string,
  notified: Set<string>,
  now: number = Date.now(),
): string[] {
  const newlyIdle: string[] = [];
  for (const member of members) {
    if (member === excludeAgent) continue;

    const inboxPath = `${inboxDir}/${member}.json`;
    let mtime: number;
    try {
      mtime = statSync(inboxPath).mtimeMs;
    } catch {
      // File doesn't exist — agent is new, skip (not idle)
      continue;
    }

    const idleMs = now - mtime;
    if (idleMs >= IDLE_THRESHOLD_MS) {
      if (!notified.has(member)) {
        newlyIdle.push(member);
      }
    } else {
      // File was recently updated — clear from notified set
      notified.delete(member);
    }
  }
  return newlyIdle;
}
