import { spawn as nodeSpawn, spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { version as CURRENT_VERSION } from '../../package.json'

export { CURRENT_VERSION }

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up_to_date' }
  | { status: 'downloading'; version: string }
  | { status: 'ready_to_restart'; version: string }
  | { status: 'offline' }
  | { status: 'failed'; error: string }
  | { status: 'update_unavailable'; version: string }

export function isNewer(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number)
  const l = local.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((r[i] ?? 0) > (l[i] ?? 0)) return true
    if ((r[i] ?? 0) < (l[i] ?? 0)) return false
  }
  return false
}

export function detectInstaller(): { supported: true; npmPath: string } | { supported: false; reason: string } {
  const npmPath = Bun.which('npm')
  if (!npmPath) return { supported: false, reason: 'npm not found in PATH' }

  const prefixResult = spawnSync('npm', ['prefix', '-g'])
  if (prefixResult.status !== 0) return { supported: false, reason: 'cannot determine npm global prefix' }
  const npmGlobalPrefix = prefixResult.stdout.toString().trim()

  // process.argv[1] is the CLI script path (process.argv[0] is the runtime binary)
  const scriptPath = process.argv[1]
  if (!scriptPath) return { supported: false, reason: 'cannot determine script path' }

  let resolvedScript: string
  try {
    resolvedScript = realpathSync(scriptPath)
  } catch {
    resolvedScript = scriptPath
  }

  if (!resolvedScript.startsWith(npmGlobalPrefix)) {
    return { supported: false, reason: 'binary not under npm global prefix (likely dev/manual install)' }
  }

  return { supported: true, npmPath }
}

export async function checkForUpdate(): Promise<
  { available: true; version: string } | { available: false; reason: string }
> {
  try {
    const res = await fetch('https://registry.npmjs.org/@meet-ai/cli/latest', {
      signal: AbortSignal.timeout(3_000),
    })
    if (!res.ok) return { available: false, reason: `registry returned ${res.status}` }
    const data = (await res.json()) as { version?: string }
    if (!data.version) return { available: false, reason: 'no version in registry response' }
    if (!isNewer(data.version, CURRENT_VERSION)) return { available: false, reason: 'up to date' }
    return { available: true, version: data.version }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('abort') || msg.includes('timeout') || msg.includes('ENOTFOUND') || msg.includes('EAI_AGAIN')) {
      return { available: false, reason: 'offline' }
    }
    return { available: false, reason: msg }
  }
}

export async function downloadUpdate(
  version: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const installer = detectInstaller()
  if (!installer.supported) return { ok: false, error: installer.reason }

  return new Promise(resolve => {
    try {
      const child = nodeSpawn('npm', ['i', '-g', `@meet-ai/cli@${version}`], {
        stdio: ['ignore', 'ignore', 'pipe'],
      })

      let stderr = ''
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('error', (err: Error) => {
        resolve({ ok: false, error: err.message })
      })

      child.on('close', (code: number | null) => {
        if (code === 0) resolve({ ok: true })
        else resolve({ ok: false, error: stderr.trim() || `npm exited with code ${code}` })
      })
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })
}

export function restartApp(onBeforeExit?: () => void): never {
  let execPath: string
  try {
    execPath = realpathSync(process.argv[0])
  } catch {
    execPath = process.argv[0]
  }

  // Spawn first — if this throws, the caller's TUI is still intact
  const child = nodeSpawn(execPath, process.argv.slice(1), {
    stdio: 'inherit',
    detached: true,
  })

  if (!child.pid) {
    throw new Error('Failed to spawn replacement process')
  }

  // Child confirmed spawned — now safe to tear down the current process
  onBeforeExit?.()
  child.unref()
  process.exit(0)
}
