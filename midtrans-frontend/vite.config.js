import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Pastikan base URL menggunakan root path di production
  server: {
    port: 5175,
    hmr: false,  // Disable Hot Module Replacement completely
    proxy: {
      '/api': {
        target: 'https://order-management-app-production.wahwooh.workers.dev',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path // Keep the /api prefix
      }
    }
  },
  build: {
    // Memperbaiki output build untuk deploy
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Set ke true jika debugging diperlukan
    rollupOptions: {
      output: {
        // Memastikan output file memiliki nama yang konsisten
        manualChunks: undefined
      }
    }
  }
})
