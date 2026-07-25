/**
 * WebRTC ICE config — STUN always; TURN when TURN_* env is set,
 * otherwise free Open Relay static-auth fallback so mesh voice works
 * across strict NATs without manual coturn setup.
 */
import { Router } from 'express'
import { openRelayIceServers } from '../utils/turnCredentials.js'

export const webrtcRouter = Router()

const DEFAULT_STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function customTurnFromEnv() {
  const urls = (process.env.TURN_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (urls.length === 0) return null

  const turn = {
    urls: urls.length === 1 ? urls[0] : urls,
  }
  if (process.env.TURN_USERNAME) turn.username = process.env.TURN_USERNAME
  if (process.env.TURN_CREDENTIAL) turn.credential = process.env.TURN_CREDENTIAL
  return turn
}

function buildIceServers() {
  const servers = [...DEFAULT_STUN]
  const custom = customTurnFromEnv()
  if (custom) {
    servers.push(custom)
    return { iceServers: servers, hasTurn: true, turnSource: 'env' }
  }

  // Default free TURN so friends on different networks can still connect.
  // Disable with TURN_FALLBACK=0 if you only want STUN / custom TURN_*.
  if (process.env.TURN_FALLBACK === '0' || process.env.TURN_FALLBACK === 'false') {
    return { iceServers: servers, hasTurn: false, turnSource: 'none' }
  }

  servers.push(...openRelayIceServers('nepsis'))
  return { iceServers: servers, hasTurn: true, turnSource: 'openrelay' }
}

function iceHasTurn(iceServers) {
  return iceServers.some((s) => {
    const u = s.urls
    const list = Array.isArray(u) ? u : [u]
    return list.some((url) => String(url).startsWith('turn'))
  })
}

/** GET /api/webrtc/ice — public ICE server list for voice channels + DM calls */
webrtcRouter.get('/ice', (_req, res) => {
  const { iceServers, hasTurn, turnSource } = buildIceServers()
  res.json({
    iceServers,
    hasTurn: hasTurn && iceHasTurn(iceServers),
    turnSource,
  })
})
