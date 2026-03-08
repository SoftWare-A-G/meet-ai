export type MeetAiRuntime = 'claude' | 'codex'

export function getMeetAiRuntime(
  env: NodeJS.ProcessEnv = process.env,
): MeetAiRuntime {
  const raw = env.MEET_AI_RUNTIME?.trim().toLowerCase()
  if (raw === 'codex') return 'codex'
  return 'claude'
}

export function isCodexRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getMeetAiRuntime(env) === 'codex'
}
