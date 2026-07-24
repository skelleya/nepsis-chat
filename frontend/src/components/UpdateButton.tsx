import type { CSSProperties } from 'react'
import { useDesktopUpdate } from '../hooks/useDesktopUpdate'

/**
 * Top-of-app update badge for the desktop shell.
 * Appears when electron-updater finds a newer GitHub Release.
 * Positioned below the custom title bar with no-drag so clicks always work.
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

  if (!isElectron || !updateAvailable) return null

  const versionLabel = availableVersion ? `v${availableVersion}` : 'Update'
  const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties

  if (updateDownloaded) {
    return (
      <div
        className="fixed top-8 left-0 right-0 z-[70] flex justify-center pointer-events-none"
        style={noDrag}
      >
        <div className="pointer-events-auto flex flex-col items-center">
          <button
            type="button"
            onClick={() => {
              void installUpdate()
            }}
            disabled={installing}
            className="mt-0 flex items-center gap-3 rounded-b-2xl bg-[#23a559] pl-3 pr-4 py-2.5 text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-90 disabled:hover:translate-y-0"
            title="Restart to install update"
            style={noDrag}
          >
            <img
              src="./logo.png"
              alt=""
              className="h-8 w-8 rounded-lg object-contain bg-white/95 p-0.5"
            />
            <span className="text-left">
              <span className="block text-sm font-semibold leading-tight">
                {installing ? 'Restarting…' : 'Restart to update'}
              </span>
              <span className="block text-[11px] text-white/85">
                {installError ? installError : `${versionLabel} is ready`}
              </span>
            </span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed top-8 left-0 right-0 z-[70] flex justify-center pointer-events-none"
      style={noDrag}
    >
      <button
        type="button"
        onClick={() => {
          void downloadUpdate()
        }}
        disabled={downloading}
        className="pointer-events-auto mt-0 flex items-center gap-3 rounded-b-2xl bg-app-darker border border-app-glass/10 border-t-0 pl-3 pr-4 py-2.5 text-app-text shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-90 disabled:hover:translate-y-0"
        title={downloading ? `Downloading… ${downloadPercent}%` : `Download ${versionLabel}`}
        style={noDrag}
      >
        <span className="relative flex h-9 w-9 items-center justify-center">
          <img
            src="./logo.png"
            alt="Nepsis"
            className="h-9 w-9 rounded-lg object-contain bg-white p-0.5"
          />
          {!downloading && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-app-accent ring-2 ring-app-darker" />
          )}
        </span>
        <span className="text-left min-w-[9.5rem]">
          <span className="block text-sm font-semibold leading-tight">
            {downloading ? 'Downloading update…' : 'Update available'}
          </span>
          <span className="block text-[11px] text-app-muted">
            {downloading ? `${downloadPercent}%` : `${versionLabel} — click to install`}
          </span>
          {downloading && (
            <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-app-glass/15">
              <span
                className="block h-full rounded-full bg-[#ff5a1f] transition-[width] duration-200"
                style={{ width: `${downloadPercent}%` }}
              />
            </span>
          )}
        </span>
      </button>
    </div>
  )
}
