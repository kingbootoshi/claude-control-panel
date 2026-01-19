import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    host: true, // Expose on network for mobile testing
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/trpc': {
        target: 'http://localhost:3847',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3847',
        changeOrigin: true,
      },
    },
  },
})
