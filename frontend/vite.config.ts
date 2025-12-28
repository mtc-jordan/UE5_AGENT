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
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '169.254.0.21',
      '.manus.computer',
      '5173-iek2dobiwwmkji1ons5ps-329fcd25.sg1.manus.computer'
    ],
    hmr: {
      host: '0.0.0.0',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
