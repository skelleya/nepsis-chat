import { useEffect, useRef } from 'react'

interface RemoteAudioProps {
  stream: MediaStream | null
  muted?: boolean
}

export function RemoteAudio({ stream, muted }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !stream) return
    audio.srcObject = stream
    audio.play().catch(() => {})
  }, [stream])

  return <audio ref={audioRef} autoPlay playsInline muted={muted} className="hidden" />
}
