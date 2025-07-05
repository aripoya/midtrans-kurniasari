import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
  }
})
