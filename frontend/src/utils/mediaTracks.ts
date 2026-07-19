/** Detect if a video track is from screen share (getDisplayMedia) vs camera (getUserMedia).
 * Prefer explicit signaling (`screenShareUserIds`) over heuristics — remote WebRTC tracks
 * often lack displaySurface/label, and contentHint must NOT be used (cameras were wrongly
 * stamped as 'detail' and then treated as screens).
 */
export function isScreenShareTrack(track: MediaStreamTrack): boolean {
  try {
    const settings = track.getSettings?.() as {
      displaySurface?: string
      width?: number
      height?: number
    }
    const surface = settings?.displaySurface
    if (surface === 'monitor' || surface === 'window' || surface === 'browser') return true
    const label = (track.label || '').toLowerCase()
    if (/screen|display|window|monitor|capture|tab/.test(label)) return true
    return false
  } catch {
    return false
  }
}

/** Cache derived MediaStreams so React effects don't thrash srcObject every render. */
const subsetCache = new WeakMap<MediaStream, Map<string, MediaStream>>()

function getOrCreateSubset(source: MediaStream, tracks: MediaStreamTrack[]): MediaStream {
  const key = tracks.map((t) => t.id).sort().join('|')
  let map = subsetCache.get(source)
  if (!map) {
    map = new Map()
    subsetCache.set(source, map)
  }
  const existing = map.get(key)
  if (existing) {
    const live = existing.getVideoTracks().filter((t) => t.readyState !== 'ended')
    if (live.length === tracks.length && tracks.every((t) => live.some((l) => l.id === t.id))) {
      return existing
    }
  }
  const out = new MediaStream()
  tracks.forEach((t) => out.addTrack(t))
  map.set(key, out)
  return out
}

export type MediaTrackOpts = {
  /** True when signaling says this peer is screen-sharing (authoritative). */
  knownScreenSharing?: boolean
}

/** Extract screen-share-only stream from a peer/local MediaStream */
export function getScreenShareStream(
  stream: MediaStream | null,
  opts?: MediaTrackOpts
): MediaStream | null {
  if (!stream) return null
  const videoTracks = stream.getVideoTracks().filter((t) => t.readyState !== 'ended')
  if (videoTracks.length === 0) return null

  let screenTracks = videoTracks.filter(isScreenShareTrack)

  // Explicit screen-share signal: if metadata is missing, use track count heuristics.
  if (screenTracks.length === 0 && opts?.knownScreenSharing) {
    if (videoTracks.length === 1) {
      screenTracks = [videoTracks[0]]
    } else if (videoTracks.length >= 2) {
      const withWidth = videoTracks.map((t) => ({
        t,
        w: (t.getSettings?.() as { width?: number })?.width ?? 0,
      }))
      const byWidth = [...withWidth].sort((a, b) => b.w - a.w)
      screenTracks = [byWidth[0].t]
    }
  }

  // Without a signal, only trust explicit metadata — never treat a lone large
  // camera (1080p) as a screen share.
  if (screenTracks.length === 0 && videoTracks.length >= 2) {
    const withWidth = videoTracks.map((t) => ({
      t,
      w: (t.getSettings?.() as { width?: number })?.width ?? 0,
    }))
    const byWidth = [...withWidth].sort((a, b) => b.w - a.w)
    // Only if one track is clearly larger and labeled/hinted as screen
    if (byWidth[0].w > byWidth[1].w + 200 && isScreenShareTrack(byWidth[0].t)) {
      screenTracks = [byWidth[0].t]
    }
  }

  if (screenTracks.length === 0) return null
  return getOrCreateSubset(stream, screenTracks)
}

/** Extract camera-only stream (exclude screen share tracks) */
export function getCameraStream(
  stream: MediaStream | null,
  opts?: MediaTrackOpts
): MediaStream | null {
  if (!stream) return null
  const videoTracks = stream.getVideoTracks().filter((t) => t.readyState !== 'ended')
  if (videoTracks.length === 0) return null

  const screen = getScreenShareStream(stream, opts)
  const screenIds = new Set(screen?.getVideoTracks().map((t) => t.id) ?? [])
  const cameraTracks = videoTracks.filter((t) => !screenIds.has(t.id) && !isScreenShareTrack(t))

  // Not screen-sharing: all video tracks are camera
  if (!opts?.knownScreenSharing && !screen) {
    return getOrCreateSubset(stream, videoTracks)
  }

  if (cameraTracks.length === 0) return null
  return getOrCreateSubset(stream, cameraTracks)
}

/** Prefer camera when both exist; else any non-screen video for participant tiles */
export function getParticipantVideoStream(
  stream: MediaStream | null,
  opts?: MediaTrackOpts
): MediaStream | null {
  if (!stream) return null
  const cam = getCameraStream(stream, opts)
  if (cam && cam.getVideoTracks().length > 0) return cam
  // If the only video is a screen share, do not show it in the face tile
  if (getScreenShareStream(stream, opts)) return null
  const videoTracks = stream.getVideoTracks().filter((t) => t.readyState !== 'ended')
  if (videoTracks.length === 0) return null
  return getOrCreateSubset(stream, videoTracks)
}

/** Track exists and is live. Do NOT require !muted — WebRTC video often stays muted until RTP. */
export function hasLiveVideo(stream: MediaStream | null): boolean {
  if (!stream) return false
  return stream.getVideoTracks().some((t) => t.readyState === 'live')
}
