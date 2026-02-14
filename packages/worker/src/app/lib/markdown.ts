import DOMPurify from 'dompurify'
import * as marked from 'marked'

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { breaks: true }).toString())
}

export function highlightCode(container: HTMLElement): void {
  if (window.highlightAllCode) {
    window.highlightAllCode(container)
  }
}
