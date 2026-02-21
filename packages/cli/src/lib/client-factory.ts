import { getMeetAiConfig } from "../config";
import { createClient } from "../client";
import type { MeetAiClient } from "../types";

let _client: MeetAiClient | null = null;

export function getClient(): MeetAiClient {
  if (!_client) {
    const config = getMeetAiConfig();
    _client = createClient(config.url, config.key) as MeetAiClient;
  }
  return _client;
}
