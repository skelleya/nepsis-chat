import { useState, useEffect, useRef } from 'react'
import * as api from '../services/api'

interface ServerEmoji {
  id: string
  name: string
  image_url: string
}

interface ServerMember {
  userId: string
  username: string
  role: string
  avatarUrl?: string
  status?: string
}

interface ServerInvite {
  code: string
  created_by: string
  expires_at?: string
  max_uses?: number
  use_count: number
  created_at: string
}

interface AuditEntry {
  id: string
  userId: string
  username: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}

interface ServerSettingsModalProps {
  serverName: string
  serverId: string
  serverIconUrl?: string
  serverBannerUrl?: string
  userId?: string
  canManageEmojis?: boolean
  canManageMembers?: boolean
  canManageRules?: boolean
  rulesChannelId?: string | null
  lockChannelsUntilRulesAccepted?: boolean
  rulesAcceptEmoji?: string
  onClose: () => void
  onUpdateServer: (data: { name?: string; icon_url?: string; banner_url?: string; rules_channel_id?: string | null; lock_channels_until_rules_accepted?: boolean; rules_accept_emoji?: string; updatedBy?: string }) => Promise<void>
  onDeleteServer: () => Promise<void>
  onKickMember?: (targetUserId: string) => Promise<void>
  onMembersChange?: () => void
}

export function ServerSettingsModal({
  serverName,
  serverId,
  serverIconUrl,
  serverBannerUrl,
  userId,
  canManageEmojis,
  canManageMembers,
  canManageRules = false,
  rulesChannelId,
  lockChannelsUntilRulesAccepted = false,
  rulesAcceptEmoji = '👍',
  onClose,
  onUpdateServer,
  onDeleteServer,
  onKickMember,
  onMembersChange,
}: ServerSettingsModalProps) {
  const [name, setName] = useState(serverName)
  const [iconUrl, setIconUrl] = useState(serverIconUrl || '')
  const [bannerUrl, setBannerUrl] = useState(serverBannerUrl || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const iconInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const [emojis, setEmojis] = useState<ServerEmoji[]>([])
  const [emojiName, setEmojiName] = useState('')
  const [emojiFile, setEmojiFile] = useState<File | null>(null)
  const [emojiError, setEmojiError] = useState('')
  const [emojiLoading, setEmojiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'emojis' | 'members' | 'invites' | 'rules' | 'audit'>('overview')
  const [rulesChannelIdState, setRulesChannelIdState] = useState(rulesChannelId || '')
  const [lockUntilAccepted, setLockUntilAccepted] = useState(lockChannelsUntilRulesAccepted)
  const [acceptEmoji, setAcceptEmoji] = useState(rulesAcceptEmoji)
  const [rulesChannels, setRulesChannels] = useState<{ id: string; name: string; type: string }[]>([])
  const [members, setMembers] = useState<ServerMember[]>([])
  const [invites, setInvites] = useState<ServerInvite[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [inviteCreating, setInviteCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [bannerError, setBannerError] = useState('')
  const [bannerLoading, setBannerLoading] = useState(false)

  useEffect(() => {
    api.getServerEmojis(serverId).then(setEmojis).catch(() => setEmojis([]))
  }, [serverId])

  useEffect(() => {
    setIconUrl(serverIconUrl || '')
    setBannerUrl(serverBannerUrl || '')
  }, [serverIconUrl, serverBannerUrl])

  useEffect(() => {
    setRulesChannelIdState(rulesChannelId || '')
    setLockUntilAccepted(lockChannelsUntilRulesAccepted)
    setAcceptEmoji(rulesAcceptEmoji)
  }, [rulesChannelId, lockChannelsUntilRulesAccepted, rulesAcceptEmoji])

  useEffect(() => {
    if (activeTab === 'rules') {
      api.getChannels(serverId).then((ch) => {
        setRulesChannels((ch || []).filter((c: { type: string }) => c.type === 'rules'))
      }).catch(() => setRulesChannels([]))
    }
  }, [serverId, activeTab])

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !/^image\/(png|gif|jpeg|webp)$/.test(file.type)) return
    try {
      const { url } = await api.uploadFile(file)
      await onUpdateServer({ icon_url: url })
      setIconUrl(url)
    } catch (err) {
      console.error('Icon upload failed:', err)
    }
    e.target.value = ''
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = /^image\/(png|gif|jpeg|webp)$/.test(file.type)
    if (!allowed) {
      setBannerError('Use PNG, GIF, JPEG, or WebP images only')
      return
    }
    setBannerError('')
    setBannerLoading(true)
    try {
      const { url } = await api.uploadFile(file)
      await onUpdateServer({ banner_url: url })
      setBannerUrl(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Banner upload failed'
      setBannerError(msg)
      console.error('Banner upload failed:', err)
    } finally {
      setBannerLoading(false)
    }
    e.target.value = ''
  }

  useEffect(() => {
    if (activeTab === 'members') {
      api.getServerMembers(serverId).then(setMembers).catch(() => setMembers([]))
    }
  }, [serverId, activeTab])

  useEffect(() => {
    if (activeTab === 'invites') {
      api.getServerInvites(serverId).then(setInvites).catch(() => setInvites([]))
    }
  }, [serverId, activeTab])

  useEffect(() => {
    if (activeTab === 'audit') {
      api.getServerAuditLog(serverId).then(setAuditLog).catch(() => setAuditLog([]))
    }
  }, [serverId, activeTab])

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

  const handleCreateInvite = async () => {
    if (!userId) return
    setInviteCreating(true)
    try {
      const inv = await api.createInvite(serverId, userId)
      const newInv = {
        code: inv.code,
        created_by: userId,
        use_count: (inv as { use_count?: number }).use_count ?? 0,
        created_at: (inv as { created_at?: string }).created_at ?? new Date().toISOString(),
      }
      setInvites((prev) => [newInv, ...prev])
    } finally {
      setInviteCreating(false)
    }
  }

  const copyInviteLink = (code: string) => {
    const base = `${window.location.origin}${window.location.pathname || '/'}#/invite/${code}`
    navigator.clipboard.writeText(base)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleRevokeInvite = async (code: string) => {
    if (!userId) return
    try {
      await api.revokeInvite(serverId, code, userId)
      setInvites((prev) => prev.filter((i) => i.code !== code))
    } catch {
      /* ignore */
    }
  }

  const handleKick = async (targetUserId: string) => {
    await onKickMember?.(targetUserId)
    setMembers((prev) => prev.filter((m) => m.userId !== targetUserId))
    onMembersChange?.()
  }

  const tabLabels: Record<string, string> = {
    overview: 'Server Overview',
    emojis: 'Custom Emojis',
    members: 'Members',
    invites: 'Invites',
    rules: 'Rules Channel',
    audit: 'Audit Log',
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
          <button
            onClick={() => setActiveTab('members')}
            className={`w-full px-2.5 py-1.5 rounded text-sm text-left mb-0.5 ${activeTab === 'members' ? 'text-white bg-app-hover/60' : 'text-app-muted hover:text-app-text hover:bg-app-hover/40'}`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`w-full px-2.5 py-1.5 rounded text-sm text-left mb-0.5 ${activeTab === 'invites' ? 'text-white bg-app-hover/60' : 'text-app-muted hover:text-app-text hover:bg-app-hover/40'}`}
          >
            Invites
          </button>
          {canManageRules && (
            <button
              onClick={() => setActiveTab('rules')}
              className={`w-full px-2.5 py-1.5 rounded text-sm text-left mb-0.5 ${activeTab === 'rules' ? 'text-white bg-app-hover/60' : 'text-app-muted hover:text-app-text hover:bg-app-hover/40'}`}
            >
              Rules Channel
            </button>
          )}
          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full px-2.5 py-1.5 rounded text-sm text-left mb-0.5 ${activeTab === 'audit' ? 'text-white bg-app-hover/60' : 'text-app-muted hover:text-app-text hover:bg-app-hover/40'}`}
          >
            Audit Log
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
        <h2 className="text-xl font-bold text-white mb-5">{tabLabels[activeTab]}</h2>

        {activeTab === 'emojis' && (
          <div className="space-y-6">
            <p className="text-sm text-app-muted">
              Upload custom emojis for this server. Use <code className="px-1 py-0.5 rounded bg-[#1e1f22] text-xs">:emoji_name:</code> in chat. Owners and admins can add emojis.
            </p>
            {canManageEmojis && userId && (
              <div
                className="rounded-xl border-2 border-dashed border-app-hover/50 bg-[#2b2d31]/50 p-6 hover:border-app-accent/50 hover:bg-[#2b2d31]/80 transition-colors"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-app-accent/70') }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-app-accent/70') }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-app-accent/70')
                  const f = e.dataTransfer.files?.[0]
                  if (f && /^image\/(png|gif|jpeg|webp)$/.test(f.type)) setEmojiFile(f)
                }}
              >
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-bold text-app-muted uppercase mb-1.5">Emoji name</label>
                    <input
                      type="text"
                      value={emojiName}
                      onChange={(e) => setEmojiName(e.target.value)}
                      placeholder="my_emoji"
                      className="w-full px-3 py-2.5 bg-[#1e1f22] rounded-lg text-app-text border border-transparent focus:border-app-accent/50 focus:ring-1 focus:ring-app-accent/30 outline-none transition-all"
                    />
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-bold text-app-muted uppercase mb-1.5">Image (PNG, GIF, JPEG, WebP)</label>
                    <input
                      type="file"
                      accept="image/png,image/gif,image/jpeg,image/webp"
                      onChange={(e) => setEmojiFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-app-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-app-accent file:text-white file:cursor-pointer hover:file:bg-app-accent-hover"
                    />
                  </div>
                  <button
                    onClick={handleUploadEmoji}
                    disabled={emojiLoading || !emojiName.trim() || !emojiFile}
                    className="px-5 py-2.5 bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {emojiLoading ? 'Uploading...' : 'Upload Emoji'}
                  </button>
                </div>
                {emojiError && <p className="mt-2 text-sm text-red-400">{emojiError}</p>}
                <p className="mt-2 text-xs text-app-muted">Drag and drop an image here, or click to browse.</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-app-text mb-3">Server emojis</h3>
              {emojis.length === 0 ? (
                <div className="rounded-xl border border-dashed border-app-hover/40 bg-[#2b2d31]/30 p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-app-hover/30 flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl opacity-50">😀</span>
                  </div>
                  <p className="text-sm text-app-muted">No custom emojis yet.</p>
                  <p className="text-xs text-app-muted mt-1">Add one above to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                  {emojis.map((e) => (
                    <div
                      key={e.id}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-[#2b2d31] hover:bg-[#36373d] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#1e1f22] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src={e.image_url} alt={e.name} className="w-8 h-8 object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-app-text block truncate">:{e.name}:</span>
                        <span className="text-xs text-app-muted truncate block">{e.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <p className="text-sm text-app-muted">Manage server members. Owners and admins can kick members.</p>
            <div className="space-y-1">
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2b2d31] hover:bg-[#36373d]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-app-accent/80 flex items-center justify-center text-white text-sm font-bold">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        m.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-app-text">{m.username}</span>
                      <span className="ml-2 text-xs text-app-muted uppercase">{m.role}</span>
                    </div>
                  </div>
                  {canManageMembers && m.role !== 'owner' && m.userId !== userId && (
                    <button
                      onClick={() => handleKick(m.userId)}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                    >
                      Kick
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rules' && canManageRules && (
          <div className="space-y-6">
            <p className="text-sm text-app-muted">
              Create a rules channel (channel type: Rules) and configure it here. Members can only react with emoji — no chat. Optionally lock all channels until members accept rules by reacting with the designated emoji.
            </p>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-bold text-app-muted uppercase mb-1.5">Rules Channel</label>
                <select
                  value={rulesChannelIdState}
                  onChange={(e) => setRulesChannelIdState(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#1e1f22] rounded-lg text-app-text border border-transparent focus:border-app-accent/50 outline-none"
                >
                  <option value="">None</option>
                  {rulesChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
                <p className="text-xs text-app-muted mt-1">Create a Rules channel first if none exist.</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="lock-until-accepted"
                  checked={lockUntilAccepted}
                  onChange={(e) => setLockUntilAccepted(e.target.checked)}
                  className="rounded border-app-hover bg-[#1e1f22]"
                />
                <label htmlFor="lock-until-accepted" className="text-sm text-app-text">
                  Lock all channels until members accept rules (react with emoji below)
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold text-app-muted uppercase mb-1.5">Accept emoji</label>
                <input
                  type="text"
                  value={acceptEmoji}
                  onChange={(e) => setAcceptEmoji(e.target.value)}
                  placeholder="👍"
                  className="w-full px-3 py-2.5 bg-[#1e1f22] rounded-lg text-app-text border border-transparent focus:border-app-accent/50 outline-none"
                />
                <p className="text-xs text-app-muted mt-1">Emoji members must react with to accept rules (e.g. 👍 ✅)</p>
              </div>
              <button
                onClick={async () => {
                  if (!userId) return
                  await onUpdateServer({
                    rules_channel_id: rulesChannelIdState || null,
                    lock_channels_until_rules_accepted: lockUntilAccepted,
                    rules_accept_emoji: acceptEmoji.trim() || '👍',
                    updatedBy: userId,
                  })
                }}
                className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover text-white rounded text-sm font-medium"
              >
                Save Rules Settings
              </button>
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <div className="space-y-4">
            <p className="text-sm text-app-muted">Create invite links to share with others. Anyone with the link can join your server.</p>
            <button
              onClick={handleCreateInvite}
              disabled={inviteCreating || !userId}
              className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover text-white rounded text-sm disabled:opacity-50"
            >
              {inviteCreating ? 'Creating...' : 'Create Invite'}
            </button>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-app-text">Active invites</h3>
              {invites.length === 0 ? (
                <p className="text-sm text-app-muted">No invites yet. Create one above.</p>
              ) : (
                invites.map((inv) => (
                  <div
                    key={inv.code}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2b2d31]"
                  >
                    <code className="text-sm text-app-muted font-mono">/{inv.code}</code>
                    <span className="text-xs text-app-muted">Used {inv.use_count} times</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyInviteLink(inv.code)}
                        className="px-2 py-1 text-xs text-app-accent hover:bg-app-accent/20 rounded"
                      >
                        {copiedCode === inv.code ? 'Copied!' : 'Copy'}
                      </button>
                      {canManageMembers && (
                        <button
                          onClick={() => handleRevokeInvite(inv.code)}
                          className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 rounded"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <p className="text-sm text-app-muted">Recent server actions. Only visible to server members.</p>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {auditLog.length === 0 ? (
                <p className="text-sm text-app-muted">No audit entries yet.</p>
              ) : (
                auditLog.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#2b2d31] text-sm">
                    <span className="text-app-muted shrink-0">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                    <span className="text-app-text font-medium">{e.username}</span>
                    <span className="text-app-muted">
                      {e.action === 'invite_created' && `created invite ${(e.details as { code?: string }).code || ''}`}
                      {e.action === 'invite_revoked' && `revoked invite ${(e.details as { code?: string }).code || ''}`}
                      {e.action === 'member_kicked' && 'kicked a member'}
                      {e.action === 'member_joined' && 'joined via invite'}
                      {!['invite_created', 'invite_revoked', 'member_kicked', 'member_joined'].includes(e.action) && e.action}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Server banner */}
          <div>
            <label className="block text-xs font-bold text-app-muted uppercase tracking-wider mb-2">
              Server Banner
            </label>
            <div
              className={`h-24 rounded-xl bg-app-channel flex items-center justify-center overflow-hidden transition-opacity border-2 border-dashed border-app-hover/50 ${bannerLoading ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:opacity-90'}`}
              onClick={() => !bannerLoading && bannerInputRef.current?.click()}
            >
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <span className="text-app-muted text-sm">{bannerLoading ? 'Uploading...' : 'Click to upload banner'}</span>
              )}
            </div>
            {bannerError && <p className="mt-1.5 text-sm text-red-400">{bannerError}</p>}
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/gif,image/jpeg,image/webp"
              className="hidden"
              onChange={handleBannerUpload}
            />
          </div>

          <div className="flex gap-6">
          {/* Server icon */}
          <div className="flex-shrink-0">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${iconUrl ? 'bg-transparent' : 'bg-app-channel'}`}
              onClick={() => iconInputRef.current?.click()}
            >
              {iconUrl ? (
                <img src={iconUrl} alt="Server" className="w-full h-full object-cover" />
              ) : (
                name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              )}
            </div>
            <input
              ref={iconInputRef}
              type="file"
              accept="image/png,image/gif,image/jpeg,image/webp"
              className="hidden"
              onChange={handleIconUpload}
            />
            <p className="text-xs text-app-muted text-center mt-2">
              Click to upload icon (min 128x128)
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
