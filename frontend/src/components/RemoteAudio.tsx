import { useEffect, useRef } from 'react'
import { applyAudioOutputDevice, loadPrefs, subscribePrefs } from '../services/userPrefs'

interface RemoteAudioProps {
  stream: MediaStream | null
  muted?: boolean
}

export function RemoteAudio({ stream, muted }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !stream) return

    // Create an audio-only stream to avoid any issues with mixed tracks
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) return

    const audioOnly = new MediaStream(audioTracks)
    audio.srcObject = audioOnly
    audio.volume = loadPrefs().voice.outputVolume
    applyAudioOutputDevice(audio)
    audio.play().catch(() => {})

    // If audio tracks are added/removed later, update
    const onTrackChange = () => {
      const updatedAudio = stream.getAudioTracks()
      if (updatedAudio.length > 0) {
        audio.srcObject = new MediaStream(updatedAudio)
        audio.play().catch(() => {})
      }
    }
    stream.addEventListener('addtrack', onTrackChange)
    stream.addEventListener('removetrack', onTrackChange)

    return () => {
      stream.removeEventListener('addtrack', onTrackChange)
      stream.removeEventListener('removetrack', onTrackChange)
    }
  }, [stream])

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

  return <audio ref={audioRef} autoPlay playsInline muted={muted} className="hidden" />
}
