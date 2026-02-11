import type { ServerMember } from './MembersSidebar'
import type { Channel } from '../types'

interface MemberProfilePanelProps {
  member: ServerMember
  currentUserId: string
  voiceChannels?: Channel[]
  onClose: () => void
  onMessage: (userId: string, username: string) => void
  onAddFriend: (userId: string, username: string) => void
}

export function MemberProfilePanel({
  member,
  currentUserId,
  voiceChannels = [],
  onClose,
  onMessage,
  onAddFriend,
}: MemberProfilePanelProps) {
  const isCurrentUser = member.userId === currentUserId

  // Only show "In voice" if member is in a voice channel on THIS server
  const isInVoiceOnThisServer =
    member.status === 'in-voice' &&
    member.voiceChannelId &&
    voiceChannels.some((ch) => ch.id === member.voiceChannelId)
  const displayStatus = isInVoiceOnThisServer ? 'in-voice' : member.status === 'online' ? 'online' : 'offline'

  const roleBadge = (role: string) => {
    if (role === 'owner') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/50 text-amber-200">owner</span>
    if (role === 'admin') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/50 text-blue-200">admin</span>
    return null
  }

  const statusLabel = displayStatus === 'in-voice' ? 'In voice' : displayStatus === 'online' ? 'Online' : 'Offline'
  const statusColor = displayStatus === 'online' ? 'bg-green-500' : displayStatus === 'in-voice' ? 'bg-yellow-500' : 'bg-gray-500'

  return (
    <div className="w-60 bg-app-channel flex flex-col border-l border-app-dark">
      <div className="h-12 px-4 flex items-center justify-between border-b border-app-dark">
        <span className="text-app-text font-semibold text-sm">Profile</span>
        <button
          onClick={onClose}
          className="p-1 rounded text-app-muted hover:text-app-text hover:bg-app-hover transition-colors"
          title="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.username} className="w-full h-full object-cover" />
              ) : (
                member.username.charAt(0).toUpperCase()
              )}
            </div>
            <div
              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-app-channel ${statusColor}`}
            />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="font-semibold text-app-text text-lg">{member.username}</span>
              {roleBadge(member.role)}
            </div>
            <div className="text-xs text-app-muted mt-1">{statusLabel}</div>
          </div>

          {!isCurrentUser && (
            <div className="w-full flex flex-col gap-2 mt-2">
              <button
                onClick={() => onMessage(member.userId, member.username)}
                className="w-full px-4 py-2 rounded bg-app-accent hover:bg-app-accent-hover text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                Message
              </button>
              <button
                onClick={() => onAddFriend(member.userId, member.username)}
                className="w-full px-4 py-2 rounded bg-app-hover hover:bg-app-hover/80 text-app-text text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Add Friend
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
