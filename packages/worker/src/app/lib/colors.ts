import { contrastRatio, hexToRgb, luminance } from './theme'

export function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 60%, 45%)`
}

export function darkenForAvatar(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 50%, 35%)`
}

let _colorProbe: HTMLDivElement | null = null
function getColorProbe(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null
  if (!_colorProbe) {
    _colorProbe = document.createElement('div')
    _colorProbe.style.display = 'none'
    document.body.appendChild(_colorProbe)
  }
  return _colorProbe
}

export function resolveColor(cssColor: string): string {
  const probe = getColorProbe()
  if (!probe) return cssColor
  probe.style.color = ''
  probe.style.color = cssColor
  const computed = getComputedStyle(probe).color
  const m = computed.match(/(\d+)/g)
  if (!m || m.length < 3) return cssColor
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

export function ensureSenderContrast(color: string): string {
  if (typeof document === 'undefined') return color
  const resolved = resolveColor(color)
  const chatBg = getComputedStyle(document.documentElement).getPropertyValue('--c-chat-bg').trim() || '#FFFFFF'
  if (contrastRatio(resolved, chatBg) >= 3) return color
  const bgLum = luminance(chatBg)
  const [r, g, b] = hexToRgb(resolved)
  if (bgLum < 0.5) {
    for (let f = 1.5; f <= 3.0; f += 0.3) {
      const d = '#' + [r, g, b].map(v => Math.min(255, Math.round(v * f)).toString(16).padStart(2, '0')).join('')
      if (contrastRatio(d, chatBg) >= 3) return d
    }
    return '#CCCCCC'
  } else {
    for (let f = 0.5; f >= 0.2; f -= 0.1) {
      const d = '#' + [r, g, b].map(v => Math.round(v * f).toString(16).padStart(2, '0')).join('')
      if (contrastRatio(d, chatBg) >= 3) return d
    }
    return '#555555'
  }
}
