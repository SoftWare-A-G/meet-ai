import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

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
