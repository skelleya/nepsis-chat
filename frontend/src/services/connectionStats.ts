export type PingSource = 'webrtc' | 'server' | 'none'

/** How media is actually flowing for the selected ICE pair. */
export type IcePathType = 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown'

export interface PingReading {
  ms: number | null
  source: PingSource
  /** Worst (highest latency) peer path type when source is webrtc. */
  path?: IcePathType
}

const PATH_RANK: Record<IcePathType, number> = {
  host: 0,
  srflx: 1,
  prflx: 2,
  relay: 3,
  unknown: 4,
}

function asIcePathType(value: unknown): IcePathType {
  if (value === 'host' || value === 'srflx' || value === 'prflx' || value === 'relay') return value
  return 'unknown'
}

/** Prefer the “heavier” path when aggregating mesh peers (relay > reflexive > host). */
export function worseIcePath(a: IcePathType | undefined, b: IcePathType | undefined): IcePathType {
  const left = a ?? 'unknown'
  const right = b ?? 'unknown'
  return PATH_RANK[right] > PATH_RANK[left] ? right : left
}

export function describeIcePath(path: IcePathType | undefined): string {
  switch (path) {
    case 'host':
      return 'direct (same network)'
    case 'srflx':
      return 'direct (via STUN)'
    case 'prflx':
      return 'direct (peer reflexive)'
    case 'relay':
      return 'relayed (TURN — higher ping)'
    default:
      return 'path unknown'
  }
}

function pathFromSelectedPair(
  stats: RTCStatsReport,
  pairId: string | null
): IcePathType {
  if (!pairId) return 'unknown'
  const pair = stats.get(pairId) as
    | { localCandidateId?: string; remoteCandidateId?: string }
    | undefined
  if (!pair?.localCandidateId) return 'unknown'
  const local = stats.get(pair.localCandidateId) as { candidateType?: string } | undefined
  // Local candidate type is what usually indicates host vs relay on our side.
  return asIcePathType(local?.candidateType)
}

/** Read the active media-path RTT from one peer connection. */
export async function readConnectionRtt(pc: RTCPeerConnection): Promise<PingReading> {
  try {
    const stats = await pc.getStats()
    let transportSelectedPairId: string | null = null
    let legacySelectedPairId: string | null = null
    let nominatedPairId: string | null = null
    let succeededPairId: string | null = null
    let legacySelectedRtt: number | null = null
    let nominatedRtt: number | null = null
    let succeededRtt: number | null = null
    const mediaRtts: number[] = []

    for (const report of stats.values()) {
      if (report.type === 'transport') {
        const transport = report as { selectedCandidatePairId?: string }
        if (transport.selectedCandidatePairId) {
          transportSelectedPairId = transport.selectedCandidatePairId
        }
      } else if (report.type === 'candidate-pair') {
        const pair = report as {
          id?: string
          state?: string
          selected?: boolean
          nominated?: boolean
          currentRoundTripTime?: number
        }
        if (!Number.isFinite(pair.currentRoundTripTime)) continue
        const ms = Math.round((pair.currentRoundTripTime as number) * 1000)
        if (pair.selected) {
          legacySelectedRtt = ms
          legacySelectedPairId = pair.id ?? null
        } else if (pair.nominated && pair.state === 'succeeded' && nominatedRtt === null) {
          nominatedRtt = ms
          nominatedPairId = pair.id ?? null
        } else if (pair.state === 'succeeded' && succeededRtt === null) {
          succeededRtt = ms
          succeededPairId = pair.id ?? null
        }
      } else if (report.type === 'remote-inbound-rtp') {
        const media = report as { kind?: string; roundTripTime?: number }
        if (
          (media.kind === 'audio' || media.kind === 'video') &&
          Number.isFinite(media.roundTripTime)
        ) {
          mediaRtts.push(Math.round((media.roundTripTime as number) * 1000))
        }
      }
    }

    if (transportSelectedPairId) {
      const selected = stats.get(transportSelectedPairId) as
        | { currentRoundTripTime?: number }
        | undefined
      if (Number.isFinite(selected?.currentRoundTripTime)) {
        return {
          ms: Math.round((selected?.currentRoundTripTime as number) * 1000),
          source: 'webrtc',
          path: pathFromSelectedPair(stats, transportSelectedPairId),
        }
      }
    }

    const ms = legacySelectedRtt
      ?? (mediaRtts.length ? Math.max(...mediaRtts) : null)
      ?? nominatedRtt
      ?? succeededRtt
    const pairId = legacySelectedPairId ?? nominatedPairId ?? succeededPairId
    return ms !== null
      ? { ms, source: 'webrtc', path: pathFromSelectedPair(stats, pairId) }
      : { ms: null, source: 'none' }
  } catch {
    return { ms: null, source: 'none' }
  }
}

/** Conservative mesh reading: display the slowest active peer path. */
export async function readAggregateRtt(
  peerConnections: RTCPeerConnection[]
): Promise<PingReading> {
  const readings = await Promise.all(peerConnections.map(readConnectionRtt))
  const active = readings.filter((reading) => reading.ms !== null)
  if (!active.length) return { ms: null, source: 'none' }

  const ms = Math.max(...active.map((reading) => reading.ms as number))
  // Path of the slowest peer (ties: prefer heavier ICE type so TURN is visible).
  let path: IcePathType = 'unknown'
  let bestMs = -1
  for (const reading of active) {
    const value = reading.ms as number
    if (value > bestMs) {
      bestMs = value
      path = reading.path ?? 'unknown'
    } else if (value === bestMs) {
      path = worseIcePath(path, reading.path)
    }
  }
  return { ms, source: 'webrtc', path }
}

export function smoothPing(previous: number | null, next: number, alpha = 0.35): number {
  return previous === null ? next : Math.round(previous * (1 - alpha) + next * alpha)
}
