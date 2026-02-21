/**
 * Extracts remaining content from raw CLI args by skipping known positionals and flags.
 * Used by send-message and send-log where content = all remaining positional args joined.
 *
 * Example: ["room-1", "bot", "hello", "world", "--color", "red"]
 * With skipCount=2 -> "hello world"
 */
export function extractRestContent(rawArgs: string[], skipCount: number): string {
  const positionals: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith("--") || (arg.startsWith("-") && arg.length === 2)) {
      // Only skip the next token if the value isn't already in the flag (--flag=value)
      if (!arg.includes("=")) {
        i++; // skip flag + its separate value
      }
      continue;
    }
    positionals.push(arg);
  }
  return positionals.slice(skipCount).join(" ");
}
