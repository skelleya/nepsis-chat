import { useEffect, useState, type CSSProperties } from 'react'
import { useDesktopUpdate } from '../hooks/useDesktopUpdate'

/**
 * Desktop update modal. Downloads remain in the background; users are only
 * prompted when the update is staged and ready for a silent in-place restart.
 */
export function UpdateButton() {
  const {
    isElectron,
    updateAvailable,
    updateDownloaded,
    installing,
    installError,
    availableVersion,
    installUpdate,
  } = useDesktopUpdate()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (updateDownloaded) setDismissed(false)
  }, [updateDownloaded, availableVersion])

  if (!isElectron || !updateAvailable || !updateDownloaded || dismissed) return null

  const versionLabel = availableVersion ? `v${availableVersion}` : 'Update'
  const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      style={noDrag}
      role="dialog"
      aria-modal="true"
      aria-label={installing ? 'Applying update' : 'Update ready'}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-app-glass/10 bg-app-darker text-app-text shadow-2xl">
        <div className="flex items-center gap-4 border-b border-app-glass/10 p-5">
          <img
            src="./logo.png"
            alt=""
            className="h-12 w-12 rounded-xl bg-white/95 object-contain p-1"
          />
          <div className="min-w-0">
            <h2 className="text-lg font-bold">
              {installing ? 'Applying update…' : 'Update ready'}
            </h2>
            <p className="text-sm text-app-muted">
              {installing
                ? 'Nepsis Chat will reopen automatically.'
                : `${versionLabel} downloaded automatically and is ready to install.`}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {installing ? (
            <>
              <p className="text-sm text-app-muted">
                Installing in the background with your existing installation settings. Do not
                close the app.
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
          ) : (
            <>
              <p className="text-sm text-app-muted">
                Restart when you are ready. The updater will silently reuse the same per-user or
                all-users install scope and location you originally selected.
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
