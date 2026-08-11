import type { SpotifyTokens, SpotifyUser } from '../types'
import { storage, KEYS } from './storage'

// ── Config ──

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined

const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
export const API_BASE = 'https://api.spotify.com/v1'

// Scopes mínimos: crear/editar playlists + leer nombre y email para el saludo.
const SCOPES = [
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-private', // leer playlists existentes para la opción "saltar duplicados"
  'user-read-private',
  'user-read-email',
]

/**
 * El redirect vuelve a la raíz de la app (sin router). Detectamos `?code=`
 * al cargar. Esta URL exacta debe estar registrada en Spotify Developers.
 * En local usar 127.0.0.1 (Spotify ya no acepta `localhost`).
 */
export function getRedirectUri(): string {
  return window.location.origin + import.meta.env.BASE_URL
}

export function hasClientId(): boolean {
  return typeof CLIENT_ID === 'string' && CLIENT_ID.length > 0
}

// ── PKCE ──

function base64UrlEncode(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64))
  return base64UrlEncode(bytes)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Construye la URL de autorización, guarda el verifier + state en localStorage
 * y devuelve la URL a la que redirigir al usuario.
 */
export async function buildAuthUrl(): Promise<string> {
  if (!CLIENT_ID) throw new Error('Falta VITE_SPOTIFY_CLIENT_ID')

  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)))

  storage.write(KEYS.pkceVerifier, { verifier, state })

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES.join(' '),
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

// ── Intercambio y refresh de tokens ──

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

function persistTokens(res: TokenResponse, prevRefresh?: string): SpotifyTokens {
  const tokens: SpotifyTokens = {
    access_token: res.access_token,
    // Spotify no siempre devuelve un refresh_token nuevo al refrescar.
    refresh_token: res.refresh_token ?? prevRefresh ?? '',
    expires_at: Date.now() + res.expires_in * 1000,
  }
  storage.write(KEYS.tokens, tokens)
  return tokens
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokens> {
  if (!CLIENT_ID) throw new Error('Falta VITE_SPOTIFY_CLIENT_ID')
  const stored = storage.read<{ verifier: string; state: string }>(KEYS.pkceVerifier)
  if (!stored?.verifier) throw new Error('No se encontró el code verifier de PKCE')

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: stored.verifier,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Error al obtener tokens: ${res.status} ${detail}`)
  }
  const json = (await res.json()) as TokenResponse
  storage.remove(KEYS.pkceVerifier)
  return persistTokens(json)
}

export async function refreshTokens(): Promise<SpotifyTokens> {
  if (!CLIENT_ID) throw new Error('Falta VITE_SPOTIFY_CLIENT_ID')
  const current = storage.read<SpotifyTokens>(KEYS.tokens)
  if (!current?.refresh_token) throw new Error('No hay refresh token disponible')

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: current.refresh_token,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    // refresh inválido → forzar re-login
    storage.remove(KEYS.tokens)
    throw new Error(`Error al refrescar el token: ${res.status}`)
  }
  const json = (await res.json()) as TokenResponse
  return persistTokens(json, current.refresh_token)
}

// ── Estado de sesión ──

export function getStoredTokens(): SpotifyTokens | null {
  return storage.read<SpotifyTokens>(KEYS.tokens)
}

export function isConnected(): boolean {
  const t = getStoredTokens()
  return !!t?.access_token && !!t?.refresh_token
}

export function logout(): void {
  storage.remove(KEYS.tokens)
  storage.remove(KEYS.user)
  storage.remove(KEYS.pkceVerifier)
}

/** Devuelve un access_token válido, refrescando si expiró (o está por expirar). */
export async function getValidAccessToken(): Promise<string> {
  let tokens = getStoredTokens()
  if (!tokens) throw new Error('No conectado a Spotify')
  // margen de 60s para evitar carreras con la expiración
  if (Date.now() >= tokens.expires_at - 60_000) {
    tokens = await refreshTokens()
  }
  return tokens.access_token
}

// ── Cliente de API con auto-refresh y manejo de 429 ──

export interface ApiOptions extends RequestInit {
  /** reintentos restantes ante 429 (rate limit) */
  retries?: number
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { retries = 3, headers, ...rest } = opts
  const token = await getValidAccessToken()
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`

  const res = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  // Rate limit: respetar Retry-After
  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '1')
    await sleep((retryAfter + 0.2) * 1000)
    return api<T>(path, { ...opts, retries: retries - 1 })
  }

  // Token expirado en pleno vuelo → refrescar una vez y reintentar
  if (res.status === 401 && retries > 0) {
    await refreshTokens()
    return api<T>(path, { ...opts, retries: retries - 1 })
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Spotify API ${res.status} en ${path}: ${detail}`)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Endpoints usados por la app ──

export async function getCurrentUser(): Promise<SpotifyUser> {
  const u = await api<{ id: string; display_name: string | null; email?: string }>('/me')
  const user: SpotifyUser = { id: u.id, display_name: u.display_name, email: u.email }
  storage.write(KEYS.user, user)
  return user
}

export function getStoredUser(): SpotifyUser | null {
  return storage.read<SpotifyUser>(KEYS.user)
}

/**
 * Procesa el redirect de OAuth si la URL tiene `?code=`. Devuelve los tokens
 * si el intercambio fue exitoso, o null si no había callback que procesar.
 * Limpia los query params de la URL en cualquier caso.
 */
export async function handleAuthCallback(): Promise<SpotifyTokens | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const returnedState = params.get('state')
  const error = params.get('error')

  if (!code && !error) return null

  // Limpiar la URL (dejar solo el path base) sin recargar
  const cleanUrl = window.location.origin + window.location.pathname
  window.history.replaceState({}, '', cleanUrl)

  if (error) throw new Error(`Autorización rechazada: ${error}`)

  const stored = storage.read<{ verifier: string; state: string }>(KEYS.pkceVerifier)
  if (stored?.state && returnedState && stored.state !== returnedState) {
    throw new Error('El parámetro state no coincide (posible CSRF)')
  }

  return exchangeCodeForTokens(code!)
}
