import { useEffect, useRef } from 'react'

type PaneData = {
  name: string
  paneId: string
  data: string
}

type TerminalTextRendererProps = {
  panes: PaneData[]
  activePane: string | null
}

// Strip ANSI escape sequences for plain text rendering
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
}

export default function TerminalTextRenderer({ panes, activePane }: TerminalTextRendererProps) {
  const containerRef = useRef<HTMLPreElement>(null)
  const pane = panes.find(p => p.paneId === activePane)
  const content = pane ? stripAnsi(pane.data) : ''

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [content])

  return (
    <pre
      ref={containerRef}
      className="flex-1 min-h-0 w-full overflow-auto p-3 m-0 bg-[#0d1117] text-[#e6edf3] text-[13px] leading-[1.4]"
      style={{
        fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {content}
    </pre>
  )
}
