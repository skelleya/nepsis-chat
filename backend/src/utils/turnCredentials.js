/**
 * Time-limited TURN credentials (coturn / Open Relay static-auth REST style).
 * username = `${expiryUnix}:{user}`
 * credential = base64(HMAC-SHA1(secret, username))
 */
import crypto from 'crypto'

/** Open Relay Project free static-auth TURN (20GB/mo). Overridable via env. */
export const OPEN_RELAY_HOST = 'staticauth.openrelay.metered.ca'
export const OPEN_RELAY_SECRET = 'openrelayprojectsecret'

export function mintTurnCredential(secret, userLabel = 'nepsis', ttlSeconds = 24 * 3600) {
  const expiry = Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds)
  const safeUser = String(userLabel || 'nepsis').replace(/:/g, '-')
  const username = `${expiry}:${safeUser}`
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64')
  return { username, credential, ttl: ttlSeconds }
}

/** ICE server entries for Open Relay (UDP + TCP + TURNS). */
export function openRelayIceServers(userLabel = 'nepsis') {
  const { username, credential } = mintTurnCredential(OPEN_RELAY_SECRET, userLabel)
  const host = process.env.TURN_FALLBACK_HOST || OPEN_RELAY_HOST
  return [
    {
      urls: [
        `turn:${host}:80`,
        `turn:${host}:443`,
        `turn:${host}:443?transport=tcp`,
        `turns:${host}:443?transport=tcp`,
      ],
      username,
      credential,
    },
  ]
}
