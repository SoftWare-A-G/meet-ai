import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      srcDirectory: 'src/app',
      // To avoid weird websocket interruption logs in devmode
      client: { entry: 'client.tsx' },
    }),
    tailwindcss(),
    react(),
  ],
  resolve: { tsconfigPaths: true },
})
