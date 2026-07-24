import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useDesktopUpdate } from '../hooks/useDesktopUpdate'

/** Neon download/apply glyph for the update-available badge. */
function UpdateDownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 3v11.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M7.2 10.8L12 16l4.8-5.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 20h14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Desktop update UI (Discord-style):
 * - When an update is available, only show a green download badge (no auto-download)
 * - Badge click downloads, then restarts with an “Updating your software” loading modal
 */
export function UpdateButton() {
  const {
    isElectron,
    updateAvailable,
    updateDownloaded,
    downloading,
    installing,
    installError,
    availableVersion,
    downloadPercent,
    downloadUpdate,
    installUpdate,
  } = useDesktopUpdate()
  const [userStarted, setUserStarted] = useState(false)
  const autoInstallRef = useRef(false)

  // After the user starts an update from the badge, install as soon as download finishes.
  useEffect(() => {
    if (!userStarted || !updateDownloaded || installing || autoInstallRef.current) return
    autoInstallRef.current = true
    void installUpdate()
  }, [userStarted, updateDownloaded, installing, installUpdate])

  if (!isElectron) return null

  const versionLabel = availableVersion ? `v${availableVersion}` : 'Update'
  const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties
  const showBadge =
    updateAvailable && !userStarted && !installing && !downloading
  const showModal = userStarted || installing || downloading

  const startUpdateFromBadge = () => {
    setUserStarted(true)
    autoInstallRef.current = false
    if (updateDownloaded) {
      autoInstallRef.current = true
      void installUpdate()
      return
    }
    void downloadUpdate()
  }

  const title = installing
    ? 'Updating your software'
    : downloading && !updateDownloaded
      ? 'Downloading update…'
      : 'Preparing update…'

  const subtitle = installing
    ? 'Nepsis Chat is installing the update. This window will reopen automatically.'
    : downloading && !updateDownloaded
      ? `${versionLabel} is downloading. Keep this window open.`
      : `${versionLabel} will install next.`

  return (
    <>
      {showModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          style={noDrag}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-app-glass/10 bg-app-darker text-app-text shadow-2xl">
            <div className="flex items-center gap-4 border-b border-app-glass/10 p-5">
              <img
                src="./logo.png"
                alt=""
                className="h-12 w-12 rounded-xl bg-white/95 object-contain p-1"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="text-sm text-app-muted">{subtitle}</p>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {installing || updateDownloaded ? (
                <>
                  <p className="text-sm text-app-muted">
                    Installing silently with your existing settings. Do not close the app.
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-app-glass/10">
                    <div className="h-full w-1/3 animate-[updateApplying_1.1s_ease-in-out_infinite] rounded-full bg-app-accent" />
                  </div>
                  <style>{`
                    @keyframes updateApplying {
                      0% { transform: translateX(-110%); }
                      100% { transform: translateX(410%); }
                    }
                  `}</style>
                  {installError && (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
                      {installError}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-app-muted">
                    <span>Downloading</span>
                    <span>{downloadPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-app-glass/10">
                    <div
                      className="h-full rounded-full bg-app-accent transition-[width] duration-200"
                      style={{ width: `${Math.max(4, downloadPercent)}%` }}
                    />
                  </div>
                  <p className="text-sm text-app-muted">
                    When the download finishes, Nepsis will restart and finish updating.
                  </p>
                  {installError && (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
                      {installError}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showBadge && (
        <button
          type="button"
          onClick={startUpdateFromBadge}
          title={`Update available${availableVersion ? ` ${versionLabel}` : ''} — click to install`}
          aria-label={`Update available${availableVersion ? ` ${versionLabel}` : ''} — click to install`}
          className="fixed top-10 right-3 z-[70] flex h-10 w-10 items-center justify-center rounded-xl border border-[#23d18c]/40 bg-black/85 text-[#23d18c] shadow-lg shadow-black/40 hover:bg-black hover:border-[#23d18c] hover:scale-105 transition-transform"
          style={noDrag}
        >
          <UpdateDownloadIcon />
        </button>
      )}
    </>
  )
}
