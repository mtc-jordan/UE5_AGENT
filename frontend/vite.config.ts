import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: 'all',
    hmr: {
      // Disable HMR for public access to avoid WebSocket issues
      // The page will need manual refresh for updates
      clientPort: 443,
      protocol: 'wss',
      host: '5173-i3ldruj09nj1z4l4mqxyl-8f88ccf5.sg1.manus.computer',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
