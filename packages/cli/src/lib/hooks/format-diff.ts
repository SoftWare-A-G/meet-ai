import type { StructuredPatchHunk } from './types'

/**
 * Return the last 3 path segments (2 dirs + filename), or fewer if the path is short.
 */
function shortPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.slice(-3).join('/')
}

/**
 * Format structuredPatch hunks into a log entry with [diff:path] prefix.
 * Each hunk includes a proper unified diff header (@@ -old,count +new,count @@)
 * so the UI can reconstruct real line numbers.
 */
export function formatDiff(filePath: string, hunks: StructuredPatchHunk[]): string {
  const display = shortPath(filePath)
  const diffLines = hunks
    .map(hunk => {
      const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
      return `${header}\n${hunk.lines.join('\n')}`
    })
    .join('\n')
  return `[diff:${display}]\n--- a/${display}\n+++ b/${display}\n${diffLines}`
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
