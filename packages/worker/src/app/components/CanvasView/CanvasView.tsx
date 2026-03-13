import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogClose } from '../ui/dialog'
import * as api from '../../lib/api'

const CanvasInner = lazy(() => import('./CanvasInner'))

interface CanvasViewProps {
  roomId: string
  open: boolean
  onClose: () => void
  userName: string
}

function getRandomColor(): string {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
  return colors[Math.floor(Math.random() * colors.length)]
}

export default function CanvasView({ roomId, open, onClose, userName }: CanvasViewProps) {
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [userColor] = useState(() => getRandomColor())

  const initCanvas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await api.ensureCanvas(roomId)
      const key = api.getApiKey()
      if (!key) throw new Error('No API key')
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      setWsUrl(`${protocol}//${location.host}/api/rooms/${roomId}/canvas/ws?token=${encodeURIComponent(key)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize canvas')
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    if (open) {
      initCanvas()
    } else {
      setWsUrl(null)
      setError(null)
    }
  }, [open, initCanvas])

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose() }}>
      <DialogContent
        className="flex flex-col border border-[#30363d] bg-[#0d1117] overflow-hidden w-[95vw] sm:max-w-[95vw] h-[90vh] p-0 gap-0"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-2 shrink-0">
          <span className="text-sm font-semibold text-[#e6edf3]">Canvas</span>
          <DialogClose className="cursor-pointer rounded-md border-none bg-transparent px-3 py-2 text-[#6e7681] hover:text-[#e6edf3] text-lg leading-none shrink-0">
            &#x2715;
          </DialogClose>
        </div>
        <div className="flex-1 min-h-0 w-full relative">
          {loading && (
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              Loading canvas...
            </div>
          )}
          {error && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-red-400">
              <span>{error}</span>
              <button
                type="button"
                className="rounded border border-red-400/30 px-3 py-1 text-xs hover:bg-red-400/10"
                onClick={initCanvas}
              >
                Retry
              </button>
            </div>
          )}
          {wsUrl && !loading && !error && (
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                  Loading tldraw...
                </div>
              }
            >
              <CanvasInner
                wsUrl={wsUrl}
                userName={userName}
                userColor={userColor}
              />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
