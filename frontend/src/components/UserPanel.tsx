import { useState, useRef, useEffect } from 'react'
import { UserSettingsModal } from './UserSettingsModal'
import { MicIcon, MicOffIcon, HeadphonesIcon, HeadphonesOffIcon } from './icons/VoiceIcons'
import type { UserStatus } from '../contexts/AppContext'

interface UserPanelProps {
  user: { id: string; username: string; avatar_url?: string; banner_url?: string; is_guest?: boolean }
  isMuted: boolean
  isDeafened: boolean
  isSpeaking?: boolean
  userStatus: UserStatus
  onSetStatus: (status: UserStatus) => void
  onToggleMute: () => void
  onToggleDeafen: () => void
  onLogout: () => void
  onUserUpdate?: (data: { username?: string; avatar_url?: string; banner_url?: string }) => void
}

const STATUS_COLORS: Record<UserStatus, string> = {
  online: 'bg-[#23a559]',
  away: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-[#80848e]',
}

const STATUS_LABELS: Record<UserStatus, string> = {
  online: 'Online',
  away: 'Away',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
}

export function UserPanel({
  user,
  isMuted,
  isDeafened,
  isSpeaking = false,
  userStatus,
  onSetStatus,
  onToggleMute,
  onToggleDeafen,
  onLogout,
  onUserUpdate,
}: UserPanelProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
    }
    if (showStatusMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showStatusMenu])

  const displayStatus = userStatus === 'online' && isSpeaking ? 'Speaking' : STATUS_LABELS[userStatus]
  const statusColor = userStatus === 'online' && isSpeaking ? 'bg-[#23a559]' : STATUS_COLORS[userStatus]

  return (
    <>
      <div className="h-[52px] bg-[#232428] px-2 flex items-center gap-1 flex-shrink-0">
        {/* User avatar + name — clickable for status */}
        <div className="relative flex-1 min-w-0" ref={statusMenuRef}>
          <div
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex items-center gap-2 px-1 py-1 rounded hover:bg-app-hover/40 cursor-pointer transition-colors"
          >
            <div className="relative flex-shrink-0">
              {user.avatar_url ? (
                <img key={user.avatar_url} src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#232428] transition-all duration-150 ${statusColor} ${
                  isSpeaking ? 'shadow-[0_0_8px_#23a559] ring-2 ring-[#23a559]/60 animate-pulse' : ''
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate leading-tight flex items-center gap-1.5">
                <span className="truncate">{user.username}</span>
                {isMuted && <MicOffIcon size={12} className="text-red-400 flex-shrink-0" />}
                {isDeafened && <HeadphonesOffIcon size={12} className="text-red-400 flex-shrink-0" />}
              </div>
              <div className="text-[11px] text-app-muted truncate leading-tight">{displayStatus}</div>
            </div>
          </div>

          {/* Status dropdown */}
          {showStatusMenu && (
            <div className="absolute left-0 bottom-full mb-1 w-48 bg-[#2b2d31] rounded-lg shadow-xl border border-app-hover/50 overflow-hidden z-[100]">
              <div className="p-1">
                {(['online', 'away', 'dnd', 'offline'] as UserStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onSetStatus(s)
                      setShowStatusMenu(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors ${
                      userStatus === s ? 'bg-app-accent/30 text-white' : 'text-app-text hover:bg-app-hover/60'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[s]}`} />
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex items-center">
          <button
            onClick={onToggleMute}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isMuted ? 'text-red-400 hover:bg-app-hover/60' : 'text-app-muted hover:bg-app-hover/60 hover:text-app-text'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
          </button>
          <button
            onClick={onToggleDeafen}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isDeafened ? 'text-red-400 hover:bg-app-hover/60' : 'text-app-muted hover:bg-app-hover/60 hover:text-app-text'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? <HeadphonesOffIcon size={18} /> : <HeadphonesIcon size={18} />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded flex items-center justify-center text-app-muted hover:bg-app-hover/60 hover:text-app-text transition-colors"
            title="User Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
          </button>
        </div>
      </div>

      {showSettings && (
        <UserSettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
          onUserUpdate={onUserUpdate}
        />
      )}
    </>
  )
}
