import { useState, useRef, useEffect, useMemo, useCallback, type MouseEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Channel } from '../types'
import { useVoice, type VoiceParticipant } from '../contexts/VoiceContext'
import { MicIcon, MicOffIcon, HeadphonesIcon, HeadphonesOffIcon } from './icons/VoiceIcons'
import { SoundboardDropdown } from './SoundboardDropdown'
import {
  getScreenShareStream,
  getParticipantVideoStream,
  hasLiveVideo,
} from '../utils/mediaTracks'
import {
  getPeerVolume,
  getStreamVolume,
  loadPrefs,
  setPeerVolume,
  setStreamVolume,
  subscribePrefs,
} from '../services/userPrefs'
import { SettingsDropdown } from './settings/SettingsDropdown'

interface VoiceViewProps {
  channel: Channel
  currentUserId: string
  currentUsername: string
  currentUserAvatarUrl?: string
  /** Users in this channel from presence (sidebar) — ensures we show them even before WebRTC connects */
  voiceUsersInChannel?: {
    userId: string
    username: string
    avatar_url?: string
    isMuted?: boolean
    isDeafened?: boolean
  }[]
  onInvitePeople?: () => Promise<void>
  /** Admin/owner: mute and disconnect users in voice */
  isAdminOrOwner?: boolean
  serverId?: string
  onMuteMember?: (userId: string) => Promise<void>
  onUnmuteMember?: (userId: string) => Promise<void>
  onDeafenMember?: (userId: string) => Promise<void>
  onUndeafenMember?: (userId: string) => Promise<void>
  onDisconnectMember?: (userId: string) => Promise<void>
}

function useAttachStream(videoRef: RefObject<HTMLVideoElement | null>, stream: MediaStream | null) {
  useEffect(() => {
    const el = videoRef.current
    if (!el || !stream) return
    if (el.srcObject !== stream) {
      el.srcObject = stream
    }
    const play = () => {
      el.play().catch(() => { /* autoplay may need gesture */ })
    }
    let resizeRaf: number | null = null
    play()
    const onUnmute = () => play()
    stream.getVideoTracks().forEach((t) => t.addEventListener('unmute', onUnmute))
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
          resizeRaf = requestAnimationFrame(() => {
            resizeRaf = null
            play()
          })
        })
      : null
    resizeObserver?.observe(el.parentElement || el)
    return () => {
      stream.getVideoTracks().forEach((t) => t.removeEventListener('unmute', onUnmute))
      resizeObserver?.disconnect()
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
      if (el.srcObject === stream) {
        el.pause()
        el.srcObject = null
      }
    }
  }, [videoRef, stream])
}

function AvatarGlyph({
  username,
  avatarUrl,
  className = '',
}: {
  username: string
  avatarUrl?: string
  className?: string
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={username} className={`object-cover ${className}`} />
  }
  return (
    <div className={`bg-app-accent flex items-center justify-center text-white font-bold ${className}`}>
      {(username || '?').charAt(0).toUpperCase()}
    </div>
  )
}

/** Large stage video — avatar placeholder until first frame (no black square). */
function StageVideo({
  stream,
  muted = false,
  label,
  badge,
  onClose,
  objectFit = 'contain',
  avatarUrl,
  username,
  mirror = false,
}: {
  stream: MediaStream
  muted?: boolean
  label: string
  badge?: 'live' | 'camera'
  onClose?: () => void
  objectFit?: 'contain' | 'cover'
  avatarUrl?: string
  username: string
  mirror?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasFrame, setHasFrame] = useState(false)
  useAttachStream(videoRef, stream)

  useEffect(() => {
    setHasFrame(false)
  }, [stream])

  return (
    <div className="relative w-full h-full min-h-0 rounded-xl overflow-hidden bg-app-darker border border-white/5 flex flex-col">
      {!hasFrame && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-[1] pointer-events-none">
          <AvatarGlyph
            username={username}
            avatarUrl={avatarUrl}
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-full text-4xl sm:text-5xl shadow-lg"
          />
          <span className="text-sm text-app-muted">Starting {badge === 'live' ? 'screen share' : 'camera'}…</span>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        onLoadedData={() => setHasFrame(true)}
        onPlaying={() => setHasFrame(true)}
        className={`flex-1 w-full h-full min-h-0 transition-opacity duration-200 ${
          objectFit === 'cover' ? 'object-cover' : 'object-contain'
        } ${hasFrame ? 'opacity-100' : 'opacity-0'} ${mirror ? 'scale-x-[-1]' : ''}`}
      />
      <div className="absolute top-3 left-3 flex items-center gap-2 z-[2]">
        {badge === 'live' && (
          <span className="bg-[#ed4245] text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm">
            Live
          </span>
        )}
        <span className="bg-black/55 px-2.5 py-1 rounded-md text-xs text-white font-medium">{label}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md bg-black/55 text-white hover:bg-black/80 transition-colors z-[2]"
          title="Stop watching"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

function useVideoTrackCount(stream: MediaStream | null, version = 0): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!stream) {
      setCount(0)
      return
    }
    const tracks = stream.getVideoTracks()
    // A remote WebRTC video track can remain `muted` until a video element is
    // attached and RTP starts flowing. Keep the tile mounted for every live
    // track; TileVideo independently hides stale frames while muted.
    const update = () =>
      setCount(stream.getVideoTracks().filter((track) => track.readyState === 'live').length)
    update()
    stream.addEventListener('addtrack', update)
    stream.addEventListener('removetrack', update)
    tracks.forEach((track) => {
      track.addEventListener('ended', update)
      track.addEventListener('mute', update)
      track.addEventListener('unmute', update)
    })
    return () => {
      stream.removeEventListener('addtrack', update)
      stream.removeEventListener('removetrack', update)
      tracks.forEach((track) => {
        track.removeEventListener('ended', update)
        track.removeEventListener('mute', update)
        track.removeEventListener('unmute', update)
      })
    }
  }, [stream, version])
  return count
}

function useSpeakingDetector(stream: MediaStream | null, enabled = true): boolean {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    if (!stream || !enabled) {
      setSpeaking(false)
      return
    }
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setSpeaking(false)
      return
    }
    let running = true
    let audioCtx: AudioContext | null = null
    const start = async () => {
      try {
        audioCtx = new AudioContext()
        if (audioCtx.state === 'suspended') await audioCtx.resume()
        if (!running) return
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.5
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const check = () => {
          if (!running) return
          analyser.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setSpeaking(avg > 8)
          setTimeout(check, 100)
        }
        check()
      } catch {
        /* AudioContext not available */
      }
    }
    start()
    return () => {
      running = false
      audioCtx?.close()
    }
  }, [stream, enabled])
  return speaking
}

function TileVideo({
  stream,
  muted = false,
  username,
  avatarUrl,
  mirror = false,
}: {
  stream: MediaStream
  muted?: boolean
  username: string
  avatarUrl?: string
  mirror?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasFrame, setHasFrame] = useState(false)
  useAttachStream(videoRef, stream)

  useEffect(() => {
    setHasFrame(false)
    const video = videoRef.current
    const tracks = stream.getVideoTracks()
    const clearFrame = () => {
      setHasFrame(false)
      if (tracks.every((track) => track.readyState === 'ended')) {
        video?.pause()
        if (video) video.srcObject = null
      }
    }
    const restoreFrame = () => {
      if (video && video.srcObject !== stream) video.srcObject = stream
      void video?.play().catch(() => {})
    }
    stream.addEventListener('removetrack', clearFrame)
    tracks.forEach((track) => {
      track.addEventListener('ended', clearFrame)
      track.addEventListener('mute', clearFrame)
      track.addEventListener('unmute', restoreFrame)
    })
    return () => {
      stream.removeEventListener('removetrack', clearFrame)
      tracks.forEach((track) => {
        track.removeEventListener('ended', clearFrame)
        track.removeEventListener('mute', clearFrame)
        track.removeEventListener('unmute', restoreFrame)
      })
    }
  }, [stream])

  return (
    <div className="relative w-full h-full bg-app-darker">
      {!hasFrame && (
        <div className="absolute inset-0 flex items-center justify-center z-[1]">
          <AvatarGlyph
            username={username}
            avatarUrl={avatarUrl}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full text-2xl"
          />
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        onLoadedData={() => setHasFrame(true)}
        onPlaying={() => setHasFrame(true)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${hasFrame ? 'opacity-100' : 'opacity-0'} ${mirror ? 'scale-x-[-1]' : ''}`}
      />
    </div>
  )
}

function ParticipantCard({
  participant,
  avatarUrl,
  isLocal,
  localStream,
  localVideoStream,
  participantVideoStream,
  mirrorLocalPreview,
  presenceOnly = false,
  isMuted,
  isDeafened,
  isCameraOn,
  currentUserId,
  isAdminOrOwner,
  onMuteMember,
  onUnmuteMember,
  onDeafenMember,
  onUndeafenMember,
  onDisconnectMember,
  isSharingScreen,
  isWatching,
  isWatchingShare = false,
  onWatchShare,
  onMaximizeCamera,
  large = false,
  compact = false,
}: {
  participant: { userId: string; username: string; stream: MediaStream | null; isSpeaking: boolean; streamVersion?: number }
  avatarUrl?: string
  isLocal: boolean
  localStream: MediaStream | null
  localVideoStream: MediaStream | null
  participantVideoStream: MediaStream | null
  mirrorLocalPreview: boolean
  presenceOnly?: boolean
  isMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  currentUserId: string
  isAdminOrOwner?: boolean
  onMuteMember?: (userId: string) => Promise<void>
  onUnmuteMember?: (userId: string) => Promise<void>
  onDeafenMember?: (userId: string) => Promise<void>
  onUndeafenMember?: (userId: string) => Promise<void>
  onDisconnectMember?: (userId: string) => Promise<void>
  isSharingScreen?: boolean
  isWatching?: boolean
  isWatchingShare?: boolean
  onWatchShare?: (userId: string) => void
  onMaximizeCamera?: (userId: string) => void
  large?: boolean
  /** Filmstrip / sidebar tile */
  compact?: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [userVolume, setUserVolume] = useState(() => getPeerVolume(participant.userId))
  const [streamVol, setStreamVol] = useState(() => getStreamVolume(participant.userId))
  const detectStream = isLocal ? localStream : participant.stream
  const speaking = useSpeakingDetector(detectStream, isLocal ? !isMuted : true)

  const remoteVideoCount = useVideoTrackCount(isLocal ? null : participant.stream, participant.streamVersion ?? 0)
  const hasRemoteCamera = !isLocal && !!participantVideoStream && remoteVideoCount > 0

  const showVideo = isLocal
    ? isCameraOn && !!localVideoStream && hasLiveVideo(localVideoStream)
    : hasRemoteCamera && hasLiveVideo(participantVideoStream)

  // Still show a video tile shell while tracks exist but frames aren't live yet (avatar inside)
  const showVideoShell = isLocal
    ? isCameraOn && !!localVideoStream
    : hasRemoteCamera

  const showMuted = isMuted
  const showAdminActions =
    !isLocal &&
    !!isAdminOrOwner &&
    !!(onMuteMember || onUnmuteMember || onDeafenMember || onUndeafenMember || onDisconnectMember)
  const showUserMenu = !isLocal

  useEffect(() => {
    if (!showMenu) return
    setUserVolume(getPeerVolume(participant.userId))
    setStreamVol(getStreamVolume(participant.userId))
  }, [showMenu, participant.userId])

  useEffect(() => {
    if (!showMenu) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [showMenu])

  const openUserMenu = (clientX: number, clientY: number) => {
    if (!showUserMenu) return
    const pad = 12
    const menuW = 260
    const menuH = 320
    const x = Math.min(clientX, window.innerWidth - menuW - pad)
    const y = Math.min(clientY, window.innerHeight - menuH - pad)
    setMenuPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
    setShowMenu(true)
  }

  // Left-click: watch / maximize (Discord-like). Right-click: volume + admin menu.
  // Opening the menu on left-click raced with dismiss and made it feel "stuck".
  const handleCardClick = () => {
    if (showMenu) {
      setShowMenu(false)
      return
    }
    if (isSharingScreen && onWatchShare) {
      onWatchShare(participant.userId)
      return
    }
    if (showVideoShell && onMaximizeCamera) onMaximizeCamera(participant.userId)
  }

  const handleCardContextMenu = (e: MouseEvent) => {
    if (!showUserMenu) return
    e.preventDefault()
    e.stopPropagation()
    openUserMenu(e.clientX, e.clientY)
  }

  const userMenu =
    showUserMenu &&
    showMenu &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        {/* Full-screen backdrop above cards so click-away cannot reopen another menu */}
        <div
          className="fixed inset-0 z-[199]"
          aria-hidden
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowMenu(false)
          }}
        />
        <div
          className="fixed z-[200] bg-[#111214] rounded-lg shadow-xl py-2 min-w-[240px] max-w-[280px] border border-app-hover/30"
          style={{ left: menuPos.x, top: menuPos.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          role="menu"
        >
        <div className="px-3 pb-1.5 text-xs font-semibold text-app-muted truncate">
          {participant.username}
        </div>
        <div className="px-3 py-2 space-y-1.5 border-b border-app-hover/30">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-app-text">User volume</span>
            <span className="text-xs text-app-muted tabular-nums">{Math.round(userVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={Math.round(userVolume * 100)}
            onChange={(e) => {
              const next = Number(e.target.value) / 100
              setUserVolume(next)
              setPeerVolume(participant.userId, next)
            }}
            className="w-full accent-app-accent"
            aria-label={`Volume for ${participant.username}`}
          />
          <p className="text-[10px] text-app-muted leading-snug">
            Right-click a user for this menu. 100% is normal; lower to quiet them.
          </p>
        </div>
        {isSharingScreen && (
          <div className="px-3 py-2 space-y-1.5 border-b border-app-hover/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-app-text">Stream volume</span>
              <span className="text-xs text-app-muted tabular-nums">{Math.round(streamVol * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              step={1}
              value={Math.round(streamVol * 100)}
              onChange={(e) => {
                const next = Number(e.target.value) / 100
                setStreamVol(next)
                setStreamVolume(participant.userId, next)
              }}
              className="w-full accent-app-accent"
              aria-label={`Stream volume for ${participant.username}`}
            />
            <p className="text-[10px] text-app-muted leading-snug">
              Applies while you watch their screen share audio.
            </p>
          </div>
        )}
        {(isSharingScreen && onWatchShare) || (showVideoShell && onMaximizeCamera) ? (
          <div className="py-1 border-b border-app-hover/30">
            {isSharingScreen && onWatchShare && (
              <button
                type="button"
                onClick={() => {
                  onWatchShare(participant.userId)
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white"
              >
                {isWatchingShare ? 'Stop watching stream' : 'Watch stream'}
              </button>
            )}
            {showVideoShell && onMaximizeCamera && (
              <button
                type="button"
                onClick={() => {
                  onMaximizeCamera(participant.userId)
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white"
              >
                {isWatching && !isWatchingShare ? 'Restore camera' : 'Maximize camera'}
              </button>
            )}
          </div>
        ) : null}
        {showAdminActions && (
          <div className="py-1">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
              Admin
            </div>
            {(isMuted ? onUnmuteMember : onMuteMember) && (
              <button
                type="button"
                onClick={async () => {
                  if (isMuted) {
                    await onUnmuteMember?.(participant.userId)
                  } else {
                    await onMuteMember?.(participant.userId)
                  }
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
              >
                {isMuted ? <MicIcon size={14} /> : <MicOffIcon size={14} />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
            )}
            {(isDeafened ? onUndeafenMember : onDeafenMember) && (
              <button
                type="button"
                onClick={async () => {
                  if (isDeafened) {
                    await onUndeafenMember?.(participant.userId)
                  } else {
                    await onDeafenMember?.(participant.userId)
                  }
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
              >
                {isDeafened ? <HeadphonesIcon size={14} /> : <HeadphonesOffIcon size={14} />}
                {isDeafened ? 'Undeafen' : 'Deafen'}
              </button>
            )}
            {onDisconnectMember && (
              <button
                type="button"
                onClick={async () => {
                  await onDisconnectMember(participant.userId)
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
                Disconnect
              </button>
            )}
          </div>
        )}
        </div>
      </>,
      document.body
    )

  // Inset rings stay inside the tile box so filmstrip overflow-x never clips them.
  const ringClass = isWatching
    ? 'ring-2 ring-inset ring-app-accent'
    : speaking
      ? 'ring-2 ring-inset ring-[#23a559]'
      : 'ring-1 ring-inset ring-white/10'

  if (compact) {
    return (
      <div
        className={`relative shrink-0 w-[7.5rem] sm:w-36 h-[4.75rem] sm:h-[5.5rem] rounded-lg ${ringClass} ${
          showUserMenu || (isSharingScreen && onWatchShare) || (showVideoShell && onMaximizeCamera)
            ? 'cursor-pointer'
            : ''
        }`}
        onClick={handleCardClick}
        onContextMenu={handleCardContextMenu}
        title={participant.username}
      >
        <div className="w-full h-full rounded-lg overflow-hidden bg-app-channel">
          {showVideoShell && (isLocal ? localVideoStream : participantVideoStream) ? (
            <TileVideo
              stream={(isLocal ? localVideoStream : participantVideoStream)!}
              muted
              username={participant.username}
              avatarUrl={avatarUrl}
              mirror={isLocal && mirrorLocalPreview}
            />
          ) : (
            <div className="w-full h-full bg-app-channel flex items-center justify-center">
              <AvatarGlyph
                username={participant.username}
                avatarUrl={avatarUrl}
                className="w-12 h-12 rounded-full text-lg"
              />
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
          <div className="text-[11px] text-white font-medium truncate">
            {participant.username}
            {participant.userId === currentUserId ? ' (you)' : ''}
          </div>
        </div>
        {isSharingScreen && (
          <span className="absolute top-1 left-1 bg-[#ed4245] text-white text-[9px] font-bold uppercase px-1 py-0.5 rounded-sm">
            Live
          </span>
        )}
        {showMuted && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#ed4245] flex items-center justify-center">
            <MicOffIcon size={10} className="text-white" />
          </div>
        )}
        {userMenu}
      </div>
    )
  }

  const circleSize = large
    ? 'w-36 h-36 sm:w-48 sm:h-48 text-4xl sm:text-5xl'
    : 'w-24 h-24 sm:w-28 sm:h-28 text-2xl sm:text-3xl'
  const videoTileSize = large
    ? 'w-full aspect-video min-h-[280px]'
    : 'w-full aspect-video min-h-[220px]'
  const muteBadgeSize = large ? 'w-9 h-9' : 'w-7 h-7'
  const muteIconSize = large ? 16 : 14

  return (
    <div
      className={`relative w-full min-w-0 min-h-[240px] flex flex-col items-center justify-center gap-3 p-3 sm:p-5 rounded-2xl border border-app-glass/[0.06] bg-app-channel/35 hover:bg-app-channel/55 transition-colors select-none ${
        showUserMenu || (isSharingScreen && onWatchShare) || (showVideoShell && onMaximizeCamera)
          ? 'cursor-pointer'
          : ''
      }`}
      onClick={handleCardClick}
      onContextMenu={handleCardContextMenu}
    >
      {isSharingScreen && (
        <div className="absolute -top-0.5 right-1 z-10 flex items-center gap-1">
          <span className="bg-[#ed4245] text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm">
            Live
          </span>
          {onWatchShare && isWatchingShare && (
            <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-sm">
              Watching
            </span>
          )}
        </div>
      )}
      {userMenu}
      {showVideoShell ? (
        <div
          className={`relative ${videoTileSize} rounded-xl ${ringClass}`}
          title={showUserMenu ? 'Click for user options' : 'Click to maximize'}
        >
          <div className="w-full h-full rounded-xl overflow-hidden bg-app-channel">
            {(isLocal ? localVideoStream : participantVideoStream) ? (
              <TileVideo
                stream={(isLocal ? localVideoStream : participantVideoStream)!}
                muted
                username={participant.username}
                avatarUrl={avatarUrl}
                mirror={isLocal && mirrorLocalPreview}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-app-channel">
                <AvatarGlyph
                  username={participant.username}
                  avatarUrl={avatarUrl}
                  className="w-20 h-20 rounded-full text-3xl"
                />
              </div>
            )}
          </div>
          {showMuted && (
            <div
              className={`absolute bottom-1.5 right-1.5 ${muteBadgeSize} rounded-full bg-[#ed4245] flex items-center justify-center ring-2 ring-app-darker shadow-md z-10`}
              title="Muted"
            >
              <MicOffIcon size={muteIconSize} className="text-white" />
            </div>
          )}
          {!showVideo && (
            <div className="absolute bottom-1.5 left-1.5 text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
              Connecting…
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <div
            className={`${circleSize} rounded-full flex items-center justify-center text-white font-bold transition-all duration-150 ${
              isWatching
                ? 'ring-4 ring-app-accent shadow-[0_0_16px_rgba(88,101,242,0.4)]'
                : speaking
                  ? 'ring-4 ring-[#23a559] shadow-[0_0_16px_rgba(35,165,89,0.55)] scale-105'
                  : 'ring-2 ring-white/10'
            }`}
          >
            <div className={`w-full h-full rounded-full overflow-hidden ${avatarUrl ? 'bg-transparent' : 'bg-app-accent'}`}>
              <AvatarGlyph
                username={participant.username}
                avatarUrl={avatarUrl}
                className={avatarUrl ? 'w-full h-full' : 'w-full h-full text-inherit'}
              />
            </div>
          </div>
          {showMuted && (
            <div
              className={`absolute -bottom-0.5 -right-0.5 ${muteBadgeSize} rounded-full bg-[#ed4245] flex items-center justify-center ring-[3px] ring-app-darker shadow-md`}
              title="Muted"
            >
              <MicOffIcon size={muteIconSize} className="text-white" />
            </div>
          )}
        </div>
      )}
      <div className="text-center w-full min-w-0">
        <div className="font-semibold text-app-text text-sm truncate">
          {participant.username}
          {participant.userId === currentUserId && (
            <span className="text-app-muted font-normal"> (you)</span>
          )}
        </div>
        <div className="text-app-muted text-xs">
          {isLocal
            ? (isMuted ? 'Muted' : speaking ? 'Speaking' : 'Connected')
            : (participant.stream || presenceOnly ? 'Connected' : 'Connecting...')}
        </div>
      </div>
    </div>
  )
}

export function VoiceView({
  channel,
  currentUserId,
  currentUsername,
  currentUserAvatarUrl,
  voiceUsersInChannel = [],
  onInvitePeople,
  isAdminOrOwner,
  serverId,
  onMuteMember,
  onUnmuteMember,
  onDeafenMember,
  onUndeafenMember,
  onDisconnectMember,
}: VoiceViewProps) {
  const voice = useVoice()
  const {
    participants,
    leftUserIds,
    remoteVoiceStates,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
    isCameraOn,
    isScreenSharing,
    toggleCamera,
    toggleScreenShare,
    videoStream,
    screenStream,
    leaveVoice,
    voiceChannelId,
    otherTabVoiceChannelId,
    localStream,
    playSoundboardSound,
    error,
    screenShareUserIds,
    watchingShareUserId,
    setWatchingShareUserId,
    micProcessing,
    setMicProcessing,
  } = voice

  const [soundboardOpen, setSoundboardOpen] = useState(false)
  const soundboardButtonRef = useRef<HTMLButtonElement>(null)
  const [maximizedCameraUserId, setMaximizedCameraUserId] = useState<string | null>(null)
  const [mirrorCameraPreview, setMirrorCameraPreview] = useState(
    () => loadPrefs().voice.mirrorCameraPreview
  )
  const autoFocusedCameraRef = useRef(false)

  useEffect(
    () => subscribePrefs((prefs) => setMirrorCameraPreview(prefs.voice.mirrorCameraPreview)),
    []
  )

  const isInThisChannel = voiceChannelId === channel.id

  const localParticipant = useMemo(
    () => ({
      userId: currentUserId,
      username: currentUsername,
      stream: null as MediaStream | null,
      isSpeaking: false,
      isMuted,
      isDeafened,
      streamVersion: 0,
    }),
    [currentUserId, currentUsername, isMuted, isDeafened]
  )

  const { allParticipants, avatarByUserId } = useMemo(() => {
    const participantByUserId = new Map<string, VoiceParticipant | typeof localParticipant>()
    const avatars = new Map<string, string>()
    if (isInThisChannel) {
      participantByUserId.set(currentUserId, localParticipant)
      if (currentUserAvatarUrl) avatars.set(currentUserId, currentUserAvatarUrl)
    }
    for (const p of participants) {
      participantByUserId.set(p.userId, p)
    }
    for (const vu of voiceUsersInChannel) {
      if (vu.userId !== currentUserId && leftUserIds.has(vu.userId)) continue
      if (!participantByUserId.has(vu.userId)) {
        participantByUserId.set(vu.userId, {
          userId: vu.userId,
          username: vu.username,
          stream: null,
          isSpeaking: false,
          isMuted: !!vu.isMuted,
          isDeafened: !!vu.isDeafened,
          streamVersion: 0,
        })
      } else {
        const existing = participantByUserId.get(vu.userId)!
        participantByUserId.set(vu.userId, {
          ...existing,
          username:
            vu.username && (!existing.username || existing.username === 'User' || existing.username === 'Unknown')
              ? vu.username
              : existing.username,
          isMuted: vu.isMuted ?? existing.isMuted,
          isDeafened: vu.isDeafened ?? existing.isDeafened,
        })
      }
      if (vu.avatar_url) avatars.set(vu.userId, vu.avatar_url)
    }
    const list = isInThisChannel
      ? [localParticipant, ...Array.from(participantByUserId.values()).filter((p) => p.userId !== currentUserId)]
      : Array.from(participantByUserId.values())
    return { allParticipants: list, avatarByUserId: avatars }
  }, [
    isInThisChannel,
    currentUserId,
    currentUserAvatarUrl,
    localParticipant,
    participants,
    leftUserIds,
    voiceUsersInChannel,
  ])

  const watchingStream = useMemo(() => {
    if (watchingShareUserId === currentUserId && isScreenSharing && screenStream) return screenStream
    if (!watchingShareUserId) return null
    const p = allParticipants.find((x) => x.userId === watchingShareUserId)
    const known = screenShareUserIds.includes(watchingShareUserId)
    return p?.stream ? getScreenShareStream(p.stream, { knownScreenSharing: known }) : null
  }, [
    watchingShareUserId,
    currentUserId,
    isScreenSharing,
    screenStream,
    allParticipants,
    screenShareUserIds,
  ])

  const watchingUsername =
    watchingShareUserId === currentUserId
      ? currentUsername
      : allParticipants.find((p) => p.userId === watchingShareUserId)?.username ?? 'Screen'

  const isWatchingShare = !!watchingStream && watchingStream.getVideoTracks().length > 0
  const isAlone = allParticipants.length === 1

  const maximizedCameraStream = useMemo(() => {
    if (!maximizedCameraUserId) return null
    if (maximizedCameraUserId === currentUserId) return videoStream
    const p = allParticipants.find((x) => x.userId === maximizedCameraUserId)
    const known = screenShareUserIds.includes(maximizedCameraUserId)
    return p?.stream ? getParticipantVideoStream(p.stream, { knownScreenSharing: known }) : null
  }, [maximizedCameraUserId, currentUserId, videoStream, allParticipants, screenShareUserIds])

  const maximizedCameraUsername =
    maximizedCameraUserId === currentUserId
      ? currentUsername
      : allParticipants.find((p) => p.userId === maximizedCameraUserId)?.username ?? 'Camera'

  // Auto-focus own camera once when turned on (bigger stage). Screen share takes priority.
  useEffect(() => {
    if (!isInThisChannel) return
    if (isCameraOn && videoStream && !watchingShareUserId && !autoFocusedCameraRef.current) {
      setMaximizedCameraUserId(currentUserId)
      autoFocusedCameraRef.current = true
    }
    if (!isCameraOn) {
      autoFocusedCameraRef.current = false
      setMaximizedCameraUserId((prev) => (prev === currentUserId ? null : prev))
    }
  }, [isCameraOn, videoStream, watchingShareUserId, currentUserId, isInThisChannel])

  // Clear maximized camera if that user turned camera off / left
  useEffect(() => {
    if (!maximizedCameraUserId) return
    if (maximizedCameraUserId === currentUserId && !isCameraOn) {
      setMaximizedCameraUserId(null)
      return
    }
    if (maximizedCameraUserId !== currentUserId) {
      const p = allParticipants.find((x) => x.userId === maximizedCameraUserId)
      const known = screenShareUserIds.includes(maximizedCameraUserId)
      if (!p?.stream || !getParticipantVideoStream(p.stream, { knownScreenSharing: known })) {
        setMaximizedCameraUserId(null)
      }
    }
  }, [maximizedCameraUserId, currentUserId, isCameraOn, allParticipants, screenShareUserIds])

  const handleWatchShare = useCallback(
    (userId: string) => {
      if (watchingShareUserId === userId) {
        setWatchingShareUserId(null)
      } else {
        setWatchingShareUserId(userId)
        // Keep camera maximize if both — dual focus layout
      }
    },
    [watchingShareUserId, setWatchingShareUserId]
  )

  const handleMaximizeCamera = useCallback(
    (userId: string) => {
      setMaximizedCameraUserId((prev) => (prev === userId ? null : userId))
    },
    []
  )

  const cycleMicProcessing = useCallback(() => {
    const next =
      micProcessing === 'off'
        ? 'standard'
        : micProcessing === 'standard'
          ? 'high'
          : 'off'
    void setMicProcessing(next)
  }, [micProcessing, setMicProcessing])

  const cardProps = useCallback(
    (
      p: {
        userId: string
        username: string
        stream: MediaStream | null
        isSpeaking: boolean
        streamVersion?: number
        isMuted?: boolean
        isDeafened?: boolean
      },
      opts: { large?: boolean; compact?: boolean } = {}
    ) => {
      const isLocal = p.userId === currentUserId
      const remoteState = remoteVoiceStates[p.userId]
      return {
        participant: p,
        avatarUrl: avatarByUserId.get(p.userId),
        isLocal,
        localStream,
        localVideoStream: videoStream,
        participantVideoStream:
          isLocal
            ? null
            : getParticipantVideoStream(p.stream, {
                knownScreenSharing: screenShareUserIds.includes(p.userId),
              }),
        mirrorLocalPreview: mirrorCameraPreview,
        presenceOnly: !isInThisChannel,
        isMuted: isLocal ? isMuted : remoteState?.muted ?? p.isMuted ?? false,
        isDeafened: isLocal ? isDeafened : remoteState?.deafened ?? p.isDeafened ?? false,
        isCameraOn,
        currentUserId,
        isAdminOrOwner,
        onMuteMember,
        onUnmuteMember,
        onDeafenMember,
        onUndeafenMember,
        onDisconnectMember,
        isSharingScreen: screenShareUserIds.includes(p.userId),
        isWatching: watchingShareUserId === p.userId || maximizedCameraUserId === p.userId,
        isWatchingShare: watchingShareUserId === p.userId,
        onWatchShare: screenShareUserIds.includes(p.userId) ? handleWatchShare : undefined,
        onMaximizeCamera: handleMaximizeCamera,
        large: opts.large,
        compact: opts.compact,
      }
    },
    [
      avatarByUserId,
      currentUserId,
      localStream,
      videoStream,
      isMuted,
      isDeafened,
      remoteVoiceStates,
      isCameraOn,
      screenShareUserIds,
      isAdminOrOwner,
      onMuteMember,
      onUnmuteMember,
      onDeafenMember,
      onUndeafenMember,
      onDisconnectMember,
      watchingShareUserId,
      maximizedCameraUserId,
      handleWatchShare,
      handleMaximizeCamera,
      mirrorCameraPreview,
      isInThisChannel,
    ]
  )

  const showFocusLayout = isWatchingShare || (!!maximizedCameraUserId && !!maximizedCameraStream)
  const showDualFocus = isWatchingShare && !!maximizedCameraUserId && !!maximizedCameraStream

  const showSelfPip =
    showFocusLayout &&
    isCameraOn &&
    !!videoStream &&
    maximizedCameraUserId !== currentUserId &&
    !(isWatchingShare && maximizedCameraUserId === currentUserId)

  const renderFilmstrip = () => (
    <div className="shrink-0 px-3 py-3 border-b border-app-glass/[0.06] bg-app-panel/90 backdrop-blur">
      {/* Inner padding keeps inset rings fully visible inside the horizontal scroller. */}
      <div className="flex gap-2.5 overflow-x-auto items-stretch p-1.5 scrollbar-thin">
        {allParticipants.map((p) => (
          <ParticipantCard key={p.userId} {...cardProps(p, { compact: true })} />
        ))}
      </div>
    </div>
  )

  const renderAvatarGrid = () => {
    if (allParticipants.length === 0) return null
    return (
      <div className="flex-1 overflow-auto p-3 sm:p-5 min-h-0">
        <div
          className={`voice-participant-grid grid w-full mx-auto gap-3 sm:gap-4 ${
            isAlone ? 'max-w-2xl' : 'max-w-7xl'
          }`}
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, var(--voice-grid-min)), 1fr))' }}
        >
          {allParticipants.map((p) => (
            <ParticipantCard key={p.userId} {...cardProps(p, { large: isAlone })} />
          ))}
        </div>
      </div>
    )
  }

  const renderFocusStage = () => {
    if (showDualFocus && watchingStream && maximizedCameraStream) {
      return (
        <div className="flex-1 flex flex-col min-h-0">
          {renderFilmstrip()}
          <div className="voice-dual-focus flex-1 flex flex-col gap-2.5 p-2.5 min-h-0 overflow-auto">
            <div className="flex-[1.65] min-w-0 min-h-[220px]">
              <StageVideo
                stream={watchingStream}
                muted
                badge="live"
                label={`${watchingUsername} — Screen`}
                username={watchingUsername}
                avatarUrl={watchingShareUserId ? avatarByUserId.get(watchingShareUserId) : undefined}
                objectFit="contain"
                onClose={() => setWatchingShareUserId(null)}
              />
            </div>
            <div className="flex-1 min-w-0 min-h-[200px]">
              <StageVideo
                stream={maximizedCameraStream}
                muted
                badge="camera"
                label={`${maximizedCameraUsername} — Camera`}
                username={maximizedCameraUsername}
                avatarUrl={maximizedCameraUserId ? avatarByUserId.get(maximizedCameraUserId) : undefined}
                objectFit="cover"
                mirror={maximizedCameraUserId === currentUserId && mirrorCameraPreview}
                onClose={() => setMaximizedCameraUserId(null)}
              />
            </div>
          </div>
        </div>
      )
    }

    if (isWatchingShare && watchingStream) {
      return (
        <div className="flex-1 flex flex-col min-h-0">
          {renderFilmstrip()}
          <div className="flex-1 p-2 min-h-0 relative">
            <StageVideo
              stream={watchingStream}
              muted
              badge="live"
              label={`${watchingUsername} — Screen`}
              username={watchingUsername}
              avatarUrl={watchingShareUserId ? avatarByUserId.get(watchingShareUserId) : undefined}
              objectFit="contain"
              onClose={() => setWatchingShareUserId(null)}
            />
            {showSelfPip && videoStream && (
              <div className="absolute bottom-4 right-4 w-36 sm:w-48 aspect-video rounded-xl overflow-hidden ring-1 ring-white/20 shadow-2xl z-[3]">
                <TileVideo
                  stream={videoStream}
                  muted
                  username={currentUsername}
                  avatarUrl={currentUserAvatarUrl}
                  mirror={mirrorCameraPreview}
                />
                <div className="absolute bottom-1 left-1.5 text-[10px] text-white font-medium drop-shadow">
                  You
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (maximizedCameraUserId && maximizedCameraStream) {
      return (
        <div className="flex-1 flex flex-col min-h-0">
          {allParticipants.length > 1 && renderFilmstrip()}
          <div className="flex-1 p-2 sm:p-3 min-h-0 relative">
            <StageVideo
              stream={maximizedCameraStream}
              muted
              badge="camera"
              label={`${maximizedCameraUsername} — Camera`}
              username={maximizedCameraUsername}
              avatarUrl={maximizedCameraUserId ? avatarByUserId.get(maximizedCameraUserId) : undefined}
              objectFit="cover"
              mirror={maximizedCameraUserId === currentUserId && mirrorCameraPreview}
              onClose={() => setMaximizedCameraUserId(null)}
            />
            {showSelfPip && videoStream && (
              <div className="absolute bottom-4 right-4 w-36 sm:w-44 aspect-video rounded-xl overflow-hidden ring-1 ring-white/20 shadow-2xl z-[3]">
                <TileVideo
                  stream={videoStream}
                  muted
                  username={currentUsername}
                  avatarUrl={currentUserAvatarUrl}
                  mirror={mirrorCameraPreview}
                />
              </div>
            )}
          </div>
        </div>
      )
    }

    return renderAvatarGrid()
  }

  return (
    <div className="voice-main-container flex-1 flex flex-col bg-app-darker min-h-0">
      <div className="h-12 px-4 flex items-center justify-between border-b border-app-glass/[0.06] bg-app-dark/85 backdrop-blur shrink-0">
        <div className="flex items-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-app-muted">
            <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6.586 7.00304H4C3.45 7.00304 3 7.45304 3 8.00304V16.003C3 16.553 3.45 17.003 4 17.003H6.586L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.003V4.00304C12 3.59904 11.757 3.23404 11.383 3.07904Z"/>
            <path d="M14 9.00304C14 9.00304 16 10.003 16 12.003C16 14.003 14 15.003 14 15.003" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <path d="M17 7.00304C17 7.00304 20 9.00304 20 12.003C20 15.003 17 17.003 17 17.003" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
          </svg>
          <span className="ml-2 font-semibold text-app-text">{channel.name}</span>
          {allParticipants.length > 0 && (
            <span className="ml-2 text-xs text-app-muted">/ {allParticipants.length} connected</span>
          )}
        </div>
        {onInvitePeople && (
          <button
            onClick={onInvitePeople}
            className="px-2 py-1 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/50 flex items-center gap-1.5"
            title="Invite People"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Invite
          </button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-2 p-2 rounded bg-red-900/50 text-red-200 text-sm shrink-0">{error}</div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!isInThisChannel && allParticipants.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center py-10">
            <div>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-app-muted/50 mx-auto mb-3">
                <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6.586 7.00304H4C3.45 7.00304 3 7.45304 3 8.00304V16.003C3 16.553 3.45 17.003 4 17.003H6.586L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.003V4.00304C12 3.59904 11.757 3.23404 11.383 3.07904Z"/>
              </svg>
              <h3 className="text-lg font-semibold text-app-text mb-1">{channel.name}</h3>
              <p className="text-sm text-app-muted mb-4">No one is currently in this voice channel.</p>
            </div>
          </div>
        )}

        {(isInThisChannel || allParticipants.length > 0) && renderFocusStage()}
      </div>

      <div className="p-4 border-t border-app-dark shrink-0">
        {isInThisChannel ? (
          <div className="flex items-center justify-center gap-2">
            <div className="hidden sm:block">
              <SettingsDropdown
                value={micProcessing}
                onChange={(value) => {
                  void setMicProcessing(value as typeof micProcessing)
                }}
                aria-label="Mic noise reduction"
                options={[
                  { value: 'off', label: 'Mic: Off' },
                  { value: 'standard', label: 'Mic: Standard' },
                  { value: 'high', label: 'Mic: High' },
                ]}
              />
            </div>
            <button
              type="button"
              onClick={cycleMicProcessing}
              className="sm:hidden px-3 py-2 rounded-full bg-app-hover hover:bg-app-channel text-app-text text-xs font-medium transition-colors"
              title={`Mic noise reduction: ${micProcessing}`}
            >
              {micProcessing === 'off' ? 'Mic Off' : micProcessing === 'high' ? 'Mic High' : 'Mic Std'}
            </button>
            <div className="relative">
              <SoundboardDropdown
                userId={currentUserId}
                serverId={serverId}
                canModerate={!!isAdminOrOwner}
                onPlay={playSoundboardSound}
                anchorRef={soundboardButtonRef}
                isOpen={soundboardOpen}
                onClose={() => setSoundboardOpen(false)}
              />
              <button
                ref={soundboardButtonRef}
                onClick={() => setSoundboardOpen(!soundboardOpen)}
                className={`p-3 rounded-full transition-colors ${
                  soundboardOpen ? 'bg-app-accent text-white' : 'bg-app-hover hover:bg-app-channel text-app-text'
                }`}
                title="Soundboard"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-full transition-colors ${
                isMuted ? 'bg-[#ed4245] hover:bg-[#c03537] text-white' : 'bg-app-hover hover:bg-app-channel text-app-text'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
              aria-pressed={isMuted}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOffIcon size={20} className="text-white" /> : <MicIcon size={20} />}
            </button>
            <button
              onClick={() => setIsDeafened(!isDeafened)}
              className={`p-3 rounded-full transition-colors ${
                isDeafened ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-app-hover hover:bg-app-channel text-app-text'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? <HeadphonesOffIcon size={20} /> : <HeadphonesIcon size={20} />}
            </button>
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-full transition-colors ${
                isCameraOn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-app-hover hover:bg-app-channel text-app-text'
              }`}
              title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                {isCameraOn ? (
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                ) : (
                  <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                )}
              </svg>
            </button>
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-full transition-colors ${
                isScreenSharing ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-app-hover hover:bg-app-channel text-app-text'
              }`}
              title={isScreenSharing ? 'Stop Sharing' : 'Share Your Screen'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
                {isScreenSharing && (
                  <path d="M9 14L12 10L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
                )}
              </svg>
            </button>
            <button
              onClick={() => leaveVoice()}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors text-white"
              title="End Call"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-center text-app-muted text-sm">
            {otherTabVoiceChannelId === channel.id
              ? 'Connected in another tab — viewing this channel without moving your microphone.'
              : 'Select this voice channel to join'}
          </div>
        )}
      </div>
    </div>
  )
}
