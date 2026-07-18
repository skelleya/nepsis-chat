import { useState, useLayoutEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../services/supabase'

type AuthMode = 'guest' | 'login' | 'signup'

const TABS: { id: AuthMode; label: string }[] = [
  { id: 'guest', label: 'Guest' },
  { id: 'login', label: 'Sign In' },
  { id: 'signup', label: 'Sign Up' },
]

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
  const [tab, setTab] = useState<AuthMode>('guest')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const { login, loginWithEmail, loginWithUsername } = useApp()
  const pageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const tabBtnRefs = useRef<Partial<Record<AuthMode, HTMLButtonElement | null>>>({})
  const pendingEnterRef = useRef(false)
  const slideDirectionRef = useRef(1)
  const targetModeRef = useRef<AuthMode>('guest')
  const tabIndicatorReadyRef = useRef(false)

  const moveTabIndicator = useCallback((animate: boolean) => {
    const track = tabsRef.current
    const indicator = indicatorRef.current
    const btn = tabBtnRefs.current[tab]
    if (!track || !indicator || !btn) return

    const trackRect = track.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    const x = btnRect.left - trackRect.left
    const width = btnRect.width

    gsap.killTweensOf(indicator)
    if (!animate || !tabIndicatorReadyRef.current) {
      gsap.set(indicator, { x, width, opacity: 1 })
      tabIndicatorReadyRef.current = true
      return
    }

    gsap.to(indicator, {
      x,
      width,
      duration: 0.55,
      ease: 'power3.inOut',
    })
  }, [tab])

  useLayoutEffect(() => {
    const page = pageRef.current
    const card = cardRef.current
    if (!page || !card) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        page,
        { opacity: 0 },
        { opacity: 1, duration: 0.45, ease: 'sine.out' }
      )
      gsap.fromTo(
        card,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', delay: 0.04 }
      )
    }, page)

    return () => ctx.revert()
  }, [])

  useLayoutEffect(() => {
    moveTabIndicator(true)
  }, [moveTabIndicator])

  useLayoutEffect(() => {
    const onResize = () => moveTabIndicator(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [moveTabIndicator])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel || !pendingEnterRef.current) return
    pendingEnterRef.current = false

    const direction = slideDirectionRef.current
    gsap.killTweensOf(panel)
    gsap.fromTo(
      panel,
      { x: 56 * direction, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
        onComplete: () => setSwitching(false),
      }
    )
  }, [mode])

  const switchMode = (next: AuthMode) => {
    if (next === tab) return
    const direction = MODE_ORDER[next] > MODE_ORDER[tab] ? 1 : -1
    slideDirectionRef.current = direction
    targetModeRef.current = next
    setTab(next)
    setError('')
    setMessage('')

    const panel = panelRef.current
    if (!panel || next === mode) {
      setMode(next)
      setSwitching(false)
      return
    }

    setSwitching(true)
    gsap.killTweensOf(panel)
    gsap.to(panel, {
      x: -56 * direction,
      opacity: 0,
      duration: 0.35,
      ease: 'power3.in',
      overwrite: true,
      onComplete: () => {
        pendingEnterRef.current = true
        setMode(targetModeRef.current)
      },
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

        {/* Mode tabs — sliding GSAP indicator */}
        <div
          ref={tabsRef}
          className="relative flex mb-8 rounded-lg bg-app-channel p-1"
          role="tablist"
          aria-label="Account type"
        >
          <div
            ref={indicatorRef}
            className="absolute top-1 bottom-1 left-0 rounded-md bg-app-accent shadow-sm will-change-transform pointer-events-none opacity-0"
            aria-hidden
          />
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              ref={(el) => { tabBtnRefs.current[id] = el }}
              onClick={() => switchMode(id)}
              className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-md transition-colors duration-300 ${
                tab === id ? 'text-white' : 'text-app-muted hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden h-[268px] -mx-1 px-1">
          <div ref={panelRef} className="will-change-transform h-full">
            {mode === 'guest' ? (
              <form onSubmit={handleGuestSubmit} className="flex h-full flex-col gap-6">
                <div className="space-y-3">
                  <label className="block text-sm text-app-muted">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter a username"
                    className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                  />
                  <p className="text-app-muted text-xs text-center pt-1">
                    Guest accounts are temporary — no email required
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading || switching}
                  className="mt-auto w-full py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Continue as Guest'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleEmailSubmit} className="flex h-full flex-col gap-6">
                <div className="space-y-6">
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
                </div>
                <button
                  type="submit"
                  disabled={loading || switching}
                  className="mt-auto w-full py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors disabled:opacity-50"
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
