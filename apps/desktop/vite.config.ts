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
  server: {
    proxy: {
      // Proxy /api/workspace/* → workspace-service:8001
      // Proxy /api/planning/*  → planning-service:8003
      // Eliminates CORS during development. The backend services do not need
      // CORS headers because all requests are made server-side by Vite.
      '/api/workspace': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/workspace/, ''),
      },
      '/api/planning': {
        target: 'http://localhost:8003',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/planning/, ''),
      },
    },
  },
})
