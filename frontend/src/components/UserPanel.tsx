import { useState } from 'react'
import { UserSettingsModal } from './UserSettingsModal'

interface UserPanelProps {
  username: string
  userId: string
  avatarUrl?: string
  isMuted: boolean
  isDeafened: boolean
  onToggleMute: () => void
  onToggleDeafen: () => void
  onLogout: () => void
}

export function UserPanel({
  username,
  userId,
  avatarUrl,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  onLogout,
}: UserPanelProps) {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <div className="h-[52px] bg-[#232428] px-2 flex items-center gap-1 flex-shrink-0">
        {/* User avatar + name */}
        <div className="flex items-center gap-2 flex-1 min-w-0 px-1 py-1 rounded hover:bg-app-hover/40 cursor-pointer transition-colors">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#23a559] border-2 border-[#232428]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate leading-tight">{username}</div>
            <div className="text-[11px] text-app-muted truncate leading-tight">Online</div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center">
          {/* Mute button */}
          <button
            onClick={onToggleMute}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isMuted
                ? 'text-red-400 hover:bg-app-hover/60'
                : 'text-app-muted hover:bg-app-hover/60 hover:text-app-text'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27 6.05 7.3C6.02 7.46 6 7.62 6 7.79v4.26c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5h1.7c0 2.25 1.83 4.08 4.06 4.08.48 0 .94-.09 1.38-.24L19.73 21 21 19.73 4.27 3z"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            )}
          </button>

          {/* Deafen button */}
          <button
            onClick={onToggleDeafen}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isDeafened
                ? 'text-red-400 hover:bg-app-hover/60'
                : 'text-app-muted hover:bg-app-hover/60 hover:text-app-text'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z"/>
                <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z"/>
              </svg>
            )}
          </button>

          {/* Settings gear */}
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

      {/* User Settings Modal */}
      {showSettings && (
        <UserSettingsModal
          username={username}
          userId={userId}
          avatarUrl={avatarUrl}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
        />
      )}
    </>
  )
}
