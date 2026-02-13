#!/usr/bin/env bash
# PostToolUse hook — streams tool-call summaries to the meet-ai chat room.
# Auto-discovers the room by matching the current session_id against
# ~/.claude/teams/*/meet-ai.json files.
#
# Always exits 0 so it never blocks the agent.

set -eo pipefail
trap 'exit 0' ERR

# Read the hook event JSON from stdin
INPUT="$(cat)"

SESSION_ID="$(echo "$INPUT" | jq -r '.session_id // empty')"
TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // empty')"

# Nothing useful without these
[ -z "$SESSION_ID" ] && exit 0
[ -z "$TOOL_NAME" ] && exit 0

# Skip Bash commands that are just cd or meet-ai CLI calls (avoid recursion)
if [ "$TOOL_NAME" = "Bash" ]; then
  CMD_CHECK="$(echo "$INPUT" | jq -r '.tool_input.command // empty')"
  case "$CMD_CHECK" in
    cd\ *|meet-ai\ *) exit 0 ;;
  esac
fi

# Skip SendMessage — internal agent communication, not useful as logs
[ "$TOOL_NAME" = "SendMessage" ] && exit 0

# --- Find the room_id by scanning team meet-ai.json files ---
ROOM_ID=""
for f in "$HOME"/.claude/teams/*/meet-ai.json; do
  [ -f "$f" ] || continue
  FILE_SID="$(jq -r '.session_id // empty' "$f" 2>/dev/null)"
  if [ "$FILE_SID" = "$SESSION_ID" ]; then
    ROOM_ID="$(jq -r '.room_id // empty' "$f" 2>/dev/null)"
    break
  fi
done

# Not in a team session — skip silently
[ -z "$ROOM_ID" ] && exit 0

# --- Build a one-line summary from the tool call ---
TOOL_INPUT="$(echo "$INPUT" | jq -c '.tool_input // {}')"

case "$TOOL_NAME" in
  Edit)
    FILE="$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' | xargs basename 2>/dev/null || echo '?')"
    SUMMARY="Edit: $FILE"
    ;;
  Bash)
    CMD="$(echo "$TOOL_INPUT" | jq -r '.command // empty')"
    CMD="${CMD:0:60}"
    SUMMARY="Bash: $CMD"
    ;;
  Grep)
    PATTERN="$(echo "$TOOL_INPUT" | jq -r '.pattern // empty')"
    GLOB="$(echo "$TOOL_INPUT" | jq -r '.glob // .path // empty')"
    SUMMARY="Grep: \"$PATTERN\" in $GLOB"
    ;;
  Read)
    FILE="$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' | xargs basename 2>/dev/null || echo '?')"
    SUMMARY="Read: $FILE"
    ;;
  Write)
    FILE="$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' | xargs basename 2>/dev/null || echo '?')"
    SUMMARY="Write: $FILE"
    ;;
  Glob)
    PATTERN="$(echo "$TOOL_INPUT" | jq -r '.pattern // empty')"
    SUMMARY="Glob: $PATTERN"
    ;;
  Task)
    DESC="$(echo "$TOOL_INPUT" | jq -r '.description // empty')"
    DESC="${DESC:0:60}"
    SUMMARY="Task: $DESC"
    ;;
  WebFetch)
    URL="$(echo "$TOOL_INPUT" | jq -r '.url // empty')"
    SUMMARY="WebFetch: $URL"
    ;;
  WebSearch)
    QUERY="$(echo "$TOOL_INPUT" | jq -r '.query // empty')"
    SUMMARY="WebSearch: $QUERY"
    ;;
  *)
    SUMMARY="$TOOL_NAME"
    ;;
esac

# --- Get or create the parent message ID ---
MSGID_FILE="/tmp/meet-ai-hook-${SESSION_ID}.msgid"
MSG_ID=""

if [ -f "$MSGID_FILE" ]; then
  FILE_MTIME="$(stat -f %m "$MSGID_FILE" 2>/dev/null || echo 0)"
  FILE_AGE=$(( $(date +%s) - FILE_MTIME ))
  if [ "$FILE_AGE" -gt 120 ]; then
    rm -f "$MSGID_FILE"
    MSG_ID=""
  else
    MSG_ID="$(cat "$MSGID_FILE" 2>/dev/null || true)"
  fi
fi

if [ -z "$MSG_ID" ]; then
  # First tool call — create a parent message (synchronous, need the ID)
  OUTPUT="$(meet-ai send-message "$ROOM_ID" "hook" "Agent activity" --color "#6b7280" 2>/dev/null || true)"
  # Parse "Message sent: <uuid>" from output
  MSG_ID="$(echo "$OUTPUT" | sed -n 's/^Message sent: //p')"
  if [ -n "$MSG_ID" ]; then
    echo -n "$MSG_ID" > "$MSGID_FILE"
  fi
fi

# --- Send the log entry in the background ---
if [ -n "$MSG_ID" ]; then
  meet-ai send-log "$ROOM_ID" "hook" "$SUMMARY" --color "#6b7280" --message-id "$MSG_ID" &
else
  meet-ai send-log "$ROOM_ID" "hook" "$SUMMARY" --color "#6b7280" &
fi

exit 0
