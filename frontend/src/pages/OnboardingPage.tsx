import { useApp } from '../contexts/AppContext'

interface OnboardingPageProps {
  onExplore: () => void
}

const ONBOARDING_COMPLETED_KEY = 'nepsis_onboarding_completed'

export function OnboardingPage({ onExplore }: OnboardingPageProps) {
  const { user, createServer } = useApp()
  const isGuest = user?.is_guest ?? false

  const handleCreateServer = async () => {
    try {
      const name = prompt('Server name:')
      if (!name?.trim()) return
      await createServer(name.trim())
      try {
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
      } catch { /* ignore */ }
    } catch (e) {
      console.error('Create server failed:', e)
    }
  }

  const handleExplore = () => {
    try {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
    } catch { /* ignore */ }
    onExplore()
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-xl mx-auto">
        {/* Welcome illustration */}
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-8 border border-app-accent/20">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-app-accent">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-3">
          Welcome to Nepsis{user?.username ? `, ${user.username}` : ''}
        </h1>
        <p className="text-app-muted text-center mb-8 leading-relaxed">
          Nepsis is your place to talk — voice chat, text channels, and DMs.
          Get started by creating your own server or exploring community servers.
        </p>

        <div className="flex flex-col gap-4 w-full">
          {!isGuest && (
            <button
              onClick={handleCreateServer}
              className="w-full py-3.5 px-6 rounded-xl bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create your first server
            </button>
          )}
          <button
            onClick={handleExplore}
            className={`w-full py-3.5 px-6 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
              isGuest
                ? 'bg-app-accent hover:bg-app-accent-hover text-white'
                : 'bg-[#2b2d31] hover:bg-[#36373d] text-app-text border border-app-hover/30'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Explore community servers
          </button>
        </div>

        <p className="mt-6 text-xs text-app-muted text-center">
          You can always create a server or join via invite later from the sidebar.
        </p>
      </div>
    </div>
  )
}

export { ONBOARDING_COMPLETED_KEY }
