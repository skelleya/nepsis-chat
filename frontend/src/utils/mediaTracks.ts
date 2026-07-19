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
  const out = new MediaStream()
  screenTracks.forEach((t) => out.addTrack(t))
  return out
}

/** Extract camera-only stream (exclude screen share tracks) */
export function getCameraStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const cameraTracks = stream.getVideoTracks().filter((t) => !isScreenShareTrack(t) && t.readyState !== 'ended')
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
  // If the only video is a screen share, do not show it in the face tile
  if (getScreenShareStream(stream)) return null
  const videoTracks = stream.getVideoTracks().filter((t) => t.readyState !== 'ended')
  if (videoTracks.length === 0) return null
  const out = new MediaStream()
  videoTracks.forEach((t) => out.addTrack(t))
  return out
}
