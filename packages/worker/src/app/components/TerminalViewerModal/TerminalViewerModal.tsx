import { Dialog } from '@base-ui/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import clsx from 'clsx'
import '@xterm/xterm/css/xterm.css'

type PaneData = {
  name: string
  paneId: string
  data: string
}

type TerminalViewerModalProps = {
  open: boolean
  onClose: () => void
  data: string | null
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

export default function TerminalViewerModal({ open, onClose, data }: TerminalViewerModalProps) {
  const [panes, setPanes] = useState<PaneData[]>([])
  const [activePane, setActivePane] = useState<string | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const prevPaneDataRef = useRef<string | null>(null)

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

  // Callback ref: initializes xterm when container mounts
  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (!container) {
      cleanupRef.current?.()
      cleanupRef.current = null
      prevPaneDataRef.current = null
      return
    }

    const terminal = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1,
      cursorBlink: false,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    fitAddon.fit()
    terminal.attachCustomKeyEventHandler(() => false)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const fitTimeout = setTimeout(() => fitAddon.fit(), 100)
    const observer = new ResizeObserver(() => fitAddon.fit())
    observer.observe(container)

    cleanupRef.current = () => {
      clearTimeout(fitTimeout)
      observer.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  // Write active pane content to terminal
  useEffect(() => {
    if (!terminalRef.current || !activePane) return
    const pane = panes.find(p => p.paneId === activePane)
    if (!pane) return
    if (pane.data === prevPaneDataRef.current) return
    prevPaneDataRef.current = pane.data
    terminalRef.current.write(`\x1b[H\x1b[2J${pane.data}`)
  }, [panes, activePane])

  // Reset prev data when switching tabs so content always refreshes
  const handleTabSwitch = useCallback((paneId: string) => {
    prevPaneDataRef.current = null
    setActivePane(paneId)
  }, [])

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setPanes([])
      setActivePane(null)
      prevPaneDataRef.current = null
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-xl border border-[#30363d] bg-[#0d1117] overflow-hidden" style={{ width: '90vw', height: '80vh' }}>
          <div className="flex items-center justify-between border-b border-[#30363d] shrink-0">
            <div className="flex items-center gap-0 overflow-x-auto">
              {panes.map(pane => (
                <button
                  key={pane.paneId}
                  type="button"
                  onClick={() => handleTabSwitch(pane.paneId)}
                  className={clsx(
                    'px-4 py-2.5 text-[12px] font-mono border-b-2 border-r border-r-[#30363d] cursor-pointer bg-transparent whitespace-nowrap',
                    pane.paneId === activePane
                      ? 'text-[#e6edf3] border-b-[#58a6ff] bg-[#161b22]'
                      : 'text-[#6e7681] border-b-transparent hover:text-[#b1bac4]'
                  )}
                >
                  {pane.name}
                </button>
              ))}
            </div>
            <Dialog.Close className="cursor-pointer rounded-md border-none bg-transparent px-3 py-2 text-[#6e7681] hover:text-[#e6edf3] text-lg leading-none shrink-0">
              &#x2715;
            </Dialog.Close>
          </div>
          <div ref={containerRef} className="flex-1 min-h-0 p-2" />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
