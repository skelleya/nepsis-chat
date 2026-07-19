import { useEffect, useRef } from 'react'
import { applyAudioOutputDevice, loadPrefs, subscribePrefs } from '../services/userPrefs'

interface RemoteAudioProps {
  stream: MediaStream | null
  muted?: boolean
}

/**
 * Plays remote peer audio. Keep instances stable across VoiceView layout changes
 * (focus/filmstrip remounts) — mount these at VoiceView root, not inside cards.
 */
export function RemoteAudio({ stream, muted }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !stream) return

    const attach = () => {
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
      audio.play().catch(() => {
        /* autoplay may be blocked until a user gesture; retry on unmute / interaction */
      })
    }

    attach()

    const onTrackChange = () => attach()
    const onUnmute = () => {
      audio.play().catch(() => {})
    }

    stream.addEventListener('addtrack', onTrackChange)
    stream.addEventListener('removetrack', onTrackChange)
    stream.getAudioTracks().forEach((t) => t.addEventListener('unmute', onUnmute))

    // Retry play after any user gesture (layout remounts often fail autoplay)
    const onGesture = () => {
      audio.play().catch(() => {})
    }
    window.addEventListener('pointerdown', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture)

    return () => {
      stream.removeEventListener('addtrack', onTrackChange)
      stream.removeEventListener('removetrack', onTrackChange)
      stream.getAudioTracks().forEach((t) => t.removeEventListener('unmute', onUnmute))
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [stream])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !!muted
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

  // Visually hidden but still “playing” — avoid display:none which some browsers pause.
  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      muted={muted}
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
    />
  )
}
