import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Service 2 owns groups and matching; proxy it directly to its Docker port.
      '/api/groups': { target: 'http://localhost:5002', changeOrigin: true },
      '/api/matching': { target: 'http://localhost:5002', changeOrigin: true },
      // All remaining current UI APIs are owned by IdentitySemester.
      '/api': { target: 'http://localhost:5001', changeOrigin: true },
    },
  },
})
