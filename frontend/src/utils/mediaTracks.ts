/** Detect if a video track is from screen share (getDisplayMedia) vs camera (getUserMedia) */
export function isScreenShareTrack(track: MediaStreamTrack): boolean {
  try {
    const settings = track.getSettings?.()
    const surface = (settings as { displaySurface?: string })?.displaySurface
    if (surface === 'monitor' || surface === 'window' || surface === 'browser') return true
    // Remote tracks often lack displaySurface; use label (Chrome/Firefox set "screen" etc.)
    const label = (track.label || '').toLowerCase()
    if (/screen|display|window|monitor|capture/.test(label)) return true
    return false
  } catch {
    return false
  }
}

/** Extract screen-share-only stream from a peer/local MediaStream */
export function getScreenShareStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const videoTracks = stream.getVideoTracks()
  let screenTracks = videoTracks.filter(isScreenShareTrack)
  // Fallback: when 2+ video tracks and none match (remote displaySurface/label often missing),
  // treat the larger-dimension track as screen share (screens are usually 1920x1080+)
  if (screenTracks.length === 0 && videoTracks.length >= 2) {
    const withWidth = videoTracks.map((t) => ({ t, w: (t.getSettings?.() as { width?: number })?.width ?? 0 }))
    const byWidth = [...withWidth].sort((a, b) => b.w - a.w)
    if (byWidth[0].w > 1280) screenTracks = [byWidth[0].t]
  }
  if (screenTracks.length === 0) return null
  const out = new MediaStream()
  screenTracks.forEach((t) => out.addTrack(t))
  return out
}

/** Extract camera-only stream (exclude screen share tracks) */
export function getCameraStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const cameraTracks = stream.getVideoTracks().filter((t) => !isScreenShareTrack(t))
  if (cameraTracks.length === 0) return null
  const out = new MediaStream()
  cameraTracks.forEach((t) => out.addTrack(t))
  return out
}

/** Prefer camera when both exist; else any video for participant tiles */
export function getParticipantVideoStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const cam = getCameraStream(stream)
  if (cam && cam.getVideoTracks().length > 0) return cam
  const videoTracks = stream.getVideoTracks()
  if (videoTracks.length === 0) return null
  const out = new MediaStream()
  videoTracks.forEach((t) => out.addTrack(t))
  return out
}
