export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { breaks: true }))
}

export function highlightCode(container: HTMLElement): void {
  if (window.highlightAllCode) {
    window.highlightAllCode(container)
  }
}
