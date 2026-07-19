import { useState, useCallback, useRef, useEffect } from 'react'
import { createBroadcastSignaling } from '../services/signaling'
import { createSocketSignaling } from '../services/socketSignaling'
import { createWebRTCClient } from '../services/webrtc'
import { ensureIceServers } from '../services/iceConfig'

export interface VoiceParticipant {
  userId: string
  username: string
  stream: MediaStream | null
  isSpeaking: boolean
}

const USE_SOCKET = !!import.meta.env.VITE_API_URL

export function useVoiceChannel(channelId: string | null, userId: string, username: string) {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const webrtcRef = useRef<ReturnType<typeof createWebRTCClient> | null>(null)
  const signalingRef = useRef<ReturnType<typeof createBroadcastSignaling> | ReturnType<typeof createSocketSignaling> | null>(null)

  const addOrUpdateParticipant = useCallback((pUserId: string, pUsername: string, stream: MediaStream | null, isSpeaking = false) => {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === pUserId)
      if (existing) {
        return prev.map((p) => (p.userId === pUserId ? { ...p, stream: stream ?? p.stream, isSpeaking } : p))
      }
      return [...prev, { userId: pUserId, username: pUsername, stream, isSpeaking }]
    })
  }, [])

  const removeParticipant = useCallback((peerId: string) => {
    setParticipants((prev) => prev.filter((p) => p.userId !== peerId))
  }, [])

  const join = useCallback(async () => {
    if (!channelId) return
    setError(null)
    try {
      const iceServers = await ensureIceServers()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      setLocalStream(stream)

      const signaling = USE_SOCKET
        ? createSocketSignaling(channelId, userId, username)
        : createBroadcastSignaling(channelId, userId)
      signalingRef.current = signaling

      const sock = signaling as { ready?: () => Promise<void>; getSocketId?: () => string | undefined }
      await sock.ready?.()
      const localId = USE_SOCKET ? sock.getSocketId?.() ?? userId : userId
      const webrtc = createWebRTCClient(
        localId,
        signaling as Parameters<typeof createWebRTCClient>[1],
        {
          onRemoteStream: (_, pUserId, pUsername, remoteStream) => {
            if (pUserId === userId) return
            addOrUpdateParticipant(pUserId, pUsername, remoteStream)
          },
          onPeerLeft: (peerId) => {
            if (peerId === userId) return
            removeParticipant(peerId)
          },
        },
        iceServers
      )
      webrtcRef.current = webrtc
      webrtc.addLocalStream(stream)
      await signaling.join()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access microphone')
    }
  }, [channelId, userId, username, addOrUpdateParticipant, removeParticipant])

  const leave = useCallback(() => {
    webrtcRef.current?.leave()
    webrtcRef.current = null
    signalingRef.current = null
    localStream?.getTracks().forEach((t) => t.stop())
    setLocalStream(null)
    setParticipants([])
  }, [localStream])

  useEffect(() => {
    if (!channelId) leave()
    return () => {}
  }, [channelId, leave])

  useEffect(() => {
    if (localStream && isMuted) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = false))
    } else if (localStream && !isMuted) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = true))
    }
  }, [isMuted, localStream])

  return {
    participants,
    localStream,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
    join,
    leave,
    error,
  }
}
