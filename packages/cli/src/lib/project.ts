import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { basename } from 'node:path'

export function detectProject(apiKey: string): { projectId: string; projectName: string } | null {
  try {
    const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    // Normalize: resolve symlinks
    const normalized = realpathSync(gitRoot)

    // Compute HMAC-SHA256 truncated to 16 hex chars
    const projectId = createHmac('sha256', apiKey).update(normalized).digest('hex').slice(0, 16)

    // Default project name = directory basename
    const projectName = basename(normalized)

    return { projectId, projectName }
  } catch {
    // Not in a git repo — no project
    return null
  }
}
