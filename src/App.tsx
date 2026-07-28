import { useEffect, useState } from 'react'
import Wizard from './components/Wizard'
import Stage1Spotify from './components/Stage1Spotify'
import Stage2File from './components/Stage2File'
import Stage3Playlists from './components/Stage3Playlists'
import Stage4Migration from './components/Stage4Migration'
import Stage5Report from './components/Stage5Report'
import type { MigrationResult, ParsedLibrary, SpotifyUser, StageId } from './types'
import {
  buildAuthUrl,
  getCurrentUser,
  getStoredUser,
  handleAuthCallback,
  isConnected,
  logout,
} from './lib/spotify'
import { storage, KEYS } from './lib/storage'

export default function App() {
  const [current, setCurrent] = useState<StageId>(1)
  const [maxReached, setMaxReached] = useState<StageId>(1)

  // ── Estado de Spotify ──
  const [user, setUser] = useState<SpotifyUser | null>(getStoredUser())
  const [connecting, setConnecting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // ── Biblioteca de Apple Music ──
  const [library, setLibrary] = useState<ParsedLibrary | null>(null)

  // ── Selección de playlists (persistida en localStorage) ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Resultado de la migración ──
  const [result, setResult] = useState<MigrationResult | null>(null)

  const persistSelection = (ids: Set<string>) => {
    setSelectedIds(ids)
    storage.write(KEYS.selection, [...ids])
  }

  const handleLibraryParsed = (lib: ParsedLibrary) => {
    setLibrary(lib)
    const available = new Set(lib.playlists.map((p) => p.id))
    const stored = storage.read<string[]>(KEYS.selection)
    // Restaurar selección previa si aplica; por defecto, todas seleccionadas
    const restored = stored?.filter((id) => available.has(id)) ?? null
    setSelectedIds(restored && restored.length > 0 ? new Set(restored) : available)
  }

  const handleLibraryReset = () => {
    setLibrary(null)
    setSelectedIds(new Set())
  }

  const togglePlaylist = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    persistSelection(next)
  }

  const toggleAllPlaylists = (select: boolean) => {
    persistSelection(select && library ? new Set(library.playlists.map((p) => p.id)) : new Set())
  }

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
      // pasos 4 (migración) y 5 (informe) manejan su propia navegación
      nav={
        current <= 3
          ? {
              onPrev: current > 1 ? prev : undefined,
              onNext: next,
              hidePrev: current === 1,
              // gating: 1 requiere sesión, 2 requiere biblioteca, 3 al menos una playlist
              nextDisabled:
                (current === 1 && !user) ||
                (current === 2 && !library) ||
                (current === 3 && selectedIds.size === 0),
              nextLabel: current === 3 ? 'Empezar migración' : undefined,
            }
          : undefined
      }
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
        <Stage2File library={library} onParsed={handleLibraryParsed} onReset={handleLibraryReset} />
      )}
      {current === 3 && library && (
        <Stage3Playlists
          library={library}
          selectedIds={selectedIds}
          onToggle={togglePlaylist}
          onToggleAll={toggleAllPlaylists}
        />
      )}
      {current === 4 && library && user && (
        <Stage4Migration
          library={library}
          selectedIds={selectedIds}
          user={user}
          onComplete={setResult}
          onGoToReport={() => goTo(5)}
        />
      )}
      {current === 5 && result && <Stage5Report />}
    </Wizard>
  )
}
