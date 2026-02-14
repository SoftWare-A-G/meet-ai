import { Toast } from '@base-ui/react/toast'
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ToastList } from '../components/Toast'
import appCss from '../main.css?url'

export const Route = createRootRoute({
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
})

function RootLayout() {
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
      </head>
      <body>
        <Toast.Provider timeout={2100}>
          <div className="root">
            <Outlet />
          </div>
          <ToastList />
        </Toast.Provider>
        <Scripts />
      </body>
    </html>
  )
}
