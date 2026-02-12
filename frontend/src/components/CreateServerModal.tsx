import { useState } from 'react'

interface CreateServerModalProps {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export function CreateServerModal({ onClose, onCreate }: CreateServerModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      await onCreate(name.trim())
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-server-title"
    >
      <div
        className="relative w-full max-w-[480px] mx-4 rounded-2xl bg-[#313338] shadow-2xl shadow-black/50 ring-1 ring-white/5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-app-accent via-app-accent/80 to-app-online" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-app-accent/30 to-app-accent/10 flex items-center justify-center border border-app-accent/20">
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
                className="w-full px-4 py-3 bg-[#1e1f22] rounded-lg text-app-text text-base placeholder:text-app-muted/50 outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-[#313338] transition-shadow"
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
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-app-muted hover:text-app-text transition-colors"
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
