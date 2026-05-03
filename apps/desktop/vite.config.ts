import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env file so VITE_DEV_PROXY_TARGET is readable at config time
  const env = loadEnv(mode, process.cwd(), '')

  const devProxyTarget = env.VITE_DEV_PROXY_TARGET ?? ''
  const useCloudProxy = Boolean(devProxyTarget)

  return {
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
        // Proxy /api/workspace → workspace-service
        // Proxy /api/planning  → planning-service
        // Proxy /api/schedule → schedule-service (PM-06F.4)
        //
        // Mode LOCAL (VITE_DEV_PROXY_TARGET empty):
        //   Strips /api/<service> prefix so requests reach the Docker service directly.
        //   /api/workspace/workspaces → http://localhost:8001/workspaces
        //
        // Mode CLOUD (VITE_DEV_PROXY_TARGET=https://briefly.ddns.net):
        //   Preserves /api/<service> path so Nginx on EC2 can route correctly.
        //   /api/workspace/workspaces → https://briefly.ddns.net/api/workspace/workspaces
        //
        '/api/workspace': {
          target: devProxyTarget || 'http://localhost:8001',
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) =>
            useCloudProxy ? p : p.replace(/^\/api\/workspace/, ''),
        },
        '/api/planning': {
          target: devProxyTarget || 'http://localhost:8003',
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) =>
            useCloudProxy ? p : p.replace(/^\/api\/planning/, ''),
        },
        '/api/schedule': {
          target: devProxyTarget || 'http://localhost:8006',
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) =>
            useCloudProxy ? p : p.replace(/^\/api\/schedule/, ''),
        },
      },
    },
  }
})
