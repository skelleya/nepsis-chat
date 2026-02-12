import { useState, useEffect, useRef } from 'react'
import * as api from '../services/api'

type TabId = 'account' | 'profiles' | 'privacy' | 'appearance' | 'voice' | 'notifications' | 'help'

function HelpTab({ user }: { user: { id: string; username: string } }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimTitle = title.trim()
    const trimDesc = description.trim()
    if (!trimTitle || !trimDesc) {
      setMessage({ type: 'error', text: 'Please fill in both title and description.' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      await api.submitBugReport({
        userId: user.id,
        username: user.username,
        title: trimTitle,
        description: trimDesc,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      })
      setMessage({ type: 'success', text: 'Thank you! Your bug report has been sent to the developers.' })
      setTitle('')
      setDescription('')
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to submit report' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-4">Help & Support</h3>
      <div className="bg-[#2b2d31] rounded-lg p-4 space-y-4">
        <h4 className="font-semibold text-white">Report a Bug</h4>
        <p className="text-app-muted text-sm">
          Found a bug? Let us know! Your report will be sent to the development team. Include as much detail as you can.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-app-muted uppercase mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              maxLength={256}
              className="w-full px-3 py-2 bg-[#1e1f22] rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none placeholder:text-app-muted"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-app-muted uppercase mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Steps to reproduce, what you expected, what happened..."
              rows={4}
              maxLength={8000}
              className="w-full px-3 py-2 bg-[#1e1f22] rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none placeholder:text-app-muted resize-none"
            />
          </div>
          <p className="text-app-muted text-xs">
            Your username and current page URL will be included to help us investigate.
          </p>
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover rounded text-sm text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Send Report'}
          </button>
        </form>
      </div>
    </div>
  )
}

interface UserSettingsModalProps {
  user: { id: string; username: string; avatar_url?: string; banner_url?: string; is_guest?: boolean }
  onClose: () => void
  onLogout: () => void
  onUserUpdate?: (data: { username?: string; avatar_url?: string; banner_url?: string }) => void
}

export function UserSettingsModal({ user, onClose, onLogout, onUserUpdate }: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('account')
  const [username, setUsername] = useState(user.username)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '')
  const [bannerUrl, setBannerUrl] = useState(user.banner_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeProfile, setActiveProfile] = useState<'personal' | 'work'>('personal')
  const [, setProfiles] = useState<{ id: string; profile_type: string; display_name: string; avatar_url?: string; banner_url?: string }[]>([])
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const isGuest = user.is_guest ?? true

  useEffect(() => {
    setUsername(user.username)
    setAvatarUrl(user.avatar_url || '')
    setBannerUrl(user.banner_url || '')
  }, [user])

  useEffect(() => {
    if (!isGuest) {
      api.getUserProfiles(user.id).then(setProfiles).catch(() => setProfiles([]))
    }
  }, [user.id, isGuest])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    setError('')
    try {
      const { url } = await api.uploadFile(file)
      await api.updateUserProfile(user.id, { avatar_url: url })
      setAvatarUrl(url)
      onUserUpdate?.({ avatar_url: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
      e.target.value = ''
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    setError('')
    try {
      const { url } = await api.uploadFile(file)
      await api.updateUserProfile(user.id, { banner_url: url })
      setBannerUrl(url)
      onUserUpdate?.({ banner_url: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
      e.target.value = ''
    }
  }

  const handleSaveUsername = async () => {
    const trimmed = username.trim()
    if (!trimmed || trimmed === user.username) return
    setSaving(true)
    setError('')
    try {
      await api.updateUserProfile(user.id, { username: trimmed })
      onUserUpdate?.({ username: trimmed })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update username')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'account', label: 'My Account' },
    { id: 'profiles', label: 'Profiles' },
    { id: 'privacy', label: 'Privacy & Safety' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'voice', label: 'Voice & Video' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'help', label: 'Help & Support' },
  ]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#313338] rounded-lg shadow-2xl w-full max-w-[740px] max-h-[90vh] flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[218px] bg-[#2b2d31] flex-shrink-0 flex flex-col">
          <div className="p-4 border-b border-app-hover/40">
            <h2 className="text-lg font-bold text-white">User Settings</h2>
          </div>
          <div className="p-2 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${
                  activeTab === tab.id ? 'bg-app-accent/30 text-white' : 'text-app-muted hover:text-app-text hover:bg-app-hover/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="h-px bg-app-hover/50 my-2" />
            <button
              onClick={onLogout}
              className="w-full px-3 py-2 rounded text-sm text-red-400 hover:text-red-300 hover:bg-app-hover/40 text-left flex items-center gap-2"
            >
              Log Out
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-auto">
                <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.58L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'account' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">My Account</h3>
              <div className="bg-[#111214] rounded-lg overflow-hidden">
                <div className="relative h-24">
                  {bannerUrl ? (
                    <img key={bannerUrl} src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-app-accent" />
                  )}
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerUpload}
                  />
                  <button
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={saving}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-sm font-medium"
                  >
                    Change Banner
                  </button>
                </div>
                <div className="px-4 pb-4">
                  <div className="flex items-end gap-4 -mt-10">
                    <div className="relative">
                      {avatarUrl ? (
                        <img key={avatarUrl} src={avatarUrl} alt={user.username} className="w-20 h-20 rounded-full object-cover border-4 border-[#111214]" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-2xl border-4 border-[#111214]">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={saving}
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-xs"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-app-muted uppercase">Username</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-[#2b2d31] rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleSaveUsername}
                        disabled={saving || username.trim() === user.username}
                        className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover rounded text-sm text-white font-medium disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-app-muted uppercase">User ID</div>
                      <div className="text-sm text-app-muted font-mono mt-0.5">{user.id}</div>
                    </div>
                  </div>
                  {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profiles' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Profiles</h3>
              {isGuest ? (
                <p className="text-app-muted">Create an account to use Personal and Work profiles.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveProfile('personal')}
                      className={`px-4 py-2 rounded text-sm font-medium ${
                        activeProfile === 'personal' ? 'bg-app-accent text-white' : 'bg-app-hover/40 text-app-muted hover:text-app-text'
                      }`}
                    >
                      Personal
                    </button>
                    <button
                      onClick={() => setActiveProfile('work')}
                      className={`px-4 py-2 rounded text-sm font-medium ${
                        activeProfile === 'work' ? 'bg-app-accent text-white' : 'bg-app-hover/40 text-app-muted hover:text-app-text'
                      }`}
                    >
                      Work
                    </button>
                  </div>
                  <p className="text-app-muted text-sm">
                    Switch between Personal and Work profiles. Each profile can have its own display name, avatar, and banner.
                  </p>
                  <p className="text-app-muted text-xs">Profile customization coming soon.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Privacy & Safety</h3>
              <div className="space-y-4">
                <div className="bg-[#2b2d31] rounded-lg p-4">
                  <h4 className="font-semibold text-white mb-2">Data & Privacy</h4>
                  <p className="text-app-muted text-sm">Manage how your data is used and stored.</p>
                </div>
                <div className="bg-[#2b2d31] rounded-lg p-4">
                  <h4 className="font-semibold text-white mb-2">Safety</h4>
                  <p className="text-app-muted text-sm">Control who can message you and filter content.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Appearance</h3>
              <div className="bg-[#2b2d31] rounded-lg p-4">
                <p className="text-app-muted text-sm">Theme and display preferences.</p>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Voice & Video</h3>
              <div className="bg-[#2b2d31] rounded-lg p-4">
                <p className="text-app-muted text-sm">Microphone, speaker, and camera settings.</p>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Notifications</h3>
              <div className="bg-[#2b2d31] rounded-lg p-4">
                <p className="text-app-muted text-sm">Manage notification preferences.</p>
              </div>
            </div>
          )}

          {activeTab === 'help' && (
            <HelpTab user={user} />
          )}
        </div>

        {/* Close button */}
        <div className="p-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border-2 border-app-muted/60 flex items-center justify-center text-app-muted hover:text-white hover:border-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
