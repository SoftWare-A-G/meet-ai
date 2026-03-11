import { describe, expect, it } from 'bun:test'
import { formatCodexTurnDiff, formatDiff } from '@meet-ai/cli/lib/hooks/format-diff'

describe('formatDiff', () => {
  it('uses the previous path in the old header for renames', () => {
    expect(
      formatDiff(
        'src/new-name.ts',
        [
          {
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: ['-old', '+new'],
          },
        ],
        'src/old-name.ts'
      )
    ).toContain('--- a/src/old-name.ts\n+++ b/src/new-name.ts')
  })
})

describe('formatCodexTurnDiff', () => {
  it('preserves rename old headers when the diff has hunks only', () => {
    const logs = formatCodexTurnDiff([
      'diff --git a/src/old-name.ts b/src/new-name.ts',
      '--- a/src/old-name.ts',
      '+++ b/src/new-name.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n'))

    expect(logs).toEqual([
      '[diff:src/new-name.ts]\n--- a/src/old-name.ts\n+++ b/src/new-name.ts\n@@ -1,1 +1,1 @@\n-old\n+new',
    ])
  })
})
