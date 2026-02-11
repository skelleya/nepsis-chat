import { useDesktopUpdate } from '../hooks/useDesktopUpdate'

export function UpdateButton() {
  const { isElectron, updateDownloaded, installUpdate } = useDesktopUpdate()

  // Only show when update is ready to install (not while downloading) to avoid
  // stuck "Downloading..." state when the update server is unreachable
  if (!isElectron || !updateDownloaded) return null

  return (
    <button
      onClick={installUpdate}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-white shadow-lg transition-all hover:bg-green-700"
      title="Restart to install update"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span className="font-semibold text-sm">Restart to Update</span>
    </button>
  )
}
