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

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export type CallState = 'idle' | 'calling' | 'ringing' | 'in-call'

interface CallContextValue {
  callState: CallState
  callId: string | null
  remoteUserId: string | null
  remoteUsername: string | null
  isMuted: boolean
  isDeafened: boolean
  callDuration: number
  unavailableReason: string | null
  toggleMute: () => void
  toggleDeafen: () => void
  initiateCall: (targetUserId: string, targetUsername: string) => void
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
  // ─── State (drives UI) ──────────────────────────────────────────
  const [callState, _setCallState] = useState<CallState>('idle')
  const [callId, _setCallId] = useState<string | null>(null)
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null)
  const [remoteUsername, setRemoteUsername] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)

  // ─── Refs (safe for socket-handler closures) ────────────────────
  const callStateRef = useRef<CallState>('idle')
  const callIdRef = useRef<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const stopRingRef = useRef<(() => void) | null>(null)
  const callTimeoutRef = useRef<number | null>(null)
  const durationIntervalRef = useRef<number | null>(null)
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([])
  const callNotificationRef = useRef<Notification | null>(null)

  // Sync wrappers — update both ref + state
  const setCallState = useCallback((s: CallState) => {
    callStateRef.current = s
    _setCallState(s)
  }, [])
  const setCallId = useCallback((id: string | null) => {
    callIdRef.current = id
    _setCallId(id)
  }, [])

  // ─── Cleanup everything ─────────────────────────────────────────
  const cleanup = useCallback(() => {
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
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    iceCandidateQueueRef.current = []
    setCallState('idle')
    setCallId(null)
    setRemoteUserId(null)
    setRemoteUsername(null)
    setIsMuted(false)
    setIsDeafened(false)
    setCallDuration(0)
  }, [setCallState, setCallId])

  // ─── Start call duration timer ──────────────────────────────────
  const startDurationTimer = useCallback(() => {
    const startTime = Date.now()
    durationIntervalRef.current = window.setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
  }, [])

  // ─── Setup WebRTC peer connection ───────────────────────────────
  const setupWebRTC = useCallback(
    async (isCaller: boolean) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = new RTCPeerConnection(ICE_CONFIG)
      pcRef.current = pc

      // Add local audio
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // Handle remote audio
      pc.ontrack = (e) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio()
          remoteAudioRef.current.autoplay = true
        }
        remoteAudioRef.current.srcObject = e.streams[0]
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

      // Flush any ICE candidates that arrived before PC was ready
      for (const candidate of iceCandidateQueueRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch {
          /* ignore */
        }
      }
      iceCandidateQueueRef.current = []

      startDurationTimer()
    },
    [startDurationTimer]
  )

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
      }: {
        callId: string
        callerId: string
        callerUsername: string
      }) => {
        if (callStateRef.current !== 'idle') {
          socket.emit('call:decline', { callId: id })
          return
        }
        setCallId(id)
        setRemoteUserId(callerId)
        setRemoteUsername(callerUsername)
        setCallState('ringing')
        stopRingRef.current = sounds.callRinging()

        // Browser notification when app is in background (another tab or minimized)
        if (typeof document !== 'undefined' && document.hidden && 'Notification' in window) {
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
      setCallState('in-call')
      await setupWebRTC(true) // caller creates offer
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
        await setupWebRTC(false)
        if (!pcRef.current) return
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
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
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username])

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
    (targetUserId: string, targetUsername: string) => {
      if (callStateRef.current !== 'idle') return
      const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      setCallId(id)
      setRemoteUserId(targetUserId)
      setRemoteUsername(targetUsername)
      setCallState('calling')
      socketRef.current?.emit('call:initiate', { targetUserId, callId: id })
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
    [cleanup, setCallId, setCallState]
  )

  const acceptCall = useCallback(() => {
    if (callStateRef.current !== 'ringing') return
    stopRingRef.current?.()
    stopRingRef.current = null
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }
    socketRef.current?.emit('call:accept', { callId: callIdRef.current })
    sounds.callConnected()
    setCallState('in-call')
    // WebRTC will be set up when the caller's offer arrives
  }, [setCallState])

  const declineCall = useCallback(() => {
    if (callStateRef.current !== 'ringing') return
    socketRef.current?.emit('call:decline', { callId: callIdRef.current })
    sounds.callDisconnected()
    cleanup()
  }, [cleanup])

  const endCall = useCallback(() => {
    socketRef.current?.emit('call:end', { callId: callIdRef.current })
    sounds.callDisconnected()
    cleanup()
  }, [cleanup])

  const toggleMute = useCallback(() => setIsMuted((v) => !v), [])
  const toggleDeafen = useCallback(() => setIsDeafened((v) => !v), [])

  return (
    <CallContext.Provider
      value={{
        callState,
        callId,
        remoteUserId,
        remoteUsername,
        isMuted,
        isDeafened,
        callDuration,
        unavailableReason,
        toggleMute,
        toggleDeafen,
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
