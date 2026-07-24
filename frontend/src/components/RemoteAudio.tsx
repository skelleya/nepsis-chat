import { useEffect, useRef } from 'react'
import { applyAudioOutputDevice, loadPrefs, subscribePrefs } from '../services/userPrefs'

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

/**
 * Plays remote peer audio for the lifetime of a voice session.
 * Uses an HTMLAudioElement (reliable WebRTC playback) plus a Web Audio GainNode
 * so per-user volume can go above 100%. Mount from VoiceProvider — never VoiceView.
 */
export function RemoteAudio({ stream, muted, volumeMultiplier = 1 }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const gainRef = useRef<GainNode | null>(null)
  const sourceReadyRef = useRef(false)
  const volumeMultiplierRef = useRef(volumeMultiplier)
  const mutedRef = useRef(!!muted)

  volumeMultiplierRef.current = volumeMultiplier
  mutedRef.current = !!muted

  const applyGain = () => {
    const audio = audioRef.current
    const gainNode = gainRef.current
    const master = loadPrefs().voice.outputVolume
    const mult = Number.isFinite(volumeMultiplierRef.current) ? volumeMultiplierRef.current : 1
    const next = mutedRef.current ? 0 : Math.min(2, Math.max(0, master * mult))

    if (gainNode) {
      gainNode.gain.value = next
      if (audio) {
        // Element output is routed through Web Audio; keep element unmuted at unity.
        audio.volume = 1
        audio.muted = false
      }
      return
    }

    if (audio) {
      audio.volume = Math.min(1, next)
      audio.muted = !!mutedRef.current || next <= 0
    }
  }

  const ensureGraph = () => {
    const audio = audioRef.current
    if (!audio || sourceReadyRef.current) return
    try {
      const ctx = getSharedAudioContext()
      const source = ctx.createMediaElementSource(audio)
      const gain = ctx.createGain()
      source.connect(gain)
      gain.connect(ctx.destination)
      gainRef.current = gain
      sourceReadyRef.current = true
      applyGain()
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    } catch (err) {
      // createMediaElementSource can fail if already connected; fall back to element volume.
      console.warn('RemoteAudio: Web Audio gain unavailable, using element volume', err)
      sourceReadyRef.current = true
      applyGain()
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const resume = () => {
      const ctx = sharedAudioContext
      if (ctx?.state === 'suspended') void ctx.resume().catch(() => {})
      void audio.play().catch(() => {})
    }

    const attach = () => {
      if (!stream) {
        audio.srcObject = null
        return
      }
      const audioTracks = stream.getAudioTracks().filter((t) => t.readyState !== 'ended')
      if (audioTracks.length === 0) {
        audio.srcObject = null
        return
      }
      const next = new MediaStream(audioTracks)
      const prev = audio.srcObject as MediaStream | null
      const prevIds = prev?.getAudioTracks().map((t) => t.id).sort().join('|') ?? ''
      const nextIds = audioTracks.map((t) => t.id).sort().join('|')
      if (prevIds !== nextIds) {
        audio.srcObject = next
      }
      ensureGraph()
      applyGain()
      void applyAudioOutputDevice(audio)
      void audio.play().catch(() => {
        /* autoplay may be blocked until a user gesture; retry on unmute / nudge */
      })
    }

    attach()

    const onTrackChange = () => attach()
    const onUnmute = () => resume()

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
    }
  }, [stream])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    applyGain()
    if (!muted) void audio.play().catch(() => {})
  }, [muted, volumeMultiplier])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const apply = () => {
      applyGain()
      applyAudioOutputDevice(audio, loadPrefs().voice.audioOutputId)
    }
    apply()
    return subscribePrefs(apply)
  }, [])

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: 0, top: 0 }}
    />
  )
}
