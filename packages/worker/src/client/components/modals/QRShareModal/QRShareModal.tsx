import { useState, useEffect, useCallback } from 'hono/jsx/dom'
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

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('qr-overlay')) onClose()
  }, [onClose])

  return (
    <div class="qr-overlay" onClick={handleOverlayClick}>
      <div class="qr-panel">
        <h2>Login on another device</h2>
        <p class="qr-subtitle">Scan with your phone camera to sign in</p>
        <div class="qr-container" id="qr-container">
          {!url && !error && (
            <div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;margin:0 auto">
              <div style="width:32px;height:32px;border:3px solid var(--c-border);border-top-color:var(--c-primary);border-radius:50%;animation:spin 0.8s linear infinite" />
            </div>
          )}
          {error && <p style="color:#F85149">{error}</p>}
        </div>
        {url && (
          <div class="qr-url" id="qr-url" onClick={handleCopy} title="Click to copy">
            {url}
          </div>
        )}
        <div class="qr-copied">{copied ? 'Copied to clipboard!' : ''}</div>
        <div class="qr-expires">Expires in 5 minutes</div>
        <button class="btn-close" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
