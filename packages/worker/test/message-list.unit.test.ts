import { describe, expect, it } from 'vitest'
import { shouldReplaceMergedDiff } from '../src/app/components/MessageList/diff-logs'

describe('shouldReplaceMergedDiff', () => {
  it('replaces an earlier same-file diff when the later snapshot strictly extends it', () => {
    const earlier =
      '[diff:src/file.ts]\n--- a/src/file.ts\n+++ b/src/file.ts\n@@ -1,1 +1,1 @@\n-old\n+new'
    const later =
      `${earlier}\n@@ -5,0 +6,1 @@\n+another`

    expect(shouldReplaceMergedDiff(earlier, later)).toBe(true)
  })

  it('does not replace unrelated same-file diffs', () => {
    const first =
      '[diff:src/file.ts]\n--- a/src/file.ts\n+++ b/src/file.ts\n@@ -1,1 +1,1 @@\n-old\n+new'
    const second =
      '[diff:src/file.ts]\n--- a/src/file.ts\n+++ b/src/file.ts\n@@ -10,1 +10,1 @@\n-a\n+b'

    expect(shouldReplaceMergedDiff(first, second)).toBe(false)
  })
})
