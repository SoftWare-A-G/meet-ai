import { useState, useEffect } from 'react'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { bundledLanguages } from 'shiki/langs'
import type { HighlighterCore } from 'shiki/core'
import type { JSX } from 'react'

type ShikiCodeProps = {
  code: string
  lang: string
}

// Singleton highlighter — created once with only the rose-pine-moon theme.
// Languages are loaded on demand per code block.
let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import('@shikijs/themes/rose-pine-moon')],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    })
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
            const loader = bundledLanguages[lang as keyof typeof bundledLanguages]
            if (!loader) throw new Error(`Unknown language: ${lang}`)
            await highlighter.loadLanguage(await loader())
          } catch {
            // Language not available - render as plain text
            if (!cancelled) setElement(null)
            return
          }
        }

        if (cancelled) return

        const hast = highlighter.codeToHast(code, {
          lang,
          theme: 'rose-pine-moon',
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
      <pre className="shiki" style={{ background: '#232136' }}>
        <code>{code}</code>
      </pre>
    )
  }

  return element
}
