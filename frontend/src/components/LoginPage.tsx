import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../services/supabase'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'guest' | 'login' | 'signup'>('guest')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, loginWithEmail } = useApp()

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setError('')
    setLoading(true)
    try {
      await login(username.trim())
    } catch {
      setError('Login failed. Try again.')
    }
    setLoading(false)
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!supabase) throw new Error('Email auth not configured')
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
        setMessage('Check your email for a confirmation link!')
      } else {
        await loginWithEmail(email, password)
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed')
    }
    setLoading(false)
  }

  const isElectron = !!(window as any).electronAPI?.isElectron

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-darker">
      <div className="w-full max-w-md p-8 rounded-xl bg-app-dark">
        <img src="./logo.png" alt="Nepsis" className="h-12 mx-auto mb-6 object-contain bg-white rounded-full p-1" />
        <h1 className="text-2xl font-bold text-white text-center mb-6">Nepsis Chat</h1>

        {!isElectron && (
          <p className="text-center mb-4">
            <Link to="/download" className="text-app-accent hover:underline text-sm">Download desktop app</Link>
          </p>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-300 text-sm text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/20 text-green-300 text-sm text-center">
            {message}
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex mb-6 rounded-lg overflow-hidden bg-app-channel">
          <button
            onClick={() => { setMode('guest'); setError(''); setMessage('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'guest' ? 'bg-app-accent text-white' : 'text-app-muted hover:text-white'
            }`}
          >
            Guest
          </button>
          <button
            onClick={() => { setMode('login'); setError(''); setMessage('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-app-accent text-white' : 'text-app-muted hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setMessage('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-app-accent text-white' : 'text-app-muted hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {mode === 'guest' ? (
          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-app-muted mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter a username"
                className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Continue as Guest'}
            </button>
            <p className="text-app-muted text-xs text-center">
              Guest accounts are temporary — no email required
            </p>
          </form>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-app-muted mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-app-muted mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
