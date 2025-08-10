import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Pastikan base URL menggunakan root path di production
  server: {
    host: '0.0.0.0', // Allow external access (untuk QR code sharing)
    port: 5175,
    hmr: false,  // Disable Hot Module Replacement completely
    proxy: {
      '/api': {
        target: 'https://order-management-app-production.wahwooh.workers.dev',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path, // Keep the /api prefix
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
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
