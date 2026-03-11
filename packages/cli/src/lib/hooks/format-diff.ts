import type { StructuredPatchHunk } from './types'
import type { PatchChangeKind } from '@meet-ai/cli/generated/codex-app-server/v2/PatchChangeKind'

/**
 * Return the last 3 path segments (2 dirs + filename), or fewer if the path is short.
 */
function shortPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.slice(-3).join('/')
}

function parseHeaderPath(headerValue: string | undefined): string | null {
  if (!headerValue) return null
  const trimmed = headerValue.trim()
  if (!trimmed || trimmed === '/dev/null') return null
  return trimmed.replace(/^[ab]\//, '')
}

function parseHunkHeader(line: string): StructuredPatchHunk | null {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
  if (!match) return null

  return {
    oldStart: Number(match[1]),
    oldLines: Number(match[2] ?? 1),
    newStart: Number(match[3]),
    newLines: Number(match[4] ?? 1),
    lines: [],
  }
}

function parseStructuredPatchHunks(lines: string[]): StructuredPatchHunk[] {
  const hunks: StructuredPatchHunk[] = []
  let current: StructuredPatchHunk | null = null

  for (const line of lines) {
    const nextHunk = parseHunkHeader(line)
    if (nextHunk) {
      current = nextHunk
      hunks.push(current)
      continue
    }

    if (!current) continue
    current.lines.push(line)
  }

  return hunks
}

function extractWriteContent(lines: string[]): string {
  const addedLines = lines
    .filter(line => line.startsWith('+') && !line.startsWith('+++ '))
    .map(line => line.slice(1))
  return addedLines.join('\n')
}

/**
 * Format structuredPatch hunks into a log entry with [diff:path] prefix.
 * Each hunk includes a proper unified diff header (@@ -old,count +new,count @@)
 * so the UI can reconstruct real line numbers.
 */
export function formatDiff(
  filePath: string,
  hunks: StructuredPatchHunk[],
  previousPath?: string | null
): string {
  const display = shortPath(filePath)
  const previousDisplay = shortPath(previousPath ?? filePath)
  const diffLines = hunks
    .map(hunk => {
      const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
      return `${header}\n${hunk.lines.join('\n')}`
    })
    .join('\n')
  return `[diff:${display}]\n--- a/${previousDisplay}\n+++ b/${display}\n${diffLines}`
}

/**
 * Format a newly written file as a unified diff where all lines are additions.
 */
export function formatWriteDiff(filePath: string, content: string): string {
  const display = shortPath(filePath)
  const lines = content.split('\n')
  const header = `@@ -0,0 +1,${lines.length} @@`
  const addedLines = lines.map(line => `+${line}`).join('\n')
  return `[diff:${display}]\n--- /dev/null\n+++ b/${display}\n${header}\n${addedLines}`
}

/**
 * Format a Codex file-change diff into the same [diff:path] log protocol used by hooks.
 * The incoming diff usually starts at the first hunk, so we synthesize file headers.
 */
export function formatCodexFileChangeDiff(
  filePath: string,
  diff: string,
  kind: PatchChangeKind,
  previousPath?: string | null
): string {
  const display = shortPath(filePath)
  const normalizedDiff = diff.trim()
  if (normalizedDiff.startsWith('--- ') || normalizedDiff.startsWith('+++ ')) {
    return `[diff:${display}]\n${normalizedDiff}`
  }

  const previousDisplay = shortPath(previousPath ?? filePath)
  const oldHeader = kind.type === 'add' ? '--- /dev/null' : `--- a/${previousDisplay}`
  const newHeader = kind.type === 'delete' ? '+++ /dev/null' : `+++ b/${display}`

  return `[diff:${display}]\n${oldHeader}\n${newHeader}\n${normalizedDiff}`
}

export function formatCodexTurnDiff(diff: string): string[] {
  const normalizedDiff = diff.replace(/\r\n/g, '\n').trim()
  if (!normalizedDiff) return []

  const sections = normalizedDiff
    .split(/^diff --git .*$/m)
    .map(section => section.trim())
    .filter(Boolean)

  const rawEntries = (sections.length > 0 ? sections : [normalizedDiff]).map(section => {
    const lines = section.split('\n')
    const firstHeaderIndex = lines.findIndex(
      line => line.startsWith('--- ') || line.startsWith('+++ ')
    )
    return firstHeaderIndex !== -1 ? lines.slice(firstHeaderIndex).join('\n').trim() : section
  })

  return rawEntries.flatMap(entry => {
    const lines = entry.split('\n')
    const oldHeader = lines.find(line => line.startsWith('--- '))
    const newHeader = lines.find(line => line.startsWith('+++ '))
    const oldPath = parseHeaderPath(oldHeader?.slice(4))
    const newPath = parseHeaderPath(newHeader?.slice(4))
    const filePath = newPath ?? oldPath
    if (!filePath) return []

    const kind: PatchChangeKind =
      oldPath == null
        ? { type: 'add' }
        : newPath == null
          ? { type: 'delete' }
          : { type: 'update', move_path: oldPath }

    const hunkStartIndex = lines.findIndex(line => line.startsWith('@@ '))
    const hunkLines = hunkStartIndex === -1 ? [] : lines.slice(hunkStartIndex)

    if (kind.type === 'add') {
      return [formatWriteDiff(filePath, extractWriteContent(hunkLines))]
    }

    if (kind.type === 'update') {
      const hunks = parseStructuredPatchHunks(hunkLines)
      if (hunks.length > 0) {
        return [formatDiff(filePath, hunks, oldPath)]
      }
    }

    return [formatCodexFileChangeDiff(filePath, entry, kind, oldPath)]
  })
}
