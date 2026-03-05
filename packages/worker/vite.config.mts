import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindPostcss from '@tailwindcss/postcss'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tsconfigPaths(),
    tanstackStart({ srcDirectory: 'src/app' }),
    react(),
  ],
  css: { postcss: { plugins: [tailwindPostcss] } },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
})
