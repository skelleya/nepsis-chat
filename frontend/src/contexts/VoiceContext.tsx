import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { createBroadcastSignaling } from '../services/signaling'
import { createSocketSignaling } from '../services/socketSignaling'
import { createWebRTCClient } from '../services/webrtc'
import { sounds } from '../services/sounds'

export interface VoiceParticipant {
  userId: string
  username: string
  stream: MediaStream | null
  isSpeaking: boolean
}

interface VoiceContextValue {
  voiceChannelId: string | null
  voiceChannelName: string | null
  isConnected: boolean
  isMuted: boolean
  isDeafened: boolean
  setIsMuted: (v: boolean) => void
  setIsDeafened: (v: boolean) => void
  isCameraOn: boolean
  isScreenSharing: boolean
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  videoStream: MediaStream | null
  screenStream: MediaStream | null
  participants: VoiceParticipant[]
  localStream: MediaStream | null
  isSpeaking: boolean      // local user speaking detection
  ping: number | null       // latency in ms
  joinVoice: (channelId: string, channelName: string) => Promise<void>
  leaveVoice: () => void
  error: string | null
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

const USE_SOCKET = !!import.meta.env.VITE_API_URL

interface VoiceProviderProps {
  children: React.ReactNode
  userId: string
  username: string
}

export function VoiceProvider({ children, userId, username }: VoiceProviderProps) {
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null)
  const [voiceChannelName, setVoiceChannelName] = useState<string | null>(null)
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ping, setPing] = useState<number | null>(null)

  const webrtcRef = useRef<ReturnType<typeof createWebRTCClient> | null>(null)
  const signalingRef = useRef<ReturnType<typeof createBroadcastSignaling> | ReturnType<typeof createSocketSignaling> | null>(null)

  const addOrUpdateParticipant = useCallback((pUserId: string, pUsername: string, stream: MediaStream | null, isSpeaking = false) => {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === pUserId)
      if (existing) {
        return prev.map((p) => (p.userId === pUserId ? { ...p, stream: stream ?? p.stream, username: pUsername || p.username, isSpeaking } : p))
      }
      return [...prev, { userId: pUserId, username: pUsername, stream, isSpeaking }]
    })
  }, [])

  const removeParticipant = useCallback((peerId: string) => {
    setParticipants((prev) => prev.filter((p) => p.userId !== peerId))
  }, [])

  const leaveVoice = useCallback(() => {
    if (voiceChannelId) sounds.voiceDisconnected()
    webrtcRef.current?.leave()
    webrtcRef.current = null
    signalingRef.current = null
    localStream?.getTracks().forEach((t) => t.stop())
    videoStream?.getTracks().forEach((t) => t.stop())
    screenStream?.getTracks().forEach((t) => t.stop())
    setLocalStream(null)
    setVideoStream(null)
    setScreenStream(null)
    setParticipants([])
    setVoiceChannelId(null)
    setVoiceChannelName(null)
    setIsCameraOn(false)
    setIsScreenSharing(false)
    setIsMuted(false)
    setIsDeafened(false)
    setIsSpeaking(false)
    setPing(null)
    setError(null)
  }, [localStream, videoStream, screenStream])

  const joinVoice = useCallback(async (channelId: string, channelName: string) => {
    if (voiceChannelId === channelId) return

    if (voiceChannelId) {
      leaveVoice()
      await new Promise((r) => setTimeout(r, 100))
    }

    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      setLocalStream(stream)
      setVoiceChannelId(channelId)
      setVoiceChannelName(channelName)

      const signaling = USE_SOCKET
        ? createSocketSignaling(channelId, userId, username)
        : createBroadcastSignaling(channelId, userId)
      signalingRef.current = signaling

      await signaling.join()

      const localId = USE_SOCKET
        ? (signaling as { getSocketId?: () => string }).getSocketId?.() ?? userId
        : userId
      sounds.voiceConnected()

      const webrtc = createWebRTCClient(localId, signaling as Parameters<typeof createWebRTCClient>[1], {
        onRemoteStream: (_, pUserId, pUsername, remoteStream) => {
          addOrUpdateParticipant(pUserId, pUsername, remoteStream)
        },
        onPeerLeft: (peerId) => {
          removeParticipant(peerId)
          sounds.userLeave()
        },
        onPeerJoined: (pUserId, pUsername) => {
          addOrUpdateParticipant(pUserId, pUsername, null)
          sounds.userJoin()
        },
      })
      webrtcRef.current = webrtc
      webrtc.addLocalStream(stream)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access microphone')
      setVoiceChannelId(null)
      setVoiceChannelName(null)
    }
  }, [voiceChannelId, userId, username, leaveVoice, addOrUpdateParticipant, removeParticipant])

  // ─── Mute sync ────────────────────────────────────────────────────
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = !isMuted))
    }
  }, [isMuted, localStream])

  // ─── Speaking detection (local user) ──────────────────────────────
  useEffect(() => {
    if (!localStream || isMuted) {
      setIsSpeaking(false)
      return
    }
    let running = true
    let audioCtx: AudioContext | null = null
    const start = async () => {
      try {
        audioCtx = new AudioContext()
        // Browsers often start AudioContext suspended; must resume for analysis to work
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }
        if (!running) return
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.5
        const source = audioCtx.createMediaStreamSource(localStream)
        source.connect(analyser)
        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const check = () => {
          if (!running) return
          analyser.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setIsSpeaking(avg > 8)
          setTimeout(check, 100)
        }
        check()
      } catch {
        // AudioContext not available
      }
    }
    start()
    return () => {
      running = false
      audioCtx?.close()
    }
  }, [localStream, isMuted])

  // ─── Admin move listener (when an admin moves this user to another voice channel) ─
  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (signaling as { onAdminMove?: (cb: (d: { channelId: string; channelName: string }) => void) => () => void }).onAdminMove?.(
      (data) => {
        leaveVoice()
        joinVoice(data.channelId, data.channelName)
      }
    )
    return () => unsub?.()
  }, [voiceChannelId, leaveVoice, joinVoice])

  // ─── Ping measurement ─────────────────────────────────────────────
  useEffect(() => {
    const connected = !!localStream && !!voiceChannelId
    if (!connected || !webrtcRef.current) {
      setPing(null)
      return
    }
    const webrtc = webrtcRef.current
    const interval = setInterval(async () => {
      try {
        const rtt = await webrtc.getPing()
        setPing(rtt)
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [localStream, voiceChannelId])

  // ─── Camera toggle (sends video over WebRTC) ─────────────────────
  const toggleCamera = useCallback(async () => {
    if (isCameraOn && videoStream) {
      // Remove video tracks from all peer connections, then stop
      for (const track of videoStream.getTracks()) {
        await webrtcRef.current?.removeTrackFromAllPeers(track)
        track.stop()
      }
      setVideoStream(null)
      setIsCameraOn(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setVideoStream(stream)
        setIsCameraOn(true)
        // Add video tracks to all peer connections (triggers renegotiation)
        for (const track of stream.getTracks()) {
          await webrtcRef.current?.addTrackToAllPeers(track, stream)
        }
      } catch {
        setError('Failed to access camera')
      }
    }
  }, [isCameraOn, videoStream])

  // ─── Screen share toggle (sends screen over WebRTC) ───────────────
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing && screenStream) {
      for (const track of screenStream.getTracks()) {
        await webrtcRef.current?.removeTrackFromAllPeers(track)
        track.stop()
      }
      setScreenStream(null)
      setIsScreenSharing(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          // User stopped sharing via browser UI
          stream.getTracks().forEach(async (track) => {
            await webrtcRef.current?.removeTrackFromAllPeers(track)
          })
          setScreenStream(null)
          setIsScreenSharing(false)
        })
        setScreenStream(stream)
        setIsScreenSharing(true)
        for (const track of stream.getTracks()) {
          await webrtcRef.current?.addTrackToAllPeers(track, stream)
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'NotAllowedError') {
          setError('Failed to share screen')
        }
      }
    }
  }, [isScreenSharing, screenStream])

  const isConnected = !!localStream && !!voiceChannelId

  return (
    <VoiceContext.Provider
      value={{
        voiceChannelId,
        voiceChannelName,
        isConnected,
        isMuted,
        isDeafened,
        setIsMuted,
        setIsDeafened,
        isCameraOn,
        isScreenSharing,
        toggleCamera,
        toggleScreenShare,
        videoStream,
        screenStream,
        participants,
        localStream,
        isSpeaking,
        ping,
        joinVoice,
        leaveVoice,
        error,
      }}
    >
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const ctx = useContext(VoiceContext)
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider')
  return ctx
}
