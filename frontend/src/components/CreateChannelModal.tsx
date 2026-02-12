import { useState } from 'react'

interface CreateChannelModalProps {
  onClose: () => void
  onCreate: (name: string, type: 'text' | 'voice' | 'rules') => Promise<void>
  defaultType?: 'text' | 'voice' | 'rules'
  categoryName?: string
  /** When true, shows the Rules channel option (owner/admin only) */
  canCreateRules?: boolean
}

export function CreateChannelModal({ onClose, onCreate, defaultType = 'text', categoryName, canCreateRules = false }: CreateChannelModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'text' | 'voice' | 'rules'>(defaultType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      await onCreate(name.trim().toLowerCase().replace(/\s+/g, '-'), type)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#313338] rounded-xl w-[460px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 pb-0 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Create Channel</h2>
            {categoryName && (
              <p className="text-app-muted text-xs mt-0.5">in {categoryName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-app-muted hover:text-app-text transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
          </button>
        </div>

        {/* Channel Type Selection */}
        <div className="p-4">
          <label className="block text-xs font-bold text-app-muted uppercase tracking-wider mb-2">
            Channel Type
          </label>
          <div className="space-y-2">
            {/* Text Channel Option */}
            <label
              className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                type === 'text' ? 'bg-app-hover/80' : 'bg-[#2b2d31] hover:bg-app-hover/50'
              }`}
            >
              <input
                type="radio"
                name="channelType"
                checked={type === 'text'}
                onChange={() => setType('text')}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-app-dark/50 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-app-muted">
                  <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41001 9L8.35001 15H14.35L15.41 9H9.41001Z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-app-text font-medium text-sm">Text</div>
                <div className="text-app-muted text-xs">Send messages, images, GIFs, emoji, opinions, and puns</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                type === 'text' ? 'border-white' : 'border-app-muted'
              }`}>
                {type === 'text' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
              </div>
            </label>

            {/* Voice Channel Option */}
            <label
              className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                type === 'voice' ? 'bg-app-hover/80' : 'bg-[#2b2d31] hover:bg-app-hover/50'
              }`}
            >
              <input
                type="radio"
                name="channelType"
                checked={type === 'voice'}
                onChange={() => setType('voice')}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-app-dark/50 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-app-muted">
                  <path d="M12 3C10.34 3 9 4.37 9 6.07V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V6.07C15 4.37 13.66 3 12 3ZM5.5 11C5.5 14.59 8.36 17.5 12 17.5C15.64 17.5 18.5 14.59 18.5 11H20C20 15.08 16.93 18.44 13 18.93V22H11V18.93C7.07 18.44 4 15.08 4 11H5.5Z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-app-text font-medium text-sm">Voice</div>
                <div className="text-app-muted text-xs">Hang out together with voice, video, and screen share</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                type === 'voice' ? 'border-white' : 'border-app-muted'
              }`}>
                {type === 'voice' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
              </div>
            </label>

            {/* Rules Channel Option (owner/admin only) */}
            {canCreateRules && (
              <label
                className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                  type === 'rules' ? 'bg-app-hover/80' : 'bg-[#2b2d31] hover:bg-app-hover/50'
                }`}
              >
                <input
                  type="radio"
                  name="channelType"
                  checked={type === 'rules'}
                  onChange={() => setType('rules')}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-app-dark/50 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-app-muted">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                    <path d="M9 15h6v2H9zm0-4h6v2H9zm0-4h3v2H9z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-app-text font-medium text-sm">Rules</div>
                  <div className="text-app-muted text-xs">Server rules — read-only; members react to accept</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  type === 'rules' ? 'border-white' : 'border-app-muted'
                }`}>
                  {type === 'rules' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Channel Name */}
        <form onSubmit={handleSubmit} className="px-4 pb-4">
          <label className="block text-xs font-bold text-app-muted uppercase tracking-wider mb-2">
            Channel Name
          </label>
          {error && (
            <div className="mb-3 p-2 rounded bg-red-900/50 text-red-200 text-sm">{error}</div>
          )}
          <div className="flex items-center bg-[#1e1f22] rounded-[3px] px-3">
            <span className="text-app-muted text-lg mr-1.5">
              {type === 'text' ? '#' : type === 'rules' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="inline">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="inline">
                  <path d="M12 3C10.34 3 9 4.37 9 6.07V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V6.07C15 4.37 13.66 3 12 3ZM5.5 11C5.5 14.59 8.36 17.5 12 17.5C15.64 17.5 18.5 14.59 18.5 11H20C20 15.08 16.93 18.44 13 18.93V22H11V18.93C7.07 18.44 4 15.08 4 11H5.5Z"/>
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

          {/* Buttons */}
          <div className="flex justify-end items-center gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
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
}
