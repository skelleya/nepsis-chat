import { useState, useCallback, useEffect } from 'react'
import { MemberProfilePanel } from './MemberProfilePanel'
import type { Channel } from '../types'

export interface ServerMember {
  userId: string
  username: string
  avatarUrl?: string
  role: 'owner' | 'admin' | 'member'
  status: 'online' | 'offline' | 'in-voice'
  voiceChannelId?: string | null
}

interface MembersSidebarProps {
  members: ServerMember[]
  currentUserId: string
  currentUserAvatarUrl?: string
  currentUserRole?: 'owner' | 'admin' | 'member'
  serverId: string | null
  voiceChannels?: Channel[]
  onKick?: (userId: string) => Promise<void>
  onMessage?: (userId: string, username: string) => void
  onAddFriend?: (userId: string, username: string) => void
  onCall?: (userId: string, username: string, avatarUrl?: string) => void
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
  onMuteInVoice?: (userId: string) => Promise<void>
  onDisconnectFromVoice?: (userId: string) => Promise<void>
  title?: string
}

export function MembersSidebar({
  members,
  currentUserId,
  currentUserAvatarUrl,
  currentUserRole = 'member',
  serverId,
  voiceChannels = [],
  onKick,
  onMessage,
  onAddFriend,
  onCall,
  onMoveToChannel,
  onMuteInVoice,
  onDisconnectFromVoice,
  title = 'Members',
}: MembersSidebarProps) {
  const [kicking, setKicking] = useState<string | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [selectedMember, setSelectedMember] = useState<ServerMember | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    member: ServerMember
  } | null>(null)
  const [moveToChannel, setMoveToChannel] = useState<ServerMember | null>(null)

  const isAdminOrOwner = currentUserRole === 'owner' || currentUserRole === 'admin'

  const canKick = (m: ServerMember) => {
    if (!serverId || !onKick) return false
    if (m.userId === currentUserId) return false
    if (m.role === 'owner') return false
    if (currentUserRole === 'owner') return true
    if (currentUserRole === 'admin' && m.role === 'member') return true
    return false
  }

  const handleKick = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation()
    if (!onKick) return
    setKicking(userId)
    try {
      await onKick(userId)
    } finally {
      setKicking(null)
    }
  }

  const canMoveToChannel = (m: ServerMember) =>
    isAdminOrOwner &&
    m.userId !== currentUserId &&
    m.status === 'in-voice' &&
    m.voiceChannelId &&
    voiceChannels.some((ch) => ch.id === m.voiceChannelId) && // only if in voice on this server
    onMoveToChannel &&
    voiceChannels.length > 0

  const canMuteOrDisconnect = (m: ServerMember) =>
    isAdminOrOwner &&
    m.userId !== currentUserId &&
    m.status === 'in-voice' &&
    m.voiceChannelId &&
    voiceChannels.some((ch) => ch.id === m.voiceChannelId) &&
    m.role !== 'owner' &&
    (currentUserRole === 'owner' || m.role === 'member')

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, member: ServerMember) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, member })
    },
    []
  )

  useEffect(() => {
    const close = () => setContextMenu(null)
    if (contextMenu) {
      window.addEventListener('click', close)
      window.addEventListener('scroll', close)
      return () => {
        window.removeEventListener('click', close)
        window.removeEventListener('scroll', close)
      }
    }
  }, [contextMenu])

  const roleBadge = (role: string) => {
    if (role === 'owner') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/50 text-amber-200">owner</span>
    if (role === 'admin') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/50 text-blue-200">admin</span>
    return null
  }

  // Minimized: show narrow bar with expand button
  if (minimized) {
    return (
      <div className="w-10 bg-app-channel flex flex-col items-center border-l border-app-dark py-2">
        <button
          onClick={() => setMinimized(false)}
          className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-app-hover transition-colors"
          title="Expand members"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="rotate-180">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        <span className="text-[10px] text-app-muted mt-1" style={{ writingMode: 'vertical-rl' }}>
          {members.length}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-shrink-0">
      <div className="w-60 bg-app-channel flex flex-col">
        <div className="h-12 px-4 flex items-center justify-between border-b border-app-dark">
          <span className="text-app-text font-semibold">
            {title} — {members.length}
          </span>
          <button
            onClick={() => setMinimized(true)}
            className="p-1 rounded text-app-muted hover:text-app-text hover:bg-app-hover transition-colors"
            title="Minimize"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {members.map((member) => {
            // Only show "In voice" if member is in a voice channel on THIS server
            const isInVoiceOnThisServer =
              member.status === 'in-voice' &&
              member.voiceChannelId &&
              voiceChannels.some((ch) => ch.id === member.voiceChannelId)
            const displayStatus = isInVoiceOnThisServer ? 'in-voice' : member.status === 'online' ? 'online' : 'offline'
            return (
            <div
              key={member.userId}
              onClick={() => setSelectedMember(member)}
              onContextMenu={(e) => handleContextMenu(e, member)}
              className="px-4 py-2 flex items-center gap-3 hover:bg-app-hover group cursor-pointer"
            >
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                  {(member.userId === currentUserId && currentUserAvatarUrl) || member.avatarUrl ? (
                    <img
                      key={(member.userId === currentUserId && currentUserAvatarUrl) ? currentUserAvatarUrl : member.avatarUrl!}
                      src={(member.userId === currentUserId && currentUserAvatarUrl) ? currentUserAvatarUrl : member.avatarUrl!}
                      alt={member.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    member.username.charAt(0)
                  )}
                </div>
                <div
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-app-channel ${
                    displayStatus === 'online' ? 'bg-green-500' : displayStatus === 'in-voice' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-app-text truncate">{member.username}</span>
                  {roleBadge(member.role)}
                </div>
                <div className="text-[10px] text-app-muted">
                  {displayStatus === 'in-voice' ? 'In voice' : displayStatus === 'online' ? 'Online' : 'Offline'}
                </div>
              </div>
              {canKick(member) && (
                <button
                  onClick={(e) => handleKick(e, member.userId)}
                  disabled={kicking === member.userId}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:bg-red-500/20 text-xs disabled:opacity-50 transition-opacity"
                  title="Kick from server"
                >
                  {kicking === member.userId ? '…' : 'Kick'}
                </button>
              )}
            </div>
            )
          })}
        </div>
      </div>
      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#111214] rounded-lg shadow-xl py-1 min-w-[160px] border border-app-hover/30"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onMessage?.(contextMenu.member.userId, contextMenu.member.username)
              setContextMenu(null)
            }}
            className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            Message
          </button>
          <button
            onClick={() => {
              onAddFriend?.(contextMenu.member.userId, contextMenu.member.username)
              setContextMenu(null)
            }}
            className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            Add Friend
          </button>
          {contextMenu.member.userId !== currentUserId && onCall && (
            <button
              onClick={() => {
                onCall(contextMenu.member.userId, contextMenu.member.username, contextMenu.member.avatarUrl)
                setContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              Call
            </button>
          )}
          {canKick(contextMenu.member) && (
            <button
              onClick={async () => {
                await onKick?.(contextMenu.member.userId)
                setContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              Kick from Server
            </button>
          )}
          {canMuteOrDisconnect(contextMenu.member) && (
            <>
              <button
                onClick={async () => {
                  await onMuteInVoice?.(contextMenu.member.userId)
                  setContextMenu(null)
                }}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27 6.05 7.3C6.02 7.46 6 7.62 6 7.79v4.26c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5h1.7c0 2.25 1.83 4.08 4.06 4.08.48 0 .94-.09 1.38-.24L19.73 21 21 19.73 4.27 3z"/>
                </svg>
                Mute in Voice
              </button>
              <button
                onClick={async () => {
                  await onDisconnectFromVoice?.(contextMenu.member.userId)
                  setContextMenu(null)
                }}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
                Disconnect from Voice
              </button>
            </>
          )}
          {canMoveToChannel(contextMenu.member) && (
            <div className="relative">
              <button
                onClick={() => setMoveToChannel(moveToChannel ? null : contextMenu.member)}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6.586 7.00304H4C3.45 7.00304 3 7.45304 3 8.00304V16.003C3 16.553 3.45 17.003 4 17.003H6.586L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.003V4.00304C12 3.59904 11.757 3.23404 11.383 3.07904Z"/>
                  </svg>
                  Move to Channel
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="rotate-90">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </button>
              {moveToChannel?.userId === contextMenu.member.userId && (
                <div className="absolute left-full top-0 ml-0.5 bg-[#111214] rounded-lg shadow-xl py-1 min-w-[140px] border border-app-hover/30 max-h-48 overflow-y-auto">
                  {voiceChannels
                    .filter((ch) => ch.id !== contextMenu.member.voiceChannelId)
                    .map((ch) => (
                      <button
                        key={ch.id}
                        onClick={async () => {
                          await onMoveToChannel?.(contextMenu.member.userId, ch.id)
                          setContextMenu(null)
                          setMoveToChannel(null)
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
                          <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6.586 7.00304H4C3.45 7.00304 3 7.45304 3 8.00304V16.003C3 16.553 3.45 17.003 4 17.003H6.586L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.003V4.00304C12 3.59904 11.757 3.23404 11.383 3.07904Z"/>
                        </svg>
                        {ch.name}
                      </button>
                    ))}
                  {voiceChannels.filter((ch) => ch.id !== contextMenu.member.voiceChannelId).length === 0 && (
                    <div className="px-3 py-2 text-xs text-app-muted">No other voice channels</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedMember && (
        <MemberProfilePanel
          member={selectedMember}
          currentUserId={currentUserId}
          voiceChannels={voiceChannels}
          onClose={() => setSelectedMember(null)}
          onMessage={(userId, username) => {
            onMessage?.(userId, username)
            setSelectedMember(null)
          }}
          onAddFriend={(userId, username) => {
            onAddFriend?.(userId, username)
            setSelectedMember(null)
          }}
          onCall={onCall ? (userId, username, avatarUrl) => {
            onCall(userId, username, avatarUrl)
            setSelectedMember(null)
          } : undefined}
        />
      )}
    </div>
  )
}
