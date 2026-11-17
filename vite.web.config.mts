// Runs the renderer on its own in a browser (no Electron), for quick UI checks.
// Saving falls back to the browser's localStorage in this mode.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  server: { port: 5199, strictPort: true },
  build: { outDir: '../../dist-web', emptyOutDir: true }
})
