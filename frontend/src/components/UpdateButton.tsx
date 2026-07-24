import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useDesktopUpdate } from '../hooks/useDesktopUpdate'

/** Neon download/apply glyph for the deferred-update badge. */
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
 * Desktop update UI:
 * - Modal for download / ready / applying
 * - "Update later" dismisses the ready modal and leaves a top-right badge
 * - Badge click applies the staged update
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
    installUpdate,
  } = useDesktopUpdate()
  const [dismissed, setDismissed] = useState(false)
  const lastAnnouncedVersionRef = useRef<string | null>(null)

  // Re-show the modal only when a new version becomes ready/download starts —
  // not every render while `updateDownloaded` stays true (that would ignore Later).
  useEffect(() => {
    if (!isElectron) return
    const key = availableVersion || (updateDownloaded ? 'ready' : downloading ? 'downloading' : null)
    if (!key) return
    if (installing) {
      setDismissed(false)
      return
    }
    if (key !== lastAnnouncedVersionRef.current) {
      lastAnnouncedVersionRef.current = key
      setDismissed(false)
    }
  }, [isElectron, availableVersion, updateDownloaded, downloading, installing])

  if (!isElectron) return null

  const versionLabel = availableVersion ? `v${availableVersion}` : 'Update'
  const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties
  const updateReady = updateAvailable && updateDownloaded
  const showModal =
    !dismissed && (installing || downloading || updateReady)
  const showBadge =
    dismissed && !installing && (updateReady || downloading)

  const openModal = () => setDismissed(false)

  const applyFromBadge = () => {
    setDismissed(false)
    if (updateDownloaded) {
      void installUpdate()
    }
  }

  const title = installing
    ? 'Applying update…'
    : downloading && !updateDownloaded
      ? 'Downloading update…'
      : 'Update ready'

  const subtitle = installing
    ? 'Nepsis Chat will reopen automatically.'
    : downloading && !updateDownloaded
      ? `${versionLabel} is downloading in the background.`
      : `${versionLabel} downloaded and is ready to install silently.`

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
              {installing ? (
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
                </>
              ) : downloading && !updateDownloaded ? (
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
                    You can keep using Nepsis Chat. We will ask you to restart when the download
                    finishes.
                  </p>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDismissed(true)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-app-muted hover:bg-app-glass/10 hover:text-app-text"
                    >
                      Update later
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-app-muted">
                    Restart to apply the update. There is no install wizard — the same install
                    location and account scope are reused automatically.
                  </p>
                  {installError && (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
                      {installError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDismissed(true)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-app-muted hover:bg-app-glass/10 hover:text-app-text"
                    >
                      Update later
                    </button>
                    <button
                      type="button"
                      onClick={() => void installUpdate()}
                      className="rounded-lg bg-app-accent px-4 py-2 text-sm font-semibold text-white hover:bg-app-accent-hover"
                    >
                      Restart and update
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showBadge && (
        <button
          type="button"
          onClick={() => (updateDownloaded ? applyFromBadge() : openModal())}
          title={
            updateDownloaded
              ? `Apply update${availableVersion ? ` ${versionLabel}` : ''}`
              : `Update downloading${availableVersion ? ` ${versionLabel}` : ''} — click for progress`
          }
          aria-label={
            updateDownloaded
              ? `Apply update${availableVersion ? ` ${versionLabel}` : ''}`
              : 'Show update download progress'
          }
          className="fixed top-10 right-3 z-[70] flex h-10 w-10 items-center justify-center rounded-xl border border-[#23d18c]/40 bg-black/85 text-[#23d18c] shadow-lg shadow-black/40 hover:bg-black hover:border-[#23d18c] hover:scale-105 transition-transform"
          style={noDrag}
        >
          <UpdateDownloadIcon />
          {downloading && !updateDownloaded && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[#23d18c]">
              {downloadPercent}%
            </span>
          )}
        </button>
      )}
    </>
  )
}
