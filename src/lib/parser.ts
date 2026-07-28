import type { AppleTrack, ApplePlaylist, ParsedLibrary } from '../types'

// El "iTunes Music Library.xml" de Apple Music es un plist: un árbol de
// <dict>/<array> donde cada <key> es seguido por su elemento-valor hermano.
// Lo parseamos con DOMParser (nativo, sin dependencias).

type PlistValue = string | number | boolean | PlistValue[] | PlistDict
interface PlistDict {
  [key: string]: PlistValue
}

function parseValue(el: Element): PlistValue {
  switch (el.tagName) {
    case 'string':
      return el.textContent ?? ''
    case 'integer':
      return parseInt(el.textContent ?? '0', 10)
    case 'real':
      return parseFloat(el.textContent ?? '0')
    case 'true':
      return true
    case 'false':
      return false
    case 'dict':
      return parseDict(el)
    case 'array':
      return parseArray(el)
    // date / data y demás los guardamos como texto crudo
    default:
      return el.textContent ?? ''
  }
}

function parseDict(dict: Element): PlistDict {
  const obj: PlistDict = {}
  const children = Array.from(dict.children)
  for (let i = 0; i < children.length; i++) {
    if (children[i].tagName === 'key') {
      const key = children[i].textContent ?? ''
      const valueEl = children[i + 1]
      if (valueEl) {
        obj[key] = parseValue(valueEl)
        i++ // saltar el elemento-valor ya consumido
      }
    }
  }
  return obj
}

function parseArray(arr: Element): PlistValue[] {
  return Array.from(arr.children).map(parseValue)
}

// ── Heurísticas de dominio ──

/**
 * Un track es "local" (archivo propio, difícil de encontrar en Spotify) cuando
 * apunta a un archivo file:// y no proviene de la tienda ni del streaming.
 * Se usa solo para etiquetar en el informe; igual se intenta buscar en Spotify.
 */
function isLocalTrack(t: PlistDict): boolean {
  const trackType = t['Track Type']
  if (trackType === 'Remote') return false // streaming de Apple Music, sin archivo
  const location = typeof t['Location'] === 'string' ? (t['Location'] as string) : ''
  if (!location) return false
  const purchased = t['Purchased'] === true || /purchased/i.test(String(t['Kind'] ?? ''))
  return location.startsWith('file://') && !purchased
}

function isSmartPlaylist(p: PlistDict): boolean {
  return p['Smart Info'] !== undefined || p['Smart Criteria'] !== undefined
}

/** Playlists auto-generadas por el sistema que no tiene sentido migrar. */
function isSystemPlaylist(p: PlistDict): boolean {
  return (
    p['Master'] === true || // la biblioteca general
    p['Distinguished Kind'] !== undefined || // Música, Descargas, Comprado, etc.
    p['Folder'] === true // carpetas contenedoras, no playlists reales
  )
}

// ── API pública ──

export function parseAppleMusicLibrary(xmlText: string): ParsedLibrary {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')

  if (doc.querySelector('parsererror')) {
    throw new Error('El archivo no es un XML válido. ¿Seguro que es el .xml exportado de Música?')
  }
  const rootDict = doc.querySelector('plist > dict')
  if (!rootDict) {
    throw new Error('No parece una biblioteca de Apple Music (falta la estructura <plist><dict>).')
  }

  const top = parseDict(rootDict)
  const tracksRaw = (top['Tracks'] as PlistDict) ?? {}
  const playlistsRaw = (top['Playlists'] as PlistValue[]) ?? []

  // 1. Indexar todos los tracks
  const tracks: Record<string, AppleTrack> = {}
  for (const key of Object.keys(tracksRaw)) {
    const t = tracksRaw[key] as PlistDict
    const id = String(t['Track ID'] ?? key)
    tracks[id] = {
      id,
      name: String(t['Name'] ?? '').trim(),
      artist: String(t['Artist'] ?? '').trim(),
      album: String(t['Album'] ?? '').trim(),
      isLocal: isLocalTrack(t),
    }
  }

  // 2. Filtrar y construir playlists migrables
  const playlists: ApplePlaylist[] = []
  for (const raw of playlistsRaw) {
    const p = raw as PlistDict
    // Excluir smart playlists (son dinámicas: migrar un snapshot engaña) y las del sistema
    if (isSmartPlaylist(p) || isSystemPlaylist(p)) continue

    const items = (p['Playlist Items'] as PlistValue[]) ?? []
    const trackIds = items
      .map((item) => String((item as PlistDict)['Track ID']))
      .filter((tid) => tracks[tid] !== undefined)

    if (trackIds.length === 0) continue // playlists vacías

    playlists.push({
      id: String(p['Playlist Persistent ID'] ?? p['Playlist ID'] ?? p['Name']),
      name: String(p['Name'] ?? 'Sin nombre'),
      trackIds,
      isSmart: isSmartPlaylist(p),
    })
  }

  return { tracks, playlists }
}

/** Lee un File del input/drop y lo parsea. */
export async function parseLibraryFile(file: File): Promise<ParsedLibrary> {
  const text = await file.text()
  return parseAppleMusicLibrary(text)
}

// ── Helpers para la UI ──

export function tracksOf(library: ParsedLibrary, playlist: ApplePlaylist): AppleTrack[] {
  return playlist.trackIds.map((id) => library.tracks[id]).filter(Boolean)
}

export function totalSelectedTracks(library: ParsedLibrary, playlistIds: Set<string>): number {
  return library.playlists
    .filter((p) => playlistIds.has(p.id))
    .reduce((sum, p) => sum + p.trackIds.length, 0)
}
