import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import gsap from 'gsap'
import * as api from '../services/api'
import type { FriendListItem, FriendRequestItem, ProfileType, PublicProfileResult } from '../services/api'
import { useApp } from '../contexts/AppContext'
import { useCall } from '../contexts/CallContext'

type Friend = FriendListItem
type FriendRequest = FriendRequestItem

type FriendsTab = 'all' | 'pending' | 'online' | 'add'

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
        isOnline ? 'bg-[#23a559]' : isAway ? 'bg-yellow-500' : isDnd ? 'bg-red-500' : 'bg-app-muted'
      }`}
      title={status === 'in-voice' ? 'In voice' : status || 'Offline'}
    />
  )
}

export function FriendsPage({ onClose, onOpenDM, stayOnFriendsWhenOpeningDM = true }: FriendsPageProps) {
  const { user } = useApp()
  const call = useCall()
  const pageRef = useRef<HTMLDivElement>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FriendsTab>('all')
  const [addFriendInput, setAddFriendInput] = useState('')
  const [addAsProfile, setAddAsProfile] = useState<ProfileType>('personal')
  const [acceptAsProfile, setAcceptAsProfile] = useState<ProfileType>('personal')
  const [searchResults, setSearchResults] = useState<PublicProfileResult[]>([])
  const [addFriendLoading, setAddFriendLoading] = useState(false)
  const [addFriendError, setAddFriendError] = useState<string | null>(null)
  const [addFriendSuccess, setAddFriendSuccess] = useState<string | null>(null)
  const isGuest = user?.is_guest ?? true

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
      if (!stayOnFriendsWhenOpeningDM && onClose) onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open DM')
    }
  }

  const handleCall = (friend: Friend) => {
    call.initiateCall(friend.id, friend.username, friend.avatar_url)
    if (onClose) onClose()
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
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-app-hover transition-colors"
            title="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
        )}
        <h2 className="text-xl font-bold text-white">Friends</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-1 pb-2 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-app-hover/60 text-white'
                : 'text-app-muted hover:text-app-text hover:bg-app-hover/30'
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-300 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12 text-app-muted">Loading...</div>
        ) : activeTab === 'add' ? (
          /* Add Friend tab — search public profile display names */
          <div>
            <h3 className="text-sm font-semibold text-app-text mb-3">Find by display name</h3>
            <p className="text-xs text-app-muted mb-3">
              Search public identities — not login usernames. Personal and Work can appear as separate people.
            </p>
            {!isGuest && (
              <div className="mb-3">
                <p className="text-xs text-app-muted mb-2">Add them from which of your profiles?</p>
                <div className="flex gap-2">
                  {(['personal', 'work'] as ProfileType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddAsProfile(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        addAsProfile === type
                          ? 'bg-app-accent text-white'
                          : 'bg-[#2b2d31] text-app-muted hover:text-app-text'
                      }`}
                    >
                      {type === 'personal' ? 'Personal' : 'Work'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={addFriendInput}
                onChange={(e) => setAddFriendInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchProfiles()}
                placeholder="Search display name…"
                className="flex-1 px-3 py-2 rounded-lg bg-[#2b2d31] text-app-text placeholder-app-muted border border-app-hover/30 focus:border-app-accent focus:outline-none"
              />
              <button
                onClick={handleSearchProfiles}
                disabled={addFriendLoading || addFriendInput.trim().length < 2}
                className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addFriendLoading ? 'Searching…' : 'Search'}
              </button>
            </div>
            {addFriendError && (
              <p className="text-sm text-red-400 mb-2">{addFriendError}</p>
            )}
            {addFriendSuccess && (
              <p className="text-sm text-[#23a559] mb-2">{addFriendSuccess}</p>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-2 mb-3">
                {searchResults.map((result) => (
                  <div
                    key={result.profile_id}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#2b2d31]"
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
        ) : activeTab === 'pending' ? (
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
                          : 'bg-[#2b2d31] text-app-muted hover:text-app-text'
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
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#2b2d31] hover:bg-[#36373d]"
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
        ) : activeTab === 'online' ? (
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
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#2b2d31] hover:bg-[#36373d]"
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
            <h3 className="text-sm font-semibold text-app-text mb-3">All friends — {friends.length}</h3>
            {friends.length === 0 && requests.length === 0 ? (
              <p className="text-sm text-app-muted">No friends yet. Add friends by username or accept friend requests.</p>
            ) : friends.length === 0 ? (
              <p className="text-sm text-app-muted">No friends yet.</p>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#2b2d31] hover:bg-[#36373d]"
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
                      <span className="font-medium text-app-text">{friend.username}</span>
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
        )}
      </div>
    </div>
  )
}
