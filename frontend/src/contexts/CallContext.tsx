/**
 * CallContext — manages private DM calls with WebRTC audio.
 *
 * Flow:
 *  1. Caller clicks "Call" → initiateCall(targetUserId, targetUsername)
 *  2. Backend routes ring to callee → callee sees incoming overlay
 *  3. Callee clicks Accept → acceptCall()
 *  4. Caller creates WebRTC offer, callee receives and creates answer
 *  5. Audio flows peer-to-peer
 *  6. Either party clicks End → endCall()
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { sounds } from '../services/sounds'
import { ensureIceServers } from '../services/iceConfig'
import { useVoice } from './VoiceContext'
import { applyAudioOutputDevice, getAudioConstraints, getVideoConstraints, loadPrefs } from '../services/userPrefs'
import { setCallBusy } from '../services/mediaSessionGate'
import {
  readConnectionRtt,
  smoothPing,
  type IcePathType,
  type PingSource,
} from '../services/connectionStats'
import { formatMediaPermissionError } from '../utils/mediaPermissionError'

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

export type CallState = 'idle' | 'calling' | 'ringing' | 'in-call'

interface CallContextValue {
  callState: CallState
  callId: string | null
  remoteUserId: string | null
  remoteUsername: string | null
  remoteAvatarUrl: string | null
  isMuted: boolean
  isDeafened: boolean
  callDuration: number
  ping: number | null
  pingSource: PingSource
  pingPath: IcePathType | null
  unavailableReason: string | null
  isVideoCall: boolean
  callExpanded: boolean
  localVideoStream: MediaStream | null
  remoteVideoStream: MediaStream | null
  toggleMute: () => void
  toggleDeafen: () => void
  expandCall: () => void
  minimizeCall: () => void
  initiateCall: (
    targetUserId: string,
    targetUsername: string,
    targetAvatarUrl?: string,
    options?: { video?: boolean }
  ) => void
  acceptCall: () => void
  declineCall: () => void
  endCall: () => void
}

const CallContext = createContext<CallContextValue | null>(null)

interface CallProviderProps {
  children: ReactNode
  userId: string
  username: string
}

export function CallProvider({ children, userId, username }: CallProviderProps) {
  const voice = useVoice()

  // ─── State (drives UI) ──────────────────────────────────────────
  const [callState, _setCallState] = useState<CallState>('idle')
  const [callId, _setCallId] = useState<string | null>(null)
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null)
  const [remoteUsername, setRemoteUsername] = useState<string | null>(null)
  const [remoteAvatarUrl, setRemoteAvatarUrl] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [ping, setPing] = useState<number | null>(null)
  const [pingSource, setPingSource] = useState<PingSource>('none')
  const [pingPath, setPingPath] = useState<IcePathType | null>(null)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
  const [isVideoCall, setIsVideoCall] = useState(false)
  const [callExpanded, setCallExpanded] = useState(false)
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null)
  const [remoteVideoStream, setRemoteVideoStream] = useState<MediaStream | null>(null)

  // ─── Refs (safe for socket-handler closures) ────────────────────
  const callStateRef = useRef<CallState>('idle')
  const callIdRef = useRef<string | null>(null)
  const isVideoCallRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const stopRingRef = useRef<(() => void) | null>(null)
  const callTimeoutRef = useRef<number | null>(null)
  const durationIntervalRef = useRef<number | null>(null)
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([])
  const callNotificationRef = useRef<Notification | null>(null)
  const mutedBeforeDeafenRef = useRef(false)
  const isMutedRef = useRef(false)
  const isDeafenedRef = useRef(false)
  const remoteUserIdRef = useRef<string | null>(null)
  const remoteUsernameRef = useRef<string | null>(null)
  const remoteAvatarUrlRef = useRef<string | null>(null)
  const reconnectPeerRef = useRef<{
    userId: string
    username: string
    avatarUrl?: string | null
  } | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const initiateCallRef = useRef<
    (
      targetUserId: string,
      targetUsername: string,
      targetAvatarUrl?: string,
      options?: { video?: boolean }
    ) => void
  >(() => {})
  const acceptCallRef = useRef<() => void>(() => {})
  const endCallRef = useRef<() => void>(() => {})
  isMutedRef.current = isMuted
  isDeafenedRef.current = isDeafened
  isVideoCallRef.current = isVideoCall
  remoteUserIdRef.current = remoteUserId
  remoteUsernameRef.current = remoteUsername
  remoteAvatarUrlRef.current = remoteAvatarUrl

  const CALL_REJOIN_KEY = 'nepsis_call_rejoin'

  // Sync wrappers — update both ref + state
  const setCallState = useCallback((s: CallState) => {
    callStateRef.current = s
    setCallBusy(s !== 'idle')
    _setCallState(s)
  }, [])
  const setCallId = useCallback((id: string | null) => {
    callIdRef.current = id
    _setCallId(id)
  }, [])

  // ─── Cleanup everything ─────────────────────────────────────────
  const cleanup = useCallback((opts?: { expectReconnect?: boolean }) => {
    stopRingRef.current?.()
    stopRingRef.current = null
    callNotificationRef.current?.close()
    callNotificationRef.current = null
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
    pcRef.current?.close()
    pcRef.current = null
    remoteStreamRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    iceCandidateQueueRef.current = []
    setCallState('idle')
    setCallId(null)
    if (!opts?.expectReconnect) {
      setRemoteUserId(null)
      setRemoteUsername(null)
      setRemoteAvatarUrl(null)
    }
    setIsMuted(false)
    setIsDeafened(false)
    mutedBeforeDeafenRef.current = false
    setCallDuration(0)
    setPing(null)
    setPingSource('none')
    setPingPath(null)
    setIsVideoCall(false)
    isVideoCallRef.current = false
    setCallExpanded(false)
    setLocalVideoStream(null)
    setRemoteVideoStream(null)
  }, [setCallState, setCallId])

  // ─── Start call duration timer ──────────────────────────────────
  const startDurationTimer = useCallback(() => {
    const startTime = Date.now()
    durationIntervalRef.current = window.setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
  }, [])

  useEffect(() => {
    if (callState !== 'in-call') {
      setPing(null)
      setPingSource('none')
      setPingPath(null)
      return
    }
    let cancelled = false
    const sample = async () => {
      const pc = pcRef.current
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        if (!cancelled) {
          setPing(null)
          setPingSource('none')
          setPingPath(null)
        }
        return
      }
      const reading = await readConnectionRtt(pc)
      if (cancelled) return
      if (reading.ms !== null) {
        setPing((previous) => smoothPing(previous, reading.ms!))
        setPingSource('webrtc')
        setPingPath(reading.path ?? 'unknown')
      } else {
        setPing(null)
        setPingSource('none')
        setPingPath(null)
      }
    }
    void sample()
    const interval = window.setInterval(sample, 2_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [callState])

  const flushIceQueue = useCallback(async () => {
    const pc = pcRef.current
    if (!pc?.remoteDescription || iceCandidateQueueRef.current.length === 0) return
    const queued = iceCandidateQueueRef.current
    iceCandidateQueueRef.current = []
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        /* ignore late or duplicate candidates */
      }
    }
  }, [])

  // ─── Setup WebRTC peer connection ───────────────────────────────
  const setupWebRTC = useCallback(
    async (isCaller: boolean) => {
      const withVideo = isVideoCallRef.current
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: getAudioConstraints(),
          video: withVideo ? getVideoConstraints() : false,
        })
      } catch (err) {
        setUnavailableReason(
          formatMediaPermissionError(err, withVideo ? 'microphone-or-camera' : 'microphone')
        )
        window.setTimeout(() => setUnavailableReason(null), 8000)
        socketRef.current?.emit('call:end', { callId: callIdRef.current })
        sounds.callDisconnected()
        cleanup()
        throw err
      }
      localStreamRef.current = stream
      setLocalVideoStream(withVideo ? stream : null)
      for (const track of stream.getTracks()) {
        try {
          if (track.kind === 'audio') {
            ;(track as MediaStreamTrack & { contentHint?: string }).contentHint = 'speech'
          } else if (track.kind === 'video') {
            track.contentHint = 'motion'
          }
        } catch {
          /* ignore */
        }
      }

      const iceServers = await ensureIceServers()
      const pc = new RTCPeerConnection({
        iceServers,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      })
      pcRef.current = pc

      // Add local media at high bitrate
      const { applySenderQuality, applyPeerConnectionQuality } = await import('../services/mediaQuality')
      for (const track of stream.getTracks()) {
        const sender = pc.addTrack(track, stream)
        void applySenderQuality(sender)
      }
      void applyPeerConnectionQuality(pc)

      // Handle remote audio (+ video for video calls)
      const remoteStream = new MediaStream()
      remoteStreamRef.current = remoteStream
      pc.ontrack = (e) => {
        if (!remoteStream.getTrackById(e.track.id)) {
          remoteStream.addTrack(e.track)
        }
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio()
          remoteAudioRef.current.autoplay = true
        }
        const voice = loadPrefs().voice
        remoteAudioRef.current.volume = voice.outputVolume
        applyAudioOutputDevice(remoteAudioRef.current, voice.audioOutputId)
        remoteAudioRef.current.srcObject = remoteStream
        if (remoteStream.getVideoTracks().length) {
          setRemoteVideoStream(remoteStream)
        }
        e.track.onended = () => {
          if (remoteStream.getTrackById(e.track.id)) {
            remoteStream.removeTrack(e.track)
          }
          setRemoteVideoStream(remoteStream.getVideoTracks().length ? remoteStream : null)
        }
      }

      // ICE candidates
      pc.onicecandidate = (e) => {
        if (e.candidate && callIdRef.current) {
          socketRef.current?.emit('call:ice-candidate', {
            callId: callIdRef.current,
            candidate: e.candidate,
          })
        }
      }

      // If caller, create and send offer
      if (isCaller) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketRef.current?.emit('call:offer', {
          callId: callIdRef.current,
          sdp: offer,
        })
      }

      await flushIceQueue()

      startDurationTimer()
    },
    [cleanup, flushIceQueue, startDurationTimer]
  )

  // Prefetch STUN/TURN so the first call does not wait on /api/webrtc/ice
  useEffect(() => {
    ensureIceServers().catch(() => {})
  }, [])

  // ─── Socket connection (persists for the lifetime of the provider)
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/calls`, {
      autoConnect: true,
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('register', { userId, username })
      // Request notification permission so incoming calls notify when app is in background
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
    })

    // --- Incoming call (callee receives) ---
    socket.on(
      'call:incoming',
      ({
        callId: id,
        callerId,
        callerUsername,
        callerAvatarUrl,
        withVideo,
      }: {
        callId: string
        callerId: string
        callerUsername: string
        callerAvatarUrl?: string
        withVideo?: boolean
      }) => {
        // Peer refreshed mid-call and is calling us back — auto-accept
        const awaiting = reconnectPeerRef.current
        if (
          callStateRef.current === 'idle' &&
          awaiting &&
          awaiting.userId === callerId
        ) {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
          }
          reconnectPeerRef.current = null
          setCallId(id)
          setRemoteUserId(callerId)
          setRemoteUsername(callerUsername)
          setRemoteAvatarUrl(callerAvatarUrl ?? awaiting.avatarUrl ?? null)
          setIsVideoCall(!!withVideo)
          isVideoCallRef.current = !!withVideo
          setCallState('ringing')
          // Accept on next tick so state is set
          window.setTimeout(() => acceptCallRef.current(), 50)
          return
        }

        if (callStateRef.current !== 'idle') {
          socket.emit('call:decline', { callId: id })
          return
        }
        setCallId(id)
        setRemoteUserId(callerId)
        setRemoteUsername(callerUsername)
        setRemoteAvatarUrl(callerAvatarUrl ?? null)
        setIsVideoCall(!!withVideo)
        isVideoCallRef.current = !!withVideo
        setCallState('ringing')
        stopRingRef.current = sounds.callRinging()

        // Browser notification when app is in background (another tab or minimized)
        if (
          loadPrefs().notifications.browserCallNotifications &&
          typeof document !== 'undefined' &&
          document.hidden &&
          'Notification' in window
        ) {
          const showNotif = () => {
            const n = new Notification('Incoming call', {
              body: `${callerUsername} is calling you`,
              icon: './logo.png',
              tag: 'nepsis-call',
              requireInteraction: true,
            })
            callNotificationRef.current = n
            n.onclick = () => window.focus()
          }
          if (Notification.permission === 'granted') {
            showNotif()
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((p) => {
              if (p === 'granted') showNotif()
            })
          }
        }

        // Auto-decline after 30 seconds if not answered
        callTimeoutRef.current = window.setTimeout(() => {
          if (callStateRef.current === 'ringing') {
            socket.emit('call:decline', { callId: callIdRef.current })
            sounds.callDisconnected()
            cleanup()
          }
        }, 30_000)
      }
    )

    // --- Call accepted (caller receives) ---
    socket.on('call:accepted', async () => {
      stopRingRef.current?.()
      stopRingRef.current = null
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current)
        callTimeoutRef.current = null
      }
      sounds.callConnected()
      setCallExpanded(true)
      setCallState('in-call')
      try {
        await setupWebRTC(true) // caller creates offer
      } catch {
        /* setupWebRTC already surfaced the error and cleaned up */
      }
    })

    // --- Call declined (caller receives) ---
    socket.on('call:declined', () => {
      stopRingRef.current?.()
      stopRingRef.current = null
      sounds.callDisconnected()
      cleanup()
    })

    // --- Call ended (either party receives) ---
    socket.on('call:ended', () => {
      stopRingRef.current?.()
      stopRingRef.current = null
      // If we were in-call, peer may be refreshing — wait briefly for their rejoin call
      if (callStateRef.current === 'in-call' && remoteUserIdRef.current) {
        reconnectPeerRef.current = {
          userId: remoteUserIdRef.current,
          username: remoteUsernameRef.current || 'User',
          avatarUrl: remoteAvatarUrlRef.current,
        }
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectPeerRef.current = null
          reconnectTimerRef.current = null
        }, 15_000)
        sounds.callDisconnected()
        cleanup({ expectReconnect: true })
        return
      }
      sounds.callDisconnected()
      cleanup()
    })

    // --- User unavailable (caller receives) ---
    socket.on(
      'call:unavailable',
      ({ reason }: { callId: string; reason?: string }) => {
        stopRingRef.current?.()
        stopRingRef.current = null
        sounds.callDisconnected()
        setUnavailableReason(reason || 'User is unavailable')
        cleanup()
        // Clear the reason after a few seconds
        setTimeout(() => setUnavailableReason(null), 4000)
      }
    )

    // --- WebRTC offer (callee receives after call is accepted) ---
    socket.on(
      'call:offer',
      async ({ callId: id, sdp }: { callId: string; sdp: RTCSessionDescriptionInit }) => {
        try {
          await setupWebRTC(false)
        } catch {
          return
        }
        if (!pcRef.current) return
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
        await flushIceQueue()
        const answer = await pcRef.current.createAnswer()
        await pcRef.current.setLocalDescription(answer)
        socket.emit('call:answer', { callId: id, sdp: answer })
      }
    )

    // --- WebRTC answer (caller receives) ---
    socket.on(
      'call:answer',
      async ({ sdp }: { callId: string; sdp: RTCSessionDescriptionInit }) => {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
          await flushIceQueue()
        }
      }
    )

    // --- WebRTC ICE candidate ---
    socket.on(
      'call:ice-candidate',
      async ({ candidate }: { callId: string; candidate: RTCIceCandidateInit }) => {
        if (!candidate) return
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
          } catch {
            /* ignore */
          }
        } else {
          // Queue ICE candidates until PC is ready
          iceCandidateQueueRef.current.push(candidate)
        }
      }
    )

    return () => {
      socket.disconnect()
      stopRingRef.current?.()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username])

  // Refresh while in a call: leave cleanly, then auto-call the peer again
  useEffect(() => {
    const onPageHide = () => {
      if (callStateRef.current !== 'in-call' && callStateRef.current !== 'calling') return
      const peerId = remoteUserIdRef.current
      const peerName = remoteUsernameRef.current
      if (!peerId || !peerName) return
      try {
        sessionStorage.setItem(
          CALL_REJOIN_KEY,
          JSON.stringify({
            peerUserId: peerId,
            peerUsername: peerName,
            peerAvatarUrl: remoteAvatarUrlRef.current,
            withVideo: isVideoCallRef.current,
          })
        )
      } catch {
        /* ignore */
      }
      socketRef.current?.emit('call:end', { callId: callIdRef.current })
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  // After refresh: re-initiate the call once the /calls socket is registered
  useEffect(() => {
    let attempts = 0
    const tryRejoin = () => {
      try {
        const raw = sessionStorage.getItem(CALL_REJOIN_KEY)
        if (!raw) return
        if (!socketRef.current?.connected) {
          if (attempts++ < 20) window.setTimeout(tryRejoin, 250)
          return
        }
        sessionStorage.removeItem(CALL_REJOIN_KEY)
        const parsed = JSON.parse(raw) as {
          peerUserId?: string
          peerUsername?: string
          peerAvatarUrl?: string | null
          withVideo?: boolean
        }
        if (!parsed.peerUserId || !parsed.peerUsername) return
        initiateCallRef.current(
          parsed.peerUserId,
          parsed.peerUsername,
          parsed.peerAvatarUrl ?? undefined,
          { video: !!parsed.withVideo }
        )
      } catch {
        /* ignore */
      }
    }
    const t = window.setTimeout(tryRejoin, 500)
    return () => window.clearTimeout(t)
  }, [userId])

  // ─── Mute sync ──────────────────────────────────────────────────
  useEffect(() => {
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => {
        t.enabled = !isMuted
      })
  }, [isMuted])

  // ─── Deafen sync ────────────────────────────────────────────────
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isDeafened
    }
  }, [isDeafened])

  // ─── Actions ────────────────────────────────────────────────────

  const initiateCall = useCallback(
    (
      targetUserId: string,
      targetUsername: string,
      targetAvatarUrl?: string,
      options?: { video?: boolean }
    ) => {
      if (callStateRef.current !== 'idle') return
      // Leave any active server voice channel before starting a DM call
      voice.leaveVoice()
      reconnectPeerRef.current = null
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      const withVideo = !!options?.video
      const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      setCallId(id)
      setRemoteUserId(targetUserId)
      setRemoteUsername(targetUsername)
      setRemoteAvatarUrl(targetAvatarUrl ?? null)
      setIsVideoCall(withVideo)
      isVideoCallRef.current = withVideo
      setCallExpanded(true)
      setCallState('calling')
      socketRef.current?.emit('call:initiate', { targetUserId, callId: id, withVideo })
      stopRingRef.current = sounds.callOutgoing()

      // Auto-cancel after 30 seconds
      callTimeoutRef.current = window.setTimeout(() => {
        if (callStateRef.current === 'calling') {
          socketRef.current?.emit('call:end', { callId: callIdRef.current })
          sounds.callDisconnected()
          cleanup()
        }
      }, 30_000)
    },
    [cleanup, setCallId, setCallState, voice.leaveVoice]
  )

  const acceptCall = useCallback(() => {
    if (callStateRef.current !== 'ringing') return
    // Leave any active server voice channel before accepting a DM call
    voice.leaveVoice()
    stopRingRef.current?.()
    stopRingRef.current = null
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }
    socketRef.current?.emit('call:accept', { callId: callIdRef.current })
    sounds.callConnected()
    setCallExpanded(true)
    setCallState('in-call')
    // WebRTC will be set up when the caller's offer arrives
  }, [setCallState, voice.leaveVoice])

  const expandCall = useCallback(() => {
    if (callStateRef.current === 'in-call') setCallExpanded(true)
  }, [])

  useEffect(() => {
    return () => setCallBusy(false)
  }, [])

  const minimizeCall = useCallback(() => {
    setCallExpanded(false)
  }, [])

  const declineCall = useCallback(() => {
    if (callStateRef.current !== 'ringing') return
    reconnectPeerRef.current = null
    socketRef.current?.emit('call:decline', { callId: callIdRef.current })
    sounds.callDisconnected()
    cleanup()
  }, [cleanup])

  const endCall = useCallback(() => {
    reconnectPeerRef.current = null
    try {
      sessionStorage.removeItem(CALL_REJOIN_KEY)
    } catch {
      /* ignore */
    }
    socketRef.current?.emit('call:end', { callId: callIdRef.current })
    sounds.callDisconnected()
    cleanup()
  }, [cleanup])

  initiateCallRef.current = initiateCall
  acceptCallRef.current = acceptCall
  endCallRef.current = endCall

  // Unmute undeafens. Deafen mutes; undeafen restores prior mute state.
  // One cue per action: unmute (covers undeafen), deafen (covers mute-from-deafen).
  const toggleMute = useCallback(() => {
    const wasMuted = isMutedRef.current
    const wasDeafened = isDeafenedRef.current
    const next = !wasMuted
    if (!next) {
      setIsMuted(false)
      setIsDeafened(false)
      mutedBeforeDeafenRef.current = false
      if (wasMuted || wasDeafened) sounds.unmute()
    } else {
      setIsMuted(true)
      sounds.mute()
    }
  }, [])
  const toggleDeafen = useCallback(() => {
    if (!isDeafenedRef.current) {
      mutedBeforeDeafenRef.current = isMutedRef.current
      setIsDeafened(true)
      setIsMuted(true)
      sounds.deafen()
    } else {
      setIsDeafened(false)
      setIsMuted(mutedBeforeDeafenRef.current)
      sounds.undeafen()
    }
  }, [])

  return (
    <CallContext.Provider
      value={{
        callState,
        callId,
        remoteUserId,
        remoteUsername,
        remoteAvatarUrl,
        isMuted,
        isDeafened,
        callDuration,
        ping,
        pingSource,
        pingPath,
        unavailableReason,
        isVideoCall,
        callExpanded,
        localVideoStream,
        remoteVideoStream,
        toggleMute,
        toggleDeafen,
        expandCall,
        minimizeCall,
        initiateCall,
        acceptCall,
        declineCall,
        endCall,
      }}
    >
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}
