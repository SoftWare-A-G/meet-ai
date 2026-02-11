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

const _colorProbe = (() => {
  const el = document.createElement('div')
  el.style.display = 'none'
  document.body.appendChild(el)
  return el
})()

export function resolveColor(cssColor: string): string {
  _colorProbe.style.color = ''
  _colorProbe.style.color = cssColor
  const computed = getComputedStyle(_colorProbe).color
  const m = computed.match(/(\d+)/g)
  if (!m || m.length < 3) return cssColor
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

export function ensureSenderContrast(color: string): string {
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
