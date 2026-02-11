/**
 * Client-side cache for server layout (channels + categories).
 * Enables instant preview when switching servers; background refresh keeps cache fresh.
 */

const CACHE_KEY = 'nepsis_layout_cache'

export interface CachedChannel {
  id: string
  server_id: string
  name: string
  type: 'text' | 'voice'
  order: number
  category_id?: string | null
}

export interface CachedCategory {
  id: string
  server_id: string
  name: string
  order: number
}

export interface CachedLayout {
  channels: CachedChannel[]
  categories: CachedCategory[]
  updatedAt: number
}

type CacheStore = Record<string, CachedLayout>

function loadStore(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveStore(store: CacheStore): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store))
  } catch {
    // Quota exceeded or private mode
  }
}

/**
 * Get cached layout for a server. Returns null if not cached.
 */
export function getCachedLayout(serverId: string): CachedLayout | null {
  const store = loadStore()
  const entry = store[serverId]
  if (!entry?.channels) return null
  return entry
}

/**
 * Save layout to cache for a server.
 */
export function saveLayoutToCache(
  serverId: string,
  channels: CachedChannel[],
  categories: CachedCategory[]
): void {
  const store = loadStore()
  store[serverId] = {
    channels,
    categories,
    updatedAt: Date.now(),
  }
  saveStore(store)
}

/**
 * Remove a server from cache (e.g. when leaving/deleting server).
 */
export function invalidateLayoutCache(serverId: string): void {
  const store = loadStore()
  delete store[serverId]
  saveStore(store)
}

/**
 * Clear entire layout cache (e.g. on logout).
 */
export function clearLayoutCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}
