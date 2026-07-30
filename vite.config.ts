import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La app se sirve desde la raíz del dominio (Vercel), así que base es '/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    // Spotify exige loopback IP (no acepta "localhost") en los redirect URIs.
    // Con esto el dev corre en http://127.0.0.1:5173/
    host: '127.0.0.1',
    port: 5173,
  },
})
