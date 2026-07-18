import { useState, useLayoutEffect, useRef, useCallback, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useApp } from '../contexts/AppContext'
import { toApiError } from '../services/api'
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

const COIN_SIZE = 48
const COIN_THICKNESS = 5
const COIN_LAYERS = 6

/** Stacked discs along Z — reliable thickness when spun on edge (no fragile cylinder mesh). */
function NepsisCoin({ coinRef }: { coinRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={coinRef}
      className="relative"
      style={{
        width: COIN_SIZE,
        height: COIN_SIZE,
        transformStyle: 'preserve-3d',
      }}
    >
      {Array.from({ length: COIN_LAYERS }, (_, i) => {
        const t = i / (COIN_LAYERS - 1)
        const z = (t - 0.5) * COIN_THICKNESS
        const isFront = i === COIN_LAYERS - 1
        const isBack = i === 0
        const isFace = isFront || isBack
        return (
          <div
            key={i}
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              transform: `translateZ(${z}px)`,
              background: isFace
                ? '#ffffff'
                : 'linear-gradient(180deg, #d0d0d0 0%, #f3f3f3 45%, #c4c4c4 100%)',
              boxShadow: isFace ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : undefined,
            }}
          >
            {isFace && (
              <img
                src="./logo.png"
                alt=""
                className={`h-full w-full object-contain p-1 select-none ${isBack ? 'scale-x-[-1]' : ''}`}
                draggable={false}
              />
            )}
          </div>
        )
      })}
    </div>
  )
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
  const fieldsRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const tabBtnRefs = useRef<Partial<Record<AuthMode, HTMLButtonElement | null>>>({})
  const coinWrapRef = useRef<HTMLDivElement>(null)
  const coinRef = useRef<HTMLDivElement>(null)
  const pendingEnterRef = useRef(false)
  const slideDirectionRef = useRef(1)
  const targetModeRef = useRef<AuthMode>('guest')
  const tabIndicatorReadyRef = useRef(false)
  const fieldsClosedRef = useRef(false)

  const closeCredentialFields = () =>
    new Promise<void>((resolve) => {
      const el = fieldsRef.current
      if (!el || fieldsClosedRef.current) {
        resolve()
        return
      }
      fieldsClosedRef.current = true
      gsap.killTweensOf(el)
      gsap.set(el, { height: el.scrollHeight, overflow: 'hidden' })
      gsap.to(el, {
        height: 0,
        opacity: 0,
        y: -10,
        duration: 0.32,
        ease: 'power2.in',
        force3D: false,
        onComplete: () => resolve(),
      })
    })

  const openCredentialFields = () =>
    new Promise<void>((resolve) => {
      const el = fieldsRef.current
      if (!el) {
        fieldsClosedRef.current = false
        resolve()
        return
      }
      if (!fieldsClosedRef.current) {
        resolve()
        return
      }
      fieldsClosedRef.current = false
      gsap.killTweensOf(el)
      // Measure natural height, then animate open from collapsed
      gsap.set(el, { height: 'auto', opacity: 0, y: -8, overflow: 'hidden' })
      const target = el.offsetHeight
      gsap.fromTo(
        el,
        { height: 0, opacity: 0, y: -8 },
        {
          height: target,
          opacity: 1,
          y: 0,
          duration: 0.34,
          ease: 'power2.out',
          force3D: false,
          onComplete: () => {
            gsap.set(el, { height: 'auto', clearProps: 'overflow,y' })
            resolve()
          },
        }
      )
    })

  // Coin spin: native listeners + inertia ticker (instant drag, free coast, reverse brakes)
  useLayoutEffect(() => {
    const wrap = coinWrapRef.current
    const coin = coinRef.current
    if (!wrap || !coin) return

    gsap.set(coin, {
      transformOrigin: '50% 50%',
      transformStyle: 'preserve-3d',
      force3D: true,
      rotationY: 0,
    })

    // Unit is required — without 'deg', non-zero quickSetter values are ignored
    const setRot = gsap.quickSetter(coin, 'rotationY', 'deg') as (value: number) => void
    let rotation = 0
    let velocity = 0 // deg per tick-unit (scaled by deltaRatio)
    let lastX: number | null = null
    let hovering = false
    const MAX_VEL = 170

    const onEnter = (e: PointerEvent) => {
      hovering = true
      lastX = e.clientX
    }

    const onMove = (e: PointerEvent) => {
      hovering = true
      const x = e.clientX
      const delta = lastX == null ? (e.movementX || 0) : x - lastX
      lastX = x
      if (!delta) return

      // Instant spin with the cursor
      rotation += delta * 1.65
      setRot(rotation)

      // Fast swipes add extra momentum; opposite direction still brakes/reverses
      const speedBoost = Math.min(2.4, 1 + Math.abs(delta) / 22)
      velocity += delta * 1.2 * speedBoost
      velocity = Math.max(-MAX_VEL, Math.min(MAX_VEL, velocity))
    }

    const onLeave = () => {
      hovering = false
      lastX = null
    }

    const tick = () => {
      const d = gsap.ticker.deltaRatio()
      if (hovering) {
        // Light damping only — pointer owns the live spin
        velocity *= Math.pow(0.9, d)
        return
      }

      // Coast with friction until nearly stopped (do not keep seeking the next face)
      if (Math.abs(velocity) > 0.08) {
        rotation += velocity * d
        // High speed coasts a bit longer after a fast swipe
        const friction = Math.abs(velocity) > 50 ? 0.945 : 0.915
        velocity *= Math.pow(friction, d)
        setRot(rotation)
        return
      }

      velocity = 0
      // Ease back to original front-facing orientation (0°, ±360°, …)
      const target = Math.round(rotation / 360) * 360
      const err = target - rotation
      if (Math.abs(err) < 0.15) {
        if (rotation !== target) {
          rotation = target
          setRot(rotation)
        }
        return
      }
      rotation += err * (1 - Math.pow(0.88, d))
      setRot(rotation)
    }

    wrap.addEventListener('pointerenter', onEnter)
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)
    gsap.ticker.add(tick)

    return () => {
      wrap.removeEventListener('pointerenter', onEnter)
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
      gsap.ticker.remove(tick)
    }
  }, [])

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
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: 'power3.out',
          delay: 0.04,
          force3D: false,
          clearProps: 'transform',
        }
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
    if (next === tab || loading) return
    const direction = MODE_ORDER[next] > MODE_ORDER[tab] ? 1 : -1
    slideDirectionRef.current = direction
    targetModeRef.current = next
    setTab(next)
    setError('')
    setMessage('')
    fieldsClosedRef.current = false

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
    if (!username.trim() || loading) return
    setError('')
    setLoading(true)
    await closeCredentialFields()
    try {
      await login(username.trim())
    } catch (err) {
      setError(toApiError(err, 'Login failed. Try again.').message)
      setLoading(false)
      await openCredentialFields()
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim() || loading) return
    setError('')
    setMessage('')

    if (mode === 'signup' && !email.includes('@')) {
      setError('Please enter a valid email to create an account')
      return
    }

    setLoading(true)
    await closeCredentialFields()

    try {
      if (mode === 'signup') {
        if (!supabase) throw new Error('Email auth not configured')
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
        setMessage('Check your email for a confirmation link!')
        setLoading(false)
        await openCredentialFields()
      } else {
        // Support sign-in with email or username (same field)
        if (email.includes('@')) {
          await loginWithEmail(email, password)
        } else {
          await loginWithUsername(email.trim(), password)
        }
        // Success: AppContent will unmount login when `user` is set.
        // If we're somehow still here, stop the spinner.
        setLoading(false)
      }
    } catch (err: unknown) {
      setError(toApiError(err, 'Authentication failed').message)
      setLoading(false)
      await openCredentialFields()
    }
  }

  const isElectron = !!(window as any).electronAPI?.isElectron

  return (
    <div
      ref={pageRef}
      className="fixed inset-0 flex items-center justify-center bg-app-darker"
    >
      <div ref={cardRef} className="w-full max-w-md p-10 rounded-xl bg-app-dark">
        <div
          ref={coinWrapRef}
          className="mx-auto mb-6 flex items-center justify-center cursor-grab active:cursor-grabbing"
          style={{
            width: 80,
            height: 80,
            perspective: 900,
            transformStyle: 'preserve-3d',
            overflow: 'visible',
          }}
          role="img"
          aria-label="Nepsis"
        >
          <div className="pointer-events-none">
            <NepsisCoin coinRef={coinRef} />
          </div>
        </div>
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
              <form onSubmit={handleGuestSubmit} className="h-full">
                <div ref={fieldsRef} className="flex h-full flex-col gap-6 origin-top">
                  <div className="space-y-3">
                    <label className="block text-sm text-app-muted">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter a username"
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent disabled:opacity-60"
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
                </div>
              </form>
            ) : (
              <form onSubmit={handleEmailSubmit} className="h-full">
                <div ref={fieldsRef} className="flex h-full flex-col gap-6 origin-top">
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
                        disabled={loading}
                        className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm text-app-muted">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={loading}
                        className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent disabled:opacity-60"
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
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
