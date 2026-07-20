import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'

interface CreateChannelModalProps {
  onClose: () => void
  onCreate: (name: string, type: 'text' | 'voice' | 'rules') => Promise<void>
  defaultType?: 'text' | 'voice' | 'rules'
  /** When true, type is fixed from the + that was clicked — only ask for a name */
  lockType?: boolean
  categoryName?: string
  /** When true (and not lockType), shows the Rules channel option (owner/admin only) */
  canCreateRules?: boolean
}

export function CreateChannelModal({
  onClose,
  onCreate,
  defaultType = 'text',
  lockType = false,
  categoryName,
  canCreateRules = false,
}: CreateChannelModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'text' | 'voice' | 'rules'>(defaultType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)

  useEffect(() => {
    setType(defaultType)
  }, [defaultType])

  useLayoutEffect(() => {
    const overlay = overlayRef.current
    const panel = panelRef.current
    if (!overlay || !panel) return

    gsap.killTweensOf([overlay, panel])
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'sine.out' })
    gsap.fromTo(
      panel,
      { opacity: 0, y: 18, scale: 0.97 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.35,
        ease: 'power3.out',
        force3D: false,
        clearProps: 'transform',
      }
    )

    return () => {
      gsap.killTweensOf([overlay, panel])
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
      duration: 0.2,
      ease: 'power2.in',
      force3D: false,
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
    setLoading(true)
    setError(null)
    try {
      await onCreate(name.trim().toLowerCase().replace(/\s+/g, '-'), type)
      requestClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel')
      closingRef.current = false
      setLoading(false)
    }
  }

  const typeLabel = type === 'voice' ? 'Voice' : type === 'rules' ? 'Rules' : 'Text'

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4"
      onClick={(e) => e.target === e.currentTarget && !loading && requestClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-channel-title"
    >
      <div
        ref={panelRef}
        className="bg-app-dark rounded-xl w-full max-w-[460px] shadow-2xl overflow-hidden will-change-transform border border-app-hover/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-0 flex items-center justify-between">
          <div>
            <h2 id="create-channel-title" className="text-xl font-bold text-app-text font-display">
              {lockType ? `Create ${typeLabel} Channel` : 'Create Channel'}
            </h2>
            {categoryName && (
              <p className="text-app-muted text-xs mt-0.5">in {categoryName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center text-app-muted hover:text-app-text transition-colors"
            aria-label="Close create channel dialog"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
          </button>
        </div>

        {!lockType && (
          <div className="p-4">
            <label className="block text-xs font-bold text-app-muted uppercase tracking-wider mb-2">
              Channel Type
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                  type === 'text' ? 'bg-app-hover/80' : 'bg-app-channel hover:bg-app-hover/50'
                }`}
              >
                <input
                  type="radio"
                  name="channelType"
                  checked={type === 'text'}
                  onChange={() => setType('text')}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-app-darker/50 flex items-center justify-center flex-shrink-0 text-app-muted">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M8 10.5h8M8 14h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                    <path d="M12 3.5c-4.7 0-8.5 3.13-8.5 7 0 2.12 1.12 4.02 2.9 5.3L5.5 20l3.4-1.7c.97.28 2 .43 3.1.43 4.7 0 8.5-3.13 8.5-7s-3.8-7-8.5-7z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-app-text font-medium text-sm">Text</div>
                  <div className="text-app-muted text-xs">Messages, images, and replies</div>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                  type === 'voice' ? 'bg-app-hover/80' : 'bg-app-channel hover:bg-app-hover/50'
                }`}
              >
                <input
                  type="radio"
                  name="channelType"
                  checked={type === 'voice'}
                  onChange={() => setType('voice')}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-app-darker/50 flex items-center justify-center flex-shrink-0 text-app-muted">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3.5" y="8" width="2.5" height="8" rx="1.25" />
                    <rect x="8.25" y="5" width="2.5" height="14" rx="1.25" />
                    <rect x="13" y="7" width="2.5" height="10" rx="1.25" />
                    <rect x="17.75" y="4" width="2.5" height="16" rx="1.25" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-app-text font-medium text-sm">Voice</div>
                  <div className="text-app-muted text-xs">Voice, video, and screen share</div>
                </div>
              </label>

              {canCreateRules && (
                <label
                  className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                    type === 'rules' ? 'bg-app-hover/80' : 'bg-app-channel hover:bg-app-hover/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="channelType"
                    checked={type === 'rules'}
                    onChange={() => setType('rules')}
                    className="hidden"
                  />
                  <div className="flex-1">
                    <div className="text-app-text font-medium text-sm">Rules</div>
                    <div className="text-app-muted text-xs">Read-only server rules</div>
                  </div>
                </label>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={`px-4 pb-4 ${lockType ? 'pt-4' : ''}`}>
          <label className="block text-xs font-bold text-app-muted uppercase tracking-wider mb-2">
            Channel Name
          </label>
          {lockType && (
            <p className="text-xs text-app-muted mb-2">
              Creating a {typeLabel.toLowerCase()} channel
              {categoryName ? ` in ${categoryName}` : ''}.
            </p>
          )}
          {error && (
            <div className="mb-3 p-2 rounded bg-red-900/50 text-red-200 text-sm">{error}</div>
          )}
          <div className="flex items-center bg-app-darker rounded-[3px] px-3 border border-app-hover/30">
            <span className="text-app-muted text-lg mr-1.5 flex items-center">
              {type === 'text' ? (
                '#'
              ) : type === 'rules' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3.5" y="8" width="2.5" height="8" rx="1.25" />
                  <rect x="8.25" y="5" width="2.5" height="14" rx="1.25" />
                  <rect x="13" y="7" width="2.5" height="10" rx="1.25" />
                  <rect x="17.75" y="4" width="2.5" height="16" rx="1.25" />
                </svg>
              )}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="new-channel"
              className="flex-1 py-2.5 bg-transparent border-none text-app-text text-base outline-none placeholder:text-app-muted/50"
              autoFocus
            />
          </div>

          <div className="flex justify-end items-center gap-3 mt-4">
            <button
              type="button"
              onClick={requestClose}
              disabled={loading}
              className="px-4 py-2 text-app-text hover:underline text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-6 py-2.5 bg-app-accent hover:bg-app-accent-hover text-white rounded-[3px] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
