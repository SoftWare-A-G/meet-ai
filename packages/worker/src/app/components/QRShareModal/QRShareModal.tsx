import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog'
import qrcode from 'qrcode-generator'
import { useState, useCallback, useRef } from 'react'
import { useShareAuth } from '../../hooks/useAuthMutations'

type QRShareModalProps = {
  onClose: () => void
  onToast: (text: string) => void
}

export default function QRShareModal({ onClose, onToast: _onToast }: QRShareModalProps) {
  const [copied, setCopied] = useState(false)
  const hasFired = useRef(false)
  const share = useShareAuth()

  // Ref callback: fire share mutation once when the QR container mounts,
  // then render the QR image into the container on success.
  const qrRef = useCallback((container: HTMLDivElement | null) => {
    if (!container || hasFired.current) return
    hasFired.current = true
    share.mutate(undefined, {
      onSuccess: (data) => {
        try {
          const qr = qrcode(0, 'M')
          qr.addData(data.url)
          qr.make()
          // qrcode-generator's createImgTag produces a safe <img> element
          container.innerHTML = qr.createImgTag(4, 2) // eslint-disable-line
        } catch {
          /* ignore */
        }
      },
    })
  }, [share])

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
      <DialogContent className="w-[360px] max-w-[90vw] p-6 text-center">
        <DialogTitle className="mb-1 text-lg">Login on another device</DialogTitle>
        <DialogDescription className="mb-4 text-[13px] opacity-60">
          Scan with your phone camera to sign in
        </DialogDescription>
        <div ref={qrRef} className="mx-auto mb-5 flex max-w-[200px] items-center justify-center overflow-hidden rounded-lg [&_img]:block [&_img]:w-full [&_img]:!h-auto">
          {!shareUrl && !shareError && (
            <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center">
              <div className="border-border border-t-primary h-8 w-8 animate-spin rounded-full border-3" />
            </div>
          )}
          {shareError && <p className="text-[#F85149]">{shareError.message || 'Failed to create share link'}</p>}
        </div>
        {shareUrl && (
          <div
            className="border-border relative mb-2 cursor-pointer rounded-md border bg-white/10 px-2.5 py-2 font-mono text-xs break-all hover:bg-white/[0.15]"
            id="qr-url"
            onClick={handleCopy}
            title="Click to copy">
            {shareUrl}
          </div>
        )}
        <div className="relative mb-1 h-[18px] text-xs text-[#3FB950]">
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
