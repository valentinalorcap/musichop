# 🎧 Me cambio a Spotify

Migra tu biblioteca de **Apple Music** a **Spotify** desde el navegador. Sin backend, sin subir
tu música a ningún lado: el archivo se lee en tu computadora y solo se habla con la API de Spotify
para crear las playlists.

- **Stack:** Vite · React · TypeScript · CSS puro
- **Hosting:** Vercel (gratis)
- **Privacidad:** 100% del lado del cliente. Tu biblioteca nunca sale de tu navegador.

---

## 🚀 Usarla (en 5 minutos)

### 1. Exporta tu biblioteca de Apple Music

En tu Mac, abre la app **Música** y ve a:

```
Archivo → Biblioteca → Exportar biblioteca…
```

Guarda el archivo `Biblioteca.xml`.

### 2. Registra una app en Spotify

El CLIENT_ID de Spotify es **público** (usamos OAuth con PKCE, no hay client secret), pero cada
persona necesita el suyo para tener su propio rate limit:

1. Ve a [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) y crea una app.
2. En **Redirect URIs**, agrega las dos URLs (según dónde la uses):
   - Local: `http://127.0.0.1:5173/`
   - Producción: `https://<tu-proyecto>.vercel.app/`
3. Copia el **Client ID**.

> ⚠️ Spotify ya no acepta `localhost`: en local hay que usar la IP de loopback `127.0.0.1`.

### 3. Configura el CLIENT_ID

```bash
cp .env.example .env
# edita .env y pega tu Client ID en VITE_SPOTIFY_CLIENT_ID
```

### 4. Ejecuta la app

```bash
nvm use          # usa Node 20 (ver .nvmrc)
npm install
npm run dev
```

Abre **http://127.0.0.1:5173/** y sigue el asistente:

1. **Conecta Spotify** → inicio de sesión oficial de Spotify.
2. **Sube tu archivo** → arrastra el `Biblioteca.xml`.
3. **Elige playlists** → marca las que quieras migrar.
4. **Migra** → se crean las playlists y se agregan las canciones.
5. **Informe** → resumen + descarga del CSV de las que no se encontraron.

---

## 🧠 Cómo funciona el matching

Para cada canción se busca en Spotify por **título + artista**. Si hay varias coincidencias, se
desempata por **álbum**. Si no hay una coincidencia exacta, la canción **no se agrega** (nunca se
mete "algo parecido") y queda listada en el informe final con todos sus datos.

Los **archivos locales** (canciones que eran tus propios archivos, no de una tienda) se marcan
aparte porque probablemente no existan en el catálogo de Spotify.

La migración respeta el rate limit de Spotify (pausa entre búsquedas, y si recibe un `429`
espera lo que indique el header `Retry-After`). Si se interrumpe, puedes retomarla sin duplicar
lo ya creado.

---

## ☁️ Deploy en Vercel

La app es 100% estática, así que Vercel la detecta como proyecto Vite sin configuración extra.

1. Ve a [vercel.com](https://vercel.com) e importa el repo `spotify-music-importer`.
2. En **Environment Variables**, agrega `VITE_SPOTIFY_CLIENT_ID` con tu Client ID.
3. Deploy. Vercel te da una URL de producción (ej. `https://spotify-music-importer.vercel.app/`) y
   la redeploya automáticamente en cada push a `main`.
4. Agrega esa URL de producción a los **Redirect URIs** de tu app de Spotify.

---

## 🛠️ Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de producción a `dist/` |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run typecheck` | Solo chequeo de tipos |
