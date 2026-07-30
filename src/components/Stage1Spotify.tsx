import type { SpotifyUser } from '../types'
import { hasClientId } from '../lib/spotify'
import './Stage1Spotify.css'

interface Props {
  user: SpotifyUser | null
  connecting: boolean
  error: string | null
  onConnect: () => void
  onDisconnect: () => void
}

const SpotifyLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.84-.66 13.56 1.62.36.18.54.78.18 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.1 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.32 11.4-1.02 15.9 1.62.54.3.72 1.02.42 1.56-.3.48-1.02.66-1.56.36z" />
  </svg>
)

export default function Stage1Spotify({ user, connecting, error, onConnect, onDisconnect }: Props) {
  const noClientId = !hasClientId()

  return (
    <div>
      <div className="stage-head">
        <div className="stage-eyebrow">Paso 1 de 5</div>
        <h1 className="stage-title">Conecta tu cuenta de Spotify</h1>
        <p className="stage-subtitle">
          Vamos a crear las playlists en tu cuenta. Autorizas una sola vez con el inicio de sesión
          oficial de Spotify — nunca vemos tu contraseña.
        </p>
      </div>

      {noClientId && (
        <div className="notice notice-warn">
          <strong>Falta configurar el CLIENT_ID.</strong> Crea un archivo <code>.env</code> con{' '}
          <code>VITE_SPOTIFY_CLIENT_ID=tu_id</code> y reinicia el servidor. Registra tu app en{' '}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
            developer.spotify.com
          </a>
          .
        </div>
      )}

      {error && <div className="notice notice-error">{error}</div>}

      {user ? (
        <div className="connected-card">
          <div className="connected-avatar">{(user.display_name ?? '?').charAt(0).toUpperCase()}</div>
          <div className="connected-info">
            <div className="connected-name">
              <span className="connected-check">✓</span>
              {user.display_name ?? 'Cuenta conectada'}
            </div>
            {user.email && <div className="connected-email">{user.email}</div>}
          </div>
          <button className="btn btn-ghost" onClick={onDisconnect}>
            Desconectar
          </button>
        </div>
      ) : (
        <div className="connect-box">
          <button
            className="btn btn-spotify connect-btn"
            onClick={onConnect}
            disabled={connecting || noClientId}
          >
            {connecting ? (
              <>
                <span className="spin">◌</span> Conectando…
              </>
            ) : (
              <>
                <SpotifyLogo /> Conectar con Spotify
              </>
            )}
          </button>
          <p className="connect-hint">Te redirigiremos a Spotify y volverás aquí automáticamente.</p>
        </div>
      )}
    </div>
  )
}
