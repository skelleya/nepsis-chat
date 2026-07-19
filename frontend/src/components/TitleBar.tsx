import { useEffect, useState, type CSSProperties } from 'react'

/**
 * Discord-style custom window chrome for the Electron desktop app.
 * Drag region across the bar; Windows/Linux get custom min/max/close.
 * macOS keeps a thin drag strip (traffic lights via hiddenInset) — no duplicate buttons.
 */
export function TitleBar() {
  const isElectron = !!window.electronAPI?.isElectron
  const [platform, setPlatform] = useState<string | null>(null)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI?.getPlatform?.().then((p) => setPlatform(p))
    window.electronAPI?.windowIsMaximized?.().then((v) => setMaximized(!!v))
    const off = window.electronAPI?.onWindowMaximized?.((v) => setMaximized(v))
    return () => {
      off?.()
    }
  }, [isElectron])

  if (!isElectron) return null

  const isMac = platform === 'darwin'
  // Until platform resolves, reserve space so layout doesn't jump
  if (platform === null) {
    return <div className="h-8 shrink-0 bg-app-darker" aria-hidden />
  }

  return (
    <div
      className={`h-8 shrink-0 flex items-stretch select-none bg-app-darker border-b border-app-dark ${
        isMac ? 'pl-[78px]' : ''
      }`}
      style={{ WebkitAppRegion: 'drag' } as CSSProperties}
    >
      <div className="flex-1 flex items-center min-w-0 px-3 gap-2">
        <img src="./logo.png" alt="" className="w-4 h-4 rounded-full object-contain bg-white/90" draggable={false} />
        <span className="text-[12px] font-semibold text-app-muted truncate">Nepsis Chat</span>
      </div>

      {!isMac && (
        <div className="flex items-stretch" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => window.electronAPI?.windowMinimize?.()}
            className="w-11 flex items-center justify-center text-app-muted hover:bg-app-hover hover:text-app-text transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <rect x="1" y="5.5" width="10" height="1.2" rx="0.5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => window.electronAPI?.windowMaximizeToggle?.()}
            className="w-11 flex items-center justify-center text-app-muted hover:bg-app-hover hover:text-app-text transition-colors"
          >
            {maximized ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
                <rect x="3" y="1.5" width="7" height="7" />
                <path d="M1.5 3.5v7h7" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
                <rect x="1.5" y="1.5" width="9" height="9" />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={() => window.electronAPI?.windowClose?.()}
            className="w-12 flex items-center justify-center text-app-muted hover:bg-[#ed4245] hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
              <path d="M2 2l8 8M10 2L2 10" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
