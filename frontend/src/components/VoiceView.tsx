import { useState, useRef, useEffect } from 'react'
import type { Channel } from '../types'
import { useVoice, type VoiceParticipant } from '../contexts/VoiceContext'
import { RemoteAudio } from './RemoteAudio'
import { MicIcon, MicOffIcon, HeadphonesIcon, HeadphonesOffIcon } from './icons/VoiceIcons'
import { SoundboardDropdown } from './SoundboardDropdown'
import { Panel, Group, Separator } from 'react-resizable-panels'
import { getScreenShareStream, getParticipantVideoStream } from '../utils/mediaTracks'

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

function VideoElement({
  stream,
  muted = false,
  label,
  onClose,
}: {
  stream: MediaStream
  muted?: boolean
  label: string
  onClose?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])
  return (
    <div className="relative w-full h-full min-h-0 bg-black rounded-lg overflow-hidden border border-app-hover flex flex-col">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="flex-1 w-full h-full min-h-0 object-contain"
      />
      <div className="absolute top-2 left-2 flex items-center gap-2">
        <span className="bg-[#ed4245] text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm">
          Live
        </span>
        <span className="bg-black/60 px-2 py-1 rounded text-xs text-white">{label}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 rounded bg-black/60 text-white hover:bg-black/80 transition-colors"
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

// Hook to track video track count on a MediaStream (re-renders when tracks change)
// `version` is bumped by VoiceContext whenever onRemoteStream fires, forcing a recount
// even when the stream reference stays the same (MediaStream.addTrack doesn't fire addtrack event)
function useVideoTrackCount(stream: MediaStream | null, version = 0): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!stream) { setCount(0); return }
    const update = () => setCount(stream.getVideoTracks().length)
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
      } catch { /* AudioContext not available */ }
    }
    start()
    return () => {
      running = false
      audioCtx?.close()
    }
  }, [stream, enabled])
  return speaking
}

function RemoteVideo({ stream, muted = false }: { stream: MediaStream; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-cover"
    />
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
  /** Click camera face to maximize */
  onMaximizeCamera?: (userId: string) => void
  /** Larger circle when alone in the channel */
  large?: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const detectStream = isLocal ? localStream : participant.stream
  const speaking = useSpeakingDetector(detectStream, isLocal ? !isMuted : true)

  const remoteVideoCount = useVideoTrackCount(isLocal ? null : participant.stream, participant.streamVersion ?? 0)
  const hasRemoteVideo = !isLocal && remoteVideoCount > 0

  const localVideoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (isLocal && localVideoStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localVideoStream
    }
  }, [isLocal, localVideoStream])

  const showVideo = isLocal ? isCameraOn && !!localVideoStream : hasRemoteVideo && !!participantVideoStream
  const showMuted = isLocal && isMuted
  const showAdminMenu = !isLocal && isAdminOrOwner && (onMuteMember || onDisconnectMember)

  const circleSize = large
    ? 'w-36 h-36 sm:w-44 sm:h-44 text-4xl sm:text-5xl'
    : 'w-24 h-24 sm:w-28 sm:h-28 text-2xl sm:text-3xl'
  // Camera on → square tile so the full face is visible
  const videoTileSize = large
    ? 'w-48 h-48 sm:w-56 sm:h-56'
    : 'w-36 h-36 sm:w-40 sm:h-40'
  const muteBadgeSize = large ? 'w-9 h-9' : 'w-7 h-7'
  const muteIconSize = large ? 16 : 14

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-2 px-2 py-3 select-none ${
        (isSharingScreen && onWatchShare) || (showVideo && onMaximizeCamera) ? 'cursor-pointer' : ''
      }`}
      onClick={() => {
        if (isSharingScreen && onWatchShare) {
          onWatchShare(participant.userId)
          return
        }
        if (showVideo && onMaximizeCamera) onMaximizeCamera(participant.userId)
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
      {showVideo ? (
        <div
          className={`relative ${videoTileSize} rounded-xl overflow-hidden bg-black ring-2 ${
            isWatching
              ? 'ring-app-accent shadow-[0_0_16px_rgba(88,101,242,0.4)]'
              : speaking
                ? 'ring-[#23a559] shadow-[0_0_16px_rgba(35,165,89,0.55)]'
                : 'ring-white/10'
          }`}
          title="Click to maximize"
        >
          {isLocal && localVideoStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : participantVideoStream ? (
            <RemoteVideo stream={participantVideoStream} muted={isDeafened} />
          ) : null}
          {showMuted && (
            <div
              className={`absolute bottom-1.5 right-1.5 ${muteBadgeSize} rounded-full bg-[#ed4245] flex items-center justify-center ring-2 ring-app-darker shadow-md z-10`}
              title="Muted"
            >
              <MicOffIcon size={muteIconSize} className="text-white" />
            </div>
          )}
        </div>
      ) : (
        /* Avatar circle — mute badge sits outside the clipped image so it is not cut off */
        <div className="relative">
          <div
            className={`${circleSize} rounded-full flex items-center justify-center text-white font-bold transition-all duration-150 ${
              isWatching
                ? 'ring-4 ring-app-accent shadow-[0_0_16px_rgba(88,101,242,0.4)]'
                : speaking
                  ? 'ring-4 ring-[#23a559] shadow-[0_0_16px_rgba(35,165,89,0.55)] scale-105'
                  : 'ring-2 ring-white/10'
            } ${avatarUrl ? 'bg-transparent' : 'bg-app-accent'}`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={participant.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              (participant.username || '?').charAt(0).toUpperCase()
            )}
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
      <div className="text-center max-w-[140px] sm:max-w-[160px]">
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
      {!isLocal && participant.stream && (
        <RemoteAudio stream={participant.stream} muted={isDeafened} />
      )}
    </div>
  )
}

export function VoiceView({ channel, currentUserId, currentUsername, currentUserAvatarUrl, voiceUsersInChannel = [], onInvitePeople, isAdminOrOwner, serverId: _serverId, onMuteMember, onDisconnectMember }: VoiceViewProps) {
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

  const isInThisChannel = voiceChannelId === channel.id

  // Clear maximized camera if that user turned camera off / left
  useEffect(() => {
    if (!maximizedCameraUserId) return
    if (maximizedCameraUserId === currentUserId && !isCameraOn) {
      setMaximizedCameraUserId(null)
      return
    }
    if (maximizedCameraUserId !== currentUserId) {
      const p = participants.find((x) => x.userId === maximizedCameraUserId)
      if (!p?.stream || !getParticipantVideoStream(p.stream)) {
        setMaximizedCameraUserId(null)
      }
    }
  }, [maximizedCameraUserId, currentUserId, isCameraOn, participants])

  const localParticipant = {
    userId: currentUserId,
    username: currentUsername,
    stream: null as MediaStream | null,
    isSpeaking: false,
  }

  const participantByUserId = new Map<string, VoiceParticipant | typeof localParticipant>()
  const avatarByUserId = new Map<string, string>()
  if (isInThisChannel) {
    participantByUserId.set(currentUserId, localParticipant)
    if (currentUserAvatarUrl) avatarByUserId.set(currentUserId, currentUserAvatarUrl)
  }
  for (const p of participants) {
    participantByUserId.set(p.userId, p)
  }
  // Merge presence users even if leftUserIds has them (session-replace emits peer-left
  // before rejoin — filtering them hid participants from other clients).
  for (const vu of voiceUsersInChannel) {
    if (!participantByUserId.has(vu.userId)) {
      participantByUserId.set(vu.userId, { userId: vu.userId, username: vu.username, stream: null, isSpeaking: false, streamVersion: 0 })
    } else {
      const existing = participantByUserId.get(vu.userId)!
      if (vu.username && (!existing.username || existing.username === 'User' || existing.username === 'Unknown')) {
        participantByUserId.set(vu.userId, { ...existing, username: vu.username })
      }
    }
    if (vu.avatar_url) avatarByUserId.set(vu.userId, vu.avatar_url)
  }
  const allParticipants = isInThisChannel
    ? [localParticipant, ...Array.from(participantByUserId.values()).filter((p) => p.userId !== currentUserId)]
    : Array.from(participantByUserId.values())

  // Discord-style: only show stage when user chose to watch someone (or auto-focused own share)
  const watchingStream =
    watchingShareUserId === currentUserId && isScreenSharing && screenStream
      ? screenStream
      : watchingShareUserId
        ? (() => {
            const p = allParticipants.find((x) => x.userId === watchingShareUserId)
            return p?.stream ? getScreenShareStream(p.stream) : null
          })()
        : null
  const watchingUsername =
    watchingShareUserId === currentUserId
      ? currentUsername
      : allParticipants.find((p) => p.userId === watchingShareUserId)?.username ?? 'Screen'

  const isWatchingShare = !!watchingStream && watchingStream.getVideoTracks().length > 0
  const isAlone = allParticipants.length === 1

  const handleWatchShare = (userId: string) => {
    setMaximizedCameraUserId(null)
    if (watchingShareUserId === userId) {
      setWatchingShareUserId(null)
    } else {
      setWatchingShareUserId(userId)
    }
  }

  const handleMaximizeCamera = (userId: string) => {
    setWatchingShareUserId(null)
    setMaximizedCameraUserId((prev) => (prev === userId ? null : userId))
  }

  const maximizedCameraStream =
    maximizedCameraUserId === currentUserId
      ? videoStream
      : (() => {
          const p = allParticipants.find((x) => x.userId === maximizedCameraUserId)
          return p?.stream ? getParticipantVideoStream(p.stream) : null
        })()
  const maximizedCameraUsername =
    maximizedCameraUserId === currentUserId
      ? currentUsername
      : allParticipants.find((p) => p.userId === maximizedCameraUserId)?.username ?? 'Camera'

  const cardProps = (p: { userId: string; username: string; stream: MediaStream | null; isSpeaking: boolean; streamVersion?: number }, large = false) => ({
    participant: p,
    avatarUrl: avatarByUserId.get(p.userId),
    isLocal: p.userId === currentUserId,
    localStream,
    localVideoStream: videoStream,
    participantVideoStream: p.userId === currentUserId ? null : getParticipantVideoStream(p.stream),
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
    large,
  })

  const renderParticipantsArea = () => {
    if (allParticipants.length === 0) return null
    // Avatars stay circular; camera-on tiles become square (see ParticipantCard)
    return (
      <div className="flex-1 overflow-auto p-6 min-h-0 flex items-center justify-center">
        <div
          className={`flex flex-wrap items-start justify-center gap-6 sm:gap-8 ${
            isAlone ? 'max-w-sm' : 'max-w-4xl'
          }`}
        >
          {allParticipants.map((p) => (
            <ParticipantCard key={p.userId} {...cardProps(p, isAlone)} />
          ))}
        </div>
      </div>
    )
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

        {isInThisChannel && (
          isWatchingShare && watchingStream ? (
            <Group orientation="vertical" autoSave="voice-view-screen-participants" className="flex-1 min-h-0">
              <Panel defaultSize={65} minSize={20} maxSize={90} className="min-h-0">
                <div className="h-full p-3 flex flex-col min-h-0">
                  <VideoElement
                    stream={watchingStream}
                    muted
                    label={`${watchingUsername} — Screen`}
                    onClose={() => setWatchingShareUserId(null)}
                  />
                </div>
              </Panel>
              <Separator
                className="h-3.5 bg-app-dark hover:bg-app-hover transition-colors data-[resize-handle-active]:bg-app-accent/60 flex items-center justify-center cursor-ns-resize"
                title="Drag to resize screen share"
              >
                <div className="w-20 h-1.5 rounded-full bg-app-muted/60" />
              </Separator>
              <Panel defaultSize={35} minSize={10} maxSize={80} className="min-h-0">
                {renderParticipantsArea()}
              </Panel>
            </Group>
          ) : maximizedCameraUserId && maximizedCameraStream ? (
            <Group orientation="vertical" autoSave="voice-view-camera-participants" className="flex-1 min-h-0">
              <Panel defaultSize={70} minSize={30} maxSize={90} className="min-h-0">
                <div className="h-full p-3 flex flex-col min-h-0">
                  <VideoElement
                    stream={maximizedCameraStream}
                    muted
                    label={`${maximizedCameraUsername} — Camera`}
                    onClose={() => setMaximizedCameraUserId(null)}
                  />
                </div>
              </Panel>
              <Separator
                className="h-3.5 bg-app-dark hover:bg-app-hover transition-colors data-[resize-handle-active]:bg-app-accent/60 flex items-center justify-center cursor-ns-resize"
                title="Drag to resize camera"
              >
                <div className="w-20 h-1.5 rounded-full bg-app-muted/60" />
              </Separator>
              <Panel defaultSize={30} minSize={10} maxSize={70} className="min-h-0">
                {renderParticipantsArea()}
              </Panel>
            </Group>
          ) : (
            renderParticipantsArea()
          )
        )}
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
