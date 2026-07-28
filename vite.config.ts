import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El base debe coincidir con el nombre del repo en GitHub Pages:
// https://valentinalorcap.github.io/spotify-music-importer/
// En dev (npm run dev) se ignora, solo afecta el build de producción.
export default defineConfig({
  plugins: [react()],
  base: '/spotify-music-importer/',
  server: {
    // Spotify exige loopback IP (no acepta "localhost") en los redirect URIs.
    // Con esto el dev corre en http://127.0.0.1:5173/spotify-music-importer/
    host: '127.0.0.1',
    port: 5173,
  },
})
