export type PingSource = 'webrtc' | 'server' | 'none'

export interface PingReading {
  ms: number | null
  source: PingSource
}

/** Read the active media-path RTT from one peer connection. */
export async function readConnectionRtt(pc: RTCPeerConnection): Promise<PingReading> {
  try {
    const stats = await pc.getStats()
    const activePairs: number[] = []
    const succeededPairs: number[] = []
    const mediaRtts: number[] = []

    for (const report of stats.values()) {
      if (report.type === 'candidate-pair') {
        const pair = report as {
          state?: string
          selected?: boolean
          nominated?: boolean
          currentRoundTripTime?: number
        }
        if (!Number.isFinite(pair.currentRoundTripTime)) continue
        const ms = Math.round((pair.currentRoundTripTime as number) * 1000)
        if (pair.selected || pair.nominated) activePairs.push(ms)
        else if (pair.state === 'succeeded') succeededPairs.push(ms)
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

    const candidates = activePairs.length
      ? activePairs
      : mediaRtts.length
        ? mediaRtts
        : succeededPairs
    return candidates.length
      ? { ms: Math.max(...candidates), source: 'webrtc' }
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
