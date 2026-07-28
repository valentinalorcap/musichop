import { useEffect, useRef, useState } from 'react'
import type { MigrationResult, ParsedLibrary, SpotifyUser } from '../types'
import {
  runMigration,
  hasResumableProgress,
  type DuplicateStrategy,
  type LogLine,
  type MigrationController,
  type MigrationStats,
} from '../lib/migrator'
import './Stage4Migration.css'

interface Props {
  library: ParsedLibrary
  selectedIds: Set<string>
  user: SpotifyUser
  onComplete: (result: MigrationResult) => void
  onGoToReport: () => void
}

type Mode = 'config' | 'running' | 'done' | 'error'

const MAX_LOG = 250

export default function Stage4Migration({ library, selectedIds, user, onComplete, onGoToReport }: Props) {
  const selectedList = [...selectedIds]
  const selectedPlaylists = library.playlists.filter((p) => selectedIds.has(p.id))
  const tracksTotal = selectedPlaylists.reduce((s, p) => s + p.trackIds.length, 0)

  const [mode, setMode] = useState<Mode>('config')
  const [makePublic, setMakePublic] = useState(false)
  const [dupStrategy, setDupStrategy] = useState<DuplicateStrategy>('create')
  const [stats, setStats] = useState<MigrationStats | null>(null)
  const [logs, setLogs] = useState<LogLine[]>([])
  const [error, setError] = useState<string | null>(null)

  const controllerRef = useRef<MigrationController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const canResume = hasResumableProgress(user.id, selectedList)

  // Auto-scroll del log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' })
  }, [logs])

  // Cancelar si el componente se desmonta en pleno vuelo
  useEffect(() => () => controllerRef.current?.cancel(), [])

  const start = () => {
    setMode('running')
    setLogs([])
    setError(null)
    controllerRef.current = runMigration(
      {
        library,
        selectedPlaylistIds: selectedList,
        user,
        makePublic,
        duplicateStrategy: dupStrategy,
      },
      {
        onStats: (s) => setStats(s),
        onLog: (line) => setLogs((prev) => [...prev.slice(-MAX_LOG + 1), line]),
        onDone: (result) => {
          onComplete(result)
          setMode('done')
        },
        onError: (msg) => {
          setError(msg)
          setMode('error')
        },
      },
    )
  }

  const cancel = () => {
    controllerRef.current?.cancel()
    setMode('config')
    setStats(null)
  }

  const pct = stats && stats.tracksTotal > 0 ? Math.round((stats.tracksProcessed / stats.tracksTotal) * 100) : 0

  // ── Pantalla de configuración / arranque ──
  if (mode === 'config') {
    return (
      <div>
        <div className="stage-head">
          <div className="stage-eyebrow">Paso 4 de 5</div>
          <h1 className="stage-title">Todo listo para migrar</h1>
          <p className="stage-subtitle">
            Vamos a crear <strong>{selectedPlaylists.length}</strong> playlists con{' '}
            <strong>{tracksTotal.toLocaleString('es')}</strong> canciones en tu Spotify.
          </p>
        </div>

        {canResume && (
          <div className="notice notice-warn">
            Encontramos una migración a medias con esta misma selección. Al empezar,{' '}
            <strong>se retoma desde donde quedó</strong> sin duplicar lo ya creado.
          </div>
        )}

        <div className="config-card">
          <label className="config-row">
            <span>
              <strong>Playlists públicas</strong>
              <small>Si está apagado, se crean como privadas (solo vos las ves).</small>
            </span>
            <input type="checkbox" checked={makePublic} onChange={(e) => setMakePublic(e.target.checked)} />
          </label>

          <div className="config-row config-radio">
            <span>
              <strong>Si ya existe una playlist con el mismo nombre</strong>
            </span>
            <div className="radio-group">
              <label className={dupStrategy === 'create' ? 'on' : ''}>
                <input
                  type="radio"
                  name="dup"
                  checked={dupStrategy === 'create'}
                  onChange={() => setDupStrategy('create')}
                />
                Crear una nueva igual
              </label>
              <label className={dupStrategy === 'skip' ? 'on' : ''}>
                <input
                  type="radio"
                  name="dup"
                  checked={dupStrategy === 'skip'}
                  onChange={() => setDupStrategy('skip')}
                />
                Saltarla
              </label>
            </div>
          </div>
        </div>

        <button className="btn btn-primary start-btn" onClick={start}>
          {canResume ? 'Retomar migración' : 'Empezar migración'} →
        </button>
      </div>
    )
  }

  // ── Pantalla de progreso / resultado ──
  return (
    <div>
      <div className="stage-head">
        <div className="stage-eyebrow">Paso 4 de 5</div>
        <h1 className="stage-title">
          {mode === 'running' && 'Migrando tu música…'}
          {mode === 'done' && '¡Migración completa!'}
          {mode === 'error' && 'Se interrumpió la migración'}
        </h1>
        {mode === 'running' && stats?.currentPlaylist && (
          <p className="stage-subtitle">
            <span className="pulse">●</span> Procesando «{stats.currentPlaylist}»
          </p>
        )}
      </div>

      {stats && (
        <>
          <div className="progress-head">
            <span>
              {stats.tracksProcessed.toLocaleString('es')} / {stats.tracksTotal.toLocaleString('es')} canciones
            </span>
            <span>{pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="stat-row">
            <div className="stat stat-ok">
              <div className="stat-num">{stats.migrated}</div>
              <div className="stat-label">migradas</div>
            </div>
            <div className="stat stat-fail">
              <div className="stat-num">{stats.failed}</div>
              <div className="stat-label">fallidas</div>
            </div>
            <div className="stat">
              <div className="stat-num">
                {stats.playlistsDone}/{stats.playlistsTotal}
              </div>
              <div className="stat-label">playlists</div>
            </div>
          </div>
        </>
      )}

      {error && <div className="notice notice-error">{error}</div>}

      <div className="log">
        {logs.map((l, i) => (
          <div key={i} className={`log-line log-${l.kind}`}>
            {l.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      <div className="migration-actions">
        {mode === 'running' && (
          <button className="btn btn-ghost" onClick={cancel}>
            Pausar
          </button>
        )}
        {mode === 'error' && (
          <button className="btn btn-primary" onClick={start}>
            Reintentar
          </button>
        )}
        {mode === 'done' && (
          <button className="btn btn-primary" onClick={onGoToReport}>
            Ver informe →
          </button>
        )}
      </div>
    </div>
  )
}
