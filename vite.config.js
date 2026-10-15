import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // During development (npm run dev) send API calls to the server on port 3000
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { chunkSizeWarningLimit: 1200 },
})
