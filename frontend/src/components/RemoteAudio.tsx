import { useEffect, useRef } from 'react'
import { applyAudioOutputDevice, loadPrefs, subscribePrefs } from '../services/userPrefs'

interface RemoteAudioProps {
  stream: MediaStream | null
  muted?: boolean
}

/** Fired when the main app view changes so paused sinks can retry autoplay. */
export const VOICE_AUDIO_NUDGE_EVENT = 'nepsis-voice-audio-nudge'

/**
 * Plays remote peer audio for the lifetime of a voice session.
 * Mount from VoiceProvider (or a body portal) — never inside VoiceView tiles.
 */
export function RemoteAudio({ stream, muted }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

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
      audio.volume = loadPrefs().voice.outputVolume
      applyAudioOutputDevice(audio)
      void audio.play().catch(() => {
        /* autoplay may be blocked until a user gesture; retry on unmute / nudge */
      })
    }

    const nudgePlay = () => {
      void audio.play().catch(() => {})
    }

    attach()

    const onTrackChange = () => attach()
    const onUnmute = () => nudgePlay()

    stream?.addEventListener('addtrack', onTrackChange)
    stream?.addEventListener('removetrack', onTrackChange)
    stream?.getAudioTracks().forEach((t) => t.addEventListener('unmute', onUnmute))

    window.addEventListener('pointerdown', nudgePlay, { passive: true })
    window.addEventListener('keydown', nudgePlay)
    window.addEventListener(VOICE_AUDIO_NUDGE_EVENT, nudgePlay)
    document.addEventListener('visibilitychange', nudgePlay)

    return () => {
      stream?.removeEventListener('addtrack', onTrackChange)
      stream?.removeEventListener('removetrack', onTrackChange)
      stream?.getAudioTracks().forEach((t) => t.removeEventListener('unmute', onUnmute))
      window.removeEventListener('pointerdown', nudgePlay)
      window.removeEventListener('keydown', nudgePlay)
      window.removeEventListener(VOICE_AUDIO_NUDGE_EVENT, nudgePlay)
      document.removeEventListener('visibilitychange', nudgePlay)
    }
  }, [stream])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !!muted
    if (!muted) void audio.play().catch(() => {})
  }, [muted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const apply = () => {
      const v = loadPrefs().voice
      audio.volume = v.outputVolume
      applyAudioOutputDevice(audio, v.audioOutputId)
    }
    apply()
    return subscribePrefs(apply)
  }, [])

  // Keep in-document (portaled to body). Avoid display:none — some browsers pause it.
  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      muted={muted}
      style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: 0, top: 0 }}
    />
  )
}
