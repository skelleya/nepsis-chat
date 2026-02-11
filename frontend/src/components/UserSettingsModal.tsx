interface UserSettingsModalProps {
  username: string
  userId: string
  avatarUrl?: string
  onClose: () => void
  onLogout: () => void
}

export function UserSettingsModal({ username, userId, avatarUrl, onClose, onLogout }: UserSettingsModalProps) {
  return (
    <div className="fixed inset-0 bg-[#313338] z-50 flex">
      {/* Left sidebar - Settings navigation */}
      <div className="w-[218px] bg-[#2b2d31] flex flex-col items-end pt-[60px] pr-2 pl-5 flex-shrink-0">
        <div className="w-[190px]">
          <div className="px-2.5 py-1.5 text-xs font-bold text-app-muted uppercase tracking-wider">
            User Settings
          </div>
          <button className="w-full px-2.5 py-1.5 rounded text-sm text-white bg-app-hover/60 text-left mb-0.5">
            My Account
          </button>
          <button className="w-full px-2.5 py-1.5 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/40 text-left mb-0.5">
            Profiles
          </button>
          <button className="w-full px-2.5 py-1.5 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/40 text-left mb-0.5">
            Privacy & Safety
          </button>
          <button className="w-full px-2.5 py-1.5 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/40 text-left mb-0.5">
            Appearance
          </button>
          <button className="w-full px-2.5 py-1.5 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/40 text-left mb-0.5">
            Voice & Video
          </button>
          <button className="w-full px-2.5 py-1.5 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/40 text-left mb-0.5">
            Notifications
          </button>
          <div className="h-px bg-app-hover/50 my-2" />
          <button
            onClick={onLogout}
            className="w-full px-2.5 py-1.5 rounded text-sm text-red-400 hover:text-red-300 hover:bg-app-hover/40 text-left flex items-center gap-2"
          >
            Log Out
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="ml-auto">
              <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.58L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-[740px] pt-[60px] px-10">
        <h2 className="text-xl font-bold text-white mb-5">My Account</h2>

        {/* User card */}
        <div className="bg-[#111214] rounded-lg overflow-hidden">
          {/* Banner */}
          <div className="h-[100px] bg-app-accent" />

          {/* User info */}
          <div className="px-4 pb-4">
            <div className="flex items-end gap-4 -mt-[38px]">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username} className="w-20 h-20 rounded-full object-cover border-[6px] border-[#111214]" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-2xl border-[6px] border-[#111214]">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[#23a559] border-[3px] border-[#111214]" />
              </div>
              <div className="pb-1">
                <div className="text-xl font-bold text-white">{username}</div>
              </div>
            </div>

            <div className="mt-4 bg-[#2b2d31] rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-app-muted uppercase">Username</div>
                  <div className="text-sm text-app-text mt-0.5">{username}</div>
                </div>
                <button className="px-4 py-1.5 bg-app-hover rounded text-sm text-white hover:bg-app-hover/80 transition-colors">
                  Edit
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-app-muted uppercase">User ID</div>
                  <div className="text-sm text-app-text mt-0.5 font-mono">{userId}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Close button */}
      <div className="pt-[60px] pr-5 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full border-2 border-app-muted/60 flex items-center justify-center text-app-muted hover:text-white hover:border-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
          </svg>
        </button>
        <div className="text-xs text-app-muted text-center mt-1">ESC</div>
      </div>
    </div>
  )
}
