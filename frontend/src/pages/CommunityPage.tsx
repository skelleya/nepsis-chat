import { useState, useEffect } from 'react'
import * as api from '../services/api'
import { useApp } from '../contexts/AppContext'

interface ServerItem {
  id: string
  name: string
  icon_url?: string
  owner_id: string
}

interface CommunityPageProps {
  onJoinServer?: (serverId: string) => void
  onClose?: () => void
}

export function CommunityPage({ onJoinServer, onClose }: CommunityPageProps) {
  const { user, servers, loadServers, setCurrentServer } = useApp()
  const [communityServers, setCommunityServers] = useState<ServerItem[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    api.getCommunityServers().then(setCommunityServers).catch(() => setCommunityServers([]))
  }, [])

  const memberServerIds = new Set(servers.map((s) => s.id))

  const handleJoinViaCode = async () => {
    const code = inviteCode.trim().replace(/^.*\/invite\//, '').trim()
    if (!code || !user) return
    setJoinError(null)
    setJoining(true)
    try {
      const { serverId } = await api.joinViaInvite(code, user.id)
      await loadServers()
      setCurrentServer(serverId)
      setInviteCode('')
      onJoinServer?.(serverId)
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Invalid or expired invite')
    } finally {
      setJoining(false)
    }
  }

  const handleJoinCommunity = async (serverId: string) => {
    if (!user) return
    setJoining(true)
    try {
      await api.joinServer(serverId, user.id)
      await loadServers()
      setCurrentServer(serverId)
      onJoinServer?.(serverId)
    } catch {
      setJoinError('Failed to join server')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6">
      {onClose && (
        <button
          onClick={onClose}
          className="self-start mb-4 px-3 py-1.5 rounded text-sm text-app-muted hover:text-app-text hover:bg-app-hover/50"
        >
          ← Back
        </button>
      )}

      <h2 className="text-xl font-bold text-white mb-2">Explore</h2>
      <p className="text-sm text-app-muted mb-6">
        Join a server with an invite link, or explore community servers.
      </p>

      {/* Invite code entry */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-app-text mb-2">Have an invite?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinViaCode()}
            placeholder="Paste invite link or code (e.g. ABC123)"
            className="flex-1 px-4 py-2.5 bg-[#2b2d31] rounded-lg text-app-text placeholder-app-muted border border-transparent focus:border-app-accent/50 focus:ring-1 focus:ring-app-accent/30 outline-none"
          />
          <button
            onClick={handleJoinViaCode}
            disabled={joining || !inviteCode.trim()}
            className="px-5 py-2.5 bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {joining ? 'Joining...' : 'Join'}
          </button>
        </div>
        {joinError && <p className="mt-2 text-sm text-red-400">{joinError}</p>}
      </div>

      {/* Community servers */}
      <div>
        <h3 className="text-sm font-semibold text-app-text mb-3">Community Servers</h3>
        {communityServers.length === 0 ? (
          <p className="text-sm text-app-muted">No community servers yet.</p>
        ) : (
          <div className="space-y-2">
            {communityServers.map((s) => {
              const isMember = memberServerIds.has(s.id)
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#2b2d31] hover:bg-[#36373d]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-app-channel flex items-center justify-center text-white font-bold text-sm">
                      {s.icon_url ? (
                        <img src={s.icon_url} alt="" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="font-medium text-app-text">{s.name}</span>
                  </div>
                  {isMember ? (
                    <button
                      onClick={() => setCurrentServer(s.id)}
                      className="px-3 py-1.5 text-sm text-app-accent hover:bg-app-accent/20 rounded-lg"
                    >
                      Open
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJoinCommunity(s.id)}
                      disabled={joining}
                      className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium disabled:opacity-50"
                    >
                      Join
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
