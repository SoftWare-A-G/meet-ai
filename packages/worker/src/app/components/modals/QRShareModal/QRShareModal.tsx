import { useState, useEffect, useCallback } from 'react'
import * as api from '../../../lib/api'

type QRShareModalProps = {
  onClose: () => void
  onToast: (text: string) => void
}

export default function QRShareModal({ onClose, onToast }: QRShareModalProps) {
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
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to create share link')
      }
    }
    load()
    return () => { cancelled = true }
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
      container.innerHTML = qr.createImgTag(5, 8)
    } catch { /* ignore */ }
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

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center" onClick={handleOverlayClick}>
      <div className="bg-chat-bg text-msg-text border border-border rounded-xl p-6 w-[360px] max-w-[90vw] text-center">
        <h2 className="mb-1 text-lg">Login on another device</h2>
        <p className="text-[13px] opacity-60 mb-4">Scan with your phone camera to sign in</p>
        <div className="mx-auto mb-4" id="qr-container">
          {!url && !error && (
            <div className="w-[200px] h-[200px] flex items-center justify-center mx-auto">
              <div className="w-8 h-8 border-3 border-border border-t-primary rounded-full animate-spin" />
            </div>
          )}
          {error && <p className="text-[#F85149]">{error}</p>}
        </div>
        {url && (
          <div className="text-xs font-mono bg-white/10 border border-border rounded-md px-2.5 py-2 break-all cursor-pointer mb-2 relative hover:bg-white/[0.15]" id="qr-url" onClick={handleCopy} title="Click to copy">
            {url}
          </div>
        )}
        <div className="text-xs text-[#3FB950] mb-2 min-h-[18px]">{copied ? 'Copied to clipboard!' : ''}</div>
        <div className="text-xs opacity-50 mb-4">Expires in 5 minutes</div>
        <button className="px-5 py-2 rounded-md text-[13px] cursor-pointer font-semibold bg-transparent text-msg-text border border-border hover:bg-white/10" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
