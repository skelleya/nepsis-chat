import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'

interface CreateServerModalProps {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export function CreateServerModal({ onClose, onCreate }: CreateServerModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const accentFillRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)

  useLayoutEffect(() => {
    const overlay = overlayRef.current
    const panel = panelRef.current
    if (!overlay || !panel) return

    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'sine.out' })
    gsap.fromTo(
      panel,
      { opacity: 0, y: 22, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.38,
        ease: 'power3.out',
        force3D: false,
        clearProps: 'transform',
      }
    )
  }, [])

  useLayoutEffect(() => {
    const fill = accentFillRef.current
    if (!fill) return
    // Seamless loop: strip is 200% wide with a mirrored gradient; slide by half its width.
    const tween = gsap.fromTo(
      fill,
      { xPercent: 0 },
      {
        xPercent: -50,
        duration: 1.1,
        ease: 'none',
        repeat: -1,
      }
    )
    return () => {
      tween.kill()
    }
  }, [])

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    const overlay = overlayRef.current
    const panel = panelRef.current
    if (!overlay || !panel) {
      onClose()
      return
    }
    gsap.killTweensOf([overlay, panel])
    gsap.to(overlay, { opacity: 0, duration: 0.2, ease: 'sine.in' })
    gsap.to(panel, {
      opacity: 0,
      y: 14,
      scale: 0.97,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: onClose,
    })
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose, loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      await onCreate(name.trim())
      requestClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create server')
      closingRef.current = false
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !loading && requestClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-server-title"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-[480px] mx-4 rounded-2xl bg-app-dark shadow-2xl shadow-black/50 ring-1 ring-white/5 overflow-hidden will-change-transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Moving gradient accent bar */}
        <div className="h-1 overflow-hidden" aria-hidden>
          <div
            ref={accentFillRef}
            className="h-full w-[200%] will-change-transform bg-[linear-gradient(90deg,rgb(var(--app-accent))_0%,#23a559_25%,rgb(var(--app-accent))_50%,#23a559_75%,rgb(var(--app-accent))_100%)]"
          />
        </div>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-app-accent/30 to-app-accent/10 flex items-center justify-center border border-app-accent/25">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-app-accent">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="create-server-title" className="text-xl font-bold text-white mb-1">
                Create your server
              </h2>
              <p className="text-sm text-app-muted leading-relaxed">
                Your server is where you and your friends hang out. Make yours and start talking.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="server-name" className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                Server name
              </label>
              <input
                id="server-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Awesome Server"
                className="w-full px-4 py-3 bg-app-darker rounded-lg text-app-text text-base placeholder:text-app-muted/50 outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-dark transition-shadow"
                autoFocus
                disabled={loading}
              />
            </div>

            <p className="text-xs text-app-muted leading-relaxed">
              By creating a server, you agree to Nepsis Chat&apos;s Community Guidelines.
            </p>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-2">
              <button
                type="button"
                onClick={requestClose}
                disabled={loading}
                className="px-4 py-2.5 text-sm font-medium text-app-muted hover:text-app-text transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || loading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-app-accent min-w-[140px]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating…
                  </span>
                ) : (
                  'Create server'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
