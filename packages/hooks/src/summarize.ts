import { basename } from 'node:path'

export function summarize(toolName: string, toolInput: Record<string, unknown>): string {
  const str = (key: string) => (typeof toolInput[key] === 'string' ? (toolInput[key] as string) : '')
  const truncate = (s: string, n: number) => s.slice(0, n)
  const file = (key: string) => basename(str(key)) || '?'

  switch (toolName) {
    case 'Edit': return `Edit: ${file('file_path')}`
    case 'Read': return `Read: ${file('file_path')}`
    case 'Write': return `Write: ${file('file_path')}`
    case 'Bash': return `Bash: ${truncate(str('command'), 60)}`
    case 'Grep': return `Grep: "${str('pattern')}" in ${str('glob') || str('path')}`
    case 'Glob': return `Glob: ${str('pattern')}`
    case 'Task': return `Task: ${truncate(str('description'), 60)}`
    case 'WebFetch': return `WebFetch: ${str('url')}`
    case 'WebSearch': return `WebSearch: ${str('query')}`
    default: return toolName
  }
}
