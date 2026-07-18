/**
 * WebRTC ICE config — STUN always; TURN when TURN_* env is set.
 * Clients prefer this endpoint so TURN credentials are not baked into the frontend build.
 */
import { Router } from 'express'

export const webrtcRouter = Router()

const DEFAULT_STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function buildIceServers() {
  const servers = [...DEFAULT_STUN]
  const urls = (process.env.TURN_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (urls.length > 0) {
    const turn = {
      urls: urls.length === 1 ? urls[0] : urls,
    }
    if (process.env.TURN_USERNAME) turn.username = process.env.TURN_USERNAME
    if (process.env.TURN_CREDENTIAL) turn.credential = process.env.TURN_CREDENTIAL
    servers.push(turn)
  }

  return servers
}

/** GET /api/webrtc/ice — public ICE server list for voice channels + DM calls */
webrtcRouter.get('/ice', (_req, res) => {
  const iceServers = buildIceServers()
  const hasTurn = iceServers.some((s) => {
    const u = s.urls
    const list = Array.isArray(u) ? u : [u]
    return list.some((url) => String(url).startsWith('turn'))
  })
  res.json({ iceServers, hasTurn })
})
