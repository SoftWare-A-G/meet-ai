export function getDiffFilename(content: string): string | null {
  const match = content.match(/^\[diff:(.+?)\]/)
  return match ? match[1] : null
}

export function shouldReplaceMergedDiff(prevContent: string, nextContent: string): boolean {
  return nextContent.length > prevContent.length && nextContent.startsWith(prevContent)
}
