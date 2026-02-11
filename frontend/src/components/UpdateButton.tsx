import { useDesktopUpdate } from '../hooks/useDesktopUpdate'

export function UpdateButton() {
  const { isElectron, updateAvailable, updateDownloaded, downloading, downloadUpdate, installUpdate } = useDesktopUpdate()

  if (!isElectron || !updateAvailable) return null

  // Update downloaded — show "Restart to install"
  if (updateDownloaded) {
    return (
      <button
        onClick={installUpdate}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-white shadow-lg transition-all hover:bg-green-700"
        title="Restart to install update"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="font-semibold text-sm">Restart to Update</span>
      </button>
    )
  }

  // Update available — show download icon (arrow down + line), click to download
  return (
    <button
      onClick={downloadUpdate}
      disabled={downloading}
      className="fixed top-4 right-4 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-app-dark/90 border border-app-hover/50 shadow-lg transition-all hover:scale-105 hover:border-[#6ee7b7]/50 focus:outline-none focus:ring-2 focus:ring-[#6ee7b7]/50 disabled:opacity-70 disabled:cursor-not-allowed"
      title={downloading ? 'Downloading...' : 'Download update'}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[#6ee7b7] drop-shadow-[0_0_8px_rgba(110,231,183,0.6)]"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {downloading && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-[#6ee7b7] whitespace-nowrap">
          Downloading...
        </span>
      )}
    </button>
  )
}
