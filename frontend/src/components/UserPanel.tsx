import { useState, useRef, useEffect } from 'react'
import { UserSettingsModal } from './UserSettingsModal'
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
                <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
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
                {isMuted && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-red-400 flex-shrink-0" aria-label="Muted">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                )}
                {isDeafened && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 flex-shrink-0" aria-label="Deafened">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                )}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27 6.05 7.3C6.02 7.46 6 7.62 6 7.79v4.26c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5h1.7c0 2.25 1.83 4.08 4.06 4.08.48 0 .94-.09 1.38-.24L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          </button>
          <button
            onClick={onToggleDeafen}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isDeafened ? 'text-red-400 hover:bg-app-hover/60' : 'text-app-muted hover:bg-app-hover/60 hover:text-app-text'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z"/>
              <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
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
