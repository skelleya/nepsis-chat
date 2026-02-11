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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#313338] rounded-xl w-[440px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-2 text-center">
          <h2 className="text-2xl font-bold text-white">Create a Server</h2>
          <p className="text-app-muted text-sm mt-2">
            Your server is where you and your friends hang out. Make yours and start talking. Requires an email account.
          </p>
        </div>

        {error && (
          <div className="mx-6 mb-2 p-3 rounded bg-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            {/* Server icon placeholder */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-app-muted flex items-center justify-center cursor-pointer hover:border-app-text transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-app-muted">
                  <path d="M12 4C11.4477 4 11 4.44772 11 5V8H5C4.44772 8 4 8.44772 4 9C4 9.55228 4.44772 10 5 10H11V16C11 16.5523 11.4477 17 12 17C12.5523 17 13 16.5523 13 16V10H19C19.5523 10 20 9.55228 20 9C20 8.44772 19.5523 8 19 8H13V5C13 4.44772 12.5523 4 12 4Z" fill="currentColor"/>
                  <path d="M4 14C4 13.4477 4.44772 13 5 13H7C7.55228 13 8 13.4477 8 14V19C8 19.5523 7.55228 20 7 20H5C4.44772 20 4 19.5523 4 19V14Z" fill="currentColor"/>
                </svg>
              </div>
            </div>

            <label className="block text-xs font-bold text-app-muted uppercase tracking-wider mb-2">
              Server Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Server"
              className="w-full px-3 py-2.5 bg-[#1e1f22] border-none rounded-[3px] text-app-text text-base outline-none focus:ring-2 focus:ring-app-accent placeholder:text-app-muted/50"
              autoFocus
            />
          </div>

          <p className="text-xs text-app-muted mb-4">
            By creating a server, you agree to Nepsis Chat's Community Guidelines.
          </p>

          {/* Buttons */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-app-text hover:underline text-sm"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-6 py-2.5 bg-app-accent hover:bg-app-accent-hover text-white rounded-[3px] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
