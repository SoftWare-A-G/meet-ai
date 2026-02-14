export function parseSchema(str: string): string[] {
  const parts = str.split(',').map(s => s.trim())
  while (parts.length < 10) parts.push('#888888')
  return parts
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  // eslint-disable-next-line no-bitwise
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function ensureContrast(textHex: string, bgHex: string, minRatio: number): string {
  if (contrastRatio(textHex, bgHex) >= minRatio) return textHex
  const whiteRatio = contrastRatio('#FFFFFF', bgHex)
  const darkRatio = contrastRatio('#000000', bgHex)
  return whiteRatio >= darkRatio ? '#FFFFFF' : '#000000'
}

function deriveChatBg(sidebarBg: string): string {
  const lum = luminance(sidebarBg)
  if (lum >= 0.5) return '#FFFFFF'
  const [r, g, b] = hexToRgb(sidebarBg)
  return `#${[r, g, b].map(v => Math.max(0, Math.round(v * 0.78 + 2)).toString(16).padStart(2, '0')).join('')}`
}

function deriveMsgText(chatBg: string, sidebarText: string): string {
  const lum = luminance(chatBg)
  if (lum >= 0.5) return '#1D1C1D'
  return sidebarText || '#ABB2BF'
}

function deriveBorder(sidebarBg: string, dividerColor: string): string {
  const lum = luminance(sidebarBg)
  if (lum >= 0.5) return '#E0E0E0'
  return dividerColor || '#3e4451'
}

export function applySchema(schemaStr: string): void {
  const c = parseSchema(schemaStr)
  const root = document.documentElement
  const sidebarDark = luminance(c[0]) < 0.5

  const sidebarText = ensureContrast(c[5], c[0], 3)
  const activeItemText = ensureContrast(c[3], c[2], 3)

  root.style.setProperty('--c-sidebar-bg', c[0])
  root.style.setProperty('--c-sidebar-text', sidebarText)
  root.style.setProperty('--c-active-item', c[2])
  root.style.setProperty('--c-active-item-text', activeItemText)
  root.style.setProperty('--c-hover-item', c[4] || c[1])
  root.style.setProperty('--c-presence', c[6])
  root.style.setProperty('--c-primary', c[6])
  root.style.setProperty('--c-sidebar-border', c[8] || (sidebarDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'))

  const chatBg = deriveChatBg(c[0])
  const msgText = deriveMsgText(chatBg, sidebarText)
  const border = deriveBorder(c[0], c[8])

  root.style.setProperty('--c-header-bg', chatBg)
  root.style.setProperty('--c-header-text', msgText)
  root.style.setProperty('--c-chat-bg', chatBg)
  root.style.setProperty('--c-msg-text', msgText)
  root.style.setProperty('--c-border', border)

  document.body.style.background = chatBg

  root.style.setProperty('--c-input-bg', sidebarDark ? c[0] : chatBg)

  const primaryTextWhite = contrastRatio('#FFFFFF', c[6])
  const primaryTextBlack = contrastRatio('#000000', c[6])
  root.style.setProperty('--c-primary-text', primaryTextWhite >= primaryTextBlack ? '#FFFFFF' : '#000000')
}
