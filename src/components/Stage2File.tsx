import { useRef, useState } from 'react'
import type { ParsedLibrary } from '../types'
import { parseLibraryFile } from '../lib/parser'
import './Stage2File.css'

interface Props {
  library: ParsedLibrary | null
  onParsed: (lib: ParsedLibrary) => void
  onReset: () => void
}

export default function Stage2File({ library, onParsed, onReset }: Props) {
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setParsing(true)
    try {
      const lib = await parseLibraryFile(file)
      if (lib.playlists.length === 0) {
        setError('No se encontraron playlists migrables en el archivo (solo smart playlists o vacías).')
      } else {
        onParsed(lib)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setParsing(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const totalTracks = library
    ? library.playlists.reduce((s, p) => s + p.trackIds.length, 0)
    : 0

  return (
    <div>
      <div className="stage-head">
        <div className="stage-eyebrow">Paso 2 de 5</div>
        <h1 className="stage-title">Subí tu biblioteca de Apple Music</h1>
        <p className="stage-subtitle">
          El archivo se lee <strong>en tu navegador</strong> — no se sube a ningún servidor. Nada de
          tu música sale de tu computadora.
        </p>
      </div>

      {library ? (
        <div className="file-summary">
          <div className="file-summary-icon">✓</div>
          <div className="file-summary-info">
            <div className="file-summary-title">Biblioteca cargada</div>
            <div className="file-summary-stats">
              <span>
                <strong>{library.playlists.length}</strong> playlists
              </span>
              <span>
                <strong>{totalTracks.toLocaleString('es')}</strong> canciones
              </span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onReset}>
            Cambiar archivo
          </button>
        </div>
      ) : (
        <div
          className={`dropzone ${dragging ? 'dragging' : ''} ${parsing ? 'busy' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !parsing && inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = '' // permitir re-seleccionar el mismo archivo
            }}
          />
          {parsing ? (
            <>
              <div className="dropzone-icon spin">◌</div>
              <div className="dropzone-title">Leyendo tu biblioteca…</div>
            </>
          ) : (
            <>
              <div className="dropzone-icon">📁</div>
              <div className="dropzone-title">Arrastrá tu archivo acá</div>
              <div className="dropzone-sub">o hacé clic para elegirlo · archivo .xml</div>
            </>
          )}
        </div>
      )}

      {error && <div className="notice notice-error" style={{ marginTop: 20 }}>{error}</div>}

      <details className="how-to">
        <summary>¿Cómo exporto el archivo desde la app Música?</summary>
        <ol>
          <li>Abrí la app <strong>Música</strong> en tu Mac.</li>
          <li>
            En la barra de menú: <code>Archivo → Biblioteca → Exportar biblioteca…</code>
          </li>
          <li>
            Guardá el archivo <code>Biblioteca.xml</code> donde quieras y subilo acá.
          </li>
        </ol>
      </details>
    </div>
  )
}
