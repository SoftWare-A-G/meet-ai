import tailwindPostcss from '@tailwindcss/postcss'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  root: 'src/mainview',
  css: { postcss: { plugins: [tailwindPostcss] } },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
