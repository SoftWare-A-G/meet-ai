interface Marked {
  parse(text: string, options?: { breaks?: boolean }): string
}

interface DOMPurifyInstance {
  sanitize(html: string): string
}

interface QRCode {
  addData(data: string): void
  make(): void
  createImgTag(cellSize: number, margin: number): string
}

interface QRCodeFactory {
  (typeNumber: number, errorCorrectionLevel: string): QRCode
}

interface Window {
  marked: Marked
  DOMPurify: DOMPurifyInstance
  qrcode: QRCodeFactory
  highlightAllCode?: (container: HTMLElement) => void
  retryMessage?: (retryEl: HTMLElement) => void
}

declare const marked: Marked
declare const DOMPurify: DOMPurifyInstance
declare const qrcode: QRCodeFactory
