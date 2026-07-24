import { useEffect, useRef } from 'react'
import { loadPrefs, subscribePrefs } from '../services/userPrefs'

interface RemoteAudioProps {
  stream: MediaStream | null
  muted?: boolean
  /** Per-user multiplier 0–2 (0%–200%). Combined with master output volume. */
  volumeMultiplier?: number
}

/** Fired when the main app view changes so paused sinks can retry autoplay. */
export const VOICE_AUDIO_NUDGE_EVENT = 'nepsis-voice-audio-nudge'

type AudioContextWithSink = AudioContext & {
  setSinkId?: (id: string) => Promise<void>
}

let sharedAudioContext: AudioContextWithSink | null = null

function getSharedAudioContext(): AudioContextWithSink {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext() as AudioContextWithSink
  }
  return sharedAudioContext
}

async function applyContextOutputDevice(ctx: AudioContextWithSink, deviceId: string): Promise<void> {
  if (!deviceId || typeof ctx.setSinkId !== 'function') return
  try {
    await ctx.setSinkId(deviceId)
  } catch {
    /* unsupported / permission */
  }
}

/**
 * Plays remote peer audio for the lifetime of a voice session.
 * Uses Web Audio GainNode so per-user volume can go above 100% (up to 200%).
 * Mount from VoiceProvider (or a body portal) — never inside VoiceView tiles.
 */
export function RemoteAudio({ stream, muted, volumeMultiplier = 1 }: RemoteAudioProps) {
  const gainRef = useRef<GainNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const connectedStreamKeyRef = useRef<string>('')
  const volumeMultiplierRef = useRef(volumeMultiplier)
  const mutedRef = useRef(!!muted)

  volumeMultiplierRef.current = volumeMultiplier
  mutedRef.current = !!muted

  const applyGain = () => {
    const gainNode = gainRef.current
    if (!gainNode) return
    const master = loadPrefs().voice.outputVolume
    const mult = Number.isFinite(volumeMultiplierRef.current) ? volumeMultiplierRef.current : 1
    const next = mutedRef.current ? 0 : Math.min(2, Math.max(0, master * mult))
    gainNode.gain.value = next
  }

  useEffect(() => {
    const ctx = getSharedAudioContext()
    const resume = () => {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    }

    const teardownGraph = () => {
      try {
        sourceRef.current?.disconnect()
      } catch {
        /* already disconnected */
      }
      sourceRef.current = null
      try {
        gainRef.current?.disconnect()
      } catch {
        /* already disconnected */
      }
      gainRef.current = null
      connectedStreamKeyRef.current = ''
    }

    const attach = () => {
      if (!stream) {
        teardownGraph()
        return
      }
      const audioTracks = stream.getAudioTracks().filter((t) => t.readyState !== 'ended')
      if (audioTracks.length === 0) {
        teardownGraph()
        return
      }
      const nextIds = audioTracks.map((t) => t.id).sort().join('|')
      if (connectedStreamKeyRef.current === nextIds && sourceRef.current && gainRef.current) {
        applyGain()
        resume()
        return
      }

      teardownGraph()
      const subset = new MediaStream(audioTracks)
      const source = ctx.createMediaStreamSource(subset)
      const gain = ctx.createGain()
      source.connect(gain)
      gain.connect(ctx.destination)
      sourceRef.current = source
      gainRef.current = gain
      connectedStreamKeyRef.current = nextIds
      applyGain()
      void applyContextOutputDevice(ctx, loadPrefs().voice.audioOutputId)
      resume()
    }

    attach()

    const onTrackChange = () => attach()
    const onUnmute = () => {
      resume()
      applyGain()
    }

    stream?.addEventListener('addtrack', onTrackChange)
    stream?.addEventListener('removetrack', onTrackChange)
    stream?.getAudioTracks().forEach((t) => t.addEventListener('unmute', onUnmute))

    window.addEventListener('pointerdown', resume, { passive: true })
    window.addEventListener('keydown', resume)
    window.addEventListener(VOICE_AUDIO_NUDGE_EVENT, resume)
    document.addEventListener('visibilitychange', resume)

    return () => {
      stream?.removeEventListener('addtrack', onTrackChange)
      stream?.removeEventListener('removetrack', onTrackChange)
      stream?.getAudioTracks().forEach((t) => t.removeEventListener('unmute', onUnmute))
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      window.removeEventListener(VOICE_AUDIO_NUDGE_EVENT, resume)
      document.removeEventListener('visibilitychange', resume)
      teardownGraph()
    }
  }, [stream])

  useEffect(() => {
    applyGain()
  }, [muted, volumeMultiplier])

  useEffect(() => {
    const apply = () => {
      applyGain()
      void applyContextOutputDevice(getSharedAudioContext(), loadPrefs().voice.audioOutputId)
    }
    apply()
    return subscribePrefs(apply)
  }, [])

  // Invisible placeholder keeps the component tree stable; playback is Web Audio.
  return (
    <audio
      aria-hidden
      style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: 0, top: 0 }}
    />
  )
}
