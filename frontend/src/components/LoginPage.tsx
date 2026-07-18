import { useState, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../services/supabase'

type AuthMode = 'guest' | 'login' | 'signup'

const MODE_ORDER: Record<AuthMode, number> = {
  guest: 0,
  login: 1,
  signup: 2,
}

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('guest')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const { login, loginWithEmail, loginWithUsername } = useApp()
  const pageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const slideDirectionRef = useRef(0)

  useLayoutEffect(() => {
    const page = pageRef.current
    const card = cardRef.current
    if (!page || !card) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        page,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' }
      )
      gsap.fromTo(
        card,
        { opacity: 0, y: 28, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', delay: 0.05 }
      )
    }, page)

    return () => ctx.revert()
  }, [])

  useLayoutEffect(() => {
    const panel = panelRef.current
    const direction = slideDirectionRef.current
    if (!panel || direction === 0) return

    gsap.fromTo(
      panel,
      { x: 40 * direction, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.28,
        ease: 'power2.out',
        onComplete: () => setSwitching(false),
      }
    )
    slideDirectionRef.current = 0
  }, [mode])

  const switchMode = (next: AuthMode) => {
    if (next === mode || switching) return
    const direction = MODE_ORDER[next] > MODE_ORDER[mode] ? 1 : -1
    const panel = panelRef.current
    setError('')
    setMessage('')

    if (!panel) {
      setMode(next)
      return
    }

    setSwitching(true)
    slideDirectionRef.current = direction
    gsap.to(panel, {
      x: -40 * direction,
      opacity: 0,
      duration: 0.18,
      ease: 'power2.in',
      onComplete: () => setMode(next),
    })
  }

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setError('')
    setLoading(true)
    try {
      await login(username.trim())
    } catch {
      setError('Login failed. Try again.')
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!email.includes('@')) {
          setError('Please enter a valid email to create an account')
          setLoading(false)
          return
        }
        if (!supabase) throw new Error('Email auth not configured')
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
        setMessage('Check your email for a confirmation link!')
        setLoading(false)
      } else {
        // Support sign-in with email or username
        if (email.includes('@')) {
          await loginWithEmail(email, password)
        } else {
          await loginWithUsername(email.trim(), password)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed')
      setLoading(false)
    }
  }

  const isElectron = !!(window as any).electronAPI?.isElectron

  return (
    <div
      ref={pageRef}
      className="min-h-screen flex items-center justify-center bg-app-darker"
      style={{ paddingTop: 'var(--download-banner-height, 0px)' }}
    >
      <div ref={cardRef} className="w-full max-w-md p-10 rounded-xl bg-app-dark will-change-transform">
        <img src="./logo.png" alt="Nepsis" className="h-12 mx-auto mb-6 object-contain bg-white rounded-full p-1" />
        <h1 className="text-2xl font-bold text-white text-center mb-8">Nepsis Chat</h1>

        {!isElectron && (
          <p className="text-center mb-6">
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
        <div className="flex mb-8 rounded-lg overflow-hidden bg-app-channel">
          <button
            type="button"
            onClick={() => switchMode('guest')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === 'guest' ? 'bg-app-accent text-white' : 'text-app-muted hover:text-white'
            }`}
          >
            Guest
          </button>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-app-accent text-white' : 'text-app-muted hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-app-accent text-white' : 'text-app-muted hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="overflow-hidden">
          <div ref={panelRef} className="will-change-transform">
            {mode === 'guest' ? (
              <form onSubmit={handleGuestSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm text-app-muted">Username</label>
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
                  disabled={loading || switching}
                  className="w-full py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Continue as Guest'}
                </button>
                <p className="text-app-muted text-xs text-center pt-1">
                  Guest accounts are temporary — no email required
                </p>
              </form>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm text-app-muted">
                    {mode === 'signup' ? 'Email' : 'Email or username'}
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={mode === 'signup' ? 'you@example.com' : 'you@example.com or username'}
                    className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm text-app-muted">Password</label>
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
                  disabled={loading || switching}
                  className="w-full py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
