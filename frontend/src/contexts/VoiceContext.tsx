import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createBroadcastSignaling } from '../services/signaling'
import { createSocketSignaling } from '../services/socketSignaling'
import { createWebRTCClient } from '../services/webrtc'
import { ensureIceServers } from '../services/iceConfig'
import { sounds } from '../services/sounds'
import {
  getAudioConstraints,
  getScreenConstraints,
  getVideoConstraints,
  loadPrefs,
  subscribePrefs,
  updatePrefs,
  type MicProcessingLevel,
} from '../services/userPrefs'
import { createPortal } from 'react-dom'
import { RemoteAudio } from '../components/RemoteAudio'
import { getRemoteAudioStream, getScreenShareStream } from '../utils/mediaTracks'
import { getCallBusy } from '../services/mediaSessionGate'
import { smoothPing, type IcePathType, type PingSource } from '../services/connectionStats'
import { formatMediaPermissionError } from '../utils/mediaPermissionError'

export interface VoiceParticipant {
  userId: string
  username: string
  stream: MediaStream | null
  isSpeaking: boolean
  isMuted?: boolean
  isDeafened?: boolean
  /** Incremented when the stream's tracks change (forces React re-render) */
  streamVersion: number
}

export interface RemoteVoiceState {
  muted: boolean
  deafened: boolean
}

interface VoiceContextValue {
  voiceChannelId: string | null
  voiceChannelName: string | null
  /** Voice session owned by another same-account browser tab (observer state). */
  otherTabVoiceChannelId: string | null
  otherTabVoiceChannelName: string | null
  isConnected: boolean
  isMuted: boolean
  isDeafened: boolean
  isSoundboardMuted: boolean
  micProcessing: MicProcessingLevel
  setIsMuted: (v: boolean) => void
  setIsDeafened: (v: boolean) => void
  setIsSoundboardMuted: (v: boolean) => void
  setMicProcessing: (value: MicProcessingLevel) => Promise<void>
  isCameraOn: boolean
  isScreenSharing: boolean
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  videoStream: MediaStream | null
  screenStream: MediaStream | null
  participants: VoiceParticipant[]
  /** User IDs that have left (peer-left) — exclude from presence merge to avoid ghost "Connecting..." */
  leftUserIds: Set<string>
  remoteVoiceStates: Record<string, RemoteVoiceState>
  localStream: MediaStream | null
  isSpeaking: boolean      // local user speaking detection
  ping: number | null       // latency in ms
  pingSource: PingSource
  /** ICE path for the slowest peer (host/srflx/relay). Null when no peer stats. */
  pingPath: IcePathType | null
  joinVoice: (channelId: string, channelName: string) => Promise<void>
  leaveVoice: (opts?: { preserveRejoin?: boolean }) => void
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

function readObservedVoiceTab(userId: string): { channelId: string | null; channelName: string | null } {
  try {
    const raw = localStorage.getItem(`nepsis_voice_tab_${userId}`)
    const owner = raw ? JSON.parse(raw) as { channelId?: string; channelName?: string; updatedAt?: number } : null
    if (owner?.updatedAt && Date.now() - owner.updatedAt < 30_000) {
      return { channelId: owner.channelId || null, channelName: owner.channelName || null }
    }
  } catch { /* ignore */ }
  return { channelId: null, channelName: null }
}

interface VoiceProviderProps {
  children: React.ReactNode
  userId: string
  username: string
}

export function VoiceProvider({ children, userId, username }: VoiceProviderProps) {
  const initialObservedRef = useRef(readObservedVoiceTab(userId))
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null)
  const [voiceChannelName, setVoiceChannelName] = useState<string | null>(null)
  const [otherTabVoiceChannelId, setOtherTabVoiceChannelId] = useState<string | null>(initialObservedRef.current.channelId)
  const [otherTabVoiceChannelName, setOtherTabVoiceChannelName] = useState<string | null>(initialObservedRef.current.channelName)
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMutedState] = useState(false)
  const [isDeafened, setIsDeafenedState] = useState(false)
  const [isSoundboardMuted, setIsSoundboardMuted] = useState(false)
  const [micProcessing, setMicProcessingState] = useState<MicProcessingLevel>(() => loadPrefs().voice.micProcessing)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ping, setPing] = useState<number | null>(null)
  const [pingSource, setPingSource] = useState<PingSource>('none')
  const [pingPath, setPingPath] = useState<IcePathType | null>(null)
  const pingSourceRef = useRef<PingSource>('none')
  const [leftUserIds, setLeftUserIds] = useState<Set<string>>(new Set())
  const [watchingShareUserId, setWatchingShareUserId] = useState<string | null>(null)
  /** Explicit screen-share signals from peers (remote tracks often lack labels) */
  const [remoteScreenShareIds, setRemoteScreenShareIds] = useState<Set<string>>(new Set())
  const [remoteVoiceStates, setRemoteVoiceStates] = useState<Record<string, RemoteVoiceState>>({})
  const participantsRef = useRef<VoiceParticipant[]>([])

  const webrtcRef = useRef<ReturnType<typeof createWebRTCClient> | null>(null)
  const signalingRef = useRef<ReturnType<typeof createBroadcastSignaling> | ReturnType<typeof createSocketSignaling> | null>(null)
  const leftUserClearTimeoutsRef = useRef<Map<string, number>>(new Map())
  const voiceChannelIdRef = useRef<string | null>(null)
  const voiceChannelNameRef = useRef<string | null>(null)
  const leaveVoiceRef = useRef<(opts?: { preserveRejoin?: boolean }) => void>(() => {})
  const joinVoiceRef = useRef<(id: string, name: string) => Promise<void>>(async () => {})
  voiceChannelIdRef.current = voiceChannelId
  voiceChannelNameRef.current = voiceChannelName

  const VOICE_REJOIN_KEY = 'nepsis_voice_rejoin'
  const isMutedRef = useRef(false)
  const isDeafenedRef = useRef(false)
  const mutedBeforeDeafenRef = useRef(false)
  const isSoundboardMutedRef = useRef(false)
  const playingSoundboardRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const tabIdRef = useRef(crypto.randomUUID())
  isMutedRef.current = isMuted
  isDeafenedRef.current = isDeafened
  participantsRef.current = participants

  // Share the active voice owner across tabs without creating a second WebRTC
  // session. Observer tabs can render presence and avoid overwriting it.
  useEffect(() => {
    const key = `nepsis_voice_tab_${userId}`
    const channelName = `nepsis-voice-tab-${userId}`
    const broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null
    const readOwner = () => {
      if (voiceChannelId) {
        setOtherTabVoiceChannelId(null)
        setOtherTabVoiceChannelName(null)
        return
      }
      try {
        const raw = localStorage.getItem(key)
        const owner = raw ? JSON.parse(raw) as {
          tabId?: string
          channelId?: string
          channelName?: string
          updatedAt?: number
        } : null
        const fresh = owner?.updatedAt && Date.now() - owner.updatedAt < 30_000
        const isOther = owner?.tabId && owner.tabId !== tabIdRef.current
        setOtherTabVoiceChannelId(fresh && isOther ? owner?.channelId || null : null)
        setOtherTabVoiceChannelName(fresh && isOther ? owner?.channelName || null : null)
      } catch {
        setOtherTabVoiceChannelId(null)
        setOtherTabVoiceChannelName(null)
      }
    }
    const publish = () => {
      if (!voiceChannelId) return
      const owner = {
        tabId: tabIdRef.current,
        channelId: voiceChannelId,
        channelName: voiceChannelName,
        updatedAt: Date.now(),
      }
      localStorage.setItem(key, JSON.stringify(owner))
      broadcast?.postMessage(owner)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) readOwner()
    }
    const onBroadcast = () => readOwner()
    window.addEventListener('storage', onStorage)
    broadcast?.addEventListener('message', onBroadcast)
    readOwner()
    publish()
    const interval = window.setInterval(voiceChannelId ? publish : readOwner, 1_500)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', onStorage)
      broadcast?.removeEventListener('message', onBroadcast)
      broadcast?.close()
      if (voiceChannelId) {
        try {
          const raw = localStorage.getItem(key)
          const owner = raw ? JSON.parse(raw) : null
          if (owner?.tabId === tabIdRef.current) localStorage.removeItem(key)
        } catch { /* ignore */ }
      }
    }
  }, [userId, voiceChannelId, voiceChannelName])
  isSoundboardMutedRef.current = isSoundboardMuted

  useEffect(() => subscribePrefs((prefs) => {
    setMicProcessingState(prefs.voice.micProcessing)
  }), [])

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

  const setMicProcessing = useCallback(async (value: MicProcessingLevel) => {
    const nextVoicePrefs = updatePrefs({ voice: { micProcessing: value } }).voice
    setMicProcessingState(nextVoicePrefs.micProcessing)
    setError(null)
    const currentTrack = localStream?.getAudioTracks()[0]
    if (!currentTrack) return
    const nextConstraints = getAudioConstraints(nextVoicePrefs)
    try {
      await currentTrack.applyConstraints(nextConstraints)
      return
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: nextConstraints,
          video: false,
        })
        const nextTrack = stream.getAudioTracks()[0]
        if (!nextTrack) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        try {
          ;(nextTrack as MediaStreamTrack & { contentHint?: string }).contentHint = 'speech'
        } catch {
          /* ignore */
        }
        nextTrack.enabled = !isMutedRef.current
        const nextStream = webrtcRef.current?.replaceAudioTrack
          ? await webrtcRef.current.replaceAudioTrack(nextTrack)
          : new MediaStream([nextTrack])
        if (!webrtcRef.current?.replaceAudioTrack) {
          currentTrack.stop()
          webrtcRef.current?.setLocalStream?.(nextStream)
        }
        setLocalStream(nextStream)
      } catch (err) {
        setError(formatMediaPermissionError(err, 'microphone'))
      }
    }
  }, [localStream])

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
    const leftTimer = leftUserClearTimeoutsRef.current.get(pUserId)
    if (leftTimer) {
      window.clearTimeout(leftTimer)
      leftUserClearTimeoutsRef.current.delete(pUserId)
    }
    setLeftUserIds((prev) => {
      if (!prev.has(pUserId)) return prev
      const next = new Set(prev)
      next.delete(pUserId)
      return next
    })
  }, [userId])

  const removeParticipant = useCallback((peerId: string) => {
    // Mark left so we don't keep a ghost "Connecting..." tile from stale WebRTC state.
    setLeftUserIds((prev) => new Set(prev).add(peerId))
    const existingTimer = leftUserClearTimeoutsRef.current.get(peerId)
    if (existingTimer) window.clearTimeout(existingTimer)
    const timer = window.setTimeout(() => {
      leftUserClearTimeoutsRef.current.delete(peerId)
      setLeftUserIds((prev) => {
        if (!prev.has(peerId)) return prev
        const next = new Set(prev)
        next.delete(peerId)
        return next
      })
    }, 10_000)
    leftUserClearTimeoutsRef.current.set(peerId, timer)
    setParticipants((prev) => prev.filter((p) => p.userId !== peerId))
    setRemoteScreenShareIds((prev) => {
      if (!prev.has(peerId)) return prev
      const next = new Set(prev)
      next.delete(peerId)
      return next
    })
    setRemoteVoiceStates((prev) => {
      if (!prev[peerId]) return prev
      const next = { ...prev }
      delete next[peerId]
      return next
    })
  }, [])

  const leaveVoice = useCallback((opts?: { preserveRejoin?: boolean }) => {
    if (voiceChannelId) sounds.voiceDisconnected()
    const sig = signalingRef.current as { emitScreenShare?: (active: boolean) => void } | null
    try {
      sig?.emitScreenShare?.(false)
    } catch {
      /* ignore */
    }
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
    for (const timer of leftUserClearTimeoutsRef.current.values()) {
      window.clearTimeout(timer)
    }
    leftUserClearTimeoutsRef.current.clear()
    setLeftUserIds(new Set())
    setRemoteScreenShareIds(new Set())
    setRemoteVoiceStates({})
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
    setPingSource('none')
    setPingPath(null)
    pingSourceRef.current = 'none'
    setError(null)
    setWatchingShareUserId(null)
    if (!opts?.preserveRejoin) {
      try {
        sessionStorage.removeItem(VOICE_REJOIN_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [localStream, videoStream, screenStream, voiceChannelId])

  leaveVoiceRef.current = leaveVoice

  const joinVoice = useCallback(async (channelId: string, channelName: string) => {
    if (voiceChannelId === channelId) return

    if (getCallBusy()) {
      setError('Leave call before joining voice')
      return
    }

    if (voiceChannelId) {
      leaveVoice()
      await new Promise((r) => setTimeout(r, 100))
    }

    setError(null)
    let acquiredStream: MediaStream | null = null
    try {
      // Prefetch ICE before joining so we don't miss room-peers while waiting
      const iceServers = await ensureIceServers()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(),
        video: false,
      })
      acquiredStream = stream
      for (const track of stream.getAudioTracks()) {
        try {
          ;(track as MediaStreamTrack & { contentHint?: string }).contentHint = 'speech'
        } catch {
          /* ignore */
        }
      }
      setLocalStream(stream)
      setVoiceChannelId(channelId)
      setVoiceChannelName(channelName)
      try {
        sessionStorage.setItem(VOICE_REJOIN_KEY, JSON.stringify({ channelId, channelName }))
      } catch {
        /* ignore */
      }
      setParticipants([])
      setLeftUserIds(new Set())
      setRemoteScreenShareIds(new Set())
      setRemoteVoiceStates({})

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
          onPeerMetadata: (pUserId, metadata) => {
            if (!pUserId || pUserId === userId) return
            if (metadata.screenSharing) {
              setRemoteScreenShareIds((prev) => new Set(prev).add(pUserId))
            }
            if (metadata.muted !== undefined || metadata.deafened !== undefined) {
              setRemoteVoiceStates((prev) => ({
                ...prev,
                [pUserId]: {
                  muted: !!metadata.muted,
                  deafened: !!metadata.deafened,
                },
              }))
            }
          },
        },
        iceServers
      )
      webrtcRef.current = webrtc
      webrtc.addLocalStream(stream)

      ;(signaling as {
        onReconnect?: (cb: () => void) => () => void
      }).onReconnect?.(() => {
        if (!voiceChannelIdRef.current) return
        setParticipants([])
        setLeftUserIds(new Set())
        setRemoteScreenShareIds(new Set())
        setRemoteVoiceStates({})
        webrtcRef.current?.resetPeers?.()
        void signaling.join()
      })

      await signaling.join()
      sounds.voiceConnected()
    } catch (err) {
      acquiredStream?.getTracks().forEach((t) => t.stop())
      try {
        webrtcRef.current?.leave()
      } catch {
        /* ignore */
      }
      webrtcRef.current = null
      try {
        ;(signalingRef.current as { close?: () => void } | null)?.close?.()
      } catch {
        /* ignore */
      }
      signalingRef.current = null
      setError(formatMediaPermissionError(err, 'microphone'))
      setVoiceChannelId(null)
      setVoiceChannelName(null)
      setLocalStream(null)
      setParticipants([])
      setLeftUserIds(new Set())
      setRemoteScreenShareIds(new Set())
      setRemoteVoiceStates({})
      try {
        sessionStorage.removeItem(VOICE_REJOIN_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [voiceChannelId, userId, username, leaveVoice, addOrUpdateParticipant, removeParticipant])

  joinVoiceRef.current = joinVoice

  // Refresh / close tab: clean leave, then auto-rejoin on next load
  useEffect(() => {
    const onPageHide = () => {
      if (!voiceChannelIdRef.current) return
      try {
        sessionStorage.setItem(
          VOICE_REJOIN_KEY,
          JSON.stringify({
            channelId: voiceChannelIdRef.current,
            channelName: voiceChannelNameRef.current || 'Voice',
          })
        )
      } catch {
        /* ignore */
      }
      leaveVoiceRef.current({ preserveRejoin: true })
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  // Auto-rejoin voice after refresh
  useEffect(() => {
    let cancelled = false
    try {
      const raw = sessionStorage.getItem(VOICE_REJOIN_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { channelId?: string; channelName?: string }
      if (!parsed.channelId) return
      const t = window.setTimeout(() => {
        if (cancelled) return
        void joinVoiceRef.current(parsed.channelId!, parsed.channelName || 'Voice')
      }, 400)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    } catch {
      /* ignore */
    }
  }, [userId])

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

  // Analyse remote audio once per media-track revision so the channel rail can
  // show the same speaking ring as the voice view.
  const remoteAudioKey = useMemo(
    () =>
      participants
        .map((p) => `${p.userId}:${p.streamVersion}:${p.stream?.getAudioTracks().map((t) => t.id).join(',') ?? ''}`)
        .join('|'),
    [participants]
  )
  useEffect(() => {
    const cleanups: Array<() => void> = []
    for (const participant of participantsRef.current) {
      const stream = participant.stream
      if (!stream?.getAudioTracks().some((track) => track.readyState === 'live')) continue
      let active = true
      let context: AudioContext | null = null
      let timer: number | null = null
      const start = async () => {
        try {
          context = new AudioContext()
          if (context.state === 'suspended') await context.resume()
          if (!active) return
          const analyser = context.createAnalyser()
          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.5
          context.createMediaStreamSource(stream).connect(analyser)
          const samples = new Uint8Array(analyser.frequencyBinCount)
          const sample = () => {
            if (!active) return
            analyser.getByteFrequencyData(samples)
            const speaking = samples.reduce((sum, value) => sum + value, 0) / samples.length > 8
            setParticipants((current) =>
              current.map((item) =>
                item.userId === participant.userId && item.isSpeaking !== speaking
                  ? { ...item, isSpeaking: speaking }
                  : item
              )
            )
            timer = window.setTimeout(sample, 100)
          }
          sample()
        } catch {
          /* Audio analysis is optional in browsers without AudioContext support. */
        }
      }
      void start()
      cleanups.push(() => {
        active = false
        if (timer !== null) window.clearTimeout(timer)
        void context?.close()
      })
    }
    return () => {
      cleanups.forEach((cleanup) => cleanup())
      setParticipants((current) =>
        current.some((participant) => participant.isSpeaking)
          ? current.map((participant) => ({ ...participant, isSpeaking: false }))
          : current
      )
    }
  }, [remoteAudioKey])

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

  // ─── Admin unmute listener ─
  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (signaling as { onAdminUnmute?: (cb: () => void) => () => void }).onAdminUnmute?.(() => {
      setIsMutedState(false)
    })
    return () => unsub?.()
  }, [voiceChannelId])

  // ─── Admin deafen listener ─
  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (signaling as { onAdminDeafen?: (cb: () => void) => () => void }).onAdminDeafen?.(() => {
      setIsMutedState(true)
      setIsDeafened(true)
    })
    return () => unsub?.()
  }, [voiceChannelId, setIsDeafened])

  // ─── Admin undeafen listener ─
  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (signaling as { onAdminUndeafen?: (cb: () => void) => () => void }).onAdminUndeafen?.(() => {
      setIsDeafenedState(false)
    })
    return () => unsub?.()
  }, [voiceChannelId])

  // ─── Local/remote voice-state sync (mute/deafen badges for peers) ─
  useEffect(() => {
    if (!voiceChannelId) return
    const sig = signalingRef.current as {
      emitVoiceState?: (state: { muted: boolean; deafened: boolean }) => void
    } | null
    sig?.emitVoiceState?.({ muted: isMuted, deafened: isDeafened })
  }, [voiceChannelId, isMuted, isDeafened])

  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (
      signaling as {
        onVoiceState?: (
          cb: (d: { userId: string; muted: boolean; deafened: boolean }) => void
        ) => () => void
      }
    ).onVoiceState?.(({ userId: fromId, muted, deafened }) => {
      if (!fromId || fromId === userId) return
      setRemoteVoiceStates((prev) => ({
        ...prev,
        [fromId]: { muted: !!muted, deafened: !!deafened },
      }))
    })
    return () => unsub?.()
  }, [voiceChannelId, userId])

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

  const playSoundboardAudio = useCallback((soundUrl: string) => {
    if (isDeafenedRef.current || isSoundboardMutedRef.current) return
    const existing = playingSoundboardRef.current.get(soundUrl)
    if (existing) {
      existing.pause()
      existing.currentTime = 0
    }
    const audio = new Audio(soundUrl)
    audio.volume = 0.8
    playingSoundboardRef.current.set(soundUrl, audio)
    const clear = () => {
      if (playingSoundboardRef.current.get(soundUrl) === audio) {
        playingSoundboardRef.current.delete(soundUrl)
      }
    }
    audio.addEventListener('ended', clear, { once: true })
    audio.addEventListener('error', clear, { once: true })
    void audio.play().catch(clear)
  }, [])

  // ─── Soundboard play listener (receive and play sounds from peers) ─
  useEffect(() => {
    const signaling = signalingRef.current
    const sig = signaling as {
      onSoundboardPlay?: (cb: (d: { soundUrl: string; userId?: string }) => void) => () => void
    }
    if (!sig?.onSoundboardPlay) return
    const unsub = sig.onSoundboardPlay(({ soundUrl, userId: fromUserId }) => {
      if (fromUserId === userId) return
      playSoundboardAudio(soundUrl)
    })
    return () => unsub?.()
  }, [voiceChannelId, userId, playSoundboardAudio])

  // ─── Ping measurement (WebRTC RTT, else socket RTT) ───────────────
  useEffect(() => {
    const connected = !!localStream && !!voiceChannelId
    if (!connected) {
      setPing(null)
      setPingSource('none')
      setPingPath(null)
      pingSourceRef.current = 'none'
      return
    }
    let cancelled = false
    const sample = async () => {
      try {
        const client = webrtcRef.current
        const hasPeers = (client?.getPeerCount() ?? 0) > 0
        const webrtcRtt = await client?.getPing()
        if (cancelled) return
        if (webrtcRtt?.ms != null) {
          const sameSource = pingSourceRef.current === 'webrtc'
          setPing((previous) => sameSource ? smoothPing(previous, webrtcRtt.ms!) : webrtcRtt.ms)
          setPingSource('webrtc')
          setPingPath(webrtcRtt.path ?? 'unknown')
          pingSourceRef.current = 'webrtc'
          return
        }
        if (hasPeers) {
          setPing(null)
          setPingSource('none')
          setPingPath(null)
          pingSourceRef.current = 'none'
          return
        }
        const sig = signalingRef.current as { measureLatency?: () => Promise<number | null> } | null
        const sockRtt = await sig?.measureLatency?.()
        if (!cancelled) {
          if (sockRtt != null) {
            const sameSource = pingSourceRef.current === 'server'
            setPing((previous) => sameSource ? smoothPing(previous, sockRtt) : sockRtt)
            setPingSource('server')
            setPingPath(null)
            pingSourceRef.current = 'server'
          } else {
            setPing(null)
            setPingSource('none')
            setPingPath(null)
            pingSourceRef.current = 'none'
          }
        }
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
        for (const track of stream.getVideoTracks()) {
          try {
            track.contentHint = 'motion'
          } catch {
            /* ignore */
          }
        }
        setVideoStream(stream)
        setIsCameraOn(true)
        // Add video tracks to all peer connections (triggers renegotiation)
        for (const track of stream.getTracks()) {
          await webrtcRef.current?.addTrackToAllPeers(track, stream)
        }
      } catch (err) {
        setError(formatMediaPermissionError(err, 'camera'))
      }
    }
  }, [isCameraOn, videoStream])

  const emitScreenShareState = useCallback((active: boolean) => {
    const sig = signalingRef.current as { emitScreenShare?: (a: boolean) => void } | null
    try {
      sig?.emitScreenShare?.(active)
    } catch {
      /* ignore */
    }
  }, [])

  // ─── Screen share toggle (sends screen over WebRTC) ───────────────
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing && screenStream) {
      const tracks = screenStream.getTracks()
      await webrtcRef.current?.removeTracksFromAllPeers(tracks)
      tracks.forEach((track) => track.stop())
      emitScreenShareState(false)
      setScreenStream(null)
      setIsScreenSharing(false)
      setWatchingShareUserId((prev) => (prev === userId ? null : prev))
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: getScreenConstraints(),
          audio: loadPrefs().voice.includeScreenShareAudio
            ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
        })
        const screenTrack = stream.getVideoTracks()[0]
        if (screenTrack) {
          try {
            screenTrack.contentHint = 'detail'
          } catch {
            /* ignore */
          }
        }
        for (const audioTrack of stream.getAudioTracks()) {
          try {
            audioTrack.contentHint = 'music'
          } catch {
            /* ignore */
          }
        }
        screenTrack?.addEventListener('ended', () => {
          // User stopped sharing via browser UI
          void webrtcRef.current?.removeTracksFromAllPeers(stream.getTracks())
          emitScreenShareState(false)
          setScreenStream(null)
          setIsScreenSharing(false)
          setWatchingShareUserId((prev) => (prev === userId ? null : prev))
        })
        setScreenStream(stream)
        setIsScreenSharing(true)
        emitScreenShareState(true)
        // Discord-like: sharer focuses their own share; others click to watch
        setWatchingShareUserId(userId)
        await webrtcRef.current?.addTracksToAllPeers(
          stream.getTracks().map((track) => ({ track, stream }))
        )
      } catch (err) {
        // User canceling the picker is NotAllowedError without "by system" — stay quiet.
        const name = err instanceof Error ? err.name : ''
        const msg = err instanceof Error ? err.message : ''
        if (name === 'NotAllowedError' && !/by system/i.test(msg)) return
        setError(formatMediaPermissionError(err, 'screen'))
      }
    }
  }, [isScreenSharing, screenStream, userId, emitScreenShareState])

  // Listen for peer screen-share start/stop (explicit signal)
  useEffect(() => {
    const signaling = signalingRef.current
    if (!signaling || !voiceChannelId) return
    const unsub = (
      signaling as {
        onScreenShare?: (cb: (d: { userId: string; active: boolean }) => void) => () => void
      }
    ).onScreenShare?.(({ userId: fromId, active }) => {
      if (!fromId || fromId === userId) return
      setRemoteScreenShareIds((prev) => {
        const next = new Set(prev)
        if (active) next.add(fromId)
        else next.delete(fromId)
        return next
      })
      // Remote shares are click-to-watch; only clear focus when the watched share stops.
      if (!active) setWatchingShareUserId((prev) => (prev === fromId ? null : prev))
    })
    return () => unsub?.()
  }, [voiceChannelId, userId])

  // Clear watch target if that user stopped sharing / left
  const screenShareUserIds = useMemo(() => {
    const ids = new Set<string>()
    if (isScreenSharing) ids.add(userId)
    for (const id of remoteScreenShareIds) ids.add(id)
    for (const p of participants) {
      if (p.stream && getScreenShareStream(p.stream)) ids.add(p.userId)
    }
    return Array.from(ids)
  }, [isScreenSharing, userId, participants, remoteScreenShareIds])

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
      playSoundboardAudio(soundUrl)
    }
  }, [playSoundboardAudio])

  return (
    <VoiceContext.Provider
      value={{
        voiceChannelId,
        voiceChannelName,
        otherTabVoiceChannelId,
        otherTabVoiceChannelName,
        isConnected,
        isMuted,
        isDeafened,
        isSoundboardMuted,
        micProcessing,
        setIsMuted,
        setIsDeafened,
        setIsSoundboardMuted,
        setMicProcessing,
        isCameraOn,
        isScreenSharing,
        toggleCamera,
        toggleScreenShare,
        videoStream,
        screenStream,
        participants,
        leftUserIds,
        remoteVoiceStates,
        localStream,
        isSpeaking,
        ping,
        pingSource,
        pingPath,
        joinVoice,
        leaveVoice,
        playSoundboardSound,
        error,
        screenShareUserIds,
        watchingShareUserId,
        setWatchingShareUserId,
      }}
    >
      {/* Playback is session-owned and portaled to document.body so Friends/DM/chat
          view swaps (and GSAP opacity on main content) cannot pause or unmount sinks. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            id="nepsis-voice-audio-root"
            aria-hidden
            style={{
              position: 'fixed',
              width: 0,
              height: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              left: 0,
              top: 0,
            }}
          >
            {isConnected &&
              participants
                .filter((participant) => participant.userId !== userId)
                .map((participant) => {
                  const audioStream = getRemoteAudioStream(participant.stream, {
                    knownScreenSharing: screenShareUserIds.includes(participant.userId),
                    includeScreenAudio: watchingShareUserId === participant.userId,
                  })
                  return (
                    <RemoteAudio
                      key={`voice-audio-${participant.userId}`}
                      stream={audioStream}
                      muted={isDeafened}
                    />
                  )
                })}
          </div>,
          document.body
        )}
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const ctx = useContext(VoiceContext)
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider')
  return ctx
}
