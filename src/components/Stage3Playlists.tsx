import type { ParsedLibrary } from '../types'
import './Stage3Playlists.css'

interface Props {
  library: ParsedLibrary
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (select: boolean) => void
}

export default function Stage3Playlists({ library, selectedIds, onToggle, onToggleAll }: Props) {
  const { playlists } = library
  const allSelected = selectedIds.size === playlists.length
  const noneSelected = selectedIds.size === 0

  const selectedTracks = playlists
    .filter((p) => selectedIds.has(p.id))
    .reduce((sum, p) => sum + p.trackIds.length, 0)

  const localsInSelection = playlists
    .filter((p) => selectedIds.has(p.id))
    .reduce((sum, p) => sum + p.trackIds.filter((id) => library.tracks[id]?.isLocal).length, 0)

  return (
    <div>
      <div className="stage-head">
        <div className="stage-eyebrow">Paso 3 de 5</div>
        <h1 className="stage-title">Elige qué playlists migrar</h1>
        <p className="stage-subtitle">
          Se crearán en tu Spotify con el mismo nombre. Puedes dejar fuera las que no quieras.
        </p>
      </div>

      <div className="pl-toolbar">
        <button
          className="pl-selectall"
          onClick={() => onToggleAll(!allSelected)}
        >
          {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
        </button>
        <span className="pl-count">
          {selectedIds.size} de {playlists.length} seleccionadas
        </span>
      </div>

      <div className="pl-list">
        {playlists.map((p) => {
          const checked = selectedIds.has(p.id)
          return (
            <label key={p.id} className={`pl-item ${checked ? 'checked' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(p.id)} />
              <span className="pl-check" aria-hidden="true">
                {checked && '✓'}
              </span>
              <span className="pl-name">{p.name}</span>
              <span className="pl-tracks">{p.trackIds.length} canciones</span>
            </label>
          )
        })}
      </div>

      <div className="pl-summary">
        <div className="pl-summary-main">
          <strong>{selectedTracks.toLocaleString('es')}</strong> canciones en{' '}
          <strong>{selectedIds.size}</strong> playlists
        </div>
        {localsInSelection > 0 && (
          <div className="pl-summary-note">
            ⚠ {localsInSelection} son archivos locales — quizás no estén en Spotify
          </div>
        )}
      </div>

      {noneSelected && (
        <div className="notice notice-warn" style={{ marginTop: 16 }}>
          Selecciona al menos una playlist para continuar.
        </div>
      )}
    </div>
  )
}
