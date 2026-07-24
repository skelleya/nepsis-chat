import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useDesktopUpdate } from '../hooks/useDesktopUpdate'
import { UpdateApplyingPanel } from './UpdateApplyingPanel'

/** Neon download/apply glyph for the update-available badge. */
function UpdateDownloadIcon({ className = '', size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
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
 * - Compact green download control for the title bar
 * - Download progress, then stepped “Applying update N of M” before restart
 */
export function UpdateButton({ variant = 'titlebar' }: { variant?: 'titlebar' | 'floating' }) {
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
  const showApplying = installing || (updateDownloaded && userStarted && !downloading)

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

  const title = installing || showApplying
    ? 'Updating your software'
    : downloading && !updateDownloaded
      ? 'Downloading update…'
      : 'Preparing update…'

  const subtitle = installing || showApplying
    ? 'Nepsis Chat is applying the update and will reopen automatically.'
    : downloading && !updateDownloaded
      ? `${versionLabel} is downloading. Keep this window open.`
      : `${versionLabel} will install next.`

  const badge =
    showBadge && variant === 'titlebar' ? (
      <button
        type="button"
        onClick={startUpdateFromBadge}
        title={`Update available${availableVersion ? ` ${versionLabel}` : ''} — click to install`}
        aria-label={`Update available${availableVersion ? ` ${versionLabel}` : ''} — click to install`}
        className="flex h-full w-10 items-center justify-center text-[#23d18c] transition-colors hover:bg-app-hover hover:text-[#3dffb0]"
      >
        <UpdateDownloadIcon size={16} />
      </button>
    ) : showBadge && variant === 'floating' ? (
      <button
        type="button"
        onClick={startUpdateFromBadge}
        title={`Update available${availableVersion ? ` ${versionLabel}` : ''} — click to install`}
        aria-label={`Update available${availableVersion ? ` ${versionLabel}` : ''} — click to install`}
        className="fixed top-10 right-3 z-[70] flex h-10 w-10 items-center justify-center rounded-xl border border-[#23d18c]/40 bg-black/85 text-[#23d18c] shadow-lg shadow-black/40 transition-transform hover:scale-105 hover:border-[#23d18c] hover:bg-black"
        style={noDrag}
      >
        <UpdateDownloadIcon />
      </button>
    ) : null

  const modal =
    showModal && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            style={noDrag}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-app-glass/10 bg-app-darker text-app-text shadow-2xl">
              <div className="relative overflow-hidden border-b border-app-glass/10 p-5">
                <div
                  className="pointer-events-none absolute inset-0 opacity-80"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 0% 0%, rgba(255,90,31,0.18), transparent 55%), radial-gradient(80% 70% at 100% 100%, rgba(35,165,89,0.08), transparent 50%)',
                  }}
                />
                <div className="relative flex items-center gap-4">
                  <img
                    src="./logo.png"
                    alt=""
                    className="h-12 w-12 rounded-xl bg-white/95 object-contain p-1"
                  />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                    <p className="text-sm text-app-muted">{subtitle}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                {showApplying ? (
                  <UpdateApplyingPanel
                    active={installing || showApplying}
                    versionLabel={availableVersion ? `v${availableVersion}` : null}
                    error={installError}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-app-muted">
                      <span>Downloading</span>
                      <span className="tabular-nums">{downloadPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-app-glass/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff7a3d] to-app-accent transition-[width] duration-200"
                        style={{ width: `${Math.max(4, downloadPercent)}%` }}
                      />
                    </div>
                    <p className="text-sm text-app-muted">
                      When the download finishes, Nepsis will apply the update and restart.
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
          </div>,
          document.body
        )
      : null

  return (
    <>
      {badge}
      {modal}
    </>
  )
}

/** @deprecated Use UpdateButton variant="titlebar" inside TitleBar */
export function UpdateTitleBarControl() {
  return <UpdateButton variant="titlebar" />
}
