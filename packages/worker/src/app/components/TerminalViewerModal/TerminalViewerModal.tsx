import { Dialog, DialogContent, DialogClose } from '../ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Terminal as WTermTerminal, useTerminal } from '@wterm/react'
import '@wterm/react/css'
import TerminalTextRenderer from './TerminalTextRenderer'

type PaneData = {
  name: string
  paneId: string
  data: string
}

type TerminalViewerModalProps = {
  open: boolean
  onClose: () => void
  data: string | null
  onResize?: (cols: number) => void
}

const TERMINAL_THEME = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#e6edf3',
  selectionBackground: '#264f78',
  black: '#0d1117',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#76e3ea',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#b3f0ff',
  brightWhite: '#f0f6fc',
}

function WTermSnapshotRenderer({
  panes,
  activePane,
  onResize,
}: {
  panes: PaneData[]
  activePane: string | null
  onResize?: (cols: number) => void
}) {
  const { ref, write } = useTerminal()
  const [ready, setReady] = useState(false)
  const previousWriteRef = useRef<string | null>(null)
  const lastReportedColsRef = useRef(0)

  const pane = panes.find(p => p.paneId === activePane)
  const terminalStyle: CSSProperties & Record<`--term-${string}`, string> = {
    '--term-bg': TERMINAL_THEME.background,
    '--term-fg': TERMINAL_THEME.foreground,
    '--term-cursor': TERMINAL_THEME.cursor,
    '--term-color-0': TERMINAL_THEME.black,
    '--term-color-1': TERMINAL_THEME.red,
    '--term-color-2': TERMINAL_THEME.green,
    '--term-color-3': TERMINAL_THEME.yellow,
    '--term-color-4': TERMINAL_THEME.blue,
    '--term-color-5': TERMINAL_THEME.magenta,
    '--term-color-6': TERMINAL_THEME.cyan,
    '--term-color-7': TERMINAL_THEME.white,
    '--term-color-8': TERMINAL_THEME.brightBlack,
    '--term-color-9': TERMINAL_THEME.brightRed,
    '--term-color-10': TERMINAL_THEME.brightGreen,
    '--term-color-11': TERMINAL_THEME.brightYellow,
    '--term-color-12': TERMINAL_THEME.brightBlue,
    '--term-color-13': TERMINAL_THEME.brightMagenta,
    '--term-color-14': TERMINAL_THEME.brightCyan,
    '--term-color-15': TERMINAL_THEME.brightWhite,
    '--term-font-family': '"Cascadia Code", "JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
    '--term-font-size': '13px',
    '--term-line-height': '1',
    padding: '8px',
    borderRadius: 0,
    boxShadow: 'none',
  }

  useEffect(() => {
    if (!ready || !pane) return

    const writeKey = `${pane.paneId}\n${pane.data}`
    if (writeKey === previousWriteRef.current) return

    previousWriteRef.current = writeKey
    write(`\x1b[H\x1b[2J${pane.data}`)
  }, [pane, ready, write])

  useEffect(() => {
    if (!activePane) previousWriteRef.current = null
  }, [activePane])

  return (
    <WTermTerminal
      ref={ref}
      autoResize
      cursorBlink={false}
      onData={() => {}}
      onReady={() => {
        previousWriteRef.current = null
        setReady(true)
      }}
      onResize={(cols) => {
        if (cols === lastReportedColsRef.current) return
        lastReportedColsRef.current = cols
        onResize?.(cols)
      }}
      className="h-full min-h-0 w-full rounded-none shadow-none"
      style={terminalStyle}
    />
  )
}

export default function TerminalViewerModal({ open, onClose, data, onResize }: TerminalViewerModalProps) {
  const [panes, setPanes] = useState<PaneData[]>([])
  const [activePane, setActivePane] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  // Track mobile state
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Parse incoming data into panes
  useEffect(() => {
    if (!data) return
    try {
      const parsed = JSON.parse(data)
      if (parsed.panes && Array.isArray(parsed.panes)) {
        setPanes(parsed.panes)
        setActivePane(prev => {
          // Auto-select first pane if none selected or active pane no longer exists
          if (!prev || !parsed.panes.some((p: PaneData) => p.paneId === prev)) {
            return parsed.panes[0]?.paneId ?? null
          }
          return prev
        })
      }
    } catch {
      // Legacy: plain string data (single pane)
      setPanes([{ name: 'terminal', paneId: 'default', data }])
      setActivePane('default')
    }
  }, [data])

  // Reset prev data when switching tabs so content always refreshes
  const handleTabSwitch = useCallback((paneId: string) => {
    setActivePane(paneId)
  }, [])

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setPanes([])
      setActivePane(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose() }}>
      <DialogContent className="flex flex-col border border-[#30363d] bg-[#0d1117] overflow-hidden w-[90vw] sm:max-w-[90vw] md:w-[58vw] h-[80vh] p-0 gap-0" showCloseButton={false}>
        <div className="flex items-center justify-between border-b border-[#30363d] shrink-0">
          <Tabs value={activePane} onValueChange={value => handleTabSwitch(value as string)} className="overflow-x-auto gap-0">
            <TabsList variant="line" className="h-auto rounded-none bg-transparent p-0 gap-0">
              {panes.map(pane => (
                <TabsTrigger
                  key={pane.paneId}
                  value={pane.paneId}
                  className="rounded-none border-r border-r-[#30363d] px-4 py-2.5 text-[12px] font-mono text-[#6e7681] hover:text-[#b1bac4] data-active:text-[#e6edf3] data-active:bg-[#161b22] after:bg-[#58a6ff] after:bottom-0 after:h-0.5"
                >
                  {pane.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DialogClose className="cursor-pointer rounded-md border-none bg-transparent px-3 py-2 text-[#6e7681] hover:text-[#e6edf3] text-lg leading-none shrink-0">
            &#x2715;
          </DialogClose>
        </div>
        {isMobile ? (
          <TerminalTextRenderer panes={panes} activePane={activePane} />
        ) : (
          <div className="flex-1 min-h-0 w-full p-0">
            <WTermSnapshotRenderer panes={panes} activePane={activePane} onResize={onResize} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
