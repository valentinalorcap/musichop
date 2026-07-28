import { useEffect, useState } from 'react'
import Wizard from './components/Wizard'
import Stage1Spotify from './components/Stage1Spotify'
import Stage2File from './components/Stage2File'
import Stage3Playlists from './components/Stage3Playlists'
import Stage4Migration from './components/Stage4Migration'
import Stage5Report from './components/Stage5Report'
import type { ParsedLibrary, SpotifyUser, StageId } from './types'
import {
  buildAuthUrl,
  getCurrentUser,
  getStoredUser,
  handleAuthCallback,
  isConnected,
  logout,
} from './lib/spotify'

export default function App() {
  const [current, setCurrent] = useState<StageId>(1)
  const [maxReached, setMaxReached] = useState<StageId>(1)

  // ── Estado de Spotify ──
  const [user, setUser] = useState<SpotifyUser | null>(getStoredUser())
  const [connecting, setConnecting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // ── Biblioteca de Apple Music ──
  const [library, setLibrary] = useState<ParsedLibrary | null>(null)

  const goTo = (id: StageId) => {
    setCurrent(id)
    setMaxReached((m) => (id > m ? id : m))
  }
  const next = () => current < 5 && goTo((current + 1) as StageId)
  const prev = () => current > 1 && goTo((current - 1) as StageId)

  // ── Al montar: procesar callback de OAuth o restaurar sesión ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setConnecting(true)
      try {
        const tokens = await handleAuthCallback()
        if (tokens || isConnected()) {
          const u = await getCurrentUser()
          if (!cancelled) {
            setUser(u)
            // si venimos de un callback exitoso, avanzar al paso 2
            if (tokens) goTo(2)
          }
        }
      } catch (e) {
        if (!cancelled) setAuthError(e instanceof Error ? e.message : 'Error de autenticación')
      } finally {
        if (!cancelled) setConnecting(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConnect = async () => {
    setAuthError(null)
    setConnecting(true)
    try {
      window.location.href = await buildAuthUrl()
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'No se pudo iniciar el login')
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    logout()
    setUser(null)
    setAuthError(null)
  }

  return (
    <Wizard
      current={current}
      maxReached={maxReached}
      onStepClick={goTo}
      nav={{
        onPrev: current > 1 ? prev : undefined,
        onNext: current < 5 ? next : undefined,
        hidePrev: current === 1,
        // gating por paso: 1 requiere sesión, 2 requiere biblioteca cargada
        nextDisabled: (current === 1 && !user) || (current === 2 && !library),
      }}
    >
      {current === 1 && (
        <Stage1Spotify
          user={user}
          connecting={connecting}
          error={authError}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      )}
      {current === 2 && (
        <Stage2File library={library} onParsed={setLibrary} onReset={() => setLibrary(null)} />
      )}
      {current === 3 && <Stage3Playlists />}
      {current === 4 && <Stage4Migration />}
      {current === 5 && <Stage5Report />}
    </Wizard>
  )
}
