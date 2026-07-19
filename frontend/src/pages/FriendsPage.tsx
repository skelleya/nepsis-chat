import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import gsap from 'gsap'
import * as api from '../services/api'
import type { FriendListItem, FriendRequestItem, ProfileType, PublicProfileResult } from '../services/api'
import { useApp } from '../contexts/AppContext'
import { useCall } from '../contexts/CallContext'

type Friend = FriendListItem
type FriendRequest = FriendRequestItem

type FriendsTab = 'all' | 'pending' | 'online' | 'add'

const TAB_ORDER: Record<FriendsTab, number> = {
  all: 0,
  pending: 1,
  online: 2,
  add: 3,
}

interface FriendsPageProps {
  onClose?: () => void
  onOpenDM: (userId: string, username: string) => Promise<void>
  /** When true, opening a DM keeps us on Friends view (doesn't close). When false, opens DM and closes Friends. */
  stayOnFriendsWhenOpeningDM?: boolean
}

function StatusDot({ status }: { status?: string }) {
  const isOnline = status === 'online' || status === 'in-voice'
  const isAway = status === 'away'
  const isDnd = status === 'dnd'
  return (
    <div
      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        isOnline ? 'bg-[#23a559]' : isAway ? 'bg-[#f0b232]' : isDnd ? 'bg-red-500' : 'bg-[#80848e]'
      }`}
      title={status === 'in-voice' ? 'In voice' : status || 'Offline'}
    />
  )
}

export function FriendsPage({ onClose, onOpenDM, stayOnFriendsWhenOpeningDM = true }: FriendsPageProps) {
  const { user } = useApp()
  const call = useCall()
  const pageRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FriendsTab>('all')
  const [displayedTab, setDisplayedTab] = useState<FriendsTab>('all')
  const [switching, setSwitching] = useState(false)
  const [addFriendInput, setAddFriendInput] = useState('')
  const [addAsProfile, setAddAsProfile] = useState<ProfileType>('personal')
  const [acceptAsProfile, setAcceptAsProfile] = useState<ProfileType>('personal')
  const [searchResults, setSearchResults] = useState<PublicProfileResult[]>([])
  const [addFriendLoading, setAddFriendLoading] = useState(false)
  const [addFriendError, setAddFriendError] = useState<string | null>(null)
  const [addFriendSuccess, setAddFriendSuccess] = useState<string | null>(null)
  const isGuest = user?.is_guest ?? true
  const tabsNavRef = useRef<HTMLDivElement>(null)
  const tabIndicatorRef = useRef<HTMLDivElement>(null)
  const tabBtnRefs = useRef<Partial<Record<FriendsTab, HTMLButtonElement | null>>>({})
  const tabContentRef = useRef<HTMLDivElement>(null)
  const tabContentTweenRef = useRef<gsap.core.Tween | null>(null)
  const tabIndicatorReadyRef = useRef(false)
  const slideDirectionRef = useRef(1)
  const pendingTabEnterRef = useRef(false)
  const targetTabRef = useRef<FriendsTab>('all')

  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page) return
    gsap.killTweensOf(page)
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
    return () => {
      gsap.killTweensOf(page)
    }
  }, [])

  const moveTabIndicator = useCallback((animate: boolean) => {
    const track = tabsNavRef.current
    const indicator = tabIndicatorRef.current
    const btn = tabBtnRefs.current[activeTab]
    if (!track || !indicator || !btn) return
    const x = btn.offsetLeft
    const width = btn.offsetWidth
    gsap.killTweensOf(indicator)
    if (!animate || !tabIndicatorReadyRef.current) {
      gsap.set(indicator, { x, width, opacity: 1 })
      tabIndicatorReadyRef.current = true
      return
    }
    gsap.to(indicator, {
      x,
      width,
      duration: 0.35,
      ease: 'power3.inOut',
      force3D: false,
    })
  }, [activeTab])

  useLayoutEffect(() => {
    moveTabIndicator(true)
  }, [moveTabIndicator, friends.length, requests.length])

  useLayoutEffect(() => {
    const content = tabContentRef.current
    if (!content || !pendingTabEnterRef.current) return
    pendingTabEnterRef.current = false
    const direction = slideDirectionRef.current
    tabContentTweenRef.current?.kill()
    tabContentTweenRef.current = gsap.fromTo(
      content,
      { x: 40 * direction, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.35,
        ease: 'power3.out',
        overwrite: true,
        onComplete: () => setSwitching(false),
      }
    )
  }, [displayedTab])

  const switchTab = (next: FriendsTab) => {
    if (next === activeTab || switching) return
    const direction = TAB_ORDER[next] > TAB_ORDER[activeTab] ? 1 : -1
    slideDirectionRef.current = direction
    targetTabRef.current = next
    setActiveTab(next)
    const content = tabContentRef.current
    if (!content || next === displayedTab) {
      setDisplayedTab(next)
      setSwitching(false)
      return
    }
    setSwitching(true)
    tabContentTweenRef.current?.kill()
    tabContentTweenRef.current = gsap.to(content, {
      x: -40 * direction,
      opacity: 0,
      duration: 0.22,
      ease: 'power3.in',
      overwrite: true,
      onComplete: () => {
        pendingTabEnterRef.current = true
        setDisplayedTab(targetTabRef.current)
      },
    })
  }

  const requestClose = useCallback((afterClose?: () => void) => {
    if (closingRef.current) return
    closingRef.current = true
    const page = pageRef.current
    if (!page) {
      onClose?.()
      afterClose?.()
      return
    }
    gsap.killTweensOf(page)
    gsap.to(page, {
      opacity: 0,
      x: 24,
      duration: 0.22,
      ease: 'power2.in',
      force3D: false,
      onComplete: () => {
        onClose?.()
        afterClose?.()
      },
    })
  }, [onClose])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [friendsList, requestsList] = await Promise.all([
        api.getFriendsList(user.id),
        api.getFriendRequests(user.id),
      ])
      setFriends(friendsList)
      setRequests(requestsList)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setFriends([])
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const handleAccept = async (requesterId: string) => {
    if (!user) return
    setActioning(requesterId)
    try {
      await api.acceptFriendRequest(user.id, requesterId, {
        profile: isGuest ? 'personal' : acceptAsProfile,
        visibleProfiles: isGuest ? 'personal' : acceptAsProfile,
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept')
    } finally {
      setActioning(null)
    }
  }

  const handleDecline = async (requesterId: string) => {
    if (!user) return
    setActioning(requesterId)
    try {
      await api.declineFriendRequest(user.id, requesterId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to decline')
    } finally {
      setActioning(null)
    }
  }

  const handleMessage = async (friend: Friend) => {
    try {
      await onOpenDM(friend.id, friend.username)
      if (!stayOnFriendsWhenOpeningDM && onClose) requestClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open DM')
    }
  }

  const handleCall = (friend: Friend) => {
    call.initiateCall(friend.id, friend.username, friend.avatar_url)
    if (onClose) requestClose()
  }

  const handleSearchProfiles = async () => {
    const q = addFriendInput.trim()
    if (!q || q.length < 2) {
      setAddFriendError('Enter at least 2 characters of a display name')
      return
    }
    setAddFriendLoading(true)
    setAddFriendError(null)
    setAddFriendSuccess(null)
    setSearchResults([])
    try {
      const results = await api.searchProfiles(q)
      setSearchResults(results.filter((r) => r.user_id !== user?.id))
      if (!results.length) setAddFriendError('No discoverable profiles found')
    } catch (e) {
      setAddFriendError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setAddFriendLoading(false)
    }
  }

  const handleAddProfile = async (target: PublicProfileResult) => {
    if (!user) return
    setAddFriendLoading(true)
    setAddFriendError(null)
    setAddFriendSuccess(null)
    try {
      if (target.user_id === user.id) {
        setAddFriendError("You can't add yourself as a friend")
        return
      }
      const alreadyFriends = friends.some((f) => f.id === target.user_id)
      if (alreadyFriends) {
        setAddFriendError('You are already friends with this person')
        return
      }
      const alreadyPending = requests.some((r) => r.requester_id === target.user_id)
      if (alreadyPending) {
        setAddFriendError('You already have a pending request from this person')
        return
      }
      await api.sendFriendRequest(
        user.id,
        target.user_id,
        isGuest ? 'personal' : addAsProfile,
        target.profile_type
      )
      setAddFriendSuccess(
        `Request sent to ${target.display_name} (${target.profile_type === 'work' ? 'Work' : 'Personal'})` +
          (!isGuest ? ` from your ${addAsProfile === 'personal' ? 'Personal' : 'Work'} profile` : '')
      )
      setSearchResults((prev) => prev.filter((r) => r.profile_id !== target.profile_id))
      await load()
    } catch (e) {
      setAddFriendError(e instanceof Error ? e.message : 'Failed to send friend request')
    } finally {
      setAddFriendLoading(false)
    }
  }

  const onlineFriends = friends.filter((f) => f.status === 'online' || f.status === 'in-voice')

  const tabs: { id: FriendsTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending', count: requests.length },
    { id: 'online', label: 'Online', count: onlineFriends.length },
    { id: 'add', label: 'Add Friend' },
  ]

  return (
    <div ref={pageRef} className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-app-dark/80 flex-shrink-0">
        {onClose && (
          <button
            onClick={() => requestClose()}
            className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-app-hover transition-colors"
            title="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
        )}
        <h2 className="font-display text-xl font-bold text-white">Friends</h2>
      </div>

      {/* Tabs — GSAP pill + content slide (same rhythm as User Settings) */}
      <div className="px-4 pt-3 pb-2 border-b border-app-dark/50 flex-shrink-0">
        <div ref={tabsNavRef} className="relative flex gap-1 w-fit max-w-full">
          <div
            ref={tabIndicatorRef}
            className="absolute top-0 bottom-0 rounded-lg bg-app-hover/70 pointer-events-none opacity-0 will-change-transform"
            aria-hidden
          />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              ref={(el) => { tabBtnRefs.current[tab.id] = el }}
              onClick={() => switchTab(tab.id)}
              className={`relative z-10 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-app-accent/30 text-app-accent text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-300 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12 text-app-muted">Loading...</div>
        ) : (
        <div ref={tabContentRef} className="will-change-transform">
        {displayedTab === 'add' ? (
          /* Add Friend — compact search */
          <div className="max-w-lg">
            <h3 className="text-sm font-semibold text-app-text mb-1">Add a friend</h3>
            <p className="text-xs text-app-muted mb-4">
              Search by public display name — not login username.
            </p>
            <div className="flex gap-2 items-center mb-3">
              <input
                type="text"
                value={addFriendInput}
                onChange={(e) => setAddFriendInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchProfiles()}
                placeholder="Display name…"
                className="flex-1 min-w-0 px-3 py-2 rounded-md bg-app-channel text-app-text text-sm placeholder-app-muted border border-transparent focus:border-app-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSearchProfiles}
                disabled={addFriendLoading || addFriendInput.trim().length < 2}
                className="px-3 py-2 bg-app-accent hover:bg-app-accent-hover text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {addFriendLoading ? '…' : 'Search'}
              </button>
            </div>
            {!isGuest && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-app-muted">From</span>
                {(['personal', 'work'] as ProfileType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAddAsProfile(type)}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      addAsProfile === type
                        ? 'bg-app-accent/20 text-app-accent'
                        : 'text-app-muted hover:text-app-text'
                    }`}
                  >
                    {type === 'personal' ? 'Personal' : 'Work'}
                  </button>
                ))}
              </div>
            )}
            {addFriendError && (
              <p className="text-sm text-red-400 mb-2">{addFriendError}</p>
            )}
            {addFriendSuccess && (
              <p className="text-sm text-[#23a559] mb-2">{addFriendSuccess}</p>
            )}
            {searchResults.length > 0 && (
              <div className="divide-y divide-app-hover/40 border-t border-app-hover/40">
                {searchResults.map((result) => (
                  <div
                    key={result.profile_id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {result.avatar_url ? (
                        <img src={result.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm">
                          {result.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-app-text truncate">{result.display_name}</div>
                        <div className="text-xs text-app-muted">
                          {result.profile_type === 'work' ? 'Work' : 'Personal'}
                          {result.bio ? ` · ${result.bio}` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddProfile(result)}
                      disabled={addFriendLoading}
                      className="px-3 py-1.5 text-sm bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium disabled:opacity-50 flex-shrink-0"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : displayedTab === 'pending' ? (
          /* Pending requests */
          <div>
            <h3 className="text-sm font-semibold text-app-text mb-3">Friend requests</h3>
            {!isGuest && requests.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-app-muted mb-2">Accept incoming requests under:</p>
                <div className="flex gap-2">
                  {(['personal', 'work'] as ProfileType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAcceptAsProfile(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        acceptAsProfile === type
                          ? 'bg-app-accent text-white'
                          : 'bg-app-channel text-app-muted hover:text-app-text'
                      }`}
                    >
                      {type === 'personal' ? 'Personal' : 'Work'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {requests.length === 0 ? (
              <p className="text-sm text-app-muted">No pending requests.</p>
            ) : (
              <div className="space-y-2">
                {requests.map((req) => (
                  <div
                    key={req.requester_id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-app-channel hover:bg-app-hover"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                        {req.user.avatar_url ? (
                          <img src={req.user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          req.user.username?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-app-text">{req.user.username}</span>
                        <p className="text-xs text-app-muted">
                          Wants to be your friend
                          {req.requester_profile === 'work' ? ' · via Work' : req.requester_profile === 'personal' ? ' · via Personal' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecline(req.requester_id)}
                        disabled={actioning === req.requester_id}
                        className="px-3 py-1.5 text-sm text-app-muted hover:text-red-400 hover:bg-red-500/20 rounded-lg disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAccept(req.requester_id)}
                        disabled={actioning === req.requester_id}
                        className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium disabled:opacity-50"
                      >
                        {actioning === req.requester_id ? 'Accepting...' : 'Accept'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : displayedTab === 'online' ? (
          /* Online friends */
          <div>
            <h3 className="text-sm font-semibold text-app-text mb-3">Online — {onlineFriends.length}</h3>
            {onlineFriends.length === 0 ? (
              <p className="text-sm text-app-muted">No friends online right now.</p>
            ) : (
              <div className="space-y-2">
                {onlineFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-app-channel hover:bg-app-hover"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            friend.username?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="absolute bottom-0 right-0 ring-2 ring-app-channel rounded-full">
                          <StatusDot status={friend.status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-app-text">{friend.username}</span>
                        <span className="text-xs text-app-muted">
                          {friend.status === 'in-voice' ? 'In voice' : 'Online'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMessage(friend)}
                        className="px-3 py-1.5 text-sm text-app-accent hover:bg-app-accent/20 rounded-lg"
                        title="Message"
                      >
                        Message
                      </button>
                      <button
                        onClick={() => handleCall(friend)}
                        className="p-2 rounded-lg text-app-muted hover:text-app-accent hover:bg-app-accent/20 transition-colors"
                        title="Call"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* All friends */
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-app-text">All friends — {friends.length}</h3>
              <button
                type="button"
                onClick={() => switchTab('add')}
                className="text-xs font-medium text-app-accent hover:text-white px-2 py-1 rounded-md hover:bg-app-accent/20 transition-colors shrink-0"
              >
                + Add
              </button>
            </div>
            {friends.length === 0 && requests.length === 0 ? (
              <p className="text-sm text-app-muted">No friends yet. Use + Add to search by display name.</p>
            ) : friends.length === 0 ? (
              <p className="text-sm text-app-muted">No friends yet.</p>
            ) : (
              <div className="space-y-1">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-app-channel"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            friend.username?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="absolute bottom-0 right-0 ring-2 ring-app-dark rounded-full">
                          <StatusDot status={friend.status} />
                        </div>
                      </div>
                      <span className="font-medium text-app-text text-sm">{friend.username}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMessage(friend)}
                        className="px-2.5 py-1 text-xs text-app-accent hover:bg-app-accent/20 rounded-md"
                        title="Message"
                      >
                        Message
                      </button>
                      <button
                        onClick={() => handleCall(friend)}
                        className="p-1.5 rounded-md text-app-muted hover:text-app-accent hover:bg-app-accent/20 transition-colors"
                        title="Call"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
        )}
      </div>
    </div>
  )
}
