import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import * as api from '../services/api'
import type { CommunityServer, ServerPreview } from '../services/api'
import { useApp } from '../contexts/AppContext'

interface CommunityPageProps {
  onJoinServer?: (serverId: string) => void
  onClose?: () => void
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function CommunityPage({ onJoinServer, onClose }: CommunityPageProps) {
  const { user, servers, loadServers, setCurrentServer } = useApp()
  const pageRef = useRef<HTMLDivElement>(null)
  const [communityServers, setCommunityServers] = useState<CommunityServer[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<ServerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page) return
    gsap.fromTo(
      page,
      { opacity: 0, x: 28 },
      {
        opacity: 1,
        x: 0,
        duration: 0.4,
        ease: 'power3.out',
        force3D: false,
        clearProps: 'transform',
      }
    )
  }, [])

  useEffect(() => {
    api.getCommunityServers().then(setCommunityServers).catch(() => setCommunityServers([]))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    api
      .getServerPreview(selectedId)
      .then((data) => {
        if (!cancelled) setPreview(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setPreview(null)
          setPreviewError(e instanceof Error ? e.message : 'Failed to load details')
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const memberServerIds = new Set(servers.map((s) => s.id))
  const selectedListItem = communityServers.find((s) => s.id === selectedId) || null

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
    <div ref={pageRef} className="flex-1 flex flex-col overflow-y-auto min-w-0">
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
                const members = s.memberCount ?? 0
                const online = s.onlineCount ?? 0
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#2b2d31] hover:bg-[#36373d] border text-left transition-all ${
                      selectedId === s.id ? 'border-app-accent/50 ring-1 ring-app-accent/30' : 'border-transparent hover:border-app-hover/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-app-channel flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                        {s.icon_url ? (
                          <img src={s.icon_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-app-text truncate">{s.name}</div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-app-muted">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#23a559]" />
                            {formatCount(online)} Online
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-app-muted/70" />
                            {formatCount(members)} Members
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-app-muted flex-shrink-0 ml-3">
                      {isMember ? 'Member' : 'View'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Server details panel */}
      {selectedId && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSelectedId(null)}
            aria-hidden
          />
          <div
            className="fixed z-50 inset-x-4 top-[12%] bottom-auto max-h-[76vh] overflow-y-auto mx-auto max-w-md rounded-2xl bg-[#2b2d31] shadow-2xl border border-white/5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-server-title"
          >
            {(preview?.bannerUrl || selectedListItem?.banner_url) && (
              <div className="h-28 bg-app-channel overflow-hidden">
                <img
                  src={preview?.bannerUrl || selectedListItem?.banner_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white overflow-hidden flex-shrink-0 ${
                    preview?.bannerUrl || selectedListItem?.banner_url ? '-mt-10 ring-4 ring-[#2b2d31]' : ''
                  } ${preview?.iconUrl || selectedListItem?.icon_url ? 'bg-transparent' : 'bg-app-channel'}`}
                >
                  {(preview?.iconUrl || selectedListItem?.icon_url) ? (
                    <img
                      src={preview?.iconUrl || selectedListItem?.icon_url}
                      alt=""
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    (preview?.name || selectedListItem?.name || '?')
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 id="community-server-title" className="text-xl font-bold text-white truncate">
                    {preview?.name || selectedListItem?.name || 'Server'}
                  </h3>
                  <p className="text-sm text-app-muted mt-0.5">
                    Owned by {preview?.ownerName || selectedListItem?.ownerName || '…'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 rounded-lg text-app-muted hover:text-app-text hover:bg-app-hover/50"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {previewLoading && (
                <p className="mt-6 text-sm text-app-muted animate-pulse">Loading details…</p>
              )}
              {previewError && (
                <p className="mt-6 text-sm text-red-400">{previewError}</p>
              )}

              {preview && !previewLoading && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[#1e1f22] px-3 py-3 text-center">
                      <div className="text-lg font-semibold text-white">{formatCount(preview.memberCount)}</div>
                      <div className="text-[11px] text-app-muted uppercase tracking-wide">Members</div>
                    </div>
                    <div className="rounded-xl bg-[#1e1f22] px-3 py-3 text-center">
                      <div className="text-lg font-semibold text-[#23a559]">{formatCount(preview.onlineCount)}</div>
                      <div className="text-[11px] text-app-muted uppercase tracking-wide">Online</div>
                    </div>
                    <div className="rounded-xl bg-[#1e1f22] px-3 py-3 text-center">
                      <div className="text-lg font-semibold text-white">{formatCount(preview.channelCount)}</div>
                      <div className="text-[11px] text-app-muted uppercase tracking-wide">Channels</div>
                    </div>
                  </div>

                  {preview.requiresRules && (
                    <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      This server requires accepting the rules before using channels.
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    {memberServerIds.has(preview.id) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentServer(preview.id)
                          setSelectedId(null)
                          onJoinServer?.(preview.id)
                        }}
                        className="flex-1 px-4 py-3 bg-app-accent hover:bg-app-accent-hover text-white rounded-xl font-semibold transition-colors"
                      >
                        Open Server
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleJoinCommunity(preview.id)}
                        disabled={joining}
                        className="flex-1 px-4 py-3 bg-[#23a559] hover:bg-[#1e8c4a] disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
                      >
                        {joining ? 'Joining…' : 'Join Server'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
