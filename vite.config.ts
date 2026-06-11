import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // dev: forward API calls to the local SkyDrop server (npm run server)
      '/api': 'http://localhost:8787',
    },
  },
})
