import type {
  AppleTrack,
  ApplePlaylist,
  FailedTrack,
  MigrationResult,
  ParsedLibrary,
  PlaylistResult,
  SpotifyUser,
} from '../types'
import { api, sleep } from './spotify'
import { storage, KEYS } from './storage'

// ── Config y eventos ──

export type DuplicateStrategy = 'create' | 'skip'

export interface MigrationConfig {
  library: ParsedLibrary
  selectedPlaylistIds: string[]
  user: SpotifyUser
  makePublic: boolean
  duplicateStrategy: DuplicateStrategy
}

export interface LogLine {
  kind: 'ok' | 'fail' | 'info' | 'local'
  text: string
}

export interface MigrationStats {
  phase: 'idle' | 'preparing' | 'running' | 'done' | 'error' | 'cancelled'
  currentPlaylist: string | null
  playlistsDone: number
  playlistsTotal: number
  tracksProcessed: number
  tracksTotal: number
  migrated: number
  failed: number
}

export interface MigrationHandlers {
  onStats: (stats: MigrationStats) => void
  onLog: (line: LogLine) => void
  onDone: (result: MigrationResult) => void
  onError: (message: string) => void
}

/** Controlador para cancelar una migración en curso. */
export interface MigrationController {
  cancel: () => void
}

// Delay entre búsquedas para no gatillar el rate limit de Spotify.
const SEARCH_DELAY_MS = 100
const BATCH_SIZE = 100

// ── Normalización y matching ──

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/\(.*?\)|\[.*?\]/g, ' ') // quitar (…) y […]
    .replace(/\b(feat|ft|featuring|con|with)\b.*$/i, ' ') // cortar colas de "feat"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

interface SpotifyTrackItem {
  uri: string
  name: string
  artists: { name: string }[]
  album: { name: string }
}

/**
 * Matching estricto (en orden):
 * 1. título + artista exactos (normalizados)
 * 2. desempate por álbum si hay varios
 * 3. sin coincidencia → null (nunca "algo parecido")
 */
function pickMatch(track: AppleTrack, items: SpotifyTrackItem[]): SpotifyTrackItem | null {
  const nName = normalize(track.name)
  const nArtist = normalize(track.artist)
  const nAlbum = normalize(track.album)

  const candidates = items.filter((it) => {
    if (normalize(it.name) !== nName) return false
    if (!nArtist) return true
    const artists = it.artists.map((a) => normalize(a.name))
    return artists.some((a) => a === nArtist || nArtist.includes(a) || a.includes(nArtist))
  })
  if (candidates.length === 0) return null

  // 2. desempate por álbum
  const byAlbum = candidates.find((it) => normalize(it.album.name) === nAlbum)
  return byAlbum ?? candidates[0]
}

async function findTrackUri(track: AppleTrack): Promise<string | null> {
  const queries = [
    `track:"${track.name}" artist:"${track.artist}"`,
    `${track.name} ${track.artist}`,
  ]
  for (const q of queries) {
    const data = await api<{ tracks?: { items: SpotifyTrackItem[] } }>(
      `/search?type=track&limit=20&q=${encodeURIComponent(q)}`,
    )
    const match = pickMatch(track, data.tracks?.items ?? [])
    if (match) return match.uri
  }
  return null
}

// ── Endpoints de escritura ──

async function fetchExistingPlaylists(): Promise<Map<string, string>> {
  // nombre normalizado → spotify playlist id (para detectar duplicados)
  const map = new Map<string, string>()
  let path: string | null = '/me/playlists?limit=50'
  while (path) {
    const data: { items: { id: string; name: string }[]; next: string | null } = await api(path)
    for (const it of data.items) map.set(it.name, it.id)
    path = data.next
  }
  return map
}

async function createPlaylist(
  userId: string,
  name: string,
  isPublic: boolean,
): Promise<{ id: string; url: string | null }> {
  const p = await api<{ id: string; external_urls?: { spotify?: string } }>(
    `/users/${encodeURIComponent(userId)}/playlists`,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        public: isPublic,
        description: 'Migrada con musicHop',
      }),
    },
  )
  return { id: p.id, url: p.external_urls?.spotify ?? null }
}

async function addTracksInBatches(playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += BATCH_SIZE) {
    const chunk = uris.slice(i, i + BATCH_SIZE)
    await api(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: chunk }),
    })
  }
}

// ── Persistencia de progreso (resume sin duplicados) ──

interface StoredProgress {
  userId: string
  selectedIds: string[]
  playlistIndex: number // índice de la playlist en curso dentro de selectedIds
  result: MigrationResult
  createdPlaylists: Record<string, string> // applePlaylistId → spotifyPlaylistId (ya creadas)
}

function emptyResult(): MigrationResult {
  return { playlists: [], failedTracks: [], totalTracks: 0, totalMigrated: 0, totalFailed: 0 }
}

function loadProgress(userId: string, selectedIds: string[]): StoredProgress | null {
  const p = storage.read<StoredProgress>(KEYS.progress)
  if (!p || p.userId !== userId) return null
  // misma selección exacta, si no arrancamos de cero
  if (p.selectedIds.length !== selectedIds.length) return null
  if (!selectedIds.every((id) => p.selectedIds.includes(id))) return null
  return p
}

// ── Runner principal ──

export function runMigration(
  config: MigrationConfig,
  handlers: MigrationHandlers,
): MigrationController {
  const cancelState = { cancelled: false }
  const controller: MigrationController = {
    cancel: () => {
      cancelState.cancelled = true
    },
  }

  ;(async () => {
    const { library, selectedPlaylistIds, user, makePublic, duplicateStrategy } = config

    const selected: ApplePlaylist[] = selectedPlaylistIds
      .map((id) => library.playlists.find((p) => p.id === id))
      .filter((p): p is ApplePlaylist => p !== undefined)

    const tracksTotal = selected.reduce((s, p) => s + p.trackIds.length, 0)

    // Resume si hay progreso guardado para el mismo usuario y selección
    const resumed = loadProgress(user.id, selectedPlaylistIds)
    const result: MigrationResult = resumed?.result ?? emptyResult()
    result.totalTracks = tracksTotal
    const createdPlaylists: Record<string, string> = resumed?.createdPlaylists ?? {}
    let startIndex = resumed?.playlistIndex ?? 0

    const stats: MigrationStats = {
      phase: 'preparing',
      currentPlaylist: null,
      playlistsDone: startIndex,
      playlistsTotal: selected.length,
      tracksProcessed: result.playlists.reduce((s, p) => s + p.total, 0),
      tracksTotal,
      migrated: result.totalMigrated,
      failed: result.totalFailed,
    }
    handlers.onStats({ ...stats })

    const persist = () => {
      const progress: StoredProgress = {
        userId: user.id,
        selectedIds: selectedPlaylistIds,
        playlistIndex: startIndex,
        result,
        createdPlaylists,
      }
      storage.write(KEYS.progress, progress)
    }

    try {
      if (resumed) {
        handlers.onLog({ kind: 'info', text: `Retomando migración desde donde quedó…` })
      }

      // La lista de playlists existentes solo se necesita para la estrategia "saltar".
      // Se envuelve en try/catch para que un fallo de permisos nunca corte la migración.
      let existing = new Map<string, string>()
      if (duplicateStrategy === 'skip') {
        try {
          existing = await fetchExistingPlaylists()
        } catch {
          handlers.onLog({
            kind: 'info',
            text: 'No se pudieron leer las playlists existentes; se crearán nuevas.',
          })
        }
      }

      for (let i = startIndex; i < selected.length; i++) {
        if (cancelState.cancelled) {
          stats.phase = 'cancelled'
          handlers.onStats({ ...stats })
          persist()
          return
        }

        const playlist = selected[i]
        startIndex = i
        stats.currentPlaylist = playlist.name
        stats.phase = 'running'
        handlers.onStats({ ...stats })

        // ── Duplicados ──
        if (duplicateStrategy === 'skip' && existing.has(playlist.name) && !createdPlaylists[playlist.id]) {
          handlers.onLog({ kind: 'info', text: `↷ "${playlist.name}" ya existe — saltada` })
          continue
        }

        // ── Crear (o reutilizar si estamos resumiendo) ──
        let spotifyPlaylistId = createdPlaylists[playlist.id]
        let spotifyUrl: string | null = null
        if (!spotifyPlaylistId) {
          handlers.onLog({ kind: 'info', text: `＋ Creando playlist "${playlist.name}"…` })
          const created = await createPlaylist(user.id, playlist.name, makePublic)
          spotifyPlaylistId = created.id
          spotifyUrl = created.url
          createdPlaylists[playlist.id] = spotifyPlaylistId
          persist()
        }

        // ── Buscar y matchear cada track ──
        const tracks = playlist.trackIds.map((id) => library.tracks[id]).filter(Boolean)
        const matchedUris: string[] = []
        const pr: PlaylistResult = {
          playlistName: playlist.name,
          spotifyPlaylistId,
          spotifyUrl,
          total: tracks.length,
          migrated: 0,
          failed: 0,
        }

        for (const track of tracks) {
          if (cancelState.cancelled) {
            stats.phase = 'cancelled'
            handlers.onStats({ ...stats })
            persist()
            return
          }

          let uri: string | null = null
          try {
            uri = await findTrackUri(track)
          } catch {
            uri = null
          }
          await sleep(SEARCH_DELAY_MS)

          stats.tracksProcessed++
          if (uri) {
            matchedUris.push(uri)
            pr.migrated++
            stats.migrated++
            handlers.onLog({ kind: 'ok', text: `✓ ${track.artist} — ${track.name}` })
          } else {
            pr.failed++
            stats.failed++
            const reason: FailedTrack['reason'] = track.isLocal ? 'local_file' : 'no_match'
            result.failedTracks.push({ track, playlistName: playlist.name, reason })
            handlers.onLog({
              kind: track.isLocal ? 'local' : 'fail',
              text: `${track.isLocal ? '⚠' : '✗'} ${track.artist} — ${track.name}`,
            })
          }
          handlers.onStats({ ...stats })
        }

        // ── Agregar en lotes de 100 (orden original) ──
        if (matchedUris.length > 0) {
          await addTracksInBatches(spotifyPlaylistId, matchedUris)
        }

        result.playlists.push(pr)
        result.totalMigrated += pr.migrated
        result.totalFailed += pr.failed
        stats.playlistsDone = i + 1
        startIndex = i + 1
        persist()
        handlers.onStats({ ...stats })
      }

      stats.phase = 'done'
      stats.currentPlaylist = null
      handlers.onStats({ ...stats })
      storage.remove(KEYS.progress) // migración completa, limpiar checkpoint
      handlers.onDone(result)
    } catch (e) {
      persist() // guardar para poder retomar
      stats.phase = 'error'
      handlers.onStats({ ...stats })
      handlers.onError(e instanceof Error ? e.message : 'Error durante la migración')
    }
  })()

  return controller
}

/** ¿Hay un checkpoint de migración a medias para este usuario/selección? */
export function hasResumableProgress(userId: string, selectedIds: string[]): boolean {
  return loadProgress(userId, selectedIds) !== null
}

export function clearProgress(): void {
  storage.remove(KEYS.progress)
}
