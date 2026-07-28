// Helpers tipados de localStorage con un namespace propio, para no pisar
// otras claves del dominio y poder limpiar todo de una sola vez.

const NS = 'mcas' // "me cambio a spotify"

export const KEYS = {
  tokens: `${NS}:tokens`,
  user: `${NS}:user`,
  pkceVerifier: `${NS}:pkce_verifier`,
  selection: `${NS}:selection`,
  progress: `${NS}:progress`,
} as const

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage lleno o deshabilitado — degradamos silenciosamente
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* noop */
  }
}

export const storage = { read, write, remove }

/** Limpia todo el estado de la app (usado por "Migrar otra biblioteca"). */
export function clearAll(): void {
  Object.values(KEYS).forEach(remove)
}
