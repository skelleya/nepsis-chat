import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useVoice } from '../contexts/VoiceContext'
import { useCall } from '../contexts/CallContext'
import {
  getParticipantVideoStream,
  getScreenShareStream,
  hasLiveVideo,
} from '../utils/mediaTracks'
import { loadPrefs } from '../services/userPrefs'

export type PipCorner = 'tl' | 'tr' | 'bl' | 'br'

const PIP_CORNER_KEY = 'nepsis_voice_pip_corner'
const PAD = 12
const PANEL_W = 200
const PANEL_W_SCREEN = 300
const DRAG_THRESHOLD_PX = 5

function loadCorner(): PipCorner {
  try {
    const v = localStorage.getItem(PIP_CORNER_KEY)
    if (v === 'tl' || v === 'tr' || v === 'bl' || v === 'br') return v
  } catch {
    /* ignore */
  }
  return 'br'
}

function saveCorner(corner: PipCorner) {
  try {
    localStorage.setItem(PIP_CORNER_KEY, corner)
  } catch {
    /* ignore */
  }
}

function cornerStyle(corner: PipCorner, width: number): CSSProperties {
  const base: CSSProperties = { position: 'fixed', width, zIndex: 85 }
  if (corner === 'tl') return { ...base, top: PAD + 36, left: PAD }
  if (corner === 'tr') return { ...base, top: PAD + 36, right: PAD }
  if (corner === 'bl') return { ...base, bottom: PAD, left: PAD }
  return { ...base, bottom: PAD, right: PAD }
}

function snapCorner(clientX: number, clientY: number): PipCorner {
  const midX = window.innerWidth / 2
  const midY = window.innerHeight / 2
  const left = clientX < midX
  const top = clientY < midY
  if (top && left) return 'tl'
  if (top && !left) return 'tr'
  if (!top && left) return 'bl'
  return 'br'
}

function useAttachStream(videoRef: RefObject<HTMLVideoElement | null>, stream: MediaStream | null) {
  useEffect(() => {
    const el = videoRef.current
    if (!el || !stream) return
    if (el.srcObject !== stream) el.srcObject = stream
    const play = () => {
      void el.play().catch(() => {})
    }
    play()
    const onUnmute = () => play()
    stream.getVideoTracks().forEach((t) => t.addEventListener('unmute', onUnmute))
    return () => {
      stream.getVideoTracks().forEach((t) => t.removeEventListener('unmute', onUnmute))
      if (el.srcObject === stream) {
        el.pause()
        el.srcObject = null
      }
    }
  }, [videoRef, stream])
}

function useSpeakingDetector(stream: MediaStream | null, enabled = true): boolean {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    if (!enabled || !stream) {
      setSpeaking(false)
      return
    }
    const track = stream.getAudioTracks().find((t) => t.readyState === 'live')
    if (!track) {
      setSpeaking(false)
      return
    }
    let running = true
    let audioCtx: AudioContext | null = null
    let raf = 0
    const start = async () => {
      try {
        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(new MediaStream([track]))
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        let lastSpeak = 0
        const tick = () => {
          if (!running) return
          analyser.getByteFrequencyData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i]
          const avg = sum / data.length
          const now = performance.now()
          if (avg > 18) lastSpeak = now
          setSpeaking(now - lastSpeak < 400)
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setSpeaking(false)
      }
    }
    void start()
    return () => {
      running = false
      cancelAnimationFrame(raf)
      void audioCtx?.close()
    }
  }, [stream, enabled])
  return speaking
}

function PipTile({
  stream,
  username,
  avatarUrl,
  mirror,
  speaking,
  isScreen = false,
}: {
  stream: MediaStream | null
  username: string
  avatarUrl?: string
  mirror?: boolean
  speaking: boolean
  isScreen?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasFrame, setHasFrame] = useState(false)
  const live = !!stream && hasLiveVideo(stream)
  useAttachStream(videoRef, live ? stream : null)

  useEffect(() => {
    setHasFrame(false)
  }, [stream])

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg bg-app-darker ${
        isScreen ? 'aspect-[16/10] min-h-[140px]' : 'aspect-video'
      } ${speaking ? 'ring-2 ring-[#23a559]' : 'ring-1 ring-white/15'}`}
    >
      {!hasFrame && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-app-channel">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-app-accent text-sm font-bold text-white">
              {(username || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      {live && stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setHasFrame(true)}
          onPlaying={() => setHasFrame(true)}
          className={`h-full w-full transition-opacity ${
            isScreen ? 'object-contain bg-black' : 'object-cover'
          } ${hasFrame ? 'opacity-100' : 'opacity-0'} ${mirror ? 'scale-x-[-1]' : ''}`}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
        <div className="truncate text-[10px] font-medium text-white">{username}</div>
      </div>
      {isScreen && (
        <span className="absolute left-1 top-1 rounded-sm bg-[#ed4245] px-1 py-0.5 text-[9px] font-bold uppercase text-white">
          Live
        </span>
      )}
    </div>
  )
}

function SpeakingPipTile({
  stream,
  username,
  avatarUrl,
  mirror,
  detectStream,
  detectEnabled,
  isScreen,
}: {
  stream: MediaStream | null
  username: string
  avatarUrl?: string
  mirror?: boolean
  detectStream: MediaStream | null
  detectEnabled: boolean
  isScreen?: boolean
}) {
  const speaking = useSpeakingDetector(detectStream, detectEnabled)
  return (
    <PipTile
      stream={stream}
      username={username}
      avatarUrl={avatarUrl}
      mirror={mirror}
      speaking={speaking}
      isScreen={isScreen}
    />
  )
}

type VoiceFloatingOverlayProps = {
  /** True when VoiceView is not the active main pane (text / DM / friends / etc.). */
  visible: boolean
  currentUserId: string
  currentUsername: string
  currentUserAvatarUrl?: string
  avatarByUserId: Map<string, string | undefined>
  onReturnToVoice: () => void
}

type PipTileModel = {
  key: string
  username: string
  avatarUrl?: string
  video: MediaStream | null
  detect: MediaStream | null
  detectEnabled: boolean
  mirror?: boolean
  isScreen?: boolean
}

/**
 * Discord-like floating camera panel while connected to voice but viewing text/DM.
 * Drag to snap to any corner; click a tile or the header to jump back to the voice channel.
 * Tile order is stable (local + join order); speaking only drives the green ring.
 */
export function VoiceFloatingOverlay({
  visible,
  currentUserId,
  currentUsername,
  currentUserAvatarUrl,
  avatarByUserId,
  onReturnToVoice,
}: VoiceFloatingOverlayProps) {
  const voice = useVoice()
  const call = useCall()
  const [corner, setCorner] = useState<PipCorner>(() => loadCorner())
  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const dragOrigin = useRef({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const mirrorLocal = loadPrefs().voice.mirrorCameraPreview

  const tiles = useMemo(() => {
    if (!voice.isConnected) return [] as PipTileModel[]
    const screens: PipTileModel[] = []
    const cameras: PipTileModel[] = []

    if (voice.isScreenSharing && voice.screenStream && hasLiveVideo(voice.screenStream)) {
      screens.push({
        key: `local-screen-${currentUserId}`,
        username: `${currentUsername} — Screen`,
        avatarUrl: currentUserAvatarUrl,
        video: voice.screenStream,
        detect: voice.localStream,
        detectEnabled: !voice.isMuted,
        isScreen: true,
      })
    }

    if (voice.isCameraOn && voice.videoStream && hasLiveVideo(voice.videoStream)) {
      cameras.push({
        key: `local-${currentUserId}`,
        username: `${currentUsername} (you)`,
        avatarUrl: currentUserAvatarUrl,
        video: voice.videoStream,
        detect: voice.localStream,
        detectEnabled: !voice.isMuted,
        mirror: mirrorLocal,
      })
    }

    for (const p of voice.participants) {
      if (p.userId === currentUserId) continue
      const knownShare = voice.screenShareUserIds.includes(p.userId)
      if (knownShare) {
        const screen = getScreenShareStream(p.stream, { knownScreenSharing: true })
        if (screen && hasLiveVideo(screen)) {
          screens.push({
            key: `screen-${p.userId}`,
            username: `${p.username} — Screen`,
            avatarUrl: avatarByUserId.get(p.userId),
            video: screen,
            detect: p.stream,
            detectEnabled: true,
            isScreen: true,
          })
        }
      }
      const video = getParticipantVideoStream(p.stream, {
        knownScreenSharing: knownShare,
      })
      if (!video || !hasLiveVideo(video)) continue
      cameras.push({
        key: p.userId,
        username: p.username,
        avatarUrl: avatarByUserId.get(p.userId),
        video,
        detect: p.stream,
        detectEnabled: true,
      })
    }

    // Screens first (larger / more useful while in text), then stable camera join order.
    // Cap cameras so the panel stays compact; always keep at least one screen if present.
    const maxCameras = screens.length > 0 ? 3 : 4
    return [...screens.slice(0, 2), ...cameras.slice(0, maxCameras)]
  }, [
    voice.isConnected,
    voice.isScreenSharing,
    voice.screenStream,
    voice.isCameraOn,
    voice.videoStream,
    voice.localStream,
    voice.isMuted,
    voice.participants,
    voice.screenShareUserIds,
    currentUserId,
    currentUsername,
    currentUserAvatarUrl,
    avatarByUserId,
    mirrorLocal,
  ])

  const panelWidth = tiles.some((t) => t.isScreen) ? PANEL_W_SCREEN : PANEL_W

  const endDrag = useCallback((clientX: number, clientY: number) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (movedRef.current) {
      const next = snapCorner(clientX, clientY)
      setCorner(next)
      saveCorner(next)
    }
    setDragging(false)
    setDragPos(null)
    movedRef.current = false
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return
      // Buttons (Open / channel name) keep click-to-return; drag from the grab bar chrome.
      if ((e.target as HTMLElement | null)?.closest?.('button')) return
      const el = panelRef.current
      if (!el) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      dragOrigin.current = { x: e.clientX, y: e.clientY }
      draggingRef.current = true
      movedRef.current = false
      setDragging(true)
      setDragPos({ x: rect.left, y: rect.top })

      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return
        const dist = Math.hypot(ev.clientX - dragOrigin.current.x, ev.clientY - dragOrigin.current.y)
        if (!movedRef.current && dist < DRAG_THRESHOLD_PX) return
        movedRef.current = true
        const w = panelRef.current?.offsetWidth ?? panelWidth
        const h = panelRef.current?.offsetHeight ?? 160
        const x = Math.min(window.innerWidth - w - 4, Math.max(4, ev.clientX - dragOffset.current.x))
        const y = Math.min(window.innerHeight - h - 4, Math.max(4, ev.clientY - dragOffset.current.y))
        setDragPos({ x, y })
      }

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        endDrag(ev.clientX, ev.clientY)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [endDrag, panelWidth]
  )

  // Safety: if the overlay unmounts mid-drag, clear listeners via end state.
  useEffect(() => {
    return () => {
      draggingRef.current = false
    }
  }, [])

  const show =
    visible &&
    voice.isConnected &&
    call.callState === 'idle' &&
    tiles.length > 0

  if (!show || typeof document === 'undefined') return null

  const style: CSSProperties =
    dragging && dragPos
      ? {
          position: 'fixed',
          left: dragPos.x,
          top: dragPos.y,
          width: panelWidth,
          zIndex: 85,
          transition: 'none',
        }
      : {
          ...cornerStyle(corner, panelWidth),
          transition: 'top 160ms ease, left 160ms ease, right 160ms ease, bottom 160ms ease, width 160ms ease',
        }

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className="select-none rounded-xl border border-app-glass/15 bg-app-darker/95 shadow-2xl backdrop-blur-md"
      role="complementary"
      aria-label="Voice cameras"
    >
      <div
        className="flex cursor-grab items-center gap-1.5 border-b border-app-glass/10 px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={onPointerDown}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#23a559]" aria-hidden />
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold text-app-text hover:text-app-accent"
          onClick={(e) => {
            e.stopPropagation()
            onReturnToVoice()
          }}
          title="Return to voice channel"
        >
          {voice.voiceChannelName || 'Voice'}
        </button>
        <button
          type="button"
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-app-muted hover:bg-app-hover hover:text-app-text"
          onClick={(e) => {
            e.stopPropagation()
            onReturnToVoice()
          }}
        >
          Open
        </button>
      </div>
      <div className="flex flex-col gap-1.5 p-1.5">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className="block w-full text-left"
            onClick={onReturnToVoice}
            title={`Return to ${voice.voiceChannelName || 'voice'}`}
          >
            <SpeakingPipTile
              stream={tile.video}
              username={tile.username}
              avatarUrl={tile.avatarUrl}
              mirror={tile.mirror}
              detectStream={tile.detect}
              detectEnabled={tile.detectEnabled}
              isScreen={tile.isScreen}
            />
          </button>
        ))}
      </div>
      <p className="px-2 pb-1.5 text-[9px] text-app-muted">Drag to a corner</p>
    </div>,
    document.body
  )
}
