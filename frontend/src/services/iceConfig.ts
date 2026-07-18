/**
 * Shared ICE config for P2P voice channels and DM calls.
 * Always includes public STUN. TURN is optional via:
 *   1) GET /api/webrtc/ice (backend TURN_* env) — preferred
 *   2) VITE_TURN_URLS / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL — fallback
 */

const DEFAULT_STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function turnFromViteEnv(): RTCIceServer[] {
  const raw = import.meta.env.VITE_TURN_URLS as string | undefined
  const urls = raw
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!urls?.length) return []

  const server: RTCIceServer = {
    urls: urls.length === 1 ? urls[0] : urls,
  }
  const username = import.meta.env.VITE_TURN_USERNAME as string | undefined
  const credential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined
  if (username) server.username = username
  if (credential) server.credential = credential
  return [server]
}

function envIceServers(): RTCIceServer[] {
  return [...DEFAULT_STUN, ...turnFromViteEnv()]
}

let cached: RTCIceServer[] | null = null
let inflight: Promise<RTCIceServer[]> | null = null

/** Sync snapshot — cached API result, else Vite env + STUN. */
export function getIceServers(): RTCIceServer[] {
  return cached ?? envIceServers()
}

/**
 * Load ICE servers (STUN + optional TURN). Safe to call often; result is cached.
 * Prefers backend `/api/webrtc/ice` so TURN creds can stay on the server.
 */
export async function ensureIceServers(): Promise<RTCIceServer[]> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = (async () => {
    const fallback = envIceServers()
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
      const res = await fetch(`${base}/webrtc/ice`)
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: RTCIceServer[] }
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          cached = data.iceServers
          return cached
        }
      }
    } catch {
      // offline / API down — use env fallback
    }
    cached = fallback
    return cached
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/** Clear cache (e.g. after changing TURN env in tests). */
export function resetIceServersCache() {
  cached = null
  inflight = null
}
