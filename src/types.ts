// ── Modelo de datos de Apple Music (parseado del XML) ──

export interface AppleTrack {
  /** "Track ID" del XML de Apple Music */
  id: string
  name: string
  artist: string
  album: string
  /** true si es un archivo local sin URL de tienda → no existe en Spotify */
  isLocal: boolean
}

export interface ApplePlaylist {
  /** "Playlist Persistent ID" (fallback a "Playlist ID") */
  id: string
  name: string
  /** IDs de tracks en el orden original de la playlist */
  trackIds: string[]
  /** true si es una smart playlist (tiene "Smart Info") */
  isSmart: boolean
}

export interface ParsedLibrary {
  /** tracks indexados por Track ID */
  tracks: Record<string, AppleTrack>
  /** solo playlists migrables (no smart, no vacías, no la biblioteca general) */
  playlists: ApplePlaylist[]
}

// ── Spotify ──

export interface SpotifyTokens {
  access_token: string
  refresh_token: string
  /** epoch en ms en el que expira el access_token */
  expires_at: number
}

export interface SpotifyUser {
  id: string
  display_name: string | null
  email?: string
}

// ── Migración ──

export type FailReason = 'no_match' | 'local_file' | 'error'

export interface FailedTrack {
  track: AppleTrack
  playlistName: string
  reason: FailReason
}

export interface PlaylistResult {
  playlistName: string
  spotifyPlaylistId: string | null
  spotifyUrl: string | null
  total: number
  migrated: number
  failed: number
}

export interface MigrationResult {
  playlists: PlaylistResult[]
  failedTracks: FailedTrack[]
  totalTracks: number
  totalMigrated: number
  totalFailed: number
}

// ── Wizard ──

export type StageId = 1 | 2 | 3 | 4 | 5

export interface StageMeta {
  id: StageId
  label: string
  short: string
}
