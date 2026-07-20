import { useState, useCallback, useEffect, useMemo } from 'react'
import { MemberProfilePanel } from './MemberProfilePanel'
import { CoolIcon } from './icons/CoolIcon'
import type { Channel } from '../types'

export interface ServerMember {
  userId: string
  username: string
  avatarUrl?: string
  bannerUrl?: string
  role: 'owner' | 'admin' | 'member'
  status: 'online' | 'offline' | 'in-voice' | 'away' | 'dnd'
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
  onBan?: (userId: string) => Promise<void>
  onMessage?: (userId: string, username: string) => void
  onAddFriend?: (userId: string, username: string) => void
  onCall?: (userId: string, username: string, avatarUrl?: string) => void
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
  onMuteInVoice?: (userId: string) => Promise<void>
  onDisconnectFromVoice?: (userId: string) => Promise<void>
  title?: string
}

type DisplayStatus = 'online' | 'offline' | 'in-voice' | 'away' | 'dnd'

function statusDotClass(status: DisplayStatus) {
  if (status === 'online' || status === 'in-voice') return 'bg-[#23a559]'
  if (status === 'away') return 'bg-[#f0b232]'
  if (status === 'dnd') return 'bg-red-500'
  return 'bg-[#80848e]'
}

function statusLabel(status: DisplayStatus) {
  if (status === 'in-voice') return 'In voice'
  if (status === 'online') return 'Online'
  if (status === 'away') return 'Away'
  if (status === 'dnd') return 'Do Not Disturb'
  return 'Offline'
}

export function MembersSidebar({
  members,
  currentUserId,
  currentUserAvatarUrl,
  currentUserRole = 'member',
  serverId,
  voiceChannels = [],
  onKick,
  onBan,
  onMessage,
  onAddFriend,
  onCall,
  onMoveToChannel,
  onMuteInVoice,
  onDisconnectFromVoice,
  title = 'Members',
}: MembersSidebarProps) {
  const [minimized, setMinimized] = useState(false)
  const [selectedMember, setSelectedMember] = useState<ServerMember | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    member: ServerMember
  } | null>(null)
  const [moveToChannel, setMoveToChannel] = useState<ServerMember | null>(null)

  const isAdminOrOwner = currentUserRole === 'owner' || currentUserRole === 'admin'

  const memberDisplayStatus = useCallback(
    (member: ServerMember): DisplayStatus => {
      const isInVoiceOnThisServer =
        member.status === 'in-voice' &&
        member.voiceChannelId &&
        voiceChannels.some((ch) => ch.id === member.voiceChannelId)
      if (isInVoiceOnThisServer) return 'in-voice'
      if (member.status === 'online' || member.status === 'away' || member.status === 'dnd') {
        return member.status
      }
      return 'offline'
    },
    [voiceChannels]
  )

  const grouped = useMemo(() => {
    const voice: ServerMember[] = []
    const online: ServerMember[] = []
    const offline: ServerMember[] = []
    for (const m of members) {
      const s = memberDisplayStatus(m)
      if (s === 'in-voice') voice.push(m)
      else if (s === 'offline') offline.push(m)
      else online.push(m)
    }
    const byName = (a: ServerMember, b: ServerMember) => a.username.localeCompare(b.username)
    voice.sort(byName)
    online.sort(byName)
    offline.sort(byName)
    return { voice, online, offline }
  }, [members, memberDisplayStatus])

  const canModerate = (m: ServerMember) => {
    if (!serverId) return false
    if (m.userId === currentUserId) return false
    if (m.role === 'owner') return false
    if (currentUserRole === 'owner') return true
    if (currentUserRole === 'admin' && m.role === 'member') return true
    return false
  }

  const canKick = (m: ServerMember) => canModerate(m) && !!onKick
  const canBan = (m: ServerMember) => canModerate(m) && !!onBan

  const openProfile = (member: ServerMember, el: HTMLElement) => {
    setContextMenu(null)
    setAnchorRect(el.getBoundingClientRect())
    setSelectedMember(member)
  }

  const closeProfile = () => {
    setSelectedMember(null)
    setAnchorRect(null)
  }

  const canMoveToChannel = (m: ServerMember) =>
    isAdminOrOwner &&
    m.userId !== currentUserId &&
    m.status === 'in-voice' &&
    m.voiceChannelId &&
    voiceChannels.some((ch) => ch.id === m.voiceChannelId) &&
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

  const handleContextMenu = useCallback((e: React.MouseEvent, member: ServerMember) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, member })
  }, [])

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

  const avatarUrlFor = (member: ServerMember) =>
    (member.userId === currentUserId && currentUserAvatarUrl) || member.avatarUrl

  const roleBadge = (role: string) => {
    if (role === 'owner') {
      return (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 tracking-wide">
          Owner
        </span>
      )
    }
    if (role === 'admin') {
      return (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 tracking-wide">
          Admin
        </span>
      )
    }
    return null
  }

  const renderMemberRow = (member: ServerMember) => {
    const displayStatus = memberDisplayStatus(member)
    const isSelected = selectedMember?.userId === member.userId
    const avatar = avatarUrlFor(member)
    return (
      <button
        key={member.userId}
        type="button"
        onClick={(e) => openProfile(member, e.currentTarget)}
        onContextMenu={(e) => handleContextMenu(e, member)}
        className={`w-full px-2.5 py-1.5 flex items-center gap-2.5 rounded-xl text-left transition-colors ${
          isSelected ? 'bg-app-glass/[0.08]' : 'hover:bg-app-glass/[0.05]'
        }`}
      >
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white font-semibold text-sm overflow-hidden ring-2 ring-transparent">
            {avatar ? (
              <img key={avatar} src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              member.username.charAt(0).toUpperCase()
            )}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-app-channel ${statusDotClass(displayStatus)}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium text-app-text truncate">{member.username}</span>
            {roleBadge(member.role)}
          </div>
          <div className="text-[11px] text-app-muted truncate">{statusLabel(displayStatus)}</div>
        </div>
      </button>
    )
  }

  const Section = ({
    label,
    count,
    children,
  }: {
    label: string
    count: number
    children: React.ReactNode
  }) => {
    if (count === 0) return null
    return (
      <div className="mb-3">
        <div className="px-2.5 mb-1 flex items-center justify-between">
          <span className="font-display text-[11px] font-semibold text-app-muted/90 tracking-tight">
            {label}
          </span>
          <span className="text-[10px] tabular-nums text-app-muted/70">{count}</span>
        </div>
        <div className="space-y-0.5 px-1">{children}</div>
      </div>
    )
  }

  // ── Minimized rail ──────────────────────────────────────────────
  if (minimized) {
    const preview = [...grouped.voice, ...grouped.online, ...grouped.offline].slice(0, 6)
    return (
      <div className="w-14 bg-app-channel flex flex-col items-center border-l border-app-glass/[0.06] py-3 gap-2">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-app-muted hover:text-app-text hover:bg-app-glass/[0.06] transition-colors"
          title="Expand members"
          aria-label="Expand members"
        >
          <CoolIcon name="chevron-left" size={18} />
        </button>
        <div className="flex flex-col items-center gap-0.5 px-1">
          <CoolIcon name="users" size={14} className="text-app-muted/70" />
          <span className="text-[10px] font-semibold tabular-nums text-app-muted">{members.length}</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto w-full flex flex-col items-center gap-1.5 py-1 px-1.5">
          {preview.map((member) => {
            const avatar = avatarUrlFor(member)
            const status = memberDisplayStatus(member)
            return (
              <button
                key={member.userId}
                type="button"
                title={member.username}
                onClick={() => setMinimized(false)}
                className="relative w-9 h-9 rounded-full overflow-hidden bg-app-accent flex items-center justify-center text-white text-xs font-semibold ring-1 ring-app-glass/10 hover:ring-app-accent/50 transition-all"
              >
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  member.username.charAt(0).toUpperCase()
                )}
                <span
                  className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-app-channel ${statusDotClass(status)}`}
                />
              </button>
            )
          })}
          {members.length > preview.length && (
            <span className="text-[10px] text-app-muted font-medium">+{members.length - preview.length}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-60 bg-app-channel flex flex-col flex-shrink-0 border-l border-app-glass/[0.06]">
      <div className="h-12 px-3 flex items-center justify-between border-b border-app-glass/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <CoolIcon name="users" size={16} className="text-app-muted flex-shrink-0" />
          <span className="font-display text-[13px] font-semibold text-app-text truncate">
            {title}
          </span>
          <span className="text-[11px] tabular-nums text-app-muted flex-shrink-0">{members.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="p-1.5 rounded-lg text-app-muted hover:text-app-text hover:bg-app-glass/[0.06] transition-colors"
          title="Minimize members"
          aria-label="Minimize members"
        >
          <CoolIcon name="chevron-right" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        <Section label="In Voice" count={grouped.voice.length}>
          {grouped.voice.map(renderMemberRow)}
        </Section>
        <Section label="Online" count={grouped.online.length}>
          {grouped.online.map(renderMemberRow)}
        </Section>
        <Section label="Offline" count={grouped.offline.length}>
          {grouped.offline.map(renderMemberRow)}
        </Section>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-app-darker rounded-xl shadow-2xl py-1 min-w-[180px] border border-app-hover/50"
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
            <CoolIcon name="chat" size={14} />
            Message
          </button>
          <button
            onClick={() => {
              onAddFriend?.(contextMenu.member.userId, contextMenu.member.username)
              setContextMenu(null)
            }}
            className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
          >
            <CoolIcon name="user-add" size={14} />
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
              <CoolIcon name="phone" size={14} />
              Call
            </button>
          )}
          {canKick(contextMenu.member) && (
            <button
              onClick={async () => {
                try {
                  await onKick?.(contextMenu.member.userId)
                } finally {
                  setContextMenu(null)
                  closeProfile()
                }
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
            >
              <CoolIcon name="user-close" size={14} />
              Kick from Server
            </button>
          )}
          {canBan(contextMenu.member) && (
            <button
              onClick={async () => {
                try {
                  await onBan?.(contextMenu.member.userId)
                } finally {
                  setContextMenu(null)
                  closeProfile()
                }
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
            >
              <CoolIcon name="circle-warning" size={14} />
              Ban from Server
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
                <CoolIcon name="volume-off" size={14} />
                Mute in Voice
              </button>
              <button
                onClick={async () => {
                  await onDisconnectFromVoice?.(contextMenu.member.userId)
                  setContextMenu(null)
                }}
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
              >
                <CoolIcon name="phone" size={14} />
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
                  <CoolIcon name="move" size={14} />
                  Move to Channel
                </span>
                <CoolIcon name="chevron-right" size={12} />
              </button>
              {moveToChannel?.userId === contextMenu.member.userId && (
                <div className="absolute left-full top-0 ml-0.5 bg-app-darker rounded-xl shadow-2xl py-1 min-w-[148px] border border-app-hover/50 max-h-48 overflow-y-auto">
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
                        <CoolIcon name="volume-max" size={12} className="opacity-70" />
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

      {selectedMember && anchorRect && (
        <MemberProfilePanel
          member={selectedMember}
          currentUserId={currentUserId}
          voiceChannels={voiceChannels}
          anchorRect={anchorRect}
          canKick={canKick(selectedMember)}
          canBan={canBan(selectedMember)}
          onClose={closeProfile}
          onMessage={(userId, username) => {
            onMessage?.(userId, username)
          }}
          onAddFriend={(userId, username) => {
            onAddFriend?.(userId, username)
          }}
          onCall={
            onCall
              ? (userId, username, avatarUrl) => {
                  onCall(userId, username, avatarUrl)
                }
              : undefined
          }
          onKick={onKick}
          onBan={onBan}
        />
      )}
    </div>
  )
}
