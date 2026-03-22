import qrcode from 'qrcode-generator'
import { useState, useCallback, useRef } from 'react'
import { useShareAuth } from '../../hooks/useAuthMutations'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog'

type QRShareModalProps = {
  onClose: () => void
  onToast: (text: string) => void
}

export default function QRShareModal({ onClose, onToast: _onToast }: QRShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const hasFired = useRef(false)
  const share = useShareAuth()

  // Ref callback: fire share mutation once when the QR container mounts,
  // then store the QR data URL in React state (no direct DOM mutation).
  const qrRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || hasFired.current) return
      hasFired.current = true
      share.mutate(undefined, {
        onSuccess: data => {
          try {
            const qr = qrcode(0, 'M')
            qr.addData(data.url)
            qr.make()
            setQrDataUrl(qr.createDataURL(4, 2))
          } catch {
            /* ignore */
          }
        },
      })
    },
    [share]
  )

  const shareUrl = share.data?.url
  const shareError = share.error

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
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
  }, [shareUrl])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose()
    },
    [onClose]
  )

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="w-90 max-w-[90vw] p-6 text-center">
        <DialogTitle className="mb-1 text-lg">Login on another device</DialogTitle>
        <DialogDescription className="mb-4 text-[13px] opacity-60">
          Scan with your phone camera to sign in
        </DialogDescription>
        <div
          ref={qrRef}
          className="mx-auto mb-5 flex max-w-50 items-center justify-center overflow-hidden [&_img]:block [&_img]:h-auto! [&_img]:w-full">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR code" />
          ) : shareError ? (
            <p className="text-[#F85149]">{shareError.message || 'Failed to create share link'}</p>
          ) : (
            <div className="mx-auto flex h-50 w-50 items-center justify-center">
              <div className="border-border border-t-primary h-8 w-8 animate-spin rounded-full border-3" />
            </div>
          )}
        </div>
        {shareUrl && (
          <div
            className="border-border relative mb-2 cursor-pointer rounded-md border bg-white/10 px-2.5 py-2 font-mono text-xs break-all hover:bg-white/15"
            id="qr-url"
            onClick={handleCopy}
            title="Click to copy">
            {shareUrl}
          </div>
        )}
        <div className="relative mb-1 h-4.5 text-xs text-[#3FB950]">
          {copied && <span className="absolute inset-x-0">Copied to clipboard!</span>}
        </div>
        <div className="mb-3 text-xs opacity-50">Expires in 5 minutes</div>
        <DialogClose className="text-msg-text border-border cursor-pointer rounded-md border bg-transparent px-5 py-2 text-[13px] font-semibold hover:bg-white/10">
          Close
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
