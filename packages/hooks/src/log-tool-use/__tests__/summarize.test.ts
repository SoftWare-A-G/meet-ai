import { describe, expect, it } from 'vitest'
import { summarize } from '../summarize'

describe('summarize', () => {
  it('summarizes Edit with basename', () => {
    expect(summarize('Edit', { file_path: '/foo/bar/baz.ts' })).toBe('Edit: baz.ts')
  })

  it('summarizes Bash with truncated command', () => {
    const cmd = 'a'.repeat(80)
    const result = summarize('Bash', { command: cmd })
    expect(result).toBe(`Bash: ${'a'.repeat(60)}`)
  })

  it('summarizes Grep with pattern and glob', () => {
    expect(summarize('Grep', { pattern: 'foo', glob: '*.ts' })).toBe('Grep: "foo" in *.ts')
  })

  it('summarizes Grep with pattern and path', () => {
    expect(summarize('Grep', { pattern: 'foo', path: 'src/' })).toBe('Grep: "foo" in src/')
  })

  it('summarizes Read with basename', () => {
    expect(summarize('Read', { file_path: '/a/b/c.json' })).toBe('Read: c.json')
  })

  it('summarizes Write with basename', () => {
    expect(summarize('Write', { file_path: '/x/y.md' })).toBe('Write: y.md')
  })

  it('summarizes Glob with pattern', () => {
    expect(summarize('Glob', { pattern: '**/*.ts' })).toBe('Glob: **/*.ts')
  })

  it('summarizes Task with truncated description', () => {
    const desc = 'b'.repeat(80)
    expect(summarize('Task', { description: desc })).toBe(`Task: ${'b'.repeat(60)}`)
  })

  it('summarizes WebFetch with url', () => {
    expect(summarize('WebFetch', { url: 'https://example.com' })).toBe('WebFetch: https://example.com')
  })

  it('summarizes WebSearch with query', () => {
    expect(summarize('WebSearch', { query: 'hono zod' })).toBe('WebSearch: hono zod')
  })

  it('returns tool name for unknown tools', () => {
    expect(summarize('AskUserQuestion', {})).toBe('AskUserQuestion')
  })
})
