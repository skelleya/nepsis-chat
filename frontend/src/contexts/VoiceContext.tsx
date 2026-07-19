import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createBroadcastSignaling } from '../services/signaling'
import { createSocketSignaling } from '../services/socketSignaling'
import { createWebRTCClient } from '../services/webrtc'
import { ensureIceServers } from '../services/iceConfig'
import { sounds } from '../services/sounds'
import { getAudioConstraints, getVideoConstraints } from '../services/userPrefs'
import { getScreenShareStream } from '../utils/mediaTracks'

export interface VoiceParticipant {
  userId: string
  username: string
  stream: MediaStream | null
  isSpeaking: boolean
  /** Incremented when the stream's tracks change (forces React re-render) */
  streamVersion: number
}

interface VoiceContextValue {
  voiceChannelId: string | null
  voiceChannelName: string | null
  isConnected: boolean
  isMuted: boolean
  isDeafened: boolean
  isSoundboardMuted: boolean
  setIsMuted: (v: boolean) => void
  setIsDeafened: (v: boolean) => void
  setIsSoundboardMuted: (v: boolean) => void
  isCameraOn: boolean
  isScreenSharing: boolean
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  videoStream: MediaStream | null
  screenStream: MediaStream | null
  participants: VoiceParticipant[]
  /** User IDs that have left (peer-left) — exclude from presence merge to avoid ghost "Connecting..." */
  leftUserIds: Set<string>
  localStream: MediaStream | null
  isSpeaking: boolean      // local user speaking detection
  ping: number | null       // latency in ms
  joinVoice: (channelId: string, channelName: string) => Promise<void>
  leaveVoice: () => void
  /** Play soundboard sound to all peers (Socket.io only; no-op when using BroadcastChannel) */
  playSoundboardSound: (soundUrl: string) => void
  error: string | null
  /** User IDs currently sharing a screen (local + remotes) — Discord-style LIVE badges */
  screenShareUserIds: string[]
  /** Who the local user is watching (null = not watching; click to watch) */
  watchingShareUserId: string | null
  setWatchingShareUserId: (userId: string | null) => void
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
  const [isMuted, setIsMutedState] = useState(false)
  const [isDeafened, setIsDeafenedState] = useState(false)
  const [isSoundboardMuted, setIsSoundboardMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ping, setPing] = useState<number | null>(null)
  const [leftUserIds, setLeftUserIds] = useState<Set<string>>(new Set())
  const [watchingShareUserId, setWatchingShareUserId] = useState<string | null>(null)

  const webrtcRef = useRef<ReturnType<typeof createWebRTCClient> | null>(null)
  const signalingRef = useRef<ReturnType<typeof createBroadcastSignaling> | ReturnType<typeof createSocketSignaling> | null>(null)
  const isMutedRef = useRef(false)
  const isDeafenedRef = useRef(false)
  const mutedBeforeDeafenRef = useRef(false)
  const isSoundboardMutedRef = useRef(false)
  const playingSoundboardRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  isMutedRef.current = isMuted
  isDeafenedRef.current = isDeafened
  isSoundboardMutedRef.current = isSoundboardMuted

  /** Unmute also undeafens */
  const setIsMuted = useCallback((v: boolean) => {
    const wasMuted = isMutedRef.current
    const wasDeafened = isDeafenedRef.current
    if (v === wasMuted && !(wasDeafened && !v)) return

    setIsMutedState(v)
    if (!v) {
      setIsDeafenedState(false)
      mutedBeforeDeafenRef.current = false
      // Unmute (and undeafen if needed) — one unmute cue
      if (wasMuted || wasDeafened) sounds.unmute()
    } else if (!wasMuted) {
      sounds.mute()
    }
  }, [])

  /**
   * Deafen always mutes. Undeafen restores mute to whatever it was
   * before deafen (so mute→deafen→undeafen stays muted; deafen alone→undeafen unmutes).
   */
  const setIsDeafened = useCallback((v: boolean) => {
    if (v) {
      if (isDeafenedRef.current) return
      mutedBeforeDeafenRef.current = isMutedRef.current
      setIsDeafenedState(true)
      setIsMutedState(true)
      sounds.deafen()
    } else {
      if (!isDeafenedRef.current) return
      setIsDeafenedState(false)
      setIsMutedState(mutedBeforeDeafenRef.current)
      sounds.undeafen()
    }
  }, [])

  const addOrUpdateParticipant = useCallback((pUserId: string, pUsername: string, stream: MediaStream | null, isSpeaking = false) => {
    // Never list ourselves as a remote peer; never invent socket-id phantoms
    if (!pUserId || pUserId === userId) return
    if (pUsername === 'Connecting...' && !stream) {
      // Allow placeholder only when we already know this userId from a prior update
    }
    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === pUserId)
      if (existing) {
        const newVersion = stream ? (existing.streamVersion ?? 0) + 1 : (existing.streamVersion ?? 0)
        return prev.map((p) =>
          p.userId === pUserId
            ? {
                ...p,
                stream: stream ?? p.stream,
                username: pUsername && pUsername !== 'Connecting...' ? pUsername : p.username,
                isSpeaking,
                streamVersion: newVersion,
              }
            : p
        )
      }
      return [...prev, { userId: pUserId, username: pUsername || 'User', stream, isSpeaking, streamVersion: 0 }]
    })
    // Re-joining clears left-set so presence can show them again
    setLeftUserIds((prev) => {
      if (!prev.has(pUserId)) return prev
      const next = new Set(prev)
      next.delete(pUserId)
      return next
    })
  }, [userId])

  const removeParticipant = useCallback((peerId: string) => {
    setLeftUserIds((prev) => new Set(prev).add(peerId))
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
    setLeftUserIds(new Set())
    setVoiceChannelId(null)
    setVoiceChannelName(null)
    setIsCameraOn(false)
    setIsScreenSharing(false)
    setIsMutedState(false)
    setIsDeafenedState(false)
    mutedBeforeDeafenRef.current = false
    setIsSoundboardMuted(false)
    setIsSpeaking(false)
    setPing(null)
    setError(null)
    setWatchingShareUserId(null)
  }, [localStream, videoStream, screenStream])

  const joinVoice = useCallback(async (channelId: string, channelName: string) => {
    if (voiceChannelId === channelId) return

    if (voiceChannelId) {
      leaveVoice()
      await new Promise((r) => setTimeout(r, 100))
    }

    setError(null)
    try {
      // Prefetch ICE before joining so we don't miss room-peers while waiting
      const iceServers = await ensureIceServers()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(),
        video: false,
      })
      setLocalStream(stream)
      setVoiceChannelId(channelId)
      setVoiceChannelName(channelName)
      setParticipants([])
      setLeftUserIds(new Set())

      const signaling = USE_SOCKET
        ? createSocketSignaling(channelId, userId, username)
        : createBroadcastSignaling(channelId, userId)
      signalingRef.current = signaling

      // Connect socket + register WebRTC handlers BEFORE join-voice (so room-peers is not dropped)
      const sock = signaling as {
        ready?: () => Promise<void>
        getSocketId?: () => string | undefined
      }
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
            sounds.userLeave()
          },
          onPeerJoined: (pUserId, pUsername, playSound = true) => {
            if (pUserId === userId) return
            addOrUpdateParticipant(pUserId, pUsername, null)
            if (playSound) sounds.userJoin()
          },
        },
        iceServers
      )
      webrtcRef.current = webrtc
      webrtc.addLocalStream(stream)

      await signaling.join()
      sounds.voiceConnected()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access microphone')
      setVoiceChannelId(null)
      setVoiceChannelName(null)
      setLocalStream(null)
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

  // ─── Admin mute listener (when an admin force-mutes this user) ─
  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (signaling as { onAdminMute?: (cb: () => void) => () => void }).onAdminMute?.(() => {
      // Force-mute only — do not undeafen
      setIsMutedState(true)
    })
    return () => unsub?.()
  }, [voiceChannelId])

  // ─── Admin disconnect listener (when an admin disconnects this user from voice) ─
  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (signaling as { onAdminDisconnect?: (cb: () => void) => () => void }).onAdminDisconnect?.(() => {
      leaveVoice()
    })
    return () => unsub?.()
  }, [voiceChannelId, leaveVoice])

  // ─── Session replaced (same account joined voice from another device/tab) ─
  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (
      signaling as {
        onVoiceSessionReplaced?: (cb: (d: { reason?: string }) => void) => () => void
      }
    ).onVoiceSessionReplaced?.(() => {
      leaveVoice()
      // Set after leaveVoice() — leaveVoice clears error
      setError('Connected in voice on another device')
    })
    return () => unsub?.()
  }, [voiceChannelId, leaveVoice])

  // ─── Soundboard play listener (receive and play sounds from peers) ─
  useEffect(() => {
    const signaling = signalingRef.current
    const sig = signaling as { onSoundboardPlay?: (cb: (d: { soundUrl: string }) => void) => () => void }
    if (!sig?.onSoundboardPlay) return
    const unsub = sig.onSoundboardPlay(({ soundUrl }) => {
      if (isDeafenedRef.current || isSoundboardMutedRef.current) return
      const audio = new Audio(soundUrl)
      audio.volume = 0.8
      audio.play().catch(() => {})
    })
    return () => unsub?.()
  }, [voiceChannelId])

  // ─── Ping measurement (WebRTC RTT, else socket RTT) ───────────────
  useEffect(() => {
    const connected = !!localStream && !!voiceChannelId
    if (!connected) {
      setPing(null)
      return
    }
    let cancelled = false
    const sample = async () => {
      try {
        const webrtcRtt = await webrtcRef.current?.getPing()
        if (cancelled) return
        if (webrtcRtt != null) {
          setPing(webrtcRtt)
          return
        }
        const sig = signalingRef.current as { measureLatency?: () => Promise<number | null> } | null
        const sockRtt = await sig?.measureLatency?.()
        if (!cancelled && sockRtt != null) setPing(sockRtt)
      } catch { /* ignore */ }
    }
    sample()
    const interval = setInterval(sample, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: getVideoConstraints(),
          audio: false,
        })
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
      setWatchingShareUserId((prev) => (prev === userId ? null : prev))
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        const screenTrack = stream.getVideoTracks()[0]
        if (screenTrack) {
          try {
            screenTrack.contentHint = 'detail'
          } catch {
            /* ignore */
          }
        }
        screenTrack?.addEventListener('ended', () => {
          // User stopped sharing via browser UI
          stream.getTracks().forEach(async (track) => {
            await webrtcRef.current?.removeTrackFromAllPeers(track)
          })
          setScreenStream(null)
          setIsScreenSharing(false)
          setWatchingShareUserId((prev) => (prev === userId ? null : prev))
        })
        setScreenStream(stream)
        setIsScreenSharing(true)
        // Discord-like: sharer focuses their own share; others click to watch
        setWatchingShareUserId(userId)
        for (const track of stream.getTracks()) {
          await webrtcRef.current?.addTrackToAllPeers(track, stream)
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'NotAllowedError') {
          setError('Failed to share screen')
        }
      }
    }
  }, [isScreenSharing, screenStream, userId])

  // Clear watch target if that user stopped sharing / left
  const screenShareUserIds = useMemo(() => {
    const ids: string[] = []
    if (isScreenSharing) ids.push(userId)
    for (const p of participants) {
      if (p.stream && getScreenShareStream(p.stream)) ids.push(p.userId)
    }
    return ids
  }, [isScreenSharing, userId, participants])

  useEffect(() => {
    if (watchingShareUserId && !screenShareUserIds.includes(watchingShareUserId)) {
      setWatchingShareUserId(null)
    }
  }, [watchingShareUserId, screenShareUserIds])

  const isConnected = !!localStream && !!voiceChannelId

  const playSoundboardSound = useCallback((soundUrl: string) => {
    const sig = signalingRef.current as { emitSoundboardPlay?: (url: string) => void } | null
    if (sig?.emitSoundboardPlay) {
      sig.emitSoundboardPlay(soundUrl)
      if (!isDeafenedRef.current && !isSoundboardMutedRef.current) {
        // Restart on spam-click: stop any existing playback for this URL
        const existing = playingSoundboardRef.current.get(soundUrl)
        if (existing) {
          existing.pause()
          existing.currentTime = 0
        }
        const audio = new Audio(soundUrl)
        audio.volume = 0.8
        playingSoundboardRef.current.set(soundUrl, audio)
        audio.addEventListener('ended', () => playingSoundboardRef.current.delete(soundUrl))
        audio.play().catch(() => {})
      }
    }
  }, [])

  return (
    <VoiceContext.Provider
      value={{
        voiceChannelId,
        voiceChannelName,
        isConnected,
        isMuted,
        isDeafened,
        isSoundboardMuted,
        setIsMuted,
        setIsDeafened,
        setIsSoundboardMuted,
        isCameraOn,
        isScreenSharing,
        toggleCamera,
        toggleScreenShare,
        videoStream,
        screenStream,
        participants,
        leftUserIds,
        localStream,
        isSpeaking,
        ping,
        joinVoice,
        leaveVoice,
        playSoundboardSound,
        error,
        screenShareUserIds,
        watchingShareUserId,
        setWatchingShareUserId,
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
