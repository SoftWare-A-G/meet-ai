export type ParsedLine =
  | { type: "text"; content: string }
  | { type: "tool"; content: string }
  | { type: "thinking"; content: string };

export function parseLine(line: string): ParsedLine | null {
  if (!line.trim()) return null;

  try {
    const data = JSON.parse(line);
    const event = data?.event;
    if (!event) return null;

    // Text delta
    if (event.delta?.type === "text_delta") {
      return { type: "text", content: event.delta.text };
    }

    // Thinking delta
    if (event.delta?.type === "thinking_delta") {
      return { type: "thinking", content: event.delta.thinking };
    }

    // Tool use start
    if (
      event.type === "content_block_start" &&
      event.content_block?.type === "tool_use"
    ) {
      return { type: "tool", content: `[tool: ${event.content_block.name}]` };
    }

    return null;
  } catch {
    return null;
  }
}
