import type { MeetAiClient } from "@meet-ai/cli/types";

export async function generateKey(client: MeetAiClient) {
  const result = await client.generateKey();
  // Primary data output — the key is the main output, so use console.log
  console.log(`API Key: ${result.key}`);
  console.log(`Prefix:  ${result.prefix}`);
  return result;
}
