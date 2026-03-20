import { highlighter } from '@git-diff-view/react'
import { useEffect, useState } from 'react'
import type { JSX } from 'react'

declare global {
  interface ImportMetaEnv {
    readonly SSR: boolean
    readonly VITE_TLDRAW_LICENSE_KEY: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

type Lowlight = ReturnType<typeof highlighter.getHighlighterEngine>
type LowlightTree = ReturnType<Lowlight['highlight']>

type CodeBlockProps = {
  code: string
  lang: string
}

const IS_SERVER = import.meta.env.SSR

let getLowlight: (() => Promise<Lowlight>) | null = null

if (!IS_SERVER) {
  getLowlight = async () => highlighter.getHighlighterEngine()
}

function renderFallback(code: string) {
  return (
    <pre className="shiki" style={{ background: '#1a1b26' }}>
      <code>{code}</code>
    </pre>
  )
}

export default function ShikiCode({ code, lang }: CodeBlockProps) {
  const [element, setElement] = useState<JSX.Element | null>(null)

  useEffect(() => {
    const loadLowlight = getLowlight
    if (IS_SERVER || !loadLowlight) return

    let cancelled = false

    async function highlight() {
      try {
        const [lowlight, { toJsxRuntime }, { Fragment, jsx, jsxs }] = await Promise.all([
          loadLowlight!(),
          import('hast-util-to-jsx-runtime'),
          import('react/jsx-runtime'),
        ])

        if (cancelled) return

        const normalizedLang = lang.toLowerCase()
        const tree: LowlightTree = lowlight.registered(normalizedLang)
          ? lowlight.highlight(normalizedLang, code)
          : lowlight.highlightAuto(code)

        const highlighted = toJsxRuntime(tree, {
          Fragment,
          jsx,
          jsxs,
        }) as JSX.Element

        if (!cancelled) {
          setElement(
            <div className="diff-tailwindcss-wrapper" data-theme="dark">
              <div className="diff-line-syntax-raw">
                <pre className="shiki" style={{ background: '#1a1b26' }}>
                  <code className="hljs">{highlighted}</code>
                </pre>
              </div>
            </div>
          )
        }
      } catch {
        if (!cancelled) setElement(null)
      }
    }

    highlight()

    return () => {
      cancelled = true
    }
  }, [code, lang])

  return element ?? renderFallback(code)
}
