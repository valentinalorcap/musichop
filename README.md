# 🎧 Me cambio a Spotify

Migrá tu biblioteca de **Apple Music** a **Spotify** desde el navegador. Sin backend, sin subir
tu música a ningún lado: el archivo se lee en tu computadora y solo se habla con la API de Spotify
para crear las playlists.

- **Stack:** Vite · React · TypeScript · CSS puro
- **Hosting:** GitHub Pages (gratis)
- **Privacidad:** 100% del lado del cliente. Tu biblioteca nunca sale de tu navegador.

---

## 🚀 Usarla (en 5 minutos)

### 1. Exportá tu biblioteca de Apple Music

En tu Mac, abrí la app **Música** y andá a:

```
Archivo → Biblioteca → Exportar biblioteca…
```

Guardá el archivo `Biblioteca.xml`.

### 2. Registrá una app en Spotify

El CLIENT_ID de Spotify es **público** (usamos OAuth con PKCE, no hay client secret), pero cada
persona necesita el suyo para tener su propio rate limit:

1. Entrá a [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) y creá una app.
2. En **Redirect URIs**, agregá las dos URLs (según dónde la uses):
   - Local: `http://127.0.0.1:5173/`
   - Producción: `https://<tu-proyecto>.vercel.app/`
3. Copiá el **Client ID**.

> ⚠️ Spotify ya no acepta `localhost`: en local hay que usar la IP de loopback `127.0.0.1`.

### 3. Configurá el CLIENT_ID

```bash
cp .env.example .env
# editá .env y pegá tu Client ID en VITE_SPOTIFY_CLIENT_ID
```

### 4. Corré la app

```bash
nvm use          # usa Node 20 (ver .nvmrc)
npm install
npm run dev
```

Abrí **http://127.0.0.1:5173/** y seguí el asistente:

1. **Conectá Spotify** → login oficial de Spotify.
2. **Subí tu archivo** → arrastrá el `Biblioteca.xml`.
3. **Elegí playlists** → tildá las que quieras migrar.
4. **Migrá** → se crean las playlists y se agregan las canciones.
5. **Informe** → resumen + descarga del CSV de las que no se encontraron.

---

## 🧠 Cómo funciona el matching

Para cada canción se busca en Spotify por **título + artista**. Si hay varias coincidencias, se
desempata por **álbum**. Si no hay una coincidencia exacta, la canción **no se agrega** (nunca se
mete "algo parecido") y queda listada en el informe final con todos sus datos.

Los **archivos locales** (canciones que eran tus propios archivos, no de una tienda) se marcan
aparte porque probablemente no existan en el catálogo de Spotify.

La migración respeta el rate limit de Spotify (pausa entre búsquedas, y si recibe un `429`
espera lo que indique el header `Retry-After`). Si se interrumpe, podés retomarla sin duplicar
lo ya creado.

---

## ☁️ Deploy en Vercel

La app es 100% estática, así que Vercel la detecta como proyecto Vite sin configuración extra.

1. Entrá a [vercel.com](https://vercel.com) e importá el repo `spotify-music-importer`.
2. En **Environment Variables**, agregá `VITE_SPOTIFY_CLIENT_ID` con tu Client ID.
3. Deploy. Vercel te da una URL de producción (ej. `https://spotify-music-importer.vercel.app/`) y
   la redeploya automáticamente en cada push a `main`.
4. Agregá esa URL de producción a los **Redirect URIs** de tu app de Spotify.

---

## 🛠️ Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de producción a `dist/` |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run typecheck` | Solo chequeo de tipos |
