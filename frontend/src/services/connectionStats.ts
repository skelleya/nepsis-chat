export type PingSource = 'webrtc' | 'server' | 'none'

export interface PingReading {
  ms: number | null
  source: PingSource
}

/** Read the active media-path RTT from one peer connection. */
export async function readConnectionRtt(pc: RTCPeerConnection): Promise<PingReading> {
  try {
    const stats = await pc.getStats()
    let transportSelectedPairId: string | null = null
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
          state?: string
          selected?: boolean
          nominated?: boolean
          currentRoundTripTime?: number
        }
        if (!Number.isFinite(pair.currentRoundTripTime)) continue
        const ms = Math.round((pair.currentRoundTripTime as number) * 1000)
        if (pair.selected) legacySelectedRtt = ms
        else if (pair.nominated && pair.state === 'succeeded' && nominatedRtt === null) nominatedRtt = ms
        else if (pair.state === 'succeeded' && succeededRtt === null) succeededRtt = ms
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
        }
      }
    }
    const ms = legacySelectedRtt
      ?? (mediaRtts.length ? Math.max(...mediaRtts) : null)
      ?? nominatedRtt
      ?? succeededRtt
    return ms !== null ? { ms, source: 'webrtc' } : { ms: null, source: 'none' }
  } catch {
    return { ms: null, source: 'none' }
  }
}

/** Conservative mesh reading: display the slowest active peer path. */
export async function readAggregateRtt(
  peerConnections: RTCPeerConnection[]
): Promise<PingReading> {
  const readings = await Promise.all(peerConnections.map(readConnectionRtt))
  const values = readings
    .map((reading) => reading.ms)
    .filter((value): value is number => value !== null)
  return values.length
    ? { ms: Math.max(...values), source: 'webrtc' }
    : { ms: null, source: 'none' }
}

export function smoothPing(previous: number | null, next: number, alpha = 0.35): number {
  return previous === null ? next : Math.round(previous * (1 - alpha) + next * alpha)
}
