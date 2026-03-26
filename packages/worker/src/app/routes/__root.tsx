import { Toast } from '@base-ui/react/toast'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { ThemeProvider } from '../components/ThemeProvider'
import { ToastList } from '../components/Toast'
import { TooltipProvider } from '../components/ui/tooltip'
import type { RouterContext } from '../router'
import appCss from '../main.css?url'

// Self-contained theme initializer — runs as inline <script> before hydration.
// No imports, no closures. Type annotations are stripped by esbuild at compile time,
// so toString() at runtime returns clean JS safe for inline <script>.
function themeInit() {
  try {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    function hexToRgb(hex: string) {
      var h = hex.replace('#', '')
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
      ]
    }

    function luminance(hex: string) {
      var rgb = hexToRgb(hex)
      var vals = []
      for (var i = 0; i < 3; i++) {
        var v = rgb[i] / 255
        vals.push(v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
      }
      return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2]
    }

    function contrastRatio(h1: string, h2: string) {
      var l1 = luminance(h1)
      var l2 = luminance(h2)
      var lighter = Math.max(l1, l2)
      var darker = Math.min(l1, l2)
      return (lighter + 0.05) / (darker + 0.05)
    }

    function ensureContrast(textHex: string, bgHex: string, minRatio: number) {
      if (contrastRatio(textHex, bgHex) >= minRatio) return textHex
      return contrastRatio('#FFFFFF', bgHex) >= contrastRatio('#000000', bgHex)
        ? '#FFFFFF'
        : '#000000'
    }

    // eslint-disable-next-line unicorn/consistent-function-scoping
    function injectStyle(id: string, css: string) {
      var el = document.getElementById(id)
      if (!el) {
        el = document.createElement('style')
        el.id = id
        document.head.appendChild(el)
      }
      el.textContent = css
    }

    var DEFAULT_SCHEMA =
      '#222244,#2D2B55,#B362FF,#FFFFFF,#2D2B55,#A599E9,#3AD900,#FAD000,#3B3768,#7E74A8'
    var schemaStr = localStorage.getItem('meet-ai-color-schema') || DEFAULT_SCHEMA
    var parts = schemaStr.split(',').map(function (s) {
      return s.trim()
    })
    while (parts.length < 10) parts.push('#888888')

    var c = parts
    var sidebarDark = luminance(c[0]) < 0.5

    var sidebarText = ensureContrast(c[5], c[0], 3)
    var activeItemText = ensureContrast(c[3], c[2], 3)

    // Derive chat background from sidebar color
    var lum = luminance(c[0])
    var chatBg
    if (lum >= 0.5) {
      chatBg = '#FFFFFF'
    } else {
      var rgb = hexToRgb(c[0])
      chatBg = `#${[rgb[0], rgb[1], rgb[2]]
        .map(function (v) {
          return Math.max(0, Math.round(v * 0.78 + 2))
            .toString(16)
            .padStart(2, '0')
        })
        .join('')}`
    }

    var msgLum = luminance(chatBg)
    var msgText = msgLum >= 0.5 ? '#1D1C1D' : sidebarText || '#ABB2BF'
    var borderLum = luminance(c[0])
    var border = borderLum >= 0.5 ? '#E0E0E0' : c[8] || '#3e4451'

    var pw = contrastRatio('#FFFFFF', c[6])
    var pb = contrastRatio('#000000', c[6])

    var sidebarBorder = c[8] || (sidebarDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
    var inputBg = sidebarDark ? c[0] : chatBg
    var primaryText = pw >= pb ? '#FFFFFF' : '#000000'

    var css = `:root{--c-sidebar-bg:${c[0]};--c-sidebar-text:${sidebarText};--c-active-item:${c[2]};--c-active-item-text:${activeItemText};--c-hover-item:${c[4] || c[1]};--c-presence:${c[6]};--c-primary:${c[6]};--c-sidebar-border:${sidebarBorder};--c-header-bg:${chatBg};--c-header-text:${msgText};--c-chat-bg:${chatBg};--c-msg-text:${msgText};--c-border:${border};--c-input-bg:${inputBg};--c-primary-text:${primaryText};}body{background:${chatBg}}`
    injectStyle('meet-ai-theme', css)

    // Font scale
    var scale = parseFloat(localStorage.getItem('meet-ai-font-scale') || '1') || 1
    injectStyle('meet-ai-font-scale', `:root{--font-scale:${scale};font-size:${scale * 100}%;}`)
  } catch {
    /* silently ignore — pre-hydration safety net */
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
      { title: 'Meet AI' },
      { name: 'theme-color', content: '#0a0a0a' },
    ],
    links: [
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  wrapInSuspense: true,
  errorComponent: ({ error, reset }) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="text-sm text-[#e74c3c]">Something went wrong</div>
      <div className="max-w-md text-xs text-[#888]">{error.message}</div>
      <button
        type="button"
        onClick={reset}
        className="mt-2 cursor-pointer rounded border-none bg-[#333] px-4 py-1.5 text-sm text-white hover:bg-[#444]">
        Retry
      </button>
    </div>
  ),
})

function RootLayout() {
  const { queryClient } = Route.useRouteContext()

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      caches.keys().then(names => {
        for (const name of names) caches.delete(name)
      })
      navigator.serviceWorker.register('/sw.js?v=5')
    }
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <ScriptOnce>{`(${themeInit.toString()})()`}</ScriptOnce>
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <TooltipProvider>
              <Toast.Provider timeout={2100}>
                <div className="root">
                  <Outlet />
                </div>
                <ToastList />
              </Toast.Provider>
            </TooltipProvider>
            <Toaster
              theme="dark"
              position="top-center"
              toastOptions={{
                style: {
                  background: '#1a1a2e',
                  border: '1px solid #3b3768',
                  color: '#e5e5e5',
                },
              }}
            />
          </ThemeProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
