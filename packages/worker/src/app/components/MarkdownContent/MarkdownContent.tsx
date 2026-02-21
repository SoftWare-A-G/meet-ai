import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Renderer, parse } from 'marked'
import ShikiCode from '../ShikiCode'

type MarkdownContentProps = {
  content: string
  className?: string
}

type Segment =
  | { type: 'html'; html: string }
  | { type: 'code'; code: string; lang: string }

const MARKER_ATTR = 'data-shiki-idx'

function parseContent(content: string): Segment[] {
  const codeBlocks: { code: string; lang: string }[] = []

  const renderer = new Renderer()
  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const idx = codeBlocks.length
    codeBlocks.push({ code: text, lang: lang || 'text' })
    // Render as a <pre> with a data attribute - DOMPurify will preserve it
    return `<pre ${MARKER_ATTR}="${idx}"></pre>`
  }

  const rawHtml = parse(content, { breaks: true, renderer }).toString()

  // Allow the data attribute through DOMPurify
  const html = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: [MARKER_ATTR],
  })

  // If no code blocks, return the whole thing as HTML
  if (codeBlocks.length === 0) {
    return [{ type: 'html', html }]
  }

  // Split on marker <pre> tags and interleave HTML segments with code blocks
  const markerRegex = new RegExp(
    `<pre\\s+${MARKER_ATTR}="(\\d+)"\\s*>\\s*</pre>`,
    'g',
  )

  const segments: Segment[] = []
  let lastIndex = 0

  for (const match of html.matchAll(markerRegex)) {
    const before = html.slice(lastIndex, match.index)
    if (before) {
      segments.push({ type: 'html', html: before })
    }
    const idx = parseInt(match[1], 10)
    segments.push({ type: 'code', ...codeBlocks[idx] })
    lastIndex = (match.index ?? 0) + match[0].length
  }

  const after = html.slice(lastIndex)
  if (after) {
    segments.push({ type: 'html', html: after })
  }

  return segments
}

export default function MarkdownContent({ content, className }: MarkdownContentProps) {
  const segments = useMemo(() => parseContent(content), [content])

  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === 'code' ? (
          <ShikiCode key={i} code={seg.code} lang={seg.lang} />
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
        ),
      )}
    </div>
  )
}
