import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as api from '../services/api'
import { useApp } from '../contexts/AppContext'

export function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useApp()
  const [invite, setInvite] = useState<{
    code: string
    server: { id: string; name: string; iconUrl?: string }
    inviter: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!code) {
      setError('Invalid invite link')
      return
    }
    api
      .getInviteByCode(code)
      .then((data) => setInvite(data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Invite not found'))
  }, [code])

  const handleJoin = async () => {
    if (!user || !code || !invite) return
    setJoining(true)
    try {
      const { serverId } = await api.joinViaInvite(code, user.id)
      sessionStorage.setItem('joinServerId', serverId)
      navigate(`/`)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  const handleOpenApp = () => {
    navigate('/')
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#313338] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-[#2b2d31] p-8 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Invite</h1>
          <p className="text-app-muted mb-6">{error}</p>
          <button
            onClick={handleOpenApp}
            className="px-6 py-2.5 bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            Back to App
          </button>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-[#313338] flex flex-col items-center justify-center p-6">
        <div className="animate-pulse text-app-muted">Loading invite...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#313338] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-[#2b2d31] p-8 shadow-xl text-center">
        <div className="w-20 h-20 rounded-2xl bg-app-channel flex items-center justify-center text-3xl font-bold text-white mb-4 mx-auto">
          {invite.server.iconUrl ? (
            <img src={invite.server.iconUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
          ) : (
            invite.server.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
          )}
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{invite.server.name}</h1>
        <p className="text-app-muted mb-6">
          {invite.inviter} has invited you to join
        </p>

        {user ? (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full px-6 py-3 bg-[#23a559] hover:bg-[#1e8c4a] disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
          >
            {joining ? 'Joining...' : 'Join Server'}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-app-muted">You need to log in to join this server.</p>
            <button
              onClick={handleOpenApp}
              className="w-full px-6 py-3 bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-semibold transition-colors"
            >
              Log In to Join
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
