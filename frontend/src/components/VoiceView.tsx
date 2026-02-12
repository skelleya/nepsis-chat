import { useState, useRef, useEffect, type ReactNode } from 'react'
import type { Channel } from '../types'
import { useVoice, type VoiceParticipant } from '../contexts/VoiceContext'
import { RemoteAudio } from './RemoteAudio'
import { MicOffIcon, HeadphonesIcon, HeadphonesOffIcon } from './icons/VoiceIcons'
import { SoundboardDropdown } from './SoundboardDropdown'
import { Panel, Group, Separator } from 'react-resizable-panels'

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

/** Detect if a video track is from screen share (getDisplayMedia) vs camera (getUserMedia) */
function isScreenShareTrack(track: MediaStreamTrack): boolean {
  try {
    const settings = track.getSettings?.()
    const surface = (settings as { displaySurface?: string })?.displaySurface
    return surface === 'monitor' || surface === 'window' || surface === 'browser'
  } catch {
    return false
  }
}

/** Extract screen-share-only stream from a stream (for remote participants who share screen) */
function getScreenShareStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const screenTracks = stream.getVideoTracks().filter(isScreenShareTrack)
  if (screenTracks.length === 0) return null
  const out = new MediaStream()
  screenTracks.forEach((t) => out.addTrack(t))
  return out
}

/** Extract camera-only stream from a stream (for participant card when they also share screen) */
function getCameraStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const cameraTracks = stream.getVideoTracks().filter((t) => !isScreenShareTrack(t))
  if (cameraTracks.length === 0) return null
  const out = new MediaStream()
  cameraTracks.forEach((t) => out.addTrack(t))
  return out
}

/** Get stream to show in participant card: prefer camera when both exist, else full video stream */
function getParticipantVideoStream(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null
  const cam = getCameraStream(stream)
  if (cam && cam.getVideoTracks().length > 0) return cam
  const videoTracks = stream.getVideoTracks()
  if (videoTracks.length === 0) return null
  const out = new MediaStream()
  videoTracks.forEach((t) => out.addTrack(t))
  return out
}

function VideoElement({ stream, muted = false, label }: { stream: MediaStream; muted?: boolean; label: string }) {
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
      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
        {label}
      </div>
    </div>
  )
}

// Hook to track video track count on a MediaStream (re-renders when tracks change)
function useVideoTrackCount(stream: MediaStream | null): number {
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
  }, [stream])
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
}: {
  participant: { userId: string; username: string; stream: MediaStream | null; isSpeaking: boolean }
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
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const detectStream = isLocal ? localStream : participant.stream
  const speaking = useSpeakingDetector(detectStream, isLocal ? !isMuted : true)

  const remoteVideoCount = useVideoTrackCount(isLocal ? null : participant.stream)
  const hasRemoteVideo = !isLocal && remoteVideoCount > 0

  const localVideoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (isLocal && localVideoStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localVideoStream
    }
  }, [isLocal, localVideoStream])

  const showVideo = isLocal ? isCameraOn && !!localVideoStream : hasRemoteVideo && !!participantVideoStream

  const showAdminMenu = !isLocal && isAdminOrOwner && (onMuteMember || onDisconnectMember)

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl bg-app-dark/60 overflow-hidden border transition-all duration-150 min-h-[160px] flex-1 ${
      speaking ? 'border-[#23a559] shadow-[0_0_12px_rgba(35,165,89,0.3)]' : 'border-app-hover/50'
    }`}
      onContextMenu={(e) => {
        if (showAdminMenu) {
          e.preventDefault()
          setMenuPos({ x: e.clientX, y: e.clientY })
          setShowMenu(true)
        }
      }}
    >
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
        <div className="flex-1 w-full relative bg-black min-h-0">
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
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <div className="font-semibold text-white text-sm truncate flex items-center gap-1.5">
              {participant.username}
              {participant.userId === currentUserId && <span className="text-white/60 font-normal">(you)</span>}
              {isLocal && isMuted && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600/80">
                  <MicOffIcon size={10} className="text-white" />
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 w-full flex items-center justify-center p-4">
            <div
              className={`relative w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-white font-bold text-2xl sm:text-4xl transition-all duration-150 overflow-hidden ${
                speaking
                  ? 'ring-4 ring-[#23a559] shadow-[0_0_16px_rgba(35,165,89,0.6)] scale-105'
                  : 'ring-2 ring-transparent'
              } ${avatarUrl ? 'bg-transparent' : 'bg-app-accent'}`}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={participant.username} className="w-full h-full object-cover" />
              ) : (
                participant.username.charAt(0).toUpperCase()
              )}
              {isLocal && isMuted && (
                <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                  <MicOffIcon size={12} className="text-white" />
                </div>
              )}
            </div>
          </div>
          <div className="w-full px-3 pb-3 text-center">
            <div className="font-semibold text-app-text text-sm truncate">
              {participant.username}
              {participant.userId === currentUserId && <span className="text-app-muted font-normal"> (you)</span>}
            </div>
            <div className="text-app-muted text-xs">
              {isLocal
                ? (isMuted ? 'Muted' : speaking ? 'Speaking' : 'Connected')
                : (participant.stream ? 'Connected' : 'Connecting...')}
            </div>
          </div>
        </>
      )}
      {!isLocal && participant.stream && (
        <RemoteAudio stream={participant.stream} muted={isDeafened} />
      )}
    </div>
  )
}

export function VoiceView({ channel, currentUserId, currentUsername, currentUserAvatarUrl, voiceUsersInChannel = [], onInvitePeople, isAdminOrOwner, serverId, onMuteMember, onDisconnectMember }: VoiceViewProps) {
  const voice = useVoice()
  const {
    participants,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
    isSoundboardMuted,
    setIsSoundboardMuted,
    isCameraOn,
    isScreenSharing,
    toggleCamera,
    toggleScreenShare,
    videoStream,
    screenStream,
    leaveVoice,
    voiceChannelId,
    leftUserIds,
    localStream,
    playSoundboardSound,
    error,
  } = voice

  const [soundboardOpen, setSoundboardOpen] = useState(false)
  const soundboardButtonRef = useRef<HTMLButtonElement>(null)

  const isInThisChannel = voiceChannelId === channel.id

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
  for (const vu of voiceUsersInChannel) {
    if (leftUserIds.has(vu.userId)) continue // Exclude users who left (peer-left) — prevents ghost "Connecting..."
    if (!participantByUserId.has(vu.userId)) {
      participantByUserId.set(vu.userId, { userId: vu.userId, username: vu.username, stream: null, isSpeaking: false })
    }
    if (vu.avatar_url) avatarByUserId.set(vu.userId, vu.avatar_url)
  }
  const allParticipants = isInThisChannel
    ? [localParticipant, ...Array.from(participantByUserId.values()).filter((p) => p.userId !== currentUserId)]
    : Array.from(participantByUserId.values())

  // Primary screen share: local first, then first remote
  const localScreenShare = isScreenSharing && screenStream ? screenStream : null
  const remoteScreenShares = allParticipants
    .filter((p) => p.userId !== currentUserId && p.stream)
    .map((p) => ({ userId: p.userId, username: p.username, stream: getScreenShareStream(p.stream!) }))
    .filter((x) => x.stream && x.stream.getVideoTracks().length > 0)
  const primaryScreenShare = localScreenShare
    ? { stream: localScreenShare, username: currentUsername }
    : remoteScreenShares[0]
      ? { stream: remoteScreenShares[0].stream!, username: remoteScreenShares[0].username }
      : null

  const hasScreenShare = !!primaryScreenShare
  const isAlone = allParticipants.length === 1

  const renderParticipantsArea = () => {
    if (allParticipants.length === 0) return null
    if (isAlone) {
      const p = allParticipants[0]
      const participantVideoStream = p.userId === currentUserId ? null : getParticipantVideoStream(p.stream)
      return (
        <div className="flex-1 flex items-center justify-center p-4 min-h-0">
          <div className="w-full max-w-md">
            <ParticipantCard
              participant={p}
              avatarUrl={avatarByUserId.get(p.userId)}
              isLocal={p.userId === currentUserId}
              localStream={localStream}
              localVideoStream={videoStream}
              participantVideoStream={participantVideoStream}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isCameraOn={isCameraOn}
              currentUserId={currentUserId}
              isAdminOrOwner={isAdminOrOwner}
              onMuteMember={onMuteMember}
              onDisconnectMember={onDisconnectMember}
            />
          </div>
        </div>
      )
    }
    if (allParticipants.length <= 4) {
      const defaultSize = 100 / allParticipants.length
      const panels: ReactNode[] = []
      allParticipants.forEach((p, i) => {
        if (i > 0) {
          panels.push(
            <Separator
              key={`handle-${p.userId}`}
              className="w-2 bg-app-dark hover:bg-app-hover/50 transition-colors data-[resize-handle-active]:bg-app-accent/50"
            />
          )
        }
        panels.push(
          <Panel key={p.userId} minSize={15} defaultSize={defaultSize} className="min-w-0">
            <div className="h-full p-2 flex min-h-0">
              <ParticipantCard
                participant={p}
                avatarUrl={avatarByUserId.get(p.userId)}
                isLocal={p.userId === currentUserId}
                localStream={localStream}
                localVideoStream={videoStream}
                participantVideoStream={p.userId === currentUserId ? null : getParticipantVideoStream(p.stream)}
                isMuted={isMuted}
                isDeafened={isDeafened}
                isCameraOn={isCameraOn}
                currentUserId={currentUserId}
                isAdminOrOwner={isAdminOrOwner}
                onMuteMember={onMuteMember}
                onDisconnectMember={onDisconnectMember}
              />
            </div>
          </Panel>
        )
      })
      return (
        <Group orientation="horizontal" className="flex-1 min-h-0" autoSave="voice-view-participants">
          {panels}
        </Group>
      )
    }
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {allParticipants.map((p) => (
            <ParticipantCard
              key={p.userId}
              participant={p}
              avatarUrl={avatarByUserId.get(p.userId)}
              isLocal={p.userId === currentUserId}
              localStream={localStream}
              localVideoStream={videoStream}
              participantVideoStream={p.userId === currentUserId ? null : getParticipantVideoStream(p.stream)}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isCameraOn={isCameraOn}
              currentUserId={currentUserId}
              isAdminOrOwner={isAdminOrOwner}
              onMuteMember={onMuteMember}
              onDisconnectMember={onDisconnectMember}
            />
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
          hasScreenShare ? (
            <Group orientation="vertical" autoSave="voice-view-screen-participants" className="flex-1 min-h-0">
              <Panel defaultSize={60} minSize={20} maxSize={90} className="min-h-0">
                <div className="h-full p-4 flex flex-col min-h-0">
                  <VideoElement stream={primaryScreenShare.stream} muted label={`${primaryScreenShare.username} — Screen Share`} />
                </div>
              </Panel>
              <Separator className="h-2 bg-app-dark hover:bg-app-hover/50 transition-colors data-[resize-handle-active]:bg-app-accent/50 flex items-center justify-center">
                <div className="w-12 h-1 rounded-full bg-app-muted/50" />
              </Separator>
              <Panel defaultSize={40} minSize={10} maxSize={80} className="min-h-0">
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
              onClick={() => setIsSoundboardMuted(!isSoundboardMuted)}
              className={`p-3 rounded-full transition-colors ${
                isSoundboardMuted ? 'bg-amber-600/80 hover:bg-amber-600 text-white' : 'bg-app-hover hover:bg-app-channel text-app-text'
              }`}
              title={isSoundboardMuted ? 'Unmute soundboard' : 'Mute soundboard'}
            >
              <span className="text-lg" title={isSoundboardMuted ? 'Soundboard muted' : 'Soundboard on'}>
                {isSoundboardMuted ? '🔇' : '🔊'}
              </span>
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-full transition-colors ${
                isMuted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-app-hover hover:bg-app-channel text-app-text'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27 6.05 7.3C6.02 7.46 6 7.62 6 7.79v4.26c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5h1.7c0 2.25 1.83 4.08 4.06 4.08.48 0 .94-.09 1.38-.24L19.73 21 21 19.73 4.27 3z"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              )}
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
              onClick={leaveVoice}
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
