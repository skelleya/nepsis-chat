import { useEffect, useState, type CSSProperties } from 'react'
import { useDesktopUpdate } from '../hooks/useDesktopUpdate'

/**
 * Desktop update modal. Shows download progress, then a restart prompt, then an
 * applying loader. The NSIS installer itself runs silently (/S --updated).
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

  useEffect(() => {
    if (updateDownloaded || downloading || installing) setDismissed(false)
  }, [updateDownloaded, downloading, installing, availableVersion])

  const show =
    isElectron &&
    !dismissed &&
    (installing || downloading || (updateAvailable && updateDownloaded))

  if (!show) return null

  const versionLabel = availableVersion ? `v${availableVersion}` : 'Update'
  const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties

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
                  Hide
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
                  Later
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
  )
}
