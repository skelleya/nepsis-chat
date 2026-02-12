import { useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'
import { useApp } from '../contexts/AppContext'
import { useCall } from '../contexts/CallContext'

interface Friend {
  id: string
  username: string
  avatar_url?: string
  status?: 'online' | 'offline' | 'in-voice' | 'away' | 'dnd'
}

interface FriendRequest {
  requester_id: string
  created_at: string
  user: { id: string; username: string; avatar_url?: string }
}

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
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FriendsTab>('all')
  const [addFriendInput, setAddFriendInput] = useState('')
  const [addFriendLoading, setAddFriendLoading] = useState(false)
  const [addFriendError, setAddFriendError] = useState<string | null>(null)
  const [addFriendSuccess, setAddFriendSuccess] = useState<string | null>(null)

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
      await api.acceptFriendRequest(user.id, requesterId)
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

  const handleAddFriend = async () => {
    const username = addFriendInput.trim()
    if (!username || !user) return
    setAddFriendLoading(true)
    setAddFriendError(null)
    setAddFriendSuccess(null)
    try {
      const found = await api.lookupUserByUsername(username)
      if (!found) {
        setAddFriendError('User not found')
        return
      }
      if (found.id === user.id) {
        setAddFriendError("You can't add yourself as a friend")
        return
      }
      const alreadyFriends = friends.some((f) => f.id === found.id)
      if (alreadyFriends) {
        setAddFriendError('You are already friends with this user')
        return
      }
      const alreadyPending = requests.some((r) => r.requester_id === found.id)
      if (alreadyPending) {
        setAddFriendError('You already have a pending request from this user')
        return
      }
      await api.sendFriendRequest(user.id, found.id)
      setAddFriendSuccess(`Friend request sent to ${found.username}`)
      setAddFriendInput('')
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-app-dark/80 flex-shrink-0">
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
      <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-app-dark/50 flex-shrink-0">
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
          /* Add Friend tab */
          <div>
            <h3 className="text-sm font-semibold text-app-text mb-3">Add by username</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={addFriendInput}
                onChange={(e) => setAddFriendInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                placeholder="Enter username"
                className="flex-1 px-3 py-2 rounded-lg bg-[#2b2d31] text-app-text placeholder-app-muted border border-app-hover/30 focus:border-app-accent focus:outline-none"
              />
              <button
                onClick={handleAddFriend}
                disabled={addFriendLoading || !addFriendInput.trim()}
                className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addFriendLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
            {addFriendError && (
              <p className="text-sm text-red-400 mb-2">{addFriendError}</p>
            )}
            {addFriendSuccess && (
              <p className="text-sm text-[#23a559] mb-2">{addFriendSuccess}</p>
            )}
            <p className="text-xs text-app-muted">
              You can add friends by their username. They must accept your request before you can message them.
            </p>
          </div>
        ) : activeTab === 'pending' ? (
          /* Pending requests */
          <div>
            <h3 className="text-sm font-semibold text-app-text mb-3">Friend requests</h3>
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
                        <p className="text-xs text-app-muted">Wants to be your friend</p>
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
