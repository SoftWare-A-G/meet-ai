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

function injectStyle(id: string, css: string): void {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = css
}

export function applyFontScale(scale: string): void {
  const s = parseFloat(scale) || 1
  injectStyle('meet-ai-font-scale', `:root{--font-scale:${s};font-size:${s * 100}%;}`)
}

export function applySchema(schemaStr: string): void {
  const c = parseSchema(schemaStr)
  const sidebarDark = luminance(c[0]) < 0.5

  const sidebarText = ensureContrast(c[5], c[0], 3)
  const activeItemText = ensureContrast(c[3], c[2], 3)

  const chatBg = deriveChatBg(c[0])
  const msgText = deriveMsgText(chatBg, sidebarText)
  const border = deriveBorder(c[0], c[8])

  const primaryTextWhite = contrastRatio('#FFFFFF', c[6])
  const primaryTextBlack = contrastRatio('#000000', c[6])

  let css = ':root{'
  css += `--c-sidebar-bg:${c[0]};`
  css += `--c-sidebar-text:${sidebarText};`
  css += `--c-active-item:${c[2]};`
  css += `--c-active-item-text:${activeItemText};`
  css += `--c-hover-item:${c[4] || c[1]};`
  css += `--c-presence:${c[6]};`
  css += `--c-primary:${c[6]};`
  css += `--c-sidebar-border:${c[8] || (sidebarDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')};`
  css += `--c-header-bg:${chatBg};`
  css += `--c-header-text:${msgText};`
  css += `--c-chat-bg:${chatBg};`
  css += `--c-msg-text:${msgText};`
  css += `--c-border:${border};`
  css += `--c-input-bg:${sidebarDark ? c[0] : chatBg};`
  css += `--c-primary-text:${primaryTextWhite >= primaryTextBlack ? '#FFFFFF' : '#000000'};`
  css += '}'
  css += `body{background:${chatBg}}`
  injectStyle('meet-ai-theme', css)
}
