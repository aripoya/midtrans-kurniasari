import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Pastikan base URL menggunakan root path di production
  server: {
    hmr: {
      // Perbaikan untuk WebSocket connection
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    },
    // Menggunakan host yang bisa diakses dari jaringan lokal jika diperlukan
    host: '0.0.0.0',
    watch: {
      // Meningkatkan performa watching
      usePolling: true
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
