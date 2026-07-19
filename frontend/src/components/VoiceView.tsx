import { useState, useRef, useEffect, useMemo, useCallback, type RefObject } from 'react'
import type { Channel } from '../types'
import { useVoice, type VoiceParticipant } from '../contexts/VoiceContext'
import { RemoteAudio } from './RemoteAudio'
import { MicIcon, MicOffIcon, HeadphonesIcon, HeadphonesOffIcon } from './icons/VoiceIcons'
import { SoundboardDropdown } from './SoundboardDropdown'
import {
  getScreenShareStream,
  getParticipantVideoStream,
  hasLiveVideo,
} from '../utils/mediaTracks'

interface VoiceViewProps {
  channel: Channel
  currentUserId: string
  currentUsername: string
  currentUserAvatarUrl?: string
  /** Users in this channel from presence (sidebar) — ensures we show them even before WebRTC connects */
  voiceUsersInChannel?: { userId: string; username: string; avatar_url?: string }[]
  onInvitePeople?: () => Promise<void>
  /** Admin/owner: mute and disconnect users in voice */
  isAdminOrOwner?: boolean
  serverId?: string
  onMuteMember?: (userId: string) => Promise<void>
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
    play()
    const onUnmute = () => play()
    stream.getVideoTracks().forEach((t) => t.addEventListener('unmute', onUnmute))
    return () => {
      stream.getVideoTracks().forEach((t) => t.removeEventListener('unmute', onUnmute))
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
}: {
  stream: MediaStream
  muted?: boolean
  label: string
  badge?: 'live' | 'camera'
  onClose?: () => void
  objectFit?: 'contain' | 'cover'
  avatarUrl?: string
  username: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasFrame, setHasFrame] = useState(false)
  useAttachStream(videoRef, stream)

  useEffect(() => {
    setHasFrame(false)
  }, [stream])

  return (
    <div className="relative w-full h-full min-h-0 rounded-xl overflow-hidden bg-[#1e1f22] border border-white/5 flex flex-col">
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
        } ${hasFrame ? 'opacity-100' : 'opacity-0'}`}
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
    const update = () => setCount(stream.getVideoTracks().filter((t) => t.readyState !== 'ended').length)
    update()
    stream.addEventListener('addtrack', update)
    stream.addEventListener('removetrack', update)
    return () => {
      stream.removeEventListener('addtrack', update)
      stream.removeEventListener('removetrack', update)
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
}: {
  stream: MediaStream
  muted?: boolean
  username: string
  avatarUrl?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasFrame, setHasFrame] = useState(false)
  useAttachStream(videoRef, stream)

  useEffect(() => {
    setHasFrame(false)
  }, [stream])

  return (
    <div className="relative w-full h-full bg-[#1e1f22]">
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
        className={`w-full h-full object-cover transition-opacity duration-200 ${hasFrame ? 'opacity-100' : 'opacity-0'}`}
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
  isMuted,
  isDeafened,
  isCameraOn,
  currentUserId,
  isAdminOrOwner,
  onMuteMember,
  onDisconnectMember,
  isSharingScreen,
  isWatching,
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
  isMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  currentUserId: string
  isAdminOrOwner?: boolean
  onMuteMember?: (userId: string) => Promise<void>
  onDisconnectMember?: (userId: string) => Promise<void>
  isSharingScreen?: boolean
  isWatching?: boolean
  onWatchShare?: (userId: string) => void
  onMaximizeCamera?: (userId: string) => void
  large?: boolean
  /** Filmstrip / sidebar tile */
  compact?: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
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

  const showMuted = isLocal && isMuted
  const showAdminMenu = !isLocal && isAdminOrOwner && (onMuteMember || onDisconnectMember)

  const ringClass = isWatching
    ? 'ring-2 ring-app-accent shadow-[0_0_12px_rgba(88,101,242,0.45)]'
    : speaking
      ? 'ring-2 ring-[#23a559] shadow-[0_0_12px_rgba(35,165,89,0.5)]'
      : 'ring-1 ring-white/10'

  if (compact) {
    return (
      <div
        className={`relative shrink-0 w-[7.5rem] sm:w-36 h-[4.75rem] sm:h-[5.5rem] rounded-lg overflow-hidden ${ringClass} ${
          (isSharingScreen && onWatchShare) || (showVideoShell && onMaximizeCamera) ? 'cursor-pointer' : ''
        }`}
        onClick={() => {
          if (isSharingScreen && onWatchShare) {
            onWatchShare(participant.userId)
            return
          }
          if (showVideoShell && onMaximizeCamera) onMaximizeCamera(participant.userId)
        }}
        title={participant.username}
      >
        {showVideoShell && (isLocal ? localVideoStream : participantVideoStream) ? (
          <TileVideo
            stream={(isLocal ? localVideoStream : participantVideoStream)!}
            muted={isLocal || isDeafened}
            username={participant.username}
            avatarUrl={avatarUrl}
          />
        ) : (
          <div className="w-full h-full bg-[#2b2d31] flex items-center justify-center">
            <AvatarGlyph
              username={participant.username}
              avatarUrl={avatarUrl}
              className="w-12 h-12 rounded-full text-lg"
            />
          </div>
        )}
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
      </div>
    )
  }

  const circleSize = large
    ? 'w-36 h-36 sm:w-44 sm:h-44 text-4xl sm:text-5xl'
    : 'w-24 h-24 sm:w-28 sm:h-28 text-2xl sm:text-3xl'
  const videoTileSize = large
    ? 'w-64 h-48 sm:w-80 sm:h-56'
    : 'w-52 h-40 sm:w-64 sm:h-48'
  const muteBadgeSize = large ? 'w-9 h-9' : 'w-7 h-7'
  const muteIconSize = large ? 16 : 14

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-2 px-2 py-3 select-none ${
        (isSharingScreen && onWatchShare) || (showVideoShell && onMaximizeCamera) ? 'cursor-pointer' : ''
      }`}
      onClick={() => {
        if (isSharingScreen && onWatchShare) {
          onWatchShare(participant.userId)
          return
        }
        if (showVideoShell && onMaximizeCamera) onMaximizeCamera(participant.userId)
      }}
      onContextMenu={(e) => {
        if (showAdminMenu) {
          e.preventDefault()
          setMenuPos({ x: e.clientX, y: e.clientY })
          setShowMenu(true)
        }
      }}
    >
      {isSharingScreen && (
        <div className="absolute -top-0.5 right-1 z-10 flex items-center gap-1">
          <span className="bg-[#ed4245] text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm">
            Live
          </span>
          {onWatchShare && (
            <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-sm">
              {isWatching ? 'Watching' : 'Click to watch'}
            </span>
          )}
        </div>
      )}
      {showAdminMenu && showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className="fixed z-50 bg-[#111214] rounded-lg shadow-xl py-1 min-w-[180px] border border-app-hover/30"
            style={{ left: menuPos.x, top: menuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {onMuteMember && (
              <button
                onClick={async () => {
                  await onMuteMember(participant.userId)
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
              >
                <MicOffIcon size={14} />
                Mute
              </button>
            )}
            {onDisconnectMember && (
              <button
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
        </>
      )}
      {showVideoShell ? (
        <div
          className={`relative ${videoTileSize} rounded-xl overflow-hidden ${ringClass}`}
          title="Click to maximize"
        >
          {(isLocal ? localVideoStream : participantVideoStream) ? (
            <TileVideo
              stream={(isLocal ? localVideoStream : participantVideoStream)!}
              muted={isLocal || isDeafened}
              username={participant.username}
              avatarUrl={avatarUrl}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#2b2d31]">
              <AvatarGlyph
                username={participant.username}
                avatarUrl={avatarUrl}
                className="w-20 h-20 rounded-full text-3xl"
              />
            </div>
          )}
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
            className={`${circleSize} rounded-full flex items-center justify-center text-white font-bold transition-all duration-150 overflow-hidden ${
              isWatching
                ? 'ring-4 ring-app-accent shadow-[0_0_16px_rgba(88,101,242,0.4)]'
                : speaking
                  ? 'ring-4 ring-[#23a559] shadow-[0_0_16px_rgba(35,165,89,0.55)] scale-105'
                  : 'ring-2 ring-white/10'
            } ${avatarUrl ? 'bg-transparent' : 'bg-app-accent'}`}
          >
            <AvatarGlyph
              username={participant.username}
              avatarUrl={avatarUrl}
              className={avatarUrl ? 'w-full h-full' : 'w-full h-full text-inherit'}
            />
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
      <div className="text-center max-w-[160px] sm:max-w-[200px]">
        <div className="font-semibold text-app-text text-sm truncate">
          {participant.username}
          {participant.userId === currentUserId && (
            <span className="text-app-muted font-normal"> (you)</span>
          )}
        </div>
        <div className="text-app-muted text-xs">
          {isLocal
            ? (isMuted ? 'Muted' : speaking ? 'Speaking' : 'Connected')
            : (participant.stream ? 'Connected' : 'Connecting...')}
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
  serverId: _serverId,
  onMuteMember,
  onDisconnectMember,
}: VoiceViewProps) {
  const voice = useVoice()
  const {
    participants,
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
    localStream,
    playSoundboardSound,
    error,
    screenShareUserIds,
    watchingShareUserId,
    setWatchingShareUserId,
  } = voice

  const [soundboardOpen, setSoundboardOpen] = useState(false)
  const soundboardButtonRef = useRef<HTMLButtonElement>(null)
  const [maximizedCameraUserId, setMaximizedCameraUserId] = useState<string | null>(null)
  const autoFocusedCameraRef = useRef(false)

  const isInThisChannel = voiceChannelId === channel.id

  const localParticipant = useMemo(
    () => ({
      userId: currentUserId,
      username: currentUsername,
      stream: null as MediaStream | null,
      isSpeaking: false,
    }),
    [currentUserId, currentUsername]
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
      if (!participantByUserId.has(vu.userId)) {
        participantByUserId.set(vu.userId, {
          userId: vu.userId,
          username: vu.username,
          stream: null,
          isSpeaking: false,
          streamVersion: 0,
        })
      } else {
        const existing = participantByUserId.get(vu.userId)!
        if (vu.username && (!existing.username || existing.username === 'User' || existing.username === 'Unknown')) {
          participantByUserId.set(vu.userId, { ...existing, username: vu.username })
        }
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

  const cardProps = useCallback(
    (
      p: { userId: string; username: string; stream: MediaStream | null; isSpeaking: boolean; streamVersion?: number },
      opts: { large?: boolean; compact?: boolean } = {}
    ) => ({
      participant: p,
      avatarUrl: avatarByUserId.get(p.userId),
      isLocal: p.userId === currentUserId,
      localStream,
      localVideoStream: videoStream,
      participantVideoStream:
        p.userId === currentUserId
          ? null
          : getParticipantVideoStream(p.stream, {
              knownScreenSharing: screenShareUserIds.includes(p.userId),
            }),
      isMuted,
      isDeafened,
      isCameraOn,
      currentUserId,
      isAdminOrOwner,
      onMuteMember,
      onDisconnectMember,
      isSharingScreen: screenShareUserIds.includes(p.userId),
      isWatching: watchingShareUserId === p.userId || maximizedCameraUserId === p.userId,
      onWatchShare: screenShareUserIds.includes(p.userId) ? handleWatchShare : undefined,
      onMaximizeCamera: handleMaximizeCamera,
      large: opts.large,
      compact: opts.compact,
    }),
    [
      avatarByUserId,
      currentUserId,
      localStream,
      videoStream,
      isMuted,
      isDeafened,
      isCameraOn,
      screenShareUserIds,
      isAdminOrOwner,
      onMuteMember,
      onDisconnectMember,
      watchingShareUserId,
      maximizedCameraUserId,
      handleWatchShare,
      handleMaximizeCamera,
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
    <div className="shrink-0 px-3 py-2 border-b border-white/5 bg-[#111214]/80">
      <div className="flex gap-2 overflow-x-auto items-stretch pb-0.5 scrollbar-thin">
        {allParticipants.map((p) => (
          <ParticipantCard key={p.userId} {...cardProps(p, { compact: true })} />
        ))}
      </div>
    </div>
  )

  const renderAvatarGrid = () => {
    if (allParticipants.length === 0) return null
    return (
      <div className="flex-1 overflow-auto p-6 min-h-0 flex items-center justify-center">
        <div
          className={`flex flex-wrap items-start justify-center gap-6 sm:gap-8 ${
            isAlone ? 'max-w-md' : 'max-w-5xl'
          }`}
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
          <div className="flex-1 flex gap-2 p-2 min-h-0">
            <div className="flex-[1.4] min-w-0 min-h-0">
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
            <div className="flex-1 min-w-0 min-h-0">
              <StageVideo
                stream={maximizedCameraStream}
                muted
                badge="camera"
                label={`${maximizedCameraUsername} — Camera`}
                username={maximizedCameraUsername}
                avatarUrl={maximizedCameraUserId ? avatarByUserId.get(maximizedCameraUserId) : undefined}
                objectFit="cover"
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
              <div className="absolute bottom-4 left-4 w-40 sm:w-52 aspect-video rounded-lg overflow-hidden ring-2 ring-white/20 shadow-2xl z-[3]">
                <TileVideo
                  stream={videoStream}
                  muted
                  username={currentUsername}
                  avatarUrl={currentUserAvatarUrl}
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
              onClose={() => setMaximizedCameraUserId(null)}
            />
            {showSelfPip && videoStream && (
              <div className="absolute bottom-4 left-4 w-36 sm:w-44 aspect-video rounded-lg overflow-hidden ring-2 ring-white/20 shadow-2xl z-[3]">
                <TileVideo
                  stream={videoStream}
                  muted
                  username={currentUsername}
                  avatarUrl={currentUserAvatarUrl}
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
    <div className="flex-1 flex flex-col bg-app-darker min-h-0">
      <div className="h-12 px-4 flex items-center justify-between border-b border-app-dark shadow-sm shrink-0">
        <div className="flex items-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-app-muted">
            <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6.586 7.00304H4C3.45 7.00304 3 7.45304 3 8.00304V16.003C3 16.553 3.45 17.003 4 17.003H6.586L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.003V4.00304C12 3.59904 11.757 3.23404 11.383 3.07904Z"/>
            <path d="M14 9.00304C14 9.00304 16 10.003 16 12.003C16 14.003 14 15.003 14 15.003" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <path d="M17 7.00304C17 7.00304 20 9.00304 20 12.003C20 15.003 17 17.003 17 17.003" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
          </svg>
          <span className="ml-2 font-semibold text-app-text">{channel.name}</span>
          {isInThisChannel && (
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

      {/* Persistent remote audio — outside focus/filmstrip so layout remounts don't kill playback */}
      {isInThisChannel && (
        <div aria-hidden className="contents">
          {allParticipants
            .filter((p) => p.userId !== currentUserId && p.stream)
            .map((p) => (
              <RemoteAudio key={`audio-${p.userId}`} stream={p.stream} muted={isDeafened} />
            ))}
        </div>
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

        {isInThisChannel && renderFocusStage()}
      </div>

      <div className="p-4 border-t border-app-dark shrink-0">
        {isInThisChannel ? (
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <SoundboardDropdown
                userId={currentUserId}
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
            Click to join this voice channel
          </div>
        )}
      </div>
    </div>
  )
}
