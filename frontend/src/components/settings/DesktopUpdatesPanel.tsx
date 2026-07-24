import { useDesktopUpdate } from '../../hooks/useDesktopUpdate'

/** Desktop-only: version + Check for updates inside User Settings. */
export function DesktopUpdatesPanel() {
  const {
    isElectron,
    version,
    availableVersion,
    updateDownloaded,
    downloading,
    downloadPercent,
    installing,
    checkStatus,
    checkForUpdatesNow,
    installUpdate,
  } = useDesktopUpdate()

  if (!isElectron) return null

  const busy = checkStatus.status === 'checking' || downloading || installing
  const statusText =
    installing
      ? 'Applying update…'
      : downloading && !updateDownloaded
        ? `Downloading update${availableVersion ? ` v${availableVersion}` : ''}… ${downloadPercent}%`
        : checkStatus.message ||
          (updateDownloaded
            ? `Update${availableVersion ? ` v${availableVersion}` : ''} is ready.`
            : version
              ? `Installed version v${version}`
              : 'Desktop app')

  return (
    <div className="bg-app-channel rounded-lg p-4 space-y-3 mb-4">
      <div>
        <h4 className="font-semibold text-app-text">Desktop updates</h4>
        <p className="text-xs text-app-muted mt-0.5">
          Updates download in the background and install silently — no install-scope wizard.
        </p>
      </div>
      <p className="text-sm text-app-text">{statusText}</p>
      {(downloading && !updateDownloaded) && (
        <div className="h-1.5 overflow-hidden rounded-full bg-app-darker">
          <div
            className="h-full rounded-full bg-app-accent transition-[width] duration-200"
            style={{ width: `${Math.max(4, downloadPercent)}%` }}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void checkForUpdatesNow()}
          className="px-3 py-2 rounded-md text-sm font-medium bg-app-accent hover:bg-app-accent-hover text-white disabled:opacity-50"
        >
          {checkStatus.status === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
        {updateDownloaded && (
          <button
            type="button"
            disabled={installing}
            onClick={() => void installUpdate()}
            className="px-3 py-2 rounded-md text-sm font-medium bg-app-hover hover:bg-app-darker text-app-text disabled:opacity-50"
          >
            {installing ? 'Restarting…' : 'Restart and update'}
          </button>
        )}
      </div>
    </div>
  )
}
