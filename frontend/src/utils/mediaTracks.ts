/** Detect if a video track is from screen share (getDisplayMedia) vs camera (getUserMedia) */
export function isScreenShareTrack(track: MediaStreamTrack): boolean {
  try {
    const settings = track.getSettings?.() as {
      displaySurface?: string
      width?: number
      height?: number
    }
    const surface = settings?.displaySurface
    if (surface === 'monitor' || surface === 'window' || surface === 'browser') return true
    // Remote tracks often lack displaySurface; use label (Chrome/Firefox set "screen" etc.)
    const label = (track.label || '').toLowerCase()
    if (/screen|display|window|monitor|capture|tab/.test(label)) return true
    // contentHint is set locally for screen; some browsers expose it remotely
    if ((track as MediaStreamTrack & { contentHint?: string }).contentHint === 'detail') return true
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

/** Extract screen-share-only stream from a peer/local MediaStream */
export function getScreenShareStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const videoTracks = stream.getVideoTracks().filter((t) => t.readyState !== 'ended')
  if (videoTracks.length === 0) return null

  let screenTracks = videoTracks.filter(isScreenShareTrack)

  // Fallback when remote metadata is missing:
  // - 2+ videos → largest dimension is usually the screen
  // - 1 video with large resolution (≥1280) and no camera label → treat as screen
  if (screenTracks.length === 0 && videoTracks.length >= 2) {
    const withWidth = videoTracks.map((t) => ({
      t,
      w: (t.getSettings?.() as { width?: number })?.width ?? 0,
    }))
    const byWidth = [...withWidth].sort((a, b) => b.w - a.w)
    if (byWidth[0].w > 1280) screenTracks = [byWidth[0].t]
  }
  if (screenTracks.length === 0 && videoTracks.length === 1) {
    const t = videoTracks[0]
    const w = (t.getSettings?.() as { width?: number })?.width ?? 0
    const label = (t.label || '').toLowerCase()
    const looksLikeCamera = /camera|webcam|facetime|integrated/.test(label)
    if (!looksLikeCamera && w >= 1280) screenTracks = [t]
  }

  if (screenTracks.length === 0) return null
  return getOrCreateSubset(stream, screenTracks)
}

/** Extract camera-only stream (exclude screen share tracks) */
export function getCameraStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const cameraTracks = stream.getVideoTracks().filter((t) => !isScreenShareTrack(t) && t.readyState !== 'ended')
  if (cameraTracks.length === 0) return null
  return getOrCreateSubset(stream, cameraTracks)
}

/** Prefer camera when both exist; else any video for participant tiles */
export function getParticipantVideoStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const cam = getCameraStream(stream)
  if (cam && cam.getVideoTracks().length > 0) return cam
  // If the only video is a screen share, do not show it in the face tile
  if (getScreenShareStream(stream)) return null
  const videoTracks = stream.getVideoTracks().filter((t) => t.readyState !== 'ended')
  if (videoTracks.length === 0) return null
  return getOrCreateSubset(stream, videoTracks)
}

/** True when a video track is live and not muted (avoids mounting black tiles mid-renegotiation). */
export function hasLiveVideo(stream: MediaStream | null): boolean {
  if (!stream) return false
  return stream.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted)
}
