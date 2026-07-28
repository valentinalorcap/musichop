import type { MigrationResult } from '../types'
import './Stage5Report.css'

interface Props {
  result: MigrationResult
  onRestart: () => void
}

function toCsv(result: MigrationResult): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = ['Canción', 'Artista', 'Álbum', 'Playlist', 'Motivo'].join(',')
  const rows = result.failedTracks.map((f) =>
    [
      f.track.name,
      f.track.artist,
      f.track.album,
      f.playlistName,
      f.reason === 'local_file' ? 'Archivo local' : 'No encontrada en Spotify',
    ]
      .map(escape)
      .join(','),
  )
  return [header, ...rows].join('\r\n')
}

function downloadCsv(result: MigrationResult) {
  // Se genera en el browser con Blob, sin servidor. BOM para acentos en Excel.
  const blob = new Blob(['﻿' + toCsv(result)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'canciones-no-migradas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Stage5Report({ result, onRestart }: Props) {
  const { totalTracks, totalMigrated, totalFailed, playlists, failedTracks } = result
  const pctMigrated = totalTracks > 0 ? Math.round((totalMigrated / totalTracks) * 100) : 0
  const pctFailed = totalTracks > 0 ? Math.round((totalFailed / totalTracks) * 100) : 0

  const firstUrl = playlists.find((p) => p.spotifyUrl)?.spotifyUrl ?? 'https://open.spotify.com'

  return (
    <div>
      <div className="stage-head">
        <div className="stage-eyebrow">Paso 5 de 5</div>
        <h1 className="stage-title">Tu música ya está en Spotify 🎉</h1>
        <p className="stage-subtitle">
          Migramos {totalMigrated.toLocaleString('es')} de {totalTracks.toLocaleString('es')} canciones en{' '}
          {playlists.length} playlists.
        </p>
      </div>

      {/* ── Stats grandes ── */}
      <div className="report-stats">
        <div className="report-stat">
          <div className="report-stat-num">{totalTracks.toLocaleString('es')}</div>
          <div className="report-stat-label">canciones totales</div>
        </div>
        <div className="report-stat ok">
          <div className="report-stat-num">{pctMigrated}%</div>
          <div className="report-stat-label">{totalMigrated.toLocaleString('es')} migradas</div>
        </div>
        <div className="report-stat fail">
          <div className="report-stat-num">{pctFailed}%</div>
          <div className="report-stat-label">{totalFailed.toLocaleString('es')} fallidas</div>
        </div>
      </div>

      {/* ── Resumen por playlist ── */}
      <div className="report-section-title">Por playlist</div>
      <div className="report-playlists">
        {playlists.map((p) => {
          const pct = p.total > 0 ? Math.round((p.migrated / p.total) * 100) : 0
          return (
            <div key={p.playlistName} className="report-pl">
              <div className="report-pl-head">
                <span className="report-pl-name">
                  {p.spotifyUrl ? (
                    <a href={p.spotifyUrl} target="_blank" rel="noreferrer">
                      {p.playlistName}
                    </a>
                  ) : (
                    p.playlistName
                  )}
                </span>
                <span className="report-pl-count">
                  {p.migrated}/{p.total}
                </span>
              </div>
              <div className="report-pl-bar">
                <div className="report-pl-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Canciones fallidas ── */}
      {failedTracks.length > 0 && (
        <>
          <div className="report-section-title report-fail-head">
            <span>No se pudieron migrar ({failedTracks.length})</span>
            <button className="btn btn-ghost report-csv-btn" onClick={() => downloadCsv(result)}>
              ↓ Descargar CSV
            </button>
          </div>
          <div className="report-failed">
            {failedTracks.map((f, i) => (
              <div key={i} className="failed-row">
                <div className="failed-main">
                  <span className="failed-name">{f.track.name}</span>
                  <span className="failed-meta">
                    {f.track.artist}
                    {f.track.album && ` · ${f.track.album}`}
                  </span>
                </div>
                <div className="failed-side">
                  <span className="failed-pl">{f.playlistName}</span>
                  {f.reason === 'local_file' && (
                    <span className="failed-tag">⚠ Archivo local — no existe en Spotify</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Acciones finales ── */}
      <div className="report-actions">
        <a className="btn btn-spotify" href={firstUrl} target="_blank" rel="noreferrer">
          Abrir Spotify
        </a>
        <button className="btn btn-ghost" onClick={onRestart}>
          Migrar otra biblioteca
        </button>
      </div>
    </div>
  )
}
