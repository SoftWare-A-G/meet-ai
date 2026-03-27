import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { devtools as tanstackDevTools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackDevTools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      srcDirectory: 'src/app',
      // To avoid weird websocket interruption logs in devmode
      client: { entry: 'client.tsx' },
    }),
    tailwindcss(),
    viteReact(),
  ],
  resolve: { tsconfigPaths: true },
})
