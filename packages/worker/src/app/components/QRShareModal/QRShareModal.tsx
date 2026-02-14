import { Dialog } from '@base-ui/react'
import qrcode from 'qrcode-generator'
import { useState, useEffect, useCallback } from 'react'
import * as api from '../../lib/api'

type QRShareModalProps = {
  onClose: () => void
  onToast: (text: string) => void
}

export default function QRShareModal({ onClose, onToast: _onToast }: QRShareModalProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api.shareAuth()
        if (cancelled) return
        setUrl(data.url)
      } catch (error: any) {
        if (!cancelled) setError(error.message || 'Failed to create share link')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Generate QR when URL is available
  useEffect(() => {
    if (!url) return
    const container = document.getElementById('qr-container')
    if (!container) return
    try {
      const qr = qrcode(0, 'M')
      qr.addData(url)
      qr.make()
      container.innerHTML = qr.createImgTag(4, 2)
    } catch {
      /* ignore */
    }
  }, [url])

  const handleCopy = useCallback(async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
      const el = document.getElementById('qr-url')
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }
  }, [url])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose()
    },
    [onClose]
  )

  return (
    <Dialog.Root open onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/50" />
        <Dialog.Popup className="bg-chat-bg text-msg-text border-border fixed top-1/2 left-1/2 z-[100] w-[360px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 text-center">
            <Dialog.Title className="mb-1 text-lg">Login on another device</Dialog.Title>
            <Dialog.Description className="mb-4 text-[13px] opacity-60">
              Scan with your phone camera to sign in
            </Dialog.Description>
            <div className="mx-auto mb-5 flex max-w-[200px] items-center justify-center overflow-hidden rounded-lg [&_img]:block [&_img]:w-full [&_img]:!h-auto" id="qr-container">
              {!url && !error && (
                <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center">
                  <div className="border-border border-t-primary h-8 w-8 animate-spin rounded-full border-3" />
                </div>
              )}
              {error && <p className="text-[#F85149]">{error}</p>}
            </div>
            {url && (
              <div
                className="border-border relative mb-2 cursor-pointer rounded-md border bg-white/10 px-2.5 py-2 font-mono text-xs break-all hover:bg-white/[0.15]"
                id="qr-url"
                onClick={handleCopy}
                title="Click to copy">
                {url}
              </div>
            )}
            <div className="relative mb-1 h-[18px] text-xs text-[#3FB950]">
              {copied && <span className="absolute inset-x-0">Copied to clipboard!</span>}
            </div>
            <div className="mb-3 text-xs opacity-50">Expires in 5 minutes</div>
            <Dialog.Close className="text-msg-text border-border cursor-pointer rounded-md border bg-transparent px-5 py-2 text-[13px] font-semibold hover:bg-white/10">
              Close
            </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
