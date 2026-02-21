import { useState, useEffect } from 'react'
import type { JSX } from 'react'

type ShikiCodeProps = {
  code: string
  lang: string
}

// Lazy-loaded shiki highlighter singleton
let highlighterPromise: ReturnType<typeof createHighlighterLazy> | null = null

async function createHighlighterLazy() {
  const { createHighlighter } = await import('shiki/bundle/web')
  return createHighlighter({
    themes: ['vitesse-dark'],
    langs: [],
  })
}

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterLazy()
  }
  return highlighterPromise
}

export default function ShikiCode({ code, lang }: ShikiCodeProps) {
  const [element, setElement] = useState<JSX.Element | null>(null)

  useEffect(() => {
    let cancelled = false

    async function highlight() {
      try {
        const [highlighter, { toJsxRuntime }, { Fragment, jsx, jsxs }] =
          await Promise.all([
            getHighlighter(),
            import('hast-util-to-jsx-runtime'),
            import('react/jsx-runtime'),
          ])

        if (cancelled) return

        const loadedLangs = highlighter.getLoadedLanguages()
        if (!loadedLangs.includes(lang)) {
          try {
            await highlighter.loadLanguage(lang as Parameters<typeof highlighter.loadLanguage>[0])
          } catch {
            // Language not available - render as plain text
            if (!cancelled) setElement(null)
            return
          }
        }

        if (cancelled) return

        const hast = highlighter.codeToHast(code, {
          lang,
          theme: 'vitesse-dark',
        })

        const jsxElement = toJsxRuntime(hast, {
          Fragment,
          jsx,
          jsxs,
        }) as JSX.Element

        if (!cancelled) {
          setElement(jsxElement)
        }
      } catch {
        // On any error, keep showing the fallback
      }
    }

    highlight()
    return () => {
      cancelled = true
    }
  }, [code, lang])

  // Fallback: plain code block while shiki loads (or if lang fails)
  if (!element) {
    return (
      <pre className="shiki" style={{ background: '#121212' }}>
        <code>{code}</code>
      </pre>
    )
  }

  return element
}
