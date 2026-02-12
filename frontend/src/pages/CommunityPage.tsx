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
    setJoinError(null)
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
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1 p-6 md:p-8 max-w-2xl">
        {onClose && (
          <button
            onClick={onClose}
            className="self-start mb-6 px-3 py-2 rounded-lg text-sm text-app-muted hover:text-app-text hover:bg-app-hover/50 transition-colors flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center border border-app-accent/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-app-accent">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Explore</h2>
          </div>
          <p className="text-app-muted text-sm leading-relaxed">
            Join a server with an invite link, or browse community servers to get started.
          </p>
        </div>

        {/* Invite code entry */}
        <section className="mb-10">
          <h3 className="text-sm font-semibold text-app-text mb-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-app-muted">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Have an invite?
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinViaCode()}
              placeholder="Paste invite link or code (e.g. ABC123)"
              className="flex-1 px-4 py-3 bg-[#2b2d31] rounded-xl text-app-text placeholder-app-muted border border-transparent focus:border-app-accent/50 focus:ring-2 focus:ring-app-accent/20 outline-none transition-all"
            />
            <button
              onClick={handleJoinViaCode}
              disabled={joining || !inviteCode.trim()}
              className="px-5 py-3 bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
            >
              {joining ? 'Joining...' : 'Join'}
            </button>
          </div>
          {joinError && <p className="mt-2 text-sm text-red-400">{joinError}</p>}
        </section>

        {/* Community servers */}
        <section>
          <h3 className="text-sm font-semibold text-app-text mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-app-muted">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Community Servers
          </h3>
          {communityServers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-app-hover/50 bg-app-channel/30 px-6 py-10 text-center">
              <p className="text-app-muted text-sm mb-1">No community servers yet</p>
              <p className="text-app-muted/80 text-xs">Servers marked as community will appear here for anyone to join.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {communityServers.map((s) => {
                const isMember = memberServerIds.has(s.id)
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#2b2d31] hover:bg-[#36373d] border border-transparent hover:border-app-hover/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-app-channel flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                        {s.icon_url ? (
                          <img src={s.icon_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="font-medium text-app-text">{s.name}</span>
                    </div>
                    {isMember ? (
                      <button
                        onClick={() => setCurrentServer(s.id)}
                        className="px-4 py-2 text-sm text-app-accent hover:bg-app-accent/20 rounded-lg font-medium transition-colors"
                      >
                        Open
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinCommunity(s.id)}
                        disabled={joining}
                        className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Join
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
