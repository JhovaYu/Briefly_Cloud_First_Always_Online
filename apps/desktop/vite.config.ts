import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  // Base relativa para que Electron cargue los archivos correctamente
  base: './',
  define: {
    // simple-peer / y-webrtc reliance on global/process
    global: 'window',
  },
  resolve: {
    alias: {
      '@tuxnotas/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
