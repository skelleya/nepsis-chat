import { useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'
import { useApp } from '../contexts/AppContext'
import { useCall } from '../contexts/CallContext'

interface Friend {
  id: string
  username: string
  avatar_url?: string
}

interface FriendRequest {
  requester_id: string
  created_at: string
  user: { id: string; username: string; avatar_url?: string }
}

interface FriendsPageProps {
  onClose: () => void
  onOpenDM: (userId: string, username: string) => Promise<void>
}

export function FriendsPage({ onClose, onOpenDM }: FriendsPageProps) {
  const { user } = useApp()
  const call = useCall()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)

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
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open DM')
    }
  }

  const handleCall = (friend: Friend) => {
    call.initiateCall(friend.id, friend.username, friend.avatar_url)
    onClose()
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-app-hover transition-colors"
          title="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-white">Friends</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-app-muted">Loading...</div>
      ) : (
        <>
          {/* Friend requests */}
          {requests.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-app-text mb-3">Friend requests</h3>
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
            </div>
          )}

          {/* Friends list */}
          <div>
            <h3 className="text-sm font-semibold text-app-text mb-3">All friends</h3>
            {friends.length === 0 && requests.length === 0 ? (
              <p className="text-sm text-app-muted">No friends yet. Add friends from servers or accept friend requests.</p>
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
                      <div className="w-10 h-10 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                        {friend.avatar_url ? (
                          <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          friend.username?.charAt(0).toUpperCase()
                        )}
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
        </>
      )}
    </div>
  )
}
