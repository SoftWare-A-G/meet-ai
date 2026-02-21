import DOMPurify from 'dompurify'
import * as marked from 'marked'

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { breaks: true }).toString())
}

// Lazy-loaded shiki highlighter singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let highlighterPromise: Promise<any> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki/bundle/web').then((m) =>
      m.createHighlighter({
        themes: ['vitesse-dark'],
        langs: [],
      }),
    )
  }
  return highlighterPromise
}

export async function highlightCode(container: HTMLElement): Promise<void> {
  const codeBlocks = container.querySelectorAll('pre > code[class*="language-"]')
  if (codeBlocks.length === 0) return

  const highlighter = await getHighlighter()

  for (const codeEl of codeBlocks) {
    const pre = codeEl.parentElement
    if (!pre || pre.classList.contains('shiki')) continue

    const langClass = [...codeEl.classList].find((c) => c.startsWith('language-'))
    const lang = langClass?.replace('language-', '') ?? 'text'
    const code = codeEl.textContent ?? ''

    const loadedLangs = highlighter.getLoadedLanguages()
    if (!loadedLangs.includes(lang)) {
      try {
        await highlighter.loadLanguage(lang)
      } catch {
        continue
      }
    }

    const html = highlighter.codeToHtml(code, { lang, theme: 'vitesse-dark' })
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    const newPre = wrapper.firstElementChild
    if (newPre) {
      pre.replaceWith(newPre)
    }
  }
}
