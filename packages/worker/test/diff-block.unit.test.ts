import { describe, expect, it } from 'vitest'
import { isNewFileDiff } from '../src/app/components/DiffBlock/DiffBlock'

describe('isNewFileDiff', () => {
  it('treats write diffs with file headers as new files', () => {
    expect(
      isNewFileDiff([
        '--- /dev/null\n+++ b/dummy.md\n@@ -0,0 +1,3 @@\n+# Dummy\n+\n+hello',
      ])
    ).toBe(true)
  })

  it('treats direct add hunks as new files', () => {
    expect(isNewFileDiff(['@@ -0,0 +1,1 @@\n+export const created = true'])).toBe(true)
  })

  it('does not treat normal edits as new files', () => {
    expect(
      isNewFileDiff([
        '--- a/dummy.md\n+++ b/dummy.md\n@@ -1,1 +1,1 @@\n-old\n+new',
      ])
    ).toBe(false)
  })
})
