import { useState, useEffect } from 'react'
import * as api from '../services/api'

interface ServerEmoji {
  id: string
  name: string
  image_url: string
}

interface ServerSettingsModalProps {
  serverName: string
  serverId: string
  userId?: string
  canManageEmojis?: boolean
  onClose: () => void
  onUpdateServer: (data: { name?: string }) => Promise<void>
  onDeleteServer: () => Promise<void>
}

export function ServerSettingsModal({ serverName, serverId, userId, canManageEmojis, onClose, onUpdateServer, onDeleteServer }: ServerSettingsModalProps) {
  const [name, setName] = useState(serverName)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [emojis, setEmojis] = useState<ServerEmoji[]>([])
  const [emojiName, setEmojiName] = useState('')
  const [emojiFile, setEmojiFile] = useState<File | null>(null)
  const [emojiError, setEmojiError] = useState('')
  const [emojiLoading, setEmojiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'emojis'>('overview')

  useEffect(() => {
    api.getServerEmojis(serverId).then(setEmojis).catch(() => setEmojis([]))
  }, [serverId])

  const handleUploadEmoji = async () => {
    if (!userId || !emojiName.trim() || !emojiFile) {
      setEmojiError('Name and image required')
      return
    }
    setEmojiError('')
    setEmojiLoading(true)
    try {
      const created = await api.uploadServerEmoji(serverId, userId, emojiName.trim(), emojiFile)
      setEmojis((prev) => [...prev, created])
      setEmojiName('')
      setEmojiFile(null)
    } catch (err) {
      setEmojiError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setEmojiLoading(false)
    }
  }

  const handleSave = async () => {
    if (name.trim() && name !== serverName) {
      await onUpdateServer({ name: name.trim() })
    }
  }

  const handleDelete = async () => {
    await onDeleteServer()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-[#313338] z-50 flex">
      {/* Left sidebar */}
      <div className="w-[218px] bg-[#2b2d31] flex flex-col items-end pt-[60px] pr-2 pl-5 flex-shrink-0">
        <div className="w-[190px]">
          <div className="px-2.5 py-1.5 text-xs font-bold text-app-muted uppercase tracking-wider truncate">
            {serverName}
          </div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full px-2.5 py-1.5 rounded text-sm text-left mb-0.5 ${activeTab === 'overview' ? 'text-white bg-app-hover/60' : 'text-app-muted hover:text-app-text hover:bg-app-hover/40'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('emojis')}
            className={`w-full px-2.5 py-1.5 rounded text-sm text-left mb-0.5 ${activeTab === 'emojis' ? 'text-white bg-app-hover/60' : 'text-app-muted hover:text-app-text hover:bg-app-hover/40'}`}
          >
            Custom Emojis
          </button>
          <button className="w-full px-2.5 py-1.5 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/40 text-left mb-0.5">
            Members
          </button>
          <button className="w-full px-2.5 py-1.5 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/40 text-left mb-0.5">
            Invites
          </button>
          <div className="h-px bg-app-hover/50 my-2" />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-2.5 py-1.5 rounded text-sm text-red-400 hover:text-red-300 hover:bg-app-hover/40 text-left"
          >
            Delete Server
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-[740px] pt-[60px] px-10">
        <h2 className="text-xl font-bold text-white mb-5">
          {activeTab === 'overview' ? 'Server Overview' : 'Custom Emojis'}
        </h2>

        {activeTab === 'emojis' && (
          <div className="space-y-6">
            <p className="text-sm text-app-muted">
              Upload custom emojis for this server. Only server owners and admins can add emojis. Requires an email account.
            </p>
            {canManageEmojis && userId && (
              <div className="p-4 rounded-lg bg-[#2b2d31] space-y-3">
                <div>
                  <label className="block text-xs font-bold text-app-muted uppercase mb-1">Emoji name</label>
                  <input
                    type="text"
                    value={emojiName}
                    onChange={(e) => setEmojiName(e.target.value)}
                    placeholder="my_emoji"
                    className="w-full px-3 py-2 bg-[#1e1f22] rounded text-app-text"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-muted uppercase mb-1">Image (PNG, GIF, max 256KB)</label>
                  <input
                    type="file"
                    accept="image/png,image/gif,image/jpeg,image/webp"
                    onChange={(e) => setEmojiFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-app-muted"
                  />
                </div>
                {emojiError && <p className="text-sm text-red-400">{emojiError}</p>}
                <button
                  onClick={handleUploadEmoji}
                  disabled={emojiLoading || !emojiName.trim() || !emojiFile}
                  className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover text-white rounded text-sm disabled:opacity-50"
                >
                  {emojiLoading ? 'Uploading...' : 'Upload Emoji'}
                </button>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-app-text mb-2">Server emojis</h3>
              <div className="flex flex-wrap gap-3">
                {emojis.length === 0 ? (
                  <p className="text-sm text-app-muted">No custom emojis yet.</p>
                ) : (
                  emojis.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 p-2 rounded bg-[#2b2d31]">
                      <img src={e.image_url} alt={e.name} className="w-8 h-8 object-contain" />
                      <span className="text-sm text-app-text">:{e.name}:</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
        <div className="flex gap-6">
          {/* Server icon */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-app-channel flex items-center justify-center text-white text-3xl font-bold cursor-pointer hover:opacity-80 transition-opacity">
              {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <p className="text-xs text-app-muted text-center mt-2">
              Min 128x128
            </p>
          </div>

          {/* Server details */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-bold text-app-muted uppercase tracking-wider mb-2">
                Server Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#1e1f22] rounded-[3px] text-app-text text-base outline-none focus:ring-2 focus:ring-app-accent border-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-muted uppercase tracking-wider mb-2">
                Server ID
              </label>
              <div className="text-sm text-app-muted font-mono">{serverId}</div>
            </div>
          </div>
        </div>
        )}

        {/* Save bar */}
        {name !== serverName && name.trim() && (
          <div className="fixed bottom-0 left-[218px] right-0 bg-[#111214] p-3 flex items-center justify-end gap-3 shadow-lg">
            <span className="text-sm text-app-muted mr-auto">Careful — you have unsaved changes!</span>
            <button
              onClick={() => setName(serverName)}
              className="px-4 py-2 text-sm text-app-text hover:underline"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-[#23a559] hover:bg-[#1e8c4a] text-white rounded-[3px] text-sm font-medium transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-[#313338] rounded-xl w-[440px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-4">
                <h3 className="text-xl font-bold text-white">Delete '{serverName}'</h3>
                <p className="text-sm text-app-muted mt-2">
                  Are you sure you want to delete <strong className="text-app-text">{serverName}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="bg-[#2b2d31] p-4 flex justify-end gap-3 rounded-b-xl">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-app-text hover:underline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-[3px] text-sm font-medium transition-colors"
                >
                  Delete Server
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Close button */}
      <div className="pt-[60px] pr-5 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full border-2 border-app-muted/60 flex items-center justify-center text-app-muted hover:text-white hover:border-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
          </svg>
        </button>
        <div className="text-xs text-app-muted text-center mt-1">ESC</div>
      </div>
    </div>
  )
}
