/**
 * Discord-leaning media quality: Opus preference, high bitrates,
 * and capture constraints for voice / camera / screen share.
 */

/** Voice chat target — Discord Go-Live / High Quality voice is ~64–128 kbps Opus */
export const AUDIO_MAX_BITRATE = 128_000
/** Camera — ~2.5 Mbps for 720p30 */
export const CAMERA_MAX_BITRATE = 2_500_000
/** Screen share — ~4 Mbps for crisp 1080p30 */
export const SCREEN_MAX_BITRATE = 4_000_000

/** Base high-quality mic constraints (merge with device prefs). */
export function highQualityAudioBase(): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 },
    ...({
      googEchoCancellation: true,
      googNoiseSuppression: true,
      googAutoGainControl: true,
      googHighpassFilter: true,
      googTypingNoiseDetection: true,
    } as MediaTrackConstraints),
  }
}

export const HIGH_QUALITY_CAMERA: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 60 },
  facingMode: 'user',
}

export const HIGH_QUALITY_SCREEN: MediaTrackConstraints = {
  width: { ideal: 1920, max: 2560 },
  height: { ideal: 1080, max: 1440 },
  frameRate: { ideal: 30, max: 60 },
}

/** Prefer Opus for audio (and VP9/VP8/H264 order for video when available). */
export function preferHighQualityCodecs(pc: RTCPeerConnection): void {
  try {
    const audioCaps = RTCRtpSender.getCapabilities?.('audio')
    if (audioCaps?.codecs?.length) {
      const opus = audioCaps.codecs.filter((c) => /opus/i.test(c.mimeType))
      const rest = audioCaps.codecs.filter((c) => !/opus/i.test(c.mimeType))
      if (opus.length) {
        for (const t of pc.getTransceivers()) {
          if (t.sender.track?.kind === 'audio' || t.receiver.track?.kind === 'audio') {
            try {
              t.setCodecPreferences([...opus, ...rest])
            } catch {
              /* ignore */
            }
          }
        }
      }
    }

    const videoCaps = RTCRtpSender.getCapabilities?.('video')
    if (videoCaps?.codecs?.length) {
      const preferred = [
        ...videoCaps.codecs.filter((c) => /vp9/i.test(c.mimeType)),
        ...videoCaps.codecs.filter((c) => /vp8/i.test(c.mimeType)),
        ...videoCaps.codecs.filter((c) => /h264/i.test(c.mimeType)),
        ...videoCaps.codecs.filter((c) => !/vp9|vp8|h264|rtx|red|ulpfec|flexfec/i.test(c.mimeType)),
      ]
      const seen = new Set<string>()
      const ordered = preferred.filter((c) => {
        const key = `${c.mimeType}:${c.sdpFmtpLine ?? ''}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      if (ordered.length) {
        for (const t of pc.getTransceivers()) {
          if (t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video') {
            try {
              t.setCodecPreferences(ordered)
            } catch {
              /* ignore */
            }
          }
        }
      }
    }
  } catch {
    /* Capabilities / preferences unsupported */
  }
}

function isScreenTrack(track: MediaStreamTrack): boolean {
  if (track.kind !== 'video') return false
  if (track.contentHint === 'detail' || track.contentHint === 'text') return true
  const label = (track.label || '').toLowerCase()
  return label.includes('screen') || label.includes('window') || label.includes('display')
}

/** Raise encoding bitrates on a sender toward Discord-like quality. */
export async function applySenderQuality(sender: RTCRtpSender): Promise<void> {
  const track = sender.track
  if (!track) return
  try {
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}]
    }
    const enc = params.encodings[0]
    if (track.kind === 'audio') {
      enc.maxBitrate = AUDIO_MAX_BITRATE
    } else if (track.kind === 'video') {
      const screen = isScreenTrack(track)
      enc.maxBitrate = screen ? SCREEN_MAX_BITRATE : CAMERA_MAX_BITRATE
      enc.maxFramerate = 30
      enc.scaleResolutionDownBy = 1
    }
    await sender.setParameters(params)
  } catch {
    /* setParameters can fail before negotiation */
  }
}

export async function applyPeerConnectionQuality(pc: RTCPeerConnection): Promise<void> {
  preferHighQualityCodecs(pc)
  await Promise.all(pc.getSenders().map((s) => applySenderQuality(s)))
}

/** Hint browser encoder for motion (camera) vs detail (screen). */
export function applyTrackContentHints(track: MediaStreamTrack, kind: 'camera' | 'screen' | 'audio'): void {
  try {
    if (kind === 'audio' && 'contentHint' in track) {
      ;(track as MediaStreamTrack & { contentHint: string }).contentHint = 'speech'
    }
    if (kind === 'camera' && 'contentHint' in track) {
      ;(track as MediaStreamTrack & { contentHint: string }).contentHint = 'motion'
    }
    if (kind === 'screen' && 'contentHint' in track) {
      ;(track as MediaStreamTrack & { contentHint: string }).contentHint = 'detail'
    }
  } catch {
    /* ignore */
  }
}
